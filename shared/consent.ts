/**
 * Consentimento de cookies (LGPD, art. 8º) — lógica pura, sem acesso ao navegador.
 *
 * Regras:
 * - "necessary" é sempre verdadeiro (carrinho e registro da própria escolha);
 * - as demais categorias começam DESLIGADAS (nada de caixas pré-marcadas);
 * - a escolha é versionada: se as categorias/política mudarem, pedimos de novo;
 * - a escolha expira (CONSENT_MAX_AGE_DAYS) e o visitante pode mudá-la a qualquer momento.
 */

export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE_DAYS = 180;

export const CONSENT_CATEGORIES = ['necessary', 'analytics', 'marketing'] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export type ConsentChoices = Record<ConsentCategory, boolean>;

export interface ConsentRecord {
  version: number;
  /** ISO 8601 do momento em que a escolha foi feita. */
  decidedAt: string;
  choices: ConsentChoices;
}

export const REJECT_ALL: ConsentChoices = { necessary: true, analytics: false, marketing: false };
export const ACCEPT_ALL: ConsentChoices = { necessary: true, analytics: true, marketing: true };

/** Força "necessary" e descarta qualquer valor que não seja booleano. */
export function normalizeChoices(input: Partial<Record<ConsentCategory, unknown>>): ConsentChoices {
  return {
    necessary: true,
    analytics: input.analytics === true,
    marketing: input.marketing === true,
  };
}

export function createRecord(choices: Partial<Record<ConsentCategory, unknown>>, now: Date = new Date()): ConsentRecord {
  return { version: CONSENT_VERSION, decidedAt: now.toISOString(), choices: normalizeChoices(choices) };
}

/** Lê um registro vindo do armazenamento (fonte não confiável). null = precisa perguntar de novo. */
export function parseRecord(raw: string | null | undefined, now: Date = new Date()): ConsentRecord | null {
  if (!raw || raw.length > 1_000) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;

  const { version, decidedAt, choices } = data as Record<string, unknown>;
  if (version !== CONSENT_VERSION) return null;
  if (typeof decidedAt !== 'string' || typeof choices !== 'object' || choices === null) return null;

  const decided = Date.parse(decidedAt);
  if (!Number.isFinite(decided)) return null;

  const ageMs = now.getTime() - decided;
  if (ageMs < 0 || ageMs > CONSENT_MAX_AGE_DAYS * 86_400_000) return null;

  return {
    version,
    decidedAt: new Date(decided).toISOString(),
    choices: normalizeChoices(choices as Record<string, unknown>),
  };
}

export const serializeRecord = (record: ConsentRecord): string => JSON.stringify(record);

export const hasConsent = (record: ConsentRecord | null, category: ConsentCategory): boolean =>
  category === 'necessary' ? true : record?.choices[category] === true;
