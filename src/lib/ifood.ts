import type { CartItem } from '../types/burger';
import { describeCustomization, roundMoney } from './pricing';
import { formatBRL } from './format';
import { STORE } from '../../shared/storeConfig';

/**
 * O iFood não recebe um carrinho montado por outro site. Para o cliente não ter
 * que lembrar de tudo, o carrinho vira um resumo em texto que ele pode copiar
 * e consultar enquanto monta o mesmo pedido no iFood. Nada é enviado a servidor.
 */
export function formatCartSummary(cart: CartItem[]): string {
  const lines = cart.map((ci) => {
    const details = describeCustomization(ci.customization);
    const extra = details.length > 0 ? ` (${details.join(' · ')})` : '';
    return `• ${ci.quantity}x ${ci.item.name}${extra} — ${formatBRL(ci.totalPrice)}`;
  });
  const subtotal = roundMoney(cart.reduce((acc, ci) => acc + ci.totalPrice, 0));
  return [`Meu pedido no ${STORE.name}:`, ...lines, `Subtotal (valores do cardápio): ${formatBRL(subtotal)}`].join('\n');
}

/** Copia texto; usa a API moderna e cai para execCommand em navegadores/contextos sem ela. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
