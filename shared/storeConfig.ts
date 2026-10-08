/**
 * ============================================================================
 *  CONFIGURAÇÕES DA LOJA — edite aqui e o site inteiro se atualiza.
 * ============================================================================
 *
 * Este é o único lugar com os dados do negócio. Eles alimentam: navbar, Hero,
 * rodapé, carrinho, cálculo de entrega, horário de funcionamento, mensagens do
 * WhatsApp, o atendente de IA e o servidor (validação dos pedidos).
 *
 * O cardápio (itens, preços e fotos) fica em `shared/menuData.ts`.
 *
 * Atenção: este arquivo vai para o navegador. NÃO coloque senhas ou chaves
 * aqui — credenciais (Gemini, Twilio) ficam só nas variáveis do servidor.
 */

export const STORE = {
  /** Identidade */
  name: 'São Cristóvão Burger',
  shortName: 'São Cristóvão',
  kind: 'Hamburgueria',
  slogan: 'Smash burgers artesanais na chapa a 200°C com crosta de Maillard.',

  /** Localização e área de entrega */
  city: 'Palhoça',
  state: 'SC',
  neighborhoods: ['Pagani', 'Pedra Branca', 'Centro', 'Ponte do Imaruim', 'Passa Vinte'],

  /** Contato */
  phoneDisplay: '(48) 99999-9999',
  /** WhatsApp da loja: só dígitos, com DDI 55 (pode ser sobrescrito por VITE_STORE_WHATSAPP_NUMBER). */
  whatsapp: '5548999999999',
  instagramUrl: '',
  facebookUrl: '',
  cnpj: '14.380.200/0001-21',

  /** Reputação exibida no site */
  rating: { value: 4.7, reviews: 1200 },

  /**
   * Horário de funcionamento (todos os dias). Intervalo semiaberto:
   * abre exatamente em `opensAt` e fecha exatamente em `closesAt`.
   */
  hours: {
    daysLabel: 'Todos os dias',
    opensAt: '18:00',
    closesAt: '23:30',
    timezone: 'America/Sao_Paulo',
  },

  /** Regras de entrega (valores em reais) */
  delivery: {
    minOrder: 29.9,
    fee: 6.9,
    freeAbove: 75,
    etaMinutes: { min: 35, max: 50 },
  },
} as const;

export type StoreConfig = typeof STORE;

/** "R$ 29,90" — formatação usada nos textos derivados desta configuração. */
export const brl = (value: number): string => `R$ ${value.toFixed(2).replace('.', ',')}`;

export const STORE_LOCATION = `${STORE.city} - ${STORE.state}`;
export const STORE_ETA_LABEL = `${STORE.delivery.etaMinutes.min} a ${STORE.delivery.etaMinutes.max} minutos`;
export const STORE_HOURS_LABEL = `${STORE.hours.daysLabel}, das ${STORE.hours.opensAt} às ${STORE.hours.closesAt}`;
export const STORE_NEIGHBORHOODS_LABEL = `${STORE.neighborhoods.join(', ')} e região`;
