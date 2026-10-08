/**
 * Configuração pública do frontend (nada aqui é segredo — vai para o bundle).
 * Credenciais da Twilio/Gemini ficam exclusivamente no servidor.
 */
import { STORE } from '../../shared/storeConfig';

/** WhatsApp da loja (só dígitos, com DDI) para o envio direto pelo app do WhatsApp. */
export const STORE_WHATSAPP_NUMBER = (import.meta.env.VITE_STORE_WHATSAPP_NUMBER || STORE.whatsapp).replace(/\D/g, '');

export const buildWhatsAppLink = (message: string): string =>
  `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

/**
 * Vídeo de fundo controlado pela rolagem (gerado com Higgsfield Seedance 2.0).
 * Trecho "burger montado → explodido", recodificado em all-intra 60 fps para
 * busca instantânea. Caminhos relativos ao site (public/media).
 */
export const HERO_SCROLL_VIDEO = {
  desktop: 'media/hero-scroll-720.mp4',
  mobile: 'media/hero-scroll-540.mp4',
  poster: 'media/hero-poster.jpg',
} as const;
