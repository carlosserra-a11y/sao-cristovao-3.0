import type { MenuItem } from './menuTypes.ts';
import { MENU_ITEMS } from './menuData.ts';
import { STORE, STORE_ETA_LABEL, STORE_HOURS_LABEL, STORE_LOCATION, STORE_NEIGHBORHOODS_LABEL, brl } from './storeConfig.ts';

/**
 * Motor do atendente de pedidos (sem IA externa).
 *
 * Usado em três situações, sempre com as MESMAS regras:
 *  1. Site estático (GitHub Pages) — não há servidor nem Gemini.
 *  2. Servidor sem Gemini disponível — resposta de contingência.
 *  3. Junto com o Gemini — detecta pedidos explícitos ("quero 2 cocas") e os
 *     itens citados na resposta da IA para oferecer o botão "Adicionar".
 *
 * Tudo é derivado do cardápio (shared/menuData.ts) e das configurações
 * (shared/storeConfig.ts): ao mudar um preço ou item, o atendente acompanha.
 */

export interface AssistantSuggestion {
  itemId: string;
  quantity: number;
}

export type AssistantAction = 'checkout' | 'open_cart';

export interface AssistantCartLine {
  name: string;
  quantity: number;
  total: number;
}

export interface AssistantContext {
  isOpen?: boolean;
  cart?: readonly AssistantCartLine[];
}

export interface AssistantReply {
  text: string;
  suggestions: AssistantSuggestion[];
  quickReplies: string[];
  action?: AssistantAction;
}

// ---------------------------------------------------------------------------
// Normalização e tokens
// ---------------------------------------------------------------------------

export const normalizeText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Palavras que não identificam um produto. */
const STOPWORDS = new Set([
  'burger', 'burguer', 'hamburguer', 'hamburger', 'lanche', 'lanches', 'de', 'do', 'da', 'dos', 'das',
  'com', 'e', 'o', 'a', 'os', 'as', 'um', 'uma', 'no', 'na', 'ml', 'gr', 'g', 'un', 'x', 'sem', 'mais',
  'potinho', 'lata', 'long', 'neck', 'pao', 'carne', 'queijo', 'serve', 'pessoa', 'pessoas', 'quero',
  'por', 'favor', 'pra', 'para', 'me', 've', 'manda', 'adiciona', 'coloca', 'pode', 'ser', 'eu', 'vou',
  'querer', 'gostaria', 'tem', 'quanto', 'custa', 'preco', 'valor', 'qual', 'quais', 'oi', 'ola',
  'original', 'combo', 'combos', 'box', 'combinho', 'pedido', 'fazer',
]);

/** Palavras que, sozinhas, implicam outras do nome no cardápio ("coca" → "Coca-Cola"). */
const EXPANSIONS: Record<string, string[]> = {
  coca: ['cola'],
  suco: ['del', 'valle'],
  pessego: ['suco', 'del', 'valle'],
  guarana: ['antarctica', 'refrigerante'],
};

/** Uma palavra presente em mais itens que isto é genérica demais para decidir sozinha. */
const MAX_DISTINCTIVE_DOC_FREQ = 6;

/** Variações comuns digitadas pelos clientes → forma usada no cardápio. */
const SYNONYMS: Record<string, string> = {
  refri: 'refrigerante',
  refrigerantes: 'refrigerante',
  guarana: 'guarana',
  cocas: 'coca',
  coquinha: 'coca',
  coquinhas: 'coca',
  cerveja: 'cerveja',
  budweiser: 'budweiser',
  heineken: 'heineken',
  heinz: 'heiz',
  maionese: 'maionese',
  maio: 'maionese',
  onion: 'onions',
  rings: 'onions',
  cebola: 'cebola',
  kids: 'kids',
  crianca: 'kids',
  infantil: 'kids',
  pickle: 'pickles',
  picles: 'pickles',
  cristovam: 'cristovao',
  christovao: 'cristovao',
  costelinha: 'costela',
};

const tokenize = (text: string): string[] =>
  normalizeText(text)
    .split(' ')
    .map((t) => SYNONYMS[t] ?? t)
    .map((t) => (t.length > 4 && t.endsWith('s') && !['onions', 'pickles'].includes(t) ? t.slice(0, -1) : t))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+(ml|g|gr|x)?$/.test(t));

interface IndexedItem {
  item: MenuItem;
  tokens: Set<string>;
  normalizedName: string;
}

const INDEX: IndexedItem[] = MENU_ITEMS.filter((i) => i.isAvailable !== false).map((item) => ({
  item,
  tokens: new Set(tokenize(item.name)),
  normalizedName: normalizeText(item.name),
}));

