import type { ChatMessageInput, ChatRoleMode } from './api.ts';
import { respond } from './orderAssistant.ts';

/**
 * Respostas de contingência quando o Gemini está indisponível.
 * Compartilhado: o servidor usa quando o provedor falha, e o navegador usa
 * quando não há backend (ex.: versão estática publicada no GitHub Pages).
 * O texto vem do mesmo motor do atendente de pedidos (shared/orderAssistant.ts),
 * então preços, horários e itens estão sempre de acordo com o cardápio.
 */

export interface FallbackImage {
  imageUrl: string;
  description: string;
}

export function buildChatFallback(messages: readonly ChatMessageInput[], _role: ChatRoleMode): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return respond(lastUser?.content ?? '').text;
}

// Acervo de fotos gastronômicas (mesmo padrão visual) para o estúdio de imagens.
const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1600&q=90',
  'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=1600&q=90',
  'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1600&q=90',
  'https://images.unsplash.com/photo-1594212699903-eca8a3a114f1?auto=format&fit=crop&w=1600&q=90',
  'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?auto=format&fit=crop&w=1600&q=90',
] as const;

export function buildImageFallback(prompt: string, imageSize: string): FallbackImage {
  return {
    imageUrl: FALLBACK_PHOTOS[Math.floor(Math.random() * FALLBACK_PHOTOS.length)],
    description: `Fotografia gastronômica de referência para "${prompt}" (${imageSize}).`,
  };
}
