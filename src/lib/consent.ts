/**
 * Armazenamento e observação do consentimento de cookies (lado do navegador).
 * A lógica de validação fica em shared/consent.ts (testada em Node).
 *
 * Como usar para carregar um rastreador (ex.: Google Analytics, Meta Pixel):
 *
 *   import { runWhenConsented } from '../lib/consent';
 *   runWhenConsented('analytics', () => { ...injeta o <script>... });
 *
 * Nada de terceiros pode ser carregado fora desse caminho. O CSP (ver
 * server/middleware/security.ts e vite.config.ts) também precisa liberar o
 * domínio do rastreador explicitamente — é uma segunda trava intencional.
 */
import { useSyncExternalStore } from 'react';
import {
  type ConsentCategory,
  type ConsentChoices,
  type ConsentRecord,
  createRecord,
  hasConsent,
  parseRecord,
  serializeRecord,
} from '../../shared/consent';

export const CONSENT_STORAGE_KEY = 'sc_cookie_consent';
const OPEN_PREFERENCES_EVENT = 'sc:open-cookie-preferences';

type Listener = () => void;
const listeners = new Set<Listener>();

function readStored(): ConsentRecord | null {
  try {
    return parseRecord(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    // Armazenamento bloqueado (modo privado/estrito): tratamos como "sem escolha" e só o necessário vale.
    return null;
  }
}

let current: ConsentRecord | null = readStored();

const emit = () => listeners.forEach((listener) => listener());

export const getConsent = (): ConsentRecord | null => current;

export function saveConsent(choices: Partial<Record<ConsentCategory, unknown>>): ConsentRecord {
  const record = createRecord(choices);
  const withdrew = (['analytics', 'marketing'] as const).some(
    (category) => hasConsent(current, category) && !hasConsent(record, category)
  );
  current = record;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, serializeRecord(record));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  emit();
  // Retirar o consentimento tem de valer na hora: recarregar descarta qualquer script já carregado.
  if (withdrew && typeof location !== 'undefined') location.reload();
  return record;
}

export const subscribeConsent = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

if (typeof window !== 'undefined') {
  // Outra aba mudou a escolha.
  window.addEventListener('storage', (event) => {
    if (event.key === CONSENT_STORAGE_KEY || event.key === null) {
      current = readStored();
      emit();
    }
  });
}

/** Estado reativo: `record === null` significa que o banner deve ser exibido. */
export function useConsent(): { record: ConsentRecord | null; choices: ConsentChoices | null } {
  const record = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  return { record, choices: record?.choices ?? null };
}

/** Executa `run` somente se (e quando) o visitante permitir a categoria. Devolve a função de cancelamento. */
export function runWhenConsented(category: ConsentCategory, run: () => void): () => void {
  let done = false;
  const check = () => {
    if (!done && hasConsent(current, category)) {
      done = true;
      run();
    }
  };
  check();
  if (done) return () => undefined;
  const unsubscribe = subscribeConsent(check);
  return unsubscribe;
}

/** Abre o painel de preferências (link "Preferências de cookies" no rodapé). */
export const openCookiePreferences = (): void => {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
};

export const onOpenCookiePreferences = (handler: () => void): (() => void) => {
  window.addEventListener(OPEN_PREFERENCES_EVENT, handler);
  return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, handler);
};