// Peso de cada palavra: quanto mais rara no cardápio, mais ela identifica o item (IDF).
const DOC_FREQ = new Map<string, number>();
for (const { tokens } of INDEX) for (const t of tokens) DOC_FREQ.set(t, (DOC_FREQ.get(t) ?? 0) + 1);
const idf = (token: string) => Math.log(1 + INDEX.length / (DOC_FREQ.get(token) ?? INDEX.length));

const isCombo = (item: MenuItem) => item.category === 'Combos';

// ---------------------------------------------------------------------------
// Reconhecimento de itens e quantidades
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

function readQuantity(segment: string): number {
  const match = normalizeText(segment).match(
    /^(?:(?:eu )?(?:quero|queria|vou querer|gostaria de|me ve|me da|manda|adiciona|adicionar|coloca|pode ser|mais)\s+)*(\d{1,2}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b(?!\s*(?:ml|g|gr|x)\b)/
  );
  if (!match) return 1;
  const value = NUMBER_WORDS[match[1]] ?? Number(match[1]);
  return Math.min(20, Math.max(1, value));
}

interface Match {
  item: MenuItem;
  score: number;
}

/** Melhor item para um trecho de texto (ou null se nada for convincente). */
function bestMatch(segment: string): Match | null {
  const typed = tokenize(segment);
  if (typed.length === 0) return null;
  const words = new Set(typed.flatMap((t) => [t, ...(EXPANSIONS[t] ?? [])]));
  const queryWeight = [...new Set(typed)].reduce((sum, t) => sum + idf(t), 0);
  const wantsCombo = /\b(combo|combos|box|combinho)\b/.test(normalizeText(segment));

  let best: Match | null = null;
  let runnerUp = 0;
  for (const entry of INDEX) {
    let matched = 0;
    let total = 0;
    let distinctive = false;
    let matchedTyped = 0;
    for (const token of entry.tokens) {
      const weight = idf(token);
      total += weight;
      if (words.has(token)) {
        matched += weight;
        if ((DOC_FREQ.get(token) ?? 0) <= MAX_DISTINCTIVE_DOC_FREQ) distinctive = true;
      }
    }
    for (const t of new Set(typed)) if (entry.tokens.has(t)) matchedTyped += idf(t);
    if (matched === 0 || total === 0 || !distinctive) continue;
    // Metade: quanto do nome do item foi citado; metade: quanto da frase foi reconhecido.
    let score = 0.5 * (matched / total) + 0.5 * (queryWeight > 0 ? matchedTyped / queryWeight : 0);
    // Sem pedir "combo", prefira o lanche avulso; pedindo, prefira o combo.
    if (isCombo(entry.item) !== wantsCombo) score *= 0.45;
    // Desempate: nomes mais curtos/simples ganham.
    score -= entry.tokens.size * 0.002;
    if (!best || score > best.score) {
      runnerUp = best?.score ?? 0;
      best = { item: entry.item, score };
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }
  if (!best || best.score < 0.4) return null;
  // Ambíguo demais (dois itens quase empatados): melhor perguntar.
  if (best.score < 0.6 && best.score - runnerUp < 0.03) return null;
  return best;
}

/** "2 cristovão bacon e uma coca" → [{destaque-1, 2}, {bebida-1, 1}]. */
export function findRequestedItems(message: string): AssistantSuggestion[] {
  const segments = message
    .split(/,|;|\+|\be\b|\bmais\b|\btambem\b|\bjunto com\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const result = new Map<string, number>();
  for (const segment of segments) {
    const match = bestMatch(segment);
    if (!match) continue;
    result.set(match.item.id, (result.get(match.item.id) ?? 0) + readQuantity(segment));
  }
  return [...result].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** Itens citados pelo nome exato em um texto (ex.: resposta do Gemini). */
export function extractItemMentions(text: string, limit = 4): AssistantSuggestion[] {
  const normalized = normalizeText(text);
  return INDEX.filter((entry) => normalized.includes(entry.normalizedName))
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length)
    .slice(0, limit)
    .map((entry) => ({ itemId: entry.item.id, quantity: 1 }));
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

const byId = new Map(MENU_ITEMS.map((i) => [i.id, i]));
const peopleOf = (item: MenuItem) => Number(item.serves?.match(/(\d+)/)?.[1] ?? 0);
const line = (item: MenuItem) => `• **${item.name}** — ${brl(item.price)}`;

const DEFAULT_QUICK_REPLIES = ['Mais vendidos', 'Combo para 2 pessoas', 'Bebidas', 'Ver meu carrinho'];

const has = (text: string, words: readonly string[]) => words.some((w) => new RegExp(`\\b${w}`).test(text));

function detectPeople(text: string): number | null {
  if (has(text, ['casal', 'namorad', 'dois', 'duas pessoas', '2 pessoas', 'pra 2', 'para 2', 'a dois'])) return 2;
  if (has(text, ['familia', 'tres', '3 pessoas', 'pra 3', 'para 3', 'galera', 'amigos', 'turma'])) return 3;
  if (has(text, ['sozinho', 'sozinha', 'so eu', '1 pessoa', 'individual', 'pra mim'])) return 1;
  return null;
}

function combosFor(people: number): MenuItem[] {
  return MENU_ITEMS.filter((i) => isCombo(i) && (people >= 3 ? peopleOf(i) >= 3 : peopleOf(i) === people))
    .sort((a, b) => Number(Boolean(b.highlight)) - Number(Boolean(a.highlight)) || a.price - b.price)
    .slice(0, 3);
}

function suggestionsOf(items: MenuItem[]): AssistantSuggestion[] {
  return items.map((item) => ({ itemId: item.id, quantity: 1 }));
}

function describeCart(cart: readonly AssistantCartLine[] | undefined): string {
  if (!cart || cart.length === 0) return 'Seu carrinho ainda está vazio. Me diga o que deseja e eu adiciono para você!';
  const total = cart.reduce((sum, l) => sum + l.total, 0);
  const lines = cart.map((l) => `• ${l.quantity}x ${l.name} — ${brl(l.total)}`);
  const missing = STORE.delivery.minOrder - total;
  return [
    '**Seu pedido até agora:**',
    ...lines,
    `Subtotal: **${brl(total)}**`,
    missing > 0
      ? `Faltam ${brl(missing)} para o pedido mínimo de ${brl(STORE.delivery.minOrder)}.`
      : total >= STORE.delivery.freeAbove
        ? 'Você já ganhou **frete grátis**! 🎉'
        : `Faltam ${brl(STORE.delivery.freeAbove - total)} para ganhar frete grátis.`,
  ].join('\n');
}

/** Palavras que indicam número de pessoas — não devem escolher um item sozinhas. */
const PEOPLE_WORDS = /\b(casal|namorad[oa]s?|familia|galera|amigos|turma|individual|sozinh[oa]|pessoas?|criancas?)\b/g;

/** Responde uma mensagem do cliente. Determinístico (fácil de testar). */
export function respond(message: string, context: AssistantContext = {}): AssistantReply {
  const text = normalizeText(message);
  const people = detectPeople(text);
  // "combo para casal": as palavras de pessoas não devem escolher um item sozinhas.
  const requested = findRequestedItems(people === null ? message : normalizeText(message).replace(PEOPLE_WORDS, ' '));
  const cartCount = context.cart?.reduce((s, l) => s + l.quantity, 0) ?? 0;

  // Finalizar pedido
  if (has(text, ['finaliz', 'fechar o pedido', 'fechar pedido', 'concluir', 'checkout', 'pagar agora', 'so isso', 'e so isso'])) {
    if (cartCount === 0 && requested.length === 0) {
      return {
        text: 'Seu carrinho está vazio por enquanto. Que tal começar pelos nossos mais vendidos?',
        suggestions: suggestionsOf(MENU_ITEMS.filter((i) => i.highlight).slice(0, 3)),
        quickReplies: DEFAULT_QUICK_REPLIES,
      };
    }
    return {
      text: `Perfeito! Vou abrir seu carrinho para você informar nome, celular e endereço. ${describeCart(context.cart)}`,
      suggestions: [],
      quickReplies: [],
      action: 'checkout',
    };
  }

  // Ver carrinho
  if (has(text, ['carrinho', 'meu pedido', 'o que eu pedi', 'resumo'])) {
    return { text: describeCart(context.cart), suggestions: [], quickReplies: cartCount ? ['Finalizar pedido', 'Bebidas'] : DEFAULT_QUICK_REPLIES, action: cartCount ? 'open_cart' : undefined };
  }

  // Pedido direto com itens reconhecidos
  if (requested.length > 0) {
    const lines = requested.map(({ itemId, quantity }) => {
      const item = byId.get(itemId)!;
      return `• ${quantity}x **${item.name}** — ${brl(item.price * quantity)}`;
    });
    const total = requested.reduce((sum, s) => sum + byId.get(s.itemId)!.price * s.quantity, 0);
    const wantsPrice = has(text, ['quanto', 'preco', 'valor', 'custa']);
    return {
      text: [
        wantsPrice ? 'Aqui estão os valores:' : 'Encontrei no cardápio:',
        ...lines,
        requested.length > 1 ? `Total: **${brl(total)}**` : '',
        'Toque em **Adicionar** para colocar no carrinho. Quer incluir uma bebida ou um molho?',
      ]
        .filter(Boolean)
        .join('\n'),
      suggestions: requested,
      quickReplies: ['Bebidas', 'Molhos', 'Finalizar pedido'],
    };
  }

  // Combos por número de pessoas
  if (people !== null || has(text, ['combo'])) {
    const n = people ?? 1;
    // Item citado pelo nome ("box casal") aparece primeiro; completa com os combos ideais.
    const named = findRequestedItems(message)
      .map((s) => byId.get(s.itemId)!)
      .filter((item) => isCombo(item));
    const combos = [...new Map([...named, ...combosFor(n)].map((i) => [i.id, i])).values()].slice(0, 3);
    return {
      text: [
        `Para ${n >= 3 ? '3 ou mais pessoas' : n === 2 ? '2 pessoas' : '1 pessoa'}, estes são os combos mais vantajosos:`,
        ...combos.map(line),
      ].join('\n'),
      suggestions: suggestionsOf(combos),
      quickReplies: ['Combo para 1 pessoa', 'Combo para 2 pessoas', 'Combo família'].filter(
        (q) => !q.includes(n === 1 ? '1 pessoa' : n === 2 ? '2 pessoas' : 'família')
      ),
    };
  }

  // Categorias
  const categoryQueries: Array<[string[], string, string]> = [
    [['bebida', 'refrigerante', 'refri', 'cerveja', 'suco', 'beber'], 'Bebidas', 'Nossas bebidas geladas:'],
    [['molho', 'acompanhamento', 'maionese', 'ketchup', 'mostarda'], 'Acompanhamentos', 'Molhos e acompanhamentos:'],
    [['hamburgueres', 'hamburguer', 'burgers', 'lanches', 'sanduiche'], 'Hambúrgueres', 'Nossos hambúrgueres:'],
  ];
  for (const [words, category, title] of categoryQueries) {
    if (has(text, words)) {
      const items = MENU_ITEMS.filter((i) => i.category === category).slice(0, 5);
      return { text: [title, ...items.map(line)].join('\n'), suggestions: suggestionsOf(items.slice(0, 3)), quickReplies: ['Mais vendidos', 'Finalizar pedido'] };
    }
  }

  if (has(text, ['sobremesa', 'doce', 'nutella', 'kinder'])) {
    const sweet = MENU_ITEMS.filter((i) => /nutella|kinder/i.test(`${i.name} ${i.description}`));
    return {
      text: ['Ainda não temos sobremesa avulsa, mas o burger de **Nutella com Kinder Bueno** vem nestas opções:', ...sweet.map(line)].join('\n'),
      suggestions: suggestionsOf(sweet.slice(0, 2)),
      quickReplies: DEFAULT_QUICK_REPLIES,
    };
  }

  // Recomendações
  if (has(text, ['recomenda', 'sugere', 'sugest', 'indica', 'mais vendid', 'melhor', 'destaque', 'o que voce', 'fome', 'escolher', 'cardapio'])) {
    const highlights = MENU_ITEMS.filter((i) => i.highlight).slice(0, 4);
    return {
      text: ['Nossos campeões de pedido:', ...highlights.map(line), 'Me diga para quantas pessoas que eu monto o combo ideal!'].join('\n'),
      suggestions: suggestionsOf(highlights.slice(0, 3)),
      quickReplies: ['Combo para 2 pessoas', 'Combo família', 'Bebidas'],
    };
  }

  // Informações da loja
  if (has(text, ['horario', 'abre', 'fecha', 'aberto', 'aberta', 'funciona', 'hoje'])) {
    const status = context.isOpen === undefined ? '' : context.isOpen ? ' Estamos **abertos agora**! 🔥' : ' No momento estamos **fechados**, mas você pode deixar o pedido agendado.';
    return { text: `Funcionamos ${STORE_HOURS_LABEL.charAt(0).toLowerCase()}${STORE_HOURS_LABEL.slice(1)}.${status}`, suggestions: [], quickReplies: DEFAULT_QUICK_REPLIES };
  }
  if (has(text, ['entrega', 'entregam', 'taxa', 'frete', 'bairro', 'demora', 'tempo', 'minimo', 'delivery'])) {
    return {
      text: `Entregamos em ${STORE_LOCATION} (${STORE_NEIGHBORHOODS_LABEL}) em ${STORE_ETA_LABEL}. Taxa de ${brl(STORE.delivery.fee)}, **grátis acima de ${brl(STORE.delivery.freeAbove)}**. Pedido mínimo: ${brl(STORE.delivery.minOrder)}.`,
      suggestions: [],
      quickReplies: DEFAULT_QUICK_REPLIES,
    };
  }
  if (has(text, ['pix', 'cartao', 'dinheiro', 'pagamento', 'pagar', 'troco'])) {
    return { text: 'Aceitamos **Pix, cartão ou dinheiro** na entrega. Pagando em dinheiro, é só informar o troco no carrinho.', suggestions: [], quickReplies: ['Finalizar pedido', 'Mais vendidos'] };
  }
  if (has(text, ['smash', 'maillard', 'crosta', 'blend', 'angus', 'como e feito'])) {
    return {
      text: 'Nosso smash é uma bola de blend Angus fresco prensada na chapa a mais de 200°C: a reação de Maillard cria a crosta dourada e crocante por fora, mantendo a suculência por dentro. 🔥',
      suggestions: suggestionsOf(MENU_ITEMS.filter((i) => i.highlight).slice(0, 2)),
      quickReplies: DEFAULT_QUICK_REPLIES,
    };
  }
  if (has(text, ['obrigad', 'valeu', 'show', 'perfeito'])) {
    return { text: 'Imagina! Se quiser, já posso finalizar seu pedido. 🍔', suggestions: [], quickReplies: cartCount ? ['Finalizar pedido'] : DEFAULT_QUICK_REPLIES };
  }

  // Saudação / ajuda
  const greeting = has(text, ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'eai', 'opa']) || text.length === 0;
  return {
    text: greeting
      ? `Olá! Sou o atendente do **${STORE.name}**. Posso montar seu pedido por aqui: é só escrever, por exemplo, "quero 2 Cristovão Bacon e uma Coca" ou "combo para casal".`
      : 'Não encontrei esse item no cardápio. 🤔 Tente pelo nome do lanche (ex.: "Cristovão Bacon", "Turbo Pickles") ou escolha uma opção abaixo.',
    suggestions: [],
    quickReplies: DEFAULT_QUICK_REPLIES,
  };
}

// ---------------------------------------------------------------------------
// Prompt do Gemini gerado a partir do cardápio + configurações
// ---------------------------------------------------------------------------

export function buildMenuPrompt(): string {
  const categories = [...new Set(MENU_ITEMS.map((i) => i.category))];
  const menu = categories
    .map((category) => {
      const items = MENU_ITEMS.filter((i) => i.category === category && i.isAvailable !== false)
        .map((i) => `   - ${i.name}: ${i.description} ${brl(i.price)}${i.originalPrice ? ` (de ${brl(i.originalPrice)})` : ''}${i.serves ? ` · ${i.serves}` : ''}`)
        .join('\n');
      return `${category}:\n${items}`;
    })
    .join('\n\n');

  return `Você é o atendente virtual de pedidos da hamburgueria "${STORE.name}" (${STORE_LOCATION}).
Sua missão é ajudar o cliente a ESCOLHER e MONTAR o pedido com simpatia, agilidade e "água na boca".

INFORMAÇÕES DA LOJA:
- Horário: ${STORE_HOURS_LABEL}.
- Entrega: ${STORE_NEIGHBORHOODS_LABEL}, em ${STORE_ETA_LABEL}. Taxa ${brl(STORE.delivery.fee)}, grátis acima de ${brl(STORE.delivery.freeAbove)}.
- Pedido mínimo: ${brl(STORE.delivery.minOrder)}. Pagamento na entrega: Pix, cartão ou dinheiro.
- Avaliação: ${STORE.rating.value} estrelas (${STORE.rating.reviews}+ avaliações).

CARDÁPIO OFICIAL (use SOMENTE estes itens e preços):
${menu}

REGRAS DE ATENDIMENTO:
- Ao recomendar ou confirmar um item, escreva o NOME EXATO do cardápio (o site mostra um botão "Adicionar" para cada nome citado).
- Seja breve (no máximo 6 linhas), em português do Brasil, com valores em R$.
- Pergunte para quantas pessoas é o pedido quando fizer sentido e sugira bebida/molho para completar.
- Quando o cliente quiser finalizar, diga para tocar em "Finalizar pedido" para informar nome, celular e endereço.
- Nunca invente itens, preços, promoções ou prazos que não estejam acima.`;
}
