import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Plus, Check, ShoppingBag, ArrowRight, Sparkles, SlidersHorizontal, Info } from 'lucide-react';
import { CartItem, MenuItem } from '../types/burger';
import { MENU_ITEMS } from '../data/menuData';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';
import { Dialog, DialogCloseButton } from './ui/Dialog';
import { SafeImage } from './ui/SafeImage';
import { api, ApiRequestError, hasBackend, isBackendUnavailable } from '../lib/api';
import { createId, formatBRL, formatClock } from '../lib/format';
import { CHAT_LIMITS, ChatModel, ChatRoleMode } from '../../shared/api';
import { STORE } from '../../shared/storeConfig';
import {
  AssistantSuggestion,
  extractItemMentions,
  findRequestedItems,
  respond,
} from '../../shared/orderAssistant';

interface OrderAssistantProps {
  onClose: () => void;
  initialQuery?: string | null;
  cart: CartItem[];
  isOpenStore: boolean;
  onAddItem: (item: MenuItem, quantity: number) => void;
  onCustomize: (item: MenuItem) => void;
  onCheckout: () => void;
}

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: AssistantSuggestion[];
  quickReplies?: string[];
  isError?: boolean;
}

const MODEL_BY_ROLE: Record<ChatRoleMode, ChatModel> = {
  fast: 'gemini-3.1-flash-lite',
  sommelier: 'gemini-3.5-flash',
  expert: 'gemini-3.1-pro-preview',
};

const ROLE_LABELS: Record<ChatRoleMode, string> = {
  fast: 'Rápido',
  sommelier: 'Sommelier',
  expert: 'Mestre hamburgueiro',
};

const MENU_BY_ID = new Map(MENU_ITEMS.map((item) => [item.id, item]));
const LOCAL_REPLY_DELAY_MS = 350;

