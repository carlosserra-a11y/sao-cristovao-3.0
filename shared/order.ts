import type { CustomizationOption, PaymentMethod } from './menuTypes.ts';
import { MENU_ITEMS } from './menuData.ts';
import {
  MAX_ITEM_QUANTITY,
  MIN_ORDER_VALUE,
  describeCustomization,
  getDeliveryFee,
  getUnitPrice,
  roundMoney,
  sanitizeCustomization,
  stripControlChars,
} from './pricing.ts';
import { formatBrazilianMobile, normalizeBrazilianMobile } from './phone.ts';
import { STORE, STORE_ETA_LABEL } from './storeConfig.ts';

/**
 * Pedido: contrato HTTP, validação/precificação e texto do WhatsApp.
 * Compartilhado para que servidor (POST /api/orders) e navegador (envio
 * direto pelo app do WhatsApp na versão estática) usem exatamente as mesmas
 * regras e o mesmo resumo.
 */

export const ORDER_LIMITS = {
  maxLines: 50,
  nameMin: 2,
  nameMax: 80,
  addressMin: 8,
  addressMax: 200,
  changeForMax: 20,
} as const;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  card: 'Cartão',
  cash: 'Dinheiro',
};

export interface OrderLineInput {
  itemId: string;
  quantity: number;
  customization?: CustomizationOption;
}

export interface OrderRequestBody {
  customer: { name: string; phone: string };
  address: string;
  paymentMethod: PaymentMethod;
  changeFor?: string;
  items: OrderLineInput[];
}

export interface PricedOrderLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  customization?: CustomizationOption;
}

/** Pedido validado e precificado a partir do cardápio (nunca do cliente). */
export interface PricedOrder {
  customer: { name: string; phone: string };
  address: string;
  paymentMethod: PaymentMethod;
  changeFor?: string;
  lines: PricedOrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export interface OrderResponseData {
  orderId: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  /** Se a confirmação também foi enviada ao WhatsApp do cliente. */
  customerNotified: boolean;
}

export type OrderValidationResult =
  | { ok: true; order: PricedOrder }
  | { ok: false; code: 'INVALID_PAYLOAD' | 'ORDER_BELOW_MINIMUM'; errors: string[] };

const MENU_BY_ID = new Map(MENU_ITEMS.map((item) => [item.id, item]));
const PAYMENT_METHODS: readonly PaymentMethod[] = ['pix', 'card', 'cash'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cleanText = (value: unknown): string =>
  typeof value === 'string' ? stripControlChars(value).replace(/\s+/g, ' ').trim() : '';

/**
 * Valida e precifica um pedido vindo de fonte não confiável.
 * Preços, nomes e taxa de entrega são recalculados a partir do cardápio.
 */
export function validateAndPriceOrder(body: unknown): OrderValidationResult {
  if (!isRecord(body)) return { ok: false, code: 'INVALID_PAYLOAD', errors: ['Corpo do pedido inválido.'] };
  const errors: string[] = [];

  const customer = isRecord(body.customer) ? body.customer : {};
  const name = cleanText(customer.name);
  if (name.length < ORDER_LIMITS.nameMin || name.length > ORDER_LIMITS.nameMax) {
    errors.push(`Informe seu nome (${ORDER_LIMITS.nameMin} a ${ORDER_LIMITS.nameMax} caracteres).`);
  }

  const phone = typeof customer.phone === 'string' ? normalizeBrazilianMobile(customer.phone) : null;
  if (!phone) errors.push('Informe um celular válido com DDD, ex.: (48) 99999-9999.');

  const address = cleanText(body.address);
  if (address.length < ORDER_LIMITS.addressMin || address.length > ORDER_LIMITS.addressMax) {
    errors.push('Informe o endereço completo de entrega.');
  }

  const paymentMethod = body.paymentMethod as PaymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod)) errors.push('Forma de pagamento inválida.');

  const changeFor = paymentMethod === 'cash' ? cleanText(body.changeFor).slice(0, ORDER_LIMITS.changeForMax) : '';

  const lines: PricedOrderLine[] = [];
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('O pedido precisa ter ao menos um item.');
  } else if (body.items.length > ORDER_LIMITS.maxLines) {
    errors.push(`O pedido aceita no máximo ${ORDER_LIMITS.maxLines} linhas.`);
  } else {
    body.items.forEach((raw, index) => {
      if (!isRecord(raw)) {
        errors.push(`Item ${index + 1} inválido.`);
        return;
      }
      const item = typeof raw.itemId === 'string' ? MENU_BY_ID.get(raw.itemId) : undefined;
      if (!item || item.isAvailable === false) {
        errors.push(`Item ${index + 1} não está disponível no cardápio.`);
        return;
      }
      const quantity = raw.quantity;
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
        errors.push(`Quantidade inválida para "${item.name}".`);
        return;
      }
      const customization = sanitizeCustomization(raw.customization);
      const unitPrice = getUnitPrice(item, customization);
      lines.push({ itemId: item.id, name: item.name, quantity, unitPrice, total: roundMoney(unitPrice * quantity), customization });
    });
  }

  if (errors.length > 0 || !phone) return { ok: false, code: 'INVALID_PAYLOAD', errors };

  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
  if (subtotal < MIN_ORDER_VALUE) {
    return {
      ok: false,
      code: 'ORDER_BELOW_MINIMUM',
      errors: [`O pedido mínimo é R$ ${MIN_ORDER_VALUE.toFixed(2).replace('.', ',')}.`],
    };
  }
  const deliveryFee = getDeliveryFee(subtotal);

  return {
    ok: true,
    order: {
      customer: { name, phone },
      address,
      paymentMethod,
      ...(changeFor ? { changeFor } : {}),
      lines,
      subtotal,
      deliveryFee,
      total: roundMoney(subtotal + deliveryFee),
    },
  };
}

const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

/** Resumo do pedido enviado à loja pelo WhatsApp. */
export function formatOrderMessage(orderId: string, order: PricedOrder): string {
  const payment =
    order.paymentMethod === 'cash' && order.changeFor
      ? `${PAYMENT_LABELS.cash} (troco para ${order.changeFor})`
      : PAYMENT_LABELS[order.paymentMethod];

  const items = order.lines.map((line) => {
    const details = describeCustomization(line.customization);
    const head = `• ${line.quantity}x ${line.name} — ${brl(line.total)}`;
    return details.length > 0 ? `${head}\n   ${details.join('; ')}` : head;
  });

  return [
    `🍔 *Novo pedido ${orderId}* — ${STORE.name}`,
    '',
    `*Cliente:* ${order.customer.name}`,
    `*WhatsApp:* ${formatBrazilianMobile(order.customer.phone)}`,
    `*Endereço:* ${order.address}`,
    `*Pagamento:* ${payment}`,
    '',
    '*Itens:*',
    ...items,
    '',
    `Subtotal: ${brl(order.subtotal)}`,
    `Entrega: ${order.deliveryFee === 0 ? 'Grátis' : brl(order.deliveryFee)}`,
    `*Total: ${brl(order.total)}*`,
  ].join('\n');
}

/** Confirmação curta enviada ao cliente (quando habilitado no servidor). */
export function formatCustomerConfirmation(orderId: string, order: PricedOrder): string {
  return [
    `Olá, ${order.customer.name.split(' ')[0]}! 🍔`,
    `Recebemos seu pedido *${orderId}* no ${STORE.name}.`,
    `Total: *${brl(order.total)}* (${PAYMENT_LABELS[order.paymentMethod]}).`,
    `Previsão de entrega: ${STORE_ETA_LABEL}. Obrigado pela preferência!`,
  ].join('\n');
}
