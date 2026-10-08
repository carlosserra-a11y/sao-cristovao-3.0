import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartItem, CustomizationOption, MenuItem } from '../types/burger';
import { CART_STORAGE_KEY, loadCart, saveCart } from '../lib/cartStorage';
import { MAX_ITEM_QUANTITY, getUnitPrice, isPlainCustomization, roundMoney } from '../lib/pricing';
import { createId } from '../lib/format';

/**
 * Estado do carrinho com persistência em localStorage e sincronização entre
 * abas. Todos os handlers são estáveis (useCallback) para que componentes
 * memoizados (ex.: MenuCard) não re-renderizem à toa.
 */
export function useCart() {
  const [cart, setCart] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  // Outra aba alterou o carrinho → recarrega (já validado) daqui.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY || event.key === null) setCart(loadCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback(
    (item: MenuItem, quantity: number, customization?: CustomizationOption) => {
      const safeQty = Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.floor(quantity)));
      setCart((prev) => [
        ...prev,
        {
          id: createId(item.id),
          item,
          quantity: safeQty,
          customization,
          totalPrice: roundMoney(getUnitPrice(item, customization) * safeQty),
        },
      ]);
    },
    []
  );

  /**
   * "Adicionar" rápido (cardápio e atendente): soma ao item sem personalização
   * ou cria nova linha. `amount` permite "quero 2 cocas" de uma vez.
   */
  const quickAdd = useCallback((item: MenuItem, amount = 1) => {
    const safeAmount = Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.floor(amount)));
    setCart((prev) => {
      const idx = prev.findIndex((ci) => ci.item.id === item.id && isPlainCustomization(ci.customization));
      if (idx === -1) {
        return [
          ...prev,
          { id: createId(item.id), item, quantity: safeAmount, totalPrice: roundMoney(item.price * safeAmount) },
        ];
      }
      const existing = prev[idx];
      const quantity = Math.min(MAX_ITEM_QUANTITY, existing.quantity + safeAmount);
      const next = [...prev];
      next[idx] = { ...existing, quantity, totalPrice: roundMoney(getUnitPrice(item) * quantity) };
      return next;
    });
  }, []);

  const updateQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((ci) => {
        if (ci.id !== cartItemId) return [ci];
        const quantity = Math.min(MAX_ITEM_QUANTITY, ci.quantity + delta);
        if (quantity <= 0) return [];
        return [
          { ...ci, quantity, totalPrice: roundMoney(getUnitPrice(ci.item, ci.customization) * quantity) },
        ];
      })
    );
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.id !== cartItemId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totals = useMemo(
    () => ({
      totalItems: cart.reduce((acc, ci) => acc + ci.quantity, 0),
      subtotal: roundMoney(cart.reduce((acc, ci) => acc + ci.totalPrice, 0)),
    }),
    [cart]
  );

  return { cart, ...totals, addItem, quickAdd, updateQuantity, removeItem, clearCart };
}
