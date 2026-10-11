import React, { useId, useState } from 'react';
import { Trash2, Plus, Minus, ShoppingBag, ExternalLink, AlertCircle, Copy, Check, Info } from 'lucide-react';
import { CartItem } from '../types/burger';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';
import { Dialog, DialogCloseButton } from './ui/Dialog';
import { SafeImage } from './ui/SafeImage';
import { formatBRL } from '../lib/format';
import { describeCustomization, roundMoney } from '../lib/pricing';
import { copyText, formatCartSummary } from '../lib/ifood';
import { IFOOD_URL } from '../lib/config';
import { STORE_OPENS_AT } from '../../shared/storeHours';
import { STORE } from '../../shared/storeConfig';

interface CartDrawerProps {
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  isOpenStore: boolean;
}

/**
 * Carrinho = "monte seu pedido". O pedido em si é feito no iFood (a loja atende
 * por lá), então este painel NÃO coleta nome, telefone, endereço nem pagamento:
 * só mostra o resumo e leva o cliente ao iFood. Menos dados = menos risco (LGPD).
 */
const CartDrawer: React.FC<CartDrawerProps> = ({ onClose, cart, onUpdateQuantity, onRemoveItem, isOpenStore }) => {
  const idPrefix = useId();
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  const subtotal = roundMoney(cart.reduce((acc, curr) => acc + curr.totalPrice, 0));

  const handleCopy = async () => {
    const ok = await copyText(formatCartSummary(cart));
    setCopied(ok ? 'ok' : 'fail');
    window.setTimeout(() => setCopied('idle'), 3000);
  };

  const titleId = 'cart-title';

  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      variant="drawer"
      panelClassName="h-full w-full max-w-md bg-[#121216] border-l border-white/10 flex flex-col shadow-2xl"
    >
      <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SaoCristovaoLogo size={38} alt="" />
          <div>
            <h2 id={titleId} className="font-extrabold text-base text-white uppercase font-display leading-tight">
              Seu Pedido
            </h2>
            <span className="text-[11px] text-amber-400 font-semibold uppercase">{STORE.shortName} {STORE.kind}</span>
          </div>
        </div>
        <DialogCloseButton onClose={onClose} label="Fechar resumo do pedido" />
      </div>

      {!isOpenStore && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>A loja abre às {STORE_OPENS_AT}. Confira no iFood se já é possível pedir ou agendar.</span>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="flex-1 text-center py-20 px-6 flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
            <ShoppingBag className="w-8 h-8" aria-hidden="true" />
          </div>
          <p className="text-zinc-200 text-sm font-medium">Seu pedido está vazio.</p>
          <p className="text-xs text-zinc-400 max-w-xs">Escolha seus smash burgers e depois finalize no iFood.</p>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="mt-2 px-5 py-3 rounded-xl bg-amber-400 text-black font-bold text-xs uppercase cursor-pointer"
          >
            Explorar Cardápio
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
            <ul className="space-y-3" aria-label="Itens do pedido">
              {cart.map((cartItem) => {
                const details = describeCustomization(cartItem.customization);
                return (
                  <li key={cartItem.id} className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        <SafeImage
                          src={cartItem.item.image}
                          alt=""
                          width={56}
                          height={56}
                          responsiveWidths={[120]}
                          sizes="56px"
                          className="w-14 h-14 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white line-clamp-2 font-sans">{cartItem.item.name}</h3>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {formatBRL(cartItem.totalPrice)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(cartItem.id)}
                        aria-label={`Remover ${cartItem.item.name} do pedido`}
                        className="text-zinc-400 hover:text-red-400 transition-colors p-2 -m-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>

                    {details.length > 0 && (
                      <p className="text-[11px] text-zinc-300 leading-relaxed break-words">{details.join(' · ')}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400" id={`${idPrefix}-qty-${cartItem.id}`}>
                        Quantidade
                      </span>
                      <div
                        role="group"
                        aria-labelledby={`${idPrefix}-qty-${cartItem.id}`}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1"
                      >
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(cartItem.id, -1)}
                          aria-label={`Diminuir quantidade de ${cartItem.item.name}`}
                          className="w-8 h-8 rounded bg-white/5 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
                        >
                          <Minus className="w-3 h-3" aria-hidden="true" />
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-white" aria-live="polite">
                          {cartItem.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(cartItem.id, 1)}
                          aria-label={`Aumentar quantidade de ${cartItem.item.name}`}
                          className="w-8 h-8 rounded bg-white/5 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
                        >
                          <Plus className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex gap-2.5 text-xs text-zinc-300 leading-relaxed">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-px" aria-hidden="true" />
              <p>
                O pedido é finalizado no <strong className="text-white">iFood</strong>, que não recebe o carrinho do nosso
                site. Copie o resumo abaixo para montar os mesmos itens por lá. Taxa de entrega, promoções e pagamento são
                definidos no iFood.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6 bg-black/85 border-t border-white/10 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <dl className="text-xs text-zinc-300">
              <div className="flex justify-between text-base font-extrabold text-white">
                <dt>Subtotal (cardápio)</dt>
                <dd className="text-amber-400 font-display">{formatBRL(subtotal)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleCopy}
              className="w-full min-h-11 py-3 rounded-xl border border-white/20 hover:border-amber-400/60 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copied === 'ok' ? (
                <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{copied === 'ok' ? 'Resumo copiado!' : copied === 'fail' ? 'Não foi possível copiar' : 'Copiar resumo do pedido'}</span>
            </button>
            <p className="sr-only" role="status">
              {copied === 'ok' ? 'Resumo do pedido copiado.' : copied === 'fail' ? 'Não foi possível copiar o resumo.' : ''}
            </p>

            <a
              href={IFOOD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-2xl bg-[#EA1D2C] hover:bg-[#d11a28] text-white font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
            >
              <span>Pedir no iFood</span>
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">(abre o iFood em nova aba)</span>
            </a>
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default CartDrawer;
