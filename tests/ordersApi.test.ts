import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { startFakeTwilio } from './helpers/fakeTwilio.ts';

/**
 * Integração: API Express real + servidor falso da Twilio.
 * As variáveis precisam existir ANTES de importar o app (config é lida no import).
 */
const fakeTwilio = await startFakeTwilio();
const ACCOUNT_SID = `AC${'a'.repeat(32)}`;
const AUTH_TOKEN = 'test-auth-token-123456';
const ALLOWED_ORIGIN = 'https://carlosserra-a11y.github.io';

Object.assign(process.env, {
  NODE_ENV: 'test',
  ENABLE_DIRECT_ORDERS: 'true',
  TWILIO_ACCOUNT_SID: ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM: '+14155238886',
  STORE_WHATSAPP_TO: '+5548988887777',
  TWILIO_API_BASE_URL: fakeTwilio.url,
  TWILIO_TIMEOUT_MS: '300',
  TWILIO_NOTIFY_CUSTOMER: 'false',
  CORS_ORIGINS: `${ALLOWED_ORIGIN}/`,
  RATE_LIMIT_ORDERS_PER_10_MINUTES: '100',
  GEMINI_API_KEY: '',
});

const { createApp } = await import('../server/app.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  const app = await createApp();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await fakeTwilio.close();
});

const order = (overrides: Record<string, unknown> = {}) => ({
  customer: { name: 'Maria Silva', phone: '(48) 99999-8888' },
  address: 'Rua das Flores, 123 - Pagani',
  paymentMethod: 'pix',
  items: [{ itemId: 'destaque-1', quantity: 1 }],
  ...overrides,
});

const postOrder = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('201: envia o pedido à loja via Twilio com credenciais só no servidor', async () => {
  fakeTwilio.setMode({ kind: 'ok' });
  const before = fakeTwilio.requests.length;
  const res = await postOrder(order());
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.match(body.data.orderId, /^SC-[A-Z2-9]{6}$/);
  assert.equal(body.data.total, 55.8); // 48,90 + entrega 6,90
  assert.equal(JSON.stringify(body).includes(AUTH_TOKEN), false);

  const sent = fakeTwilio.requests[before];
  assert.equal(sent.path, `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`);
  assert.equal(sent.authorization, `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')}`);
  assert.equal(sent.form.get('To'), 'whatsapp:+5548988887777');
  assert.equal(sent.form.get('From'), 'whatsapp:+14155238886');
  assert.match(sent.form.get('Body') ?? '', /Maria Silva[\s\S]*\(48\) 99999-8888/);
});

test('400: telefone fora do padrão E.164 brasileiro não chega à Twilio', async () => {
  const before = fakeTwilio.requests.length;
  const res = await postOrder(order({ customer: { name: 'Maria', phone: '3333-4444' } }));
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.error.code, 'INVALID_PAYLOAD');
  assert.ok(body.error.details.some((d: string) => d.includes('celular')));
  assert.equal(fakeTwilio.requests.length, before);
});

test('400: pedido abaixo do mínimo', async () => {
  const res = await postOrder(order({ items: [{ itemId: 'molho-1', quantity: 1 }] }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'ORDER_BELOW_MINIMUM');
});

test('400/413: JSON inválido e corpo grande demais', async () => {
  const invalid = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{quebrado',
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'INVALID_JSON');

  const huge = await postOrder(order({ address: 'x'.repeat(40_000) }));
  assert.equal(huge.status, 413);
});

test('504: timeout da Twilio vira erro amigável', async () => {
  fakeTwilio.setMode({ kind: 'slow', delayMs: 1_000 });
  const res = await postOrder(order());
  const body = await res.json();
  assert.equal(res.status, 504);
  assert.equal(body.error.code, 'WHATSAPP_TIMEOUT');
});

test('502: falha da Twilio vira erro de upstream', async () => {
  fakeTwilio.setMode({ kind: 'error', status: 500, code: 20500 });
  const res = await postOrder(order());
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error.code, 'WHATSAPP_SEND_FAILED');
});

test('503: número da loja recusado pela Twilio é tratado como configuração', async () => {
  fakeTwilio.setMode({ kind: 'error', status: 400, code: 21211 });
  const res = await postOrder(order());
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'WHATSAPP_NOT_CONFIGURED');
});

test('CORS: origem permitida recebe cabeçalhos; desconhecida é bloqueada', async () => {
  fakeTwilio.setMode({ kind: 'ok' });
  const preflight = await fetch(`${baseUrl}/api/orders`, {
    method: 'OPTIONS',
    headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
  assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /POST/);

  const allowed = await postOrder(order(), { Origin: ALLOWED_ORIGIN });
  assert.equal(allowed.status, 201);
  assert.equal(allowed.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);

  const blocked = await fetch(`${baseUrl}/api/orders`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://site-malicioso.example', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
});
