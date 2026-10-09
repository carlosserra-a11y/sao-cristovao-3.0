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
 * Fundo controlado pela rolagem: sequência de quadros do vídeo gerado com
 * Higgsfield Seedance 2.0 (burger montado → explodido), em WebP.
 *
 * Por que quadros e não <video>? O Safari do iPhone não exibe vídeo pausado
 * que é "pulado" pela rolagem (e bloqueia vídeo em modo Pouca Energia); já
 * imagens num <canvas> funcionam igual em qualquer navegador.
 *
 * - desktop: 40 quadros 1280×720 (preenche a tela, estilo "cover").
 * - mobile: 36 quadros 560×560 recortados no centro, para o burger caber inteiro
 *   numa tela vertical. Arquivos em public/media/frames/<set>/fNN.webp.
 */
export const HERO_SEQUENCE = {
  desktop: { dir: "media/frames/desktop", count: 40, width: 1280, height: 720 },
  mobile: { dir: "media/frames/mobile", count: 36, width: 560, height: 560 },
} as const;

export type HeroSequenceSet = (typeof HERO_SEQUENCE)[keyof typeof HERO_SEQUENCE];

export const heroFrameUrl = (set: HeroSequenceSet, index: number): string =>
  `${import.meta.env.BASE_URL}${set.dir}/f${String(index + 1).padStart(2, "0")}.webp`;
