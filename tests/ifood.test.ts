import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeIfoodUrl } from '../shared/ifood.ts';

test('aceita links https do iFood', () => {
  assert.equal(
    sanitizeIfoodUrl('https://www.ifood.com.br/delivery/palhoca-sc/sao-cristovao/abc'),
    'https://www.ifood.com.br/delivery/palhoca-sc/sao-cristovao/abc'
  );
  assert.ok(sanitizeIfoodUrl('https://ifood.com.br/'));
  assert.ok(sanitizeIfoodUrl('https://ifood.onelink.me/xyz'));
});

test('rejeita vazio, texto solto e esquemas perigosos', () => {
  for (const bad of [undefined, null, '', '   ', 'ifood', 'javascript:alert(1)', 'data:text/html,x', 'http://www.ifood.com.br/']) {
    assert.equal(sanitizeIfoodUrl(bad), null, String(bad));
  }
});

test('rejeita domínios parecidos, credenciais e portas estranhas', () => {
  for (const bad of [
    'https://ifood.com.br.evil.com/',
    'https://evilifood.com.br/',
    'https://evil.com/?u=ifood.com.br',
    'https://www.ifood.com.br@evil.com/',
    'https://user:pass@www.ifood.com.br/',
    'https://www.ifood.com.br:8443/',
  ]) {
    assert.equal(sanitizeIfoodUrl(bad), null, bad);
  }
});
