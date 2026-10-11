import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Sem credenciais da Twilio: o pedido não pode "fingir" sucesso.
for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', 'STORE_WHATSAPP_TO']) {
  process.env[key] = '';
}
process.env.NODE_ENV = 'test';
process.env.ENABLE_DIRECT_ORDERS = 'true';

const { createApp } = await import('../server/app.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  server = (await createApp()).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('503 WHATSAPP_NOT_CONFIGURED quando as variáveis da Twilio não existem', async () => {
  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { name: 'Maria Silva', phone: '48999998888' },
      address: 'Rua das Flores, 123 - Pagani',
      paymentMethod: 'card',
      items: [{ itemId: 'destaque-2', quantity: 1 }],
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'WHATSAPP_NOT_CONFIGURED');
});
