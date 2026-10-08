import React, { memo } from 'react';
import { ShoppingBag, Bot, Sparkles, MapPin, Clock } from 'lucide-react';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';
import { formatBRL } from '../lib/format';
import { STORE_CLOSES_AT, STORE_OPENS_AT } from '../../shared/storeHours';

interface NavbarProps {
  totalItems: number;
  totalValue: number;
  onOpenCart: () => void;
  onOpenChat: () => void;
  onOpenStudio: () => void;
  /** Calculado automaticamente por useStoreStatus (18:00–23:30, America/Sao_Paulo). */
  isOpenStore: boolean;
  /** Pré-carrega os chunks dos modais ao passar o mouse/focar nos botões. */
  onPrefetchChat?: () => void;
  onPrefetchStudio?: () => void;
  onPrefetchCart?: () => void;
}

export const Navbar: React.FC<NavbarProps> = memo(function Navbar({
  totalItems,
  totalValue,
  onOpenCart,
  onOpenChat,
  onOpenStudio,
  isOpenStore,
  onPrefetchChat,
  onPrefetchStudio,
  onPrefetchCart,
}) {
  const itemsLabel = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0c0c0e]/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-20">
          {/* Marca e status */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <a href="#inicio" aria-label="São Cristóvão Burger — voltar ao início" className="shrink-0 rounded-full">
              <SaoCristovaoLogo size={44} className="hover:scale-105 transition-transform" />
            </a>
            <div className="hidden min-[400px]:flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-xl tracking-tight uppercase text-white font-display truncate">
                  São Cristóvão
                </span>
                <span className="hidden lg:inline px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-black uppercase">
                  Hamburgueria
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-400">
                <MapPin className="hidden sm:block w-3 h-3 text-amber-400" aria-hidden="true" />
                <span className="hidden sm:inline">Palhoça - SC</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  •
                </span>
                <span role="status" className="flex items-center gap-1 whitespace-nowrap">
                  <Clock className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                  <span className={isOpenStore ? 'text-green-400 font-semibold' : 'text-amber-400 font-semibold'}>
                    {isOpenStore ? `Aberto até ${STORE_CLOSES_AT}` : `Abre às ${STORE_OPENS_AT}`}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Links centrais (desktop) */}
          <nav aria-label="Principal" className="hidden xl:flex items-center gap-6 text-sm font-semibold text-zinc-300 whitespace-nowrap">
            <a href="#inicio" className="hover:text-amber-400 transition-colors">
              Início
            </a>
            <a href="#cardapio" className="hover:text-amber-400 transition-colors">
              Cardápio Completo
            </a>
            <button
              type="button"
              onClick={onOpenStudio}
              onPointerEnter={onPrefetchStudio}
              onFocus={onPrefetchStudio}
              className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Studio IA (1K-4K)</span>
            </button>
            <button
              type="button"
              onClick={onOpenChat}
              onPointerEnter={onPrefetchChat}
              onFocus={onPrefetchChat}
              className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4 text-orange-400" aria-hidden="true" />
              <span>Atendente IA</span>
            </button>
          </nav>

          {/* Ações */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenChat}
              onPointerEnter={onPrefetchChat}
              onFocus={onPrefetchChat}
              aria-label="Abrir atendente de pedidos com IA"
              className="h-11 min-w-11 px-2.5 sm:px-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4 text-orange-400" aria-hidden="true" />
              <span className="hidden sm:inline xl:hidden">Atendente IA</span>
            </button>

            <button
              type="button"
              onClick={onOpenStudio}
              onPointerEnter={onPrefetchStudio}
              onFocus={onPrefetchStudio}
              aria-label="Criar imagem de burger com IA"
              className="h-11 min-w-11 px-2.5 sm:px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="hidden sm:inline xl:hidden">Criar Burger IA</span>
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              onPointerEnter={onPrefetchCart}
              onFocus={onPrefetchCart}
              aria-label={`Abrir carrinho: ${itemsLabel}, total ${formatBRL(totalValue)}`}
              className="relative h-11 px-3 sm:px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-colors active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-black" aria-hidden="true" />
              <span className="flex flex-col text-left leading-tight" aria-hidden="true">
                <span>{formatBRL(totalValue)}</span>
                <span className="text-[10px] text-zinc-800 font-semibold">{itemsLabel}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});
