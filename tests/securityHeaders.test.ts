import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Config é lida no import: define o ambiente de PRODUÇÃO antes de carregar o app.
Object.assign(process.env, { NODE_ENV: 'production', GEMINI_API_KEY: '', ENABLE_DIRECT_ORDERS: '', FRAME_ANCESTORS: '' });

const { createApp } = await import('../server/app.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  server = (await createApp()).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

const directive = (csp: string, name: string): string[] =>
  (csp.split(';').map((d) => d.trim().split(/\s+/)).find(([n]) => n === name) ?? []).slice(1);

test('CSP de produção bloqueia scripts inline/eval, frames e terceiros', async () => {
  const res = await fetch(`${baseUrl}/api/store/status`);
  const csp = res.headers.get('content-security-policy') ?? '';
  assert.ok(csp, 'CSP ausente');

  assert.deepEqual(directive(csp, 'script-src'), ["'self'"]);
  assert.deepEqual(directive(csp, 'object-src'), ["'none'"]);
  assert.deepEqual(directive(csp, 'frame-ancestors'), ["'none'"]);
  assert.deepEqual(directive(csp, 'base-uri'), ["'self'"]);
  assert.deepEqual(directive(csp, 'form-action'), ["'self'"]);
  assert.ok(!directive(csp, 'style-src').includes("'unsafe-inline'"));
  assert.ok(!csp.includes('unsafe-eval'));
  assert.ok(!csp.includes('googleapis'), 'fontes agora são hospedadas por nós');
  assert.ok('upgrade-insecure-requests' === csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('upgrade')));
});

test('demais cabeçalhos de segurança estão presentes', async () => {
  const res = await fetch(`${baseUrl}/api/store/status`);
  assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=31536000.*includeSubDomains/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  const permissions = res.headers.get('permissions-policy') ?? '';
  for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) {
    assert.ok(permissions.includes(feature), feature);
  }
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('pedidos diretos ficam desligados por padrão (a loja recebe pelo iFood)', async () => {
  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(res.status, 404);
});

test('corpo grande demais é recusado antes de ser processado', async () => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', text: 'x'.repeat(300_000) }] }),
  });
  assert.equal(res.status, 413);
});

test('origem não autorizada não passa no preflight de CORS', async () => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'OPTIONS',
    headers: { origin: 'https://site-malicioso.example', 'access-control-request-method': 'POST' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});
