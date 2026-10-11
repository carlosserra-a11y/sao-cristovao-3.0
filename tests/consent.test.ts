import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEPT_ALL,
  CONSENT_MAX_AGE_DAYS,
  CONSENT_VERSION,
  REJECT_ALL,
  createRecord,
  hasConsent,
  normalizeChoices,
  parseRecord,
  serializeRecord,
} from '../shared/consent.ts';

const NOW = new Date('2026-10-11T12:00:00Z');

test('"necessary" é sempre verdadeiro; o resto só liga com true explícito', () => {
  assert.deepEqual(normalizeChoices({}), REJECT_ALL);
  assert.deepEqual(normalizeChoices({ necessary: false, analytics: 'true', marketing: 1 }), REJECT_ALL);
  assert.deepEqual(normalizeChoices({ analytics: true, marketing: true }), ACCEPT_ALL);
});

test('registro faz ida e volta', () => {
  const record = createRecord({ analytics: true }, NOW);
  const parsed = parseRecord(serializeRecord(record), NOW);
  assert.deepEqual(parsed, record);
  assert.equal(hasConsent(parsed, 'analytics'), true);
  assert.equal(hasConsent(parsed, 'marketing'), false);
});

test('sem escolha registrada, só o necessário é permitido', () => {
  assert.equal(hasConsent(null, 'necessary'), true);
  assert.equal(hasConsent(null, 'analytics'), false);
  assert.equal(hasConsent(null, 'marketing'), false);
});

test('lixo, versão antiga, data inválida ou expirada pedem nova escolha', () => {
  const ok = createRecord(ACCEPT_ALL, NOW);
  assert.equal(parseRecord(null, NOW), null);
  assert.equal(parseRecord('', NOW), null);
  assert.equal(parseRecord('{not json', NOW), null);
  assert.equal(parseRecord('"texto"', NOW), null);
  assert.equal(parseRecord(JSON.stringify({ ...ok, version: CONSENT_VERSION + 1 }), NOW), null);
  assert.equal(parseRecord(JSON.stringify({ ...ok, decidedAt: 'ontem' }), NOW), null);
  assert.equal(parseRecord(JSON.stringify({ ...ok, decidedAt: '2099-01-01T00:00:00Z' }), NOW), null);
  assert.equal(parseRecord('x'.repeat(2_000), NOW), null);

  const old = new Date(NOW.getTime() - (CONSENT_MAX_AGE_DAYS + 1) * 86_400_000);
  assert.equal(parseRecord(serializeRecord(createRecord(ACCEPT_ALL, old)), NOW), null);
});

test('registro adulterado não consegue desligar o "necessary" nem injetar categorias', () => {
  const forged = JSON.stringify({
    version: CONSENT_VERSION,
    decidedAt: NOW.toISOString(),
    choices: { necessary: false, analytics: true, spy: true },
  });
  const parsed = parseRecord(forged, NOW);
  assert.deepEqual(parsed?.choices, { necessary: true, analytics: true, marketing: false });
});
