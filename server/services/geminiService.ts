import { ApiError, GoogleGenAI } from '@google/genai';
import type { ChatMessageInput, ChatModel, ChatRoleMode } from '../../shared/api.ts';
import { env, isGeminiConfigured } from '../config/env.ts';
import { AiProviderError } from '../errors/AppError.ts';
import { buildMenuPrompt } from '../../shared/orderAssistant.ts';
import type { ChatModelSelection, GeneratedImage, ValidatedImageRequest } from '../types/ai.ts';

/**
 * Único ponto de acesso ao Gemini: cliente, seleção de modelo, instruções de
 * sistema, chat e geração de imagem. Erros do SDK são traduzidos para
 * AiProviderError com códigos estáveis (timeout, rate limit, auth...).
 */

const IMAGE_MODEL = 'gemini-3-pro-image-preview';

/** Prompt gerado do cardápio + configurações da loja (sempre sincronizado). */
const RESTAURANT_SYSTEM_INSTRUCTION = buildMenuPrompt();

const ROLE_PROFILES: Record<ChatRoleMode, ChatModelSelection> = {
  fast: {
    model: 'gemini-3.1-flash-lite',
    systemInstruction: `${RESTAURANT_SYSTEM_INSTRUCTION}\nMODO ATENDENTE RÁPIDO: Seja direto, conciso e responda com agilidade máxima às dúvidas do cardápio e horário.`,
  },
  sommelier: {
    model: 'gemini-3.5-flash',
    systemInstruction: `${RESTAURANT_SYSTEM_INSTRUCTION}\nMODO SOMMELIER GOURMET: Ajude o cliente a descobrir o hambúrguer ideal para o momento, sugerindo bebidas que combinam e combos especiais.`,
  },
  expert: {
    model: 'gemini-3.1-pro-preview',
    systemInstruction: `${RESTAURANT_SYSTEM_INSTRUCTION}\nMODO MESTRE HAMBURGUEIRO & CONSULTOR GASTRONÔMICO: Forneça detalhes aprofundados sobre blends de carne, técnica smash Maillard a 200°C, harmonizações complexas, perfis de sabor e orientações para pedidos de grupos e eventos.`,
  },
};

/** Mesma precedência da versão anterior: papel "fast"/"expert" OU modelo explícito. */
export function selectChatProfile(role: ChatRoleMode, modelPreference?: ChatModel): ChatModelSelection {
  if (role === 'fast' || modelPreference === 'gemini-3.1-flash-lite') return ROLE_PROFILES.fast;
  if (role === 'expert' || modelPreference === 'gemini-3.1-pro-preview') return ROLE_PROFILES.expert;
  return ROLE_PROFILES.sommelier;
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new AiProviderError('AI_PROVIDER_AUTH', 'O assistente está temporariamente indisponível.', {
      cause: new Error('GEMINI_API_KEY ausente ou com valor de exemplo.'),
    });
  }
  client ??= new GoogleGenAI({
    apiKey: env.geminiApiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  return client;
}

/** Combina o timeout do servidor com o cancelamento do cliente (aba fechada). */
function buildSignal(timeoutMs: number, clientSignal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return clientSignal ? AbortSignal.any([timeout, clientSignal]) : timeout;
}

/** Traduz erros do SDK/rede em AiProviderError com código e status HTTP adequados. */
export function toProviderError(error: unknown, signal?: AbortSignal): AiProviderError {
  if (error instanceof AiProviderError) return error;

  const name = error instanceof Error ? error.name : '';
  const reason = signal?.reason instanceof Error ? signal.reason.name : '';
  if (name === 'TimeoutError' || reason === 'TimeoutError') {
    return new AiProviderError('AI_PROVIDER_TIMEOUT', 'O assistente demorou demais para responder.', { cause: error });
  }
  if (name === 'AbortError') {
    return new AiProviderError('AI_PROVIDER_UNAVAILABLE', 'Requisição cancelada.', { cause: error, status: 499 });
  }

  if (error instanceof ApiError) {
    const { status } = error;
    if (status === 429) {
      return new AiProviderError('AI_PROVIDER_RATE_LIMITED', 'O assistente está com alta demanda. Tente em instantes.', { cause: error });
    }
    if (status === 401 || status === 403) {
      return new AiProviderError('AI_PROVIDER_AUTH', 'O assistente está temporariamente indisponível.', { cause: error });
    }
    if (status === 404) {
      return new AiProviderError('AI_MODEL_UNAVAILABLE', 'O modelo de IA selecionado não está disponível.', { cause: error });
    }
    if (status === 400) {
      return new AiProviderError('AI_PROVIDER_BAD_REQUEST', 'O assistente não conseguiu processar este pedido.', { cause: error });
    }
    if (status === 504) {
      return new AiProviderError('AI_PROVIDER_TIMEOUT', 'O assistente demorou demais para responder.', { cause: error });
    }
  }

  // 5xx, falhas de rede (fetch failed, ECONNRESET...) e erros desconhecidos do SDK.
  return new AiProviderError('AI_PROVIDER_UNAVAILABLE', 'O assistente está temporariamente indisponível.', { cause: error });
}

export async function generateChatReply(
  messages: readonly ChatMessageInput[],
  profile: ChatModelSelection,
  clientSignal?: AbortSignal
): Promise<string> {
  const signal = buildSignal(env.chatTimeoutMs, clientSignal);
  try {
    const response = await getClient().models.generateContent({
      model: profile.model,
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: profile.systemInstruction,
        temperature: 0.7,
        abortSignal: signal,
      },
    });
    const reply = response.text?.trim();
    if (!reply) {
      throw new AiProviderError('AI_EMPTY_RESPONSE', 'O assistente não retornou uma resposta.');
    }
    return reply;
  } catch (error) {
    throw toProviderError(error, signal);
  }
}

export async function generateImage(
  request: ValidatedImageRequest,
  clientSignal?: AbortSignal
): Promise<GeneratedImage & { model: string }> {
  const signal = buildSignal(env.imageTimeoutMs, clientSignal);
  const enhancedPrompt = `High-end professional gourmet photography for "São Cristóvão Burger". Style: ${request.style}. Subject: ${request.prompt}. Cinematic lighting, steam rising, glossy melted cheddar, glistening seared smash patty with crisp edges, brioche bun with toasted shine, dark slate tabletop, bokeh background, award-winning culinary editorial shot, ultra crisp detail.`;

  try {
    const response = await getClient().models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: enhancedPrompt }] },
      config: {
        imageConfig: { aspectRatio: request.aspectRatio, imageSize: request.imageSize },
        abortSignal: signal,
      },
    });

    let imageUrl: string | null = null;
    const descriptionParts: string[] = [];
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      } else if (part.text) {
        descriptionParts.push(part.text);
      }
    }

    if (!imageUrl) {
      throw new AiProviderError('AI_EMPTY_RESPONSE', 'O gerador não retornou nenhuma imagem.');
    }
    return { imageUrl, description: descriptionParts.join(' ').trim(), model: IMAGE_MODEL };
  } catch (error) {
    throw toProviderError(error, signal);
  }
}

export const GEMINI_IMAGE_MODEL = IMAGE_MODEL;
