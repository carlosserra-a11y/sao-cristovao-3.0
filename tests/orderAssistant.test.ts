import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMenuPrompt,
  extractItemMentions,
  findRequestedItems,
  respond,
} from '../shared/orderAssistant.ts';
import { STORE } from '../shared/storeConfig.ts';
import { MENU_ITEMS } from '../shared/menuData.ts';

const ids = (list: { itemId: string; quantity: number }[]) => list.map((s) => `${s.quantity}x${s.itemId}`);

test('reconhece itens e quantidades em linguagem natural', () => {
  assert.deepEqual(ids(findRequestedItems('quero 2 cristovão bacon e uma coca')), ['2xdestaque-1', '1xbebida-1']);
  assert.deepEqual(ids(findRequestedItems('3 cocas, 1 guaraná e um suco')), ['3xbebida-1', '1xbebida-2', '1xbebida-3']);
  assert.deepEqual(ids(findRequestedItems('me vê um turbo pickles')), ['1xdestaque-2']);
  assert.deepEqual(ids(findRequestedItems('burger kids pra criança')), ['1xcampeoes-3']);
  assert.deepEqual(ids(findRequestedItems('maionese e ketchup')), ['1xmolho-1', '1xmolho-2']);
});

test('diferencia lanche avulso de combo', () => {
  assert.deepEqual(ids(findRequestedItems('cristovão bacon')), ['1xdestaque-1']);
  assert.deepEqual(ids(findRequestedItems('quero 2 combos bacon')), ['2xcombo-ind-1']);
});

test('não inventa itens nem decide com palavras genéricas', () => {
  assert.deepEqual(findRequestedItems('quero um x-tudo'), []);
  assert.deepEqual(findRequestedItems('quero um cristovão'), []);
  assert.deepEqual(findRequestedItems('Mais vendidos'), []);
});

test('combos por número de pessoas', () => {
  const casal = respond('combo para casal');
  assert.match(casal.text, /2 pessoas/);
  assert.ok(casal.suggestions.length > 0);
  for (const s of casal.suggestions) {
    const item = MENU_ITEMS.find((i) => i.id === s.itemId)!;
    assert.equal(item.category, 'Combos');
    assert.match(item.serves ?? '', /2 pessoas/);
  }
  const familia = respond('combo família');
  assert.ok(familia.suggestions.every((s) => /3 pessoas/.test(MENU_ITEMS.find((i) => i.id === s.itemId)!.serves ?? '')));
});

test('finalizar abre o checkout quando há itens no carrinho', () => {
  const withCart = respond('pode finalizar', { cart: [{ name: 'Cristovão Turbo Pickles', quantity: 1, total: 51.9 }] });
  assert.equal(withCart.action, 'checkout');
  const empty = respond('finalizar pedido', { cart: [] });
  assert.equal(empty.action, undefined);
  assert.ok(empty.suggestions.length > 0);
});

test('informações da loja vêm da configuração central', () => {
  assert.match(respond('qual o horário?').text, new RegExp(STORE.hours.opensAt));
  assert.match(respond('qual o horário?', { isOpen: true }).text, /abertos agora/);
  const entrega = respond('quanto é a entrega?').text;
  assert.match(entrega, /R\$ 6,90/);
  assert.match(entrega, /R\$ 75,00/);
  assert.match(respond('aceita pix?').text, /Pix/);
});

test('saudação e mensagem desconhecida têm respostas úteis', () => {
  assert.match(respond('oi').text, /atendente/i);
  const unknown = respond('quero algo apimentado');
  assert.match(unknown.text, /Não encontrei/);
  assert.ok(unknown.quickReplies.length > 0);
});

test('detecta itens citados pela IA pelo nome exato', () => {
  const mentions = extractItemMentions('Recomendo o Cristovão Turbo Pickles com uma Coca-Cola Original 200ml.');
  assert.deepEqual(mentions.map((m) => m.itemId).sort(), ['bebida-1', 'destaque-2']);
});

test('prompt do Gemini é gerado do cardápio e da configuração', () => {
  const prompt = buildMenuPrompt();
  assert.ok(prompt.includes(STORE.name));
  assert.ok(prompt.includes(`${STORE.hours.opensAt} às ${STORE.hours.closesAt}`));
  for (const item of MENU_ITEMS) assert.ok(prompt.includes(item.name), `faltou ${item.name} no prompt`);
});
