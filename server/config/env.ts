import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

/** "1" → 1 hop · "true"/"false" · lista de IPs/sub-redes → repassado ao Express. */
const parseTrustProxy = (value: string | undefined, isProd: boolean): boolean | number | string => {
  if (value === undefined || value === '') return isProd ? 1 : false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const asNumber = Number(value);
  return Number.isInteger(asNumber) ? asNumber : value;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

/**
 * Configuração centralizada e validada na inicialização.
 * GEMINI_API_KEY vive SOMENTE aqui (servidor) — nunca use o prefixo VITE_,
 * que exporia a chave no bundle do navegador.
 */
export const env = Object.freeze({
  nodeEnv,
  isProd,
  port: parseNumber(process.env.PORT, 3000),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
  /** Quando true, falhas do provedor de IA retornam respostas de contingência (com meta.fallback). */
  aiFallbackEnabled: parseBoolean(process.env.AI_FALLBACK_ENABLED, true),
  chatTimeoutMs: parseNumber(process.env.AI_CHAT_TIMEOUT_MS, 30_000),
  imageTimeoutMs: parseNumber(process.env.AI_IMAGE_TIMEOUT_MS, 90_000),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY, isProd),
  /**
   * Pedidos diretos pelo site (POST /api/orders → WhatsApp/Twilio). DESLIGADO por padrão:
   * a loja recebe pedidos pelo iFood, então a rota nem é montada (menos superfície de ataque
   * e nenhum dado pessoal de clientes passando pelo nosso servidor).
   */
  directOrders: parseBoolean(process.env.ENABLE_DIRECT_ORDERS, false),
  /** Origens autorizadas a embutir o site em iframe (ex.: preview do AI Studio). */
  frameAncestors: (process.env.FRAME_ANCESTORS ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean),
  /** Origens externas autorizadas a chamar a API (ex.: o site no GitHub Pages). */
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? '',
    /** Remetente WhatsApp habilitado na Twilio, E.164 (ex.: +14155238886 no sandbox). */
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM?.trim() ?? '',
    /** WhatsApp da loja que recebe os pedidos, E.164. */
    storeWhatsappTo: process.env.STORE_WHATSAPP_TO?.trim() ?? '',
    /** Envia também uma confirmação ao cliente (exige opt-in/template no WhatsApp Business). */
    notifyCustomer: parseBoolean(process.env.TWILIO_NOTIFY_CUSTOMER, false),
    timeoutMs: parseNumber(process.env.TWILIO_TIMEOUT_MS, 10_000),
    /** Sobrescrito apenas em testes automatizados. */
    apiBaseUrl: process.env.TWILIO_API_BASE_URL?.trim() || 'https://api.twilio.com',
  },
  rateLimit: {
    ordersPer10Minutes: parseNumber(process.env.RATE_LIMIT_ORDERS_PER_10_MINUTES, 5),
    apiPerMinute: parseNumber(process.env.RATE_LIMIT_API_PER_MINUTE, 120),
    chatPerMinute: parseNumber(process.env.RATE_LIMIT_CHAT_PER_MINUTE, 20),
    imagePer10Minutes: parseNumber(process.env.RATE_LIMIT_IMAGE_PER_10_MINUTES, 5),
  },
});

export const isGeminiConfigured = (): boolean =>
  env.geminiApiKey.length > 0 && env.geminiApiKey !== 'MY_GEMINI_API_KEY';
