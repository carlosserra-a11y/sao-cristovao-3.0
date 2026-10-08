import React, { memo } from 'react';
import { MessageCircle } from 'lucide-react';

interface AssistantLauncherProps {
  onOpen: () => void;
  onPrefetch?: () => void;
  /** Itens no carrinho — mostrados como selo para lembrar de finalizar. */
  cartCount: number;
}

/**
 * Botão flutuante do atendente de pedidos (canto inferior direito).
 * Leve (sem motion) para ficar no bundle inicial; o painel do chat é lazy.
 */
export const AssistantLauncher: React.FC<AssistantLauncherProps> = memo(function AssistantLauncher({
  onOpen,
  onPrefetch,
  cartCount,
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      aria-label={`Abrir atendente para fazer o pedido${cartCount ? ` (${cartCount} ${cartCount === 1 ? 'item' : 'itens'} no carrinho)` : ''}`}
      className="group fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6 flex items-center gap-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-extrabold shadow-[0_12px_40px_rgba(251,191,36,0.45)] transition-[transform,background-color] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer pl-4 pr-4 sm:pr-5 h-14"
    >
      <span className="relative flex">
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-60 [animation-iteration-count:3]" />
        <MessageCircle className="relative w-6 h-6" aria-hidden="true" />
      </span>
      <span className="hidden sm:inline text-sm">Fazer pedido com o atendente</span>
      {cartCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-black text-amber-400 text-xs font-black flex items-center justify-center border-2 border-amber-400"
        >
          {cartCount}
        </span>
      )}
    </button>
  );
});
