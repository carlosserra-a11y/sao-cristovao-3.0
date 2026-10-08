/**
 * Fonte única de verdade para o horário de funcionamento da loja.
 *
 * Usado tanto pelo servidor (GET /api/store/status) quanto pelo frontend
 * (hook useStoreStatus). Todo cálculo é feito no fuso America/Sao_Paulo via
 * Intl, então o resultado independe do fuso/configuração do dispositivo.
 *
 * Regra (intervalo semiaberto): 18:00 <= hora local < 23:30 → ABERTO.
 *  - Exatamente 18:00:00 → ABERTO.
 *  - Exatamente 23:30:00 → FECHADO.
 */

import { STORE } from './storeConfig.ts';

// Valores vêm de shared/storeConfig.ts (configuração única da loja).
export const STORE_TIMEZONE = STORE.hours.timezone;
export const STORE_OPENS_AT = STORE.hours.opensAt;
export const STORE_CLOSES_AT = STORE.hours.closesAt;

export interface StoreStatus {
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  timezone: string;
  /** Hora atual no fuso da loja, "HH:mm". */
  localTime: string;
  /** Minutos até a próxima mudança de estado (abrir ou fechar). */
  minutesUntilChange: number;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const OPEN_MINUTES = toMinutes(STORE_OPENS_AT);
const CLOSE_MINUTES = toMinutes(STORE_CLOSES_AT);
const DAY_MINUTES = 24 * 60;

// Criar um Intl.DateTimeFormat é relativamente caro; reutilizamos a instância.
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Minutos (com fração de segundos) desde a meia-noite no fuso da loja. */
export function getStoreLocalMinutes(date: Date): number {
  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const part of timeFormatter.formatToParts(date)) {
    if (part.type === 'hour') hour = Number(part.value) % 24;
    else if (part.type === 'minute') minute = Number(part.value);
    else if (part.type === 'second') second = Number(part.value);
  }
  return hour * 60 + minute + second / 60;
}

export function isStoreOpenAt(localMinutes: number): boolean {
  return localMinutes >= OPEN_MINUTES && localMinutes < CLOSE_MINUTES;
}

export function getStoreStatus(date: Date = new Date()): StoreStatus {
  const minutes = getStoreLocalMinutes(date);
  const isOpen = isStoreOpenAt(minutes);
  const nextChange = isOpen ? CLOSE_MINUTES : OPEN_MINUTES;
  const minutesUntilChange = (nextChange - minutes + DAY_MINUTES) % DAY_MINUTES;
  const whole = Math.floor(minutes);

  return {
    isOpen,
    opensAt: STORE_OPENS_AT,
    closesAt: STORE_CLOSES_AT,
    timezone: STORE_TIMEZONE,
    localTime: `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`,
    minutesUntilChange: Math.round(minutesUntilChange * 100) / 100,
  };
}
