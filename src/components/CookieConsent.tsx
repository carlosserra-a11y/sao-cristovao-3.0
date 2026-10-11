import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cookie } from 'lucide-react';
import { ACCEPT_ALL, REJECT_ALL, type ConsentCategory } from '../../shared/consent';
import { onOpenCookiePreferences, saveConsent, useConsent } from '../lib/consent';

interface CategoryInfo {
  key: ConsentCategory;
  label: string;
  description: string;
  locked?: boolean;
}

const CATEGORIES: readonly CategoryInfo[] = [
  {
    key: 'necessary',
    label: 'Necessários',
    description:
      'Guardam o seu carrinho neste aparelho e a sua escolha sobre cookies. O site não funciona direito sem eles, por isso não podem ser desligados.',
    locked: true,
  },
  {
    key: 'analytics',
    label: 'Estatísticas',
    description:
      'Ajudam a entender quais partes do cardápio são mais vistas, de forma agregada, para melhorarmos o site. Desligado, nada é medido.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      'Permitem medir anúncios e mostrar ofertas do São Cristóvão em outros sites. Desligado, nenhum rastreador de anúncios é carregado.',
  },
];

// Os dois botões de decisão têm o MESMO peso visual: recusar não pode ser mais difícil que aceitar.
const decisionButton =
  'flex-1 min-h-11 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-sm transition-colors cursor-pointer';
const linkClass = 'underline underline-offset-2 hover:text-amber-300';

/**
 * Banner de cookies (LGPD). Aparece enquanto não houver escolha válida e pode
 * ser reaberto pelo rodapé. Não bloqueia a página: o visitante continua
 * navegando e pedindo normalmente. Renderizado em portal no <body> para
 * continuar visível/acessível mesmo com modais abertos (o #root fica `inert`).
 */
export const CookieConsent: React.FC = () => {
  const { record, choices } = useConsent();
  const [reopened, setReopened] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<Record<ConsentCategory, boolean>>(REJECT_ALL);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const visible = record === null || reopened;

  useEffect(
    () =>
      onOpenCookiePreferences(() => {
        setDraft(choices ?? REJECT_ALL);
        setCustomizing(true);
        setReopened(true);
      }),
    [choices]
  );

  // Ao abrir pelo rodapé, leva o foco ao painel (leitores de tela e teclado).
  useEffect(() => {
    if (reopened) panelRef.current?.focus();
  }, [reopened]);

  if (!visible) return null;

  const decide = (next: Record<ConsentCategory, boolean>) => {
    saveConsent(next);
    setReopened(false);
    setCustomizing(false);
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:max-w-md outline-none"
    >
      <div className="m-2 sm:m-0 p-5 rounded-2xl bg-[#121216] border border-white/15 shadow-2xl shadow-black/70 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center gap-2.5 mb-2">
          <Cookie className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
          <h2 id={titleId} className="text-base font-extrabold text-white font-display">
            Sua privacidade
          </h2>
        </div>

        {!customizing ? (
          <>
            <p className="text-xs leading-relaxed text-zinc-300">
              Usamos o armazenamento necessário para o carrinho funcionar. Cookies de estatísticas e de marketing só são
              ativados se você permitir — e você pode mudar de ideia quando quiser pelo rodapé. Saiba mais na{' '}
              <a href="#cookies" className={linkClass}>
                Política de Cookies
              </a>{' '}
              e na{' '}
              <a href="#privacidade" className={linkClass}>
                Política de Privacidade
              </a>
              .
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button type="button" className={decisionButton} onClick={() => decide(REJECT_ALL)}>
                Rejeitar não essenciais
              </button>
              <button type="button" className={decisionButton} onClick={() => decide(ACCEPT_ALL)}>
                Aceitar todos
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft(choices ?? REJECT_ALL);
                setCustomizing(true);
              }}
              className="mt-2 w-full min-h-11 px-4 py-2 rounded-xl border border-white/20 hover:border-amber-400/60 text-white text-sm font-bold transition-colors cursor-pointer"
            >
              Personalizar
            </button>
          </>
        ) : (
          <>
            <ul className="mt-3 space-y-3">
              {CATEGORIES.map((category) => {
                const inputId = `${titleId}-${category.key}`;
                return (
                  <li key={category.key} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={inputId} className="text-sm font-bold text-white">
                        {category.label}
                        {category.locked && <span className="ml-2 text-[11px] font-semibold text-zinc-400">sempre ativo</span>}
                      </label>
                      <input
                        id={inputId}
                        type="checkbox"
                        role="switch"
                        checked={draft[category.key]}
                        disabled={category.locked}
                        onChange={(event) => setDraft((prev) => ({ ...prev, [category.key]: event.target.checked }))}
                        className="w-5 h-5 accent-amber-400 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">{category.description}</p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button type="button" className={decisionButton} onClick={() => decide(draft)}>
                Salvar minhas escolhas
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomizing(false);
                  if (record !== null) setReopened(false);
                }}
                className="min-h-11 px-4 py-2.5 rounded-xl border border-white/20 text-white text-sm font-bold hover:border-amber-400/60 cursor-pointer"
              >
                {record !== null ? 'Fechar' : 'Voltar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
