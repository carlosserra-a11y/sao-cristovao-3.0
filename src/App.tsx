/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useCallback, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ExplodedExperienceSection } from './components/ExplodedExperienceSection';
import { MenuSection } from './components/MenuSection';
import { Footer } from './components/Footer';
import { AssistantLauncher } from './components/AssistantLauncher';
import { LazyBoundary, ModalLoadError, ModalLoadingFallback, StaticBackdrop } from './components/ui/LazyBoundary';
import { useCart } from './hooks/useCart';
import { useStoreStatus } from './hooks/useStoreStatus';
import { useIdlePreload } from './hooks/useIdlePreload';
import { CustomizationOption, MenuItem, Order } from './types/burger';

// Code splitting: nada disso é necessário para o primeiro paint do cardápio.
const loadBackground = () => import('./components/BackgroundExperience');
const loadItemDetail = () => import('./components/ItemDetailModal');
const loadCartDrawer = () => import('./components/CartDrawer');
const loadOrderStatus = () => import('./components/OrderStatusModal');
const loadAssistant = () => import('./components/OrderAssistant');
const loadStudio = () => import('./components/GeminiImageStudioModal');

const BackgroundExperience = lazy(loadBackground);
const ItemDetailModal = lazy(loadItemDetail);
const CartDrawer = lazy(loadCartDrawer);
const OrderStatusModal = lazy(loadOrderStatus);
const OrderAssistant = lazy(loadAssistant);
const GeminiImageStudioModal = lazy(loadStudio);

const IDLE_PRELOADS = [loadItemDetail, loadCartDrawer, loadOrderStatus, loadAssistant, loadStudio] as const;

interface ChatState {
  open: boolean;
  initialQuery: string | null;
}

const CLOSED_CHAT: ChatState = { open: false, initialQuery: null };

export default function App() {
  const { cart, totalItems, subtotal, addItem, quickAdd, updateQuantity, removeItem, clearCart } = useCart();
  const { isOpen: isOpenStore } = useStoreStatus();

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [chat, setChat] = useState<ChatState>(CLOSED_CHAT);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<MenuItem | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useIdlePreload(IDLE_PRELOADS);

  // Handlers estáveis → os cards memoizados do cardápio não re-renderizam à toa.
  const handleAddToCart = useCallback(
    (item: MenuItem, quantity: number, customization: CustomizationOption) => {
      addItem(item, quantity, customization);
      setIsCartOpen(true);
    },
    [addItem]
  );

  const handleAskAIAboutItem = useCallback((item: MenuItem) => {
    setChat({
      open: true,
      initialQuery: `Me conte mais sobre o "${item.name}". Quais são os diferenciais do blend e que acompanhamento você recomenda?`,
    });
  }, []);

  const openChat = useCallback(() => setChat({ open: true, initialQuery: null }), []);
  const closeChat = useCallback(() => setChat(CLOSED_CHAT), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const openStudio = useCallback(() => setIsStudioOpen(true), []);
  const closeStudio = useCallback(() => setIsStudioOpen(false), []);
  const closeItemDetail = useCallback(() => setSelectedItemForDetail(null), []);
  const closeOrder = useCallback(() => setActiveOrder(null), []);

  // Atendente → carrinho / detalhes do item.
  const handleAssistantCheckout = useCallback(() => {
    setChat(CLOSED_CHAT);
    setIsCartOpen(true);
  }, []);
  const handleAssistantCustomize = useCallback((item: MenuItem) => {
    setChat(CLOSED_CHAT);
    setSelectedItemForDetail(item);
  }, []);

  const handleCheckoutSuccess = useCallback(
    (order: Order) => {
      setActiveOrder(order);
      clearCart();
      setIsCartOpen(false);
    },
    [clearCart]
  );

  const renderModal = (node: React.ReactNode, onClose: () => void) => (
    <LazyBoundary errorFallback={<ModalLoadError onClose={onClose} />}>
      <Suspense fallback={<ModalLoadingFallback />}>{node}</Suspense>
    </LazyBoundary>
  );

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#f4f4f5] flex flex-col relative overflow-x-clip selection:bg-amber-400 selection:text-black">
      <a
        href="#cardapio"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-amber-400 focus:text-black focus:font-bold"
      >
        Pular para o cardápio
      </a>

      {/* Fundo: vídeo do burger controlado pela rolagem (lazy) */}
      <LazyBoundary errorFallback={<StaticBackdrop />}>
        <Suspense fallback={<StaticBackdrop />}>
          <BackgroundExperience />
        </Suspense>
      </LazyBoundary>

      <Navbar
        totalItems={totalItems}
        totalValue={subtotal}
        onOpenCart={openCart}
        onOpenChat={openChat}
        onOpenStudio={openStudio}
        isOpenStore={isOpenStore}
        onPrefetchChat={loadAssistant}
        onPrefetchStudio={loadStudio}
        onPrefetchCart={loadCartDrawer}
      />

      <main className="flex-1 relative z-20">
        <HeroSection onOrderBurger={setSelectedItemForDetail} isOpenStore={isOpenStore} />
        <ExplodedExperienceSection />
        <MenuSection onSelectItem={setSelectedItemForDetail} />
      </main>

      <Footer />

      {/* Atendente de pedidos: botão flutuante sempre à mão */}
      {!chat.open && <AssistantLauncher onOpen={openChat} onPrefetch={loadAssistant} cartCount={totalItems} />}

      {/* Modais: montados somente quando abertos (estado sempre limpo, hooks nunca condicionais). */}
      {selectedItemForDetail &&
        renderModal(
          <ItemDetailModal
            key={selectedItemForDetail.id}
            item={selectedItemForDetail}
            onClose={closeItemDetail}
            onAddToCart={handleAddToCart}
            onAskAI={handleAskAIAboutItem}
          />,
          closeItemDetail
        )}

      {isCartOpen &&
        renderModal(
          <CartDrawer
            onClose={closeCart}
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onCheckoutSuccess={handleCheckoutSuccess}
            isOpenStore={isOpenStore}
          />,
          closeCart
        )}

      {activeOrder &&
        renderModal(<OrderStatusModal key={activeOrder.id} order={activeOrder} onClose={closeOrder} />, closeOrder)}

      {chat.open &&
        renderModal(
          <OrderAssistant
            onClose={closeChat}
            initialQuery={chat.initialQuery}
            cart={cart}
            isOpenStore={isOpenStore}
            onAddItem={quickAdd}
            onCustomize={handleAssistantCustomize}
            onCheckout={handleAssistantCheckout}
          />,
          closeChat
        )}

      {isStudioOpen && renderModal(<GeminiImageStudioModal onClose={closeStudio} />, closeStudio)}
    </div>
  );
}