const WELCOME: AssistantMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Olá! 👋 Sou o atendente do **${STORE.name}**. Posso montar seu pedido por aqui — escreva, por exemplo, "quero 2 Cristovão Bacon e uma Coca" ou "combo para casal".`,
  timestamp: 'Agora',
  quickReplies: ['Mais vendidos', 'Combo para 2 pessoas', 'Bebidas', 'Horário e entrega'],
};

// A conversa sobrevive a fechar/abrir o painel (só em memória — nada é gravado no aparelho).
let conversationMemory: AssistantMessage[] = [WELCOME];

/** **negrito** do Markdown sem innerHTML (sem risco de XSS). */
function renderRichText(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4 ? (
      <strong key={i} className="font-bold text-white">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{chunk}</React.Fragment>
    )
  );
}

/** Une sugestões sem repetir itens (a primeira ocorrência mantém a quantidade). */
function mergeSuggestions(...lists: AssistantSuggestion[][]): AssistantSuggestion[] {
  const map = new Map<string, AssistantSuggestion>();
  for (const list of lists) for (const s of list) if (!map.has(s.itemId)) map.set(s.itemId, s);
  return [...map.values()].slice(0, 4);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Atendente de pedidos.
 *
 * - Com servidor + Gemini: o Gemini responde (prompt gerado do cardápio) e o
 *   motor local transforma itens citados/pedidos em cartões "Adicionar".
 * - Sem servidor (site estático) ou com a IA indisponível: o motor local
 *   (shared/orderAssistant.ts) responde sozinho — mesmo cardápio e regras.
 * - "Finalizar pedido" abre o carrinho para nome, celular e endereço.
 */
const OrderAssistant: React.FC<OrderAssistantProps> = ({
  onClose,
  initialQuery,
  cart,
  isOpenStore,
  onAddItem,
  onCustomize,
  onCheckout,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>(conversationMemory);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roleMode, setRoleMode] = useState<ChatRoleMode>('sommelier');
  const [showSettings, setShowSettings] = useState(false);
  const [aiStatus, setAiStatus] = useState<'ai' | 'local'>(hasBackend ? 'ai' : 'local');
  const [added, setAdded] = useState<Record<string, number>>({});

  const messagesRef = useRef(messages);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSentRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
    conversationMemory = messages;
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cartSummary = useMemo(
    () => ({
      count: cart.reduce((sum, ci) => sum + ci.quantity, 0),
      total: cart.reduce((sum, ci) => sum + ci.totalPrice, 0),
      lines: cart.map((ci) => ({ name: ci.item.name, quantity: ci.quantity, total: ci.totalPrice })),
    }),
    [cart]
  );

  const pushAssistant = (content: string, extra: Partial<AssistantMessage> = {}) =>
    setMessages((prev) => [
      ...prev,
      { id: createId('bot'), role: 'assistant', content, timestamp: formatClock(), ...extra },
    ]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim().slice(0, CHAT_LIMITS.maxMessageLength);
      if (!text || loadingRef.current) return;

      const userMessage: AssistantMessage = { id: createId('user'), role: 'user', content: text, timestamp: formatClock() };
      const history = [...messagesRef.current, userMessage];
      setMessages(history);
      setInput('');
      setIsLoading(true);
      loadingRef.current = true;

      const local = respond(text, { isOpen: isOpenStore, cart: cartSummary.lines });

      try {
        // Ações do pedido são sempre tratadas localmente (rápidas e determinísticas).
        if (local.action === 'checkout') {
          await wait(LOCAL_REPLY_DELAY_MS);
          pushAssistant(local.text);
          onCheckout();
          return;
        }

        if (!hasBackend || local.action === 'open_cart') {
          await wait(LOCAL_REPLY_DELAY_MS);
          pushAssistant(local.text, { suggestions: local.suggestions, quickReplies: local.quickReplies });
          return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        const { data, meta } = await api.chat(
          {
            messages: history
              .filter((m) => !m.isError && m.id !== 'welcome')
              .slice(-CHAT_LIMITS.maxMessages)
              .map((m) => ({ role: m.role, content: m.content.slice(0, CHAT_LIMITS.maxMessageLength) })),
            role: roleMode,
            modelPreference: MODEL_BY_ROLE[roleMode],
          },
          controller.signal
        );
        setAiStatus(meta?.fallback ? 'local' : 'ai');
        pushAssistant(data.reply, {
          // Pedido explícito do cliente ("quero 2 cocas") + itens citados pela IA.
          suggestions: mergeSuggestions(findRequestedItems(text), extractItemMentions(data.reply)),
          quickReplies: local.quickReplies,
        });
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === 'ABORTED') return;
        if (isBackendUnavailable(err) || (err instanceof ApiRequestError && err.status >= 500)) {
          setAiStatus('local');
          pushAssistant(local.text, { suggestions: local.suggestions, quickReplies: local.quickReplies });
          return;
        }
        pushAssistant(
          err instanceof ApiRequestError ? err.message : 'Tive um problema para responder. Tente novamente.',
          { isError: true, quickReplies: local.quickReplies }
        );
      } finally {
        abortRef.current = null;
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    // pushAssistant só usa setMessages (estável).
    [input, isOpenStore, cartSummary.lines, onCheckout, roleMode]
  );

  // Pergunta inicial (ex.: "Perguntar à IA" no detalhe de um item) — enviada uma vez.
  useEffect(() => {
    if (initialSentRef.current || !initialQuery?.trim()) return;
    initialSentRef.current = true;
    void send(initialQuery);
  }, [initialQuery, send]);

  const handleAdd = (item: MenuItem, quantity: number) => {
    onAddItem(item, quantity);
    setAdded((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + quantity }));
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const titleId = 'assistant-title';
  const descriptionId = 'assistant-description';

  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descriptionId}
      variant="panel"
      initialFocusRef={inputRef}
      panelClassName="w-full h-[100dvh] sm:w-[420px] sm:h-[min(700px,calc(100dvh-2.5rem))] bg-[#121216] sm:border sm:border-white/10 sm:rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.75)] flex flex-col"
    >
      {/* Cabeçalho */}
      <div className="px-4 py-3.5 border-b border-white/10 bg-gradient-to-r from-amber-500/15 via-transparent to-transparent flex items-center justify-between gap-3 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <SaoCristovaoLogo size={42} alt="" />
            <span
              aria-hidden="true"
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#121216]"
            />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="font-extrabold text-white text-base leading-tight font-sans">
              Atendente {STORE.shortName}
            </h2>
            <p id={descriptionId} className="text-[11px] text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" aria-hidden="true" />
              {aiStatus === 'ai' ? 'IA Gemini · ajuda você a montar o pedido' : 'Atendente virtual · ajuda você a montar o pedido'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasBackend && (
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              aria-controls="assistant-settings"
              aria-label="Configurações do atendente"
              className="p-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          <DialogCloseButton onClose={onClose} label="Fechar atendente" />
        </div>
      </div>

      {hasBackend && showSettings && (
        <div id="assistant-settings" className="px-4 py-3 border-b border-white/10 bg-black/40">
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-2">Estilo do atendente</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ROLE_LABELS) as ChatRoleMode[]).map((mode) => (
                <label
                  key={mode}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400 ${
                    roleMode === mode ? 'bg-amber-400 text-black border-amber-400' : 'bg-zinc-900 text-zinc-200 border-white/15'
                  }`}
                >
                  <input
                    type="radio"
                    name="assistant-role"
                    value={mode}
                    checked={roleMode === mode}
                    onChange={() => setRoleMode(mode)}
                    className="sr-only"
                  />
                  {ROLE_LABELS[mode]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {aiStatus === 'local' && hasBackend && (
        <p className="px-4 py-2 text-[11px] text-amber-100 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          IA temporariamente indisponível — respondendo com o atendente automático.
        </p>
      )}

      {/* Conversa */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversa com o atendente"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2`}>
              <div
                className={`max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  isUser
                    ? 'bg-amber-400 text-black font-medium rounded-br-md'
                    : msg.isError
                      ? 'bg-red-500/10 text-red-100 border border-red-400/30 rounded-bl-md'
                      : 'bg-white/[0.06] text-zinc-100 border border-white/10 rounded-bl-md'
                }`}
              >
                <span className="sr-only">{isUser ? 'Você: ' : 'Atendente: '}</span>
                <div className="whitespace-pre-wrap break-words">{isUser ? msg.content : renderRichText(msg.content)}</div>
                <div className={`text-[10px] mt-1 text-right ${isUser ? 'text-black/60' : 'text-zinc-400'}`}>{msg.timestamp}</div>
              </div>

              {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                <ul className="w-full max-w-[94%] space-y-2" aria-label="Itens sugeridos">
                  {msg.suggestions.map(({ itemId, quantity }) => {
                    const item = MENU_BY_ID.get(itemId);
                    if (!item) return null;
                    const addedCount = added[itemId] ?? 0;
                    return (
                      <li
                        key={itemId}
                        className="flex items-center gap-3 p-2.5 rounded-2xl bg-black/50 border border-amber-400/25"
                      >
                        <SafeImage
                          src={item.image}
                          alt=""
                          width={56}
                          height={56}
                          responsiveWidths={[120]}
                          sizes="56px"
                          className="w-14 h-14 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white line-clamp-2">{item.name}</p>
                          <p className="text-xs font-mono font-bold text-amber-400">
                            {quantity > 1 ? `${quantity}x · ${formatBRL(item.price * quantity)}` : formatBRL(item.price)}
                          </p>
                          <button
                            type="button"
                            onClick={() => onCustomize(item)}
                            className="text-[11px] text-zinc-300 underline underline-offset-2 hover:text-white cursor-pointer"
                          >
                            Personalizar
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdd(item, quantity)}
                          aria-label={`Adicionar ${quantity > 1 ? `${quantity} unidades de ` : ''}${item.name} ao carrinho`}
                          className={`shrink-0 min-h-10 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer ${
                            addedCount > 0 ? 'bg-green-500 text-black' : 'bg-amber-400 hover:bg-amber-300 text-black'
                          }`}
                        >
                          {addedCount > 0 ? (
                            <>
                              <Check className="w-4 h-4" aria-hidden="true" />
                              {addedCount}
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" aria-hidden="true" />
                              Adicionar
                            </>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isUser && msg.id === lastAssistantId && !isLoading && msg.quickReplies && msg.quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Respostas rápidas">
                  {msg.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => void send(reply === 'Horário e entrega' ? 'Qual o horário e a taxa de entrega?' : reply)}
                      className="min-h-9 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 border border-white/15 text-zinc-100 hover:border-amber-400/70 cursor-pointer"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/10 w-fit" role="status">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
            <span className="sr-only">O atendente está digitando…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Resumo do carrinho */}
      {cartSummary.count > 0 && (
        <div className="px-4 py-2.5 border-t border-white/10 bg-black/60 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-200 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-400" aria-hidden="true" />
            {cartSummary.count} {cartSummary.count === 1 ? 'item' : 'itens'} · <strong className="text-white">{formatBRL(cartSummary.total)}</strong>
          </p>
          <button
            type="button"
            onClick={onCheckout}
            className="min-h-10 px-3.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            Finalizar pedido
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="p-3 border-t border-white/10 bg-black/80 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <label htmlFor="assistant-input" className="sr-only">
          Mensagem para o atendente
        </label>
        <input
          ref={inputRef}
          id="assistant-input"
          type="text"
          value={input}
          maxLength={CHAT_LIMITS.maxMessageLength}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ex.: "quero 2 Cristovão Bacon e uma Coca"'
          className="flex-1 min-w-0 px-4 py-3 bg-zinc-900 border border-white/15 rounded-2xl text-base sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Enviar mensagem"
          className="w-12 h-12 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-black flex items-center justify-center cursor-pointer"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </Dialog>
  );
};

export default OrderAssistant;
