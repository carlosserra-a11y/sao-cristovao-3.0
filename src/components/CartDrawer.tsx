import React, { useCallback, useId, useState } from 'react';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  MapPin,
  CreditCard,
  QrCode,
  Banknote,
  AlertCircle,
  Loader2,
  MessageCircle,
  User,
  Phone,
} from 'lucide-react';
import { CartItem, Order, PaymentMethod } from '../types/burger';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';
import { Dialog, DialogCloseButton } from './ui/Dialog';
import { SafeImage } from './ui/SafeImage';
import { formatBRL } from '../lib/format';
import { MIN_ORDER_VALUE, describeCustomization, getDeliveryFee, roundMoney } from '../lib/pricing';
import { STORE_OPENS_AT } from '../../shared/storeHours';
import { ORDER_LIMITS } from '../../shared/order';
import { STORE, STORE_LOCATION, brl } from '../../shared/storeConfig';
import { CheckoutForm, FieldErrors, useCheckout, validateCheckoutFields } from '../hooks/useCheckout';

interface CartDrawerProps {
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onCheckoutSuccess: (order: Order) => void;
  isOpenStore: boolean;
}

const PAYMENT_OPTIONS: ReadonlyArray<{ value: PaymentMethod; label: string; Icon: typeof QrCode }> = [
  { value: 'pix', label: 'Pix', Icon: QrCode },
  { value: 'card', label: 'Cartão', Icon: CreditCard },
  { value: 'cash', label: 'Dinheiro', Icon: Banknote },
];

const INITIAL_FORM: CheckoutForm = { name: '', phone: '', address: '', paymentMethod: 'pix', changeFor: '' };

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-base sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-amber-400 aria-[invalid=true]:border-red-400';

interface FieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  hint?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ id, label, icon, error, hint, children }) => {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy || undefined })}
      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-red-300 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[11px] text-zinc-400">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

const CartDrawer: React.FC<CartDrawerProps> = ({
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckoutSuccess,
  isOpenStore,
}) => {
  const [form, setForm] = useState<CheckoutForm>(INITIAL_FORM);
  const [attempted, setAttempted] = useState(false);
  const idPrefix = useId();

  const handleSuccess = useCallback(
    (order: Order) => {
      // canvas-confetti só é baixado quando um pedido é concluído (code splitting).
      import('canvas-confetti')
        .then(({ default: confetti }) =>
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#fbbf24', '#f59e0b', '#ef4444', '#10b981'],
            disableForReducedMotion: true,
          })
        )
        .catch(() => undefined);
      onCheckoutSuccess(order);
    },
    [onCheckoutSuccess]
  );

  const checkout = useCheckout(cart, handleSuccess);

  const subtotal = roundMoney(cart.reduce((acc, curr) => acc + curr.totalPrice, 0));
  const deliveryFee = getDeliveryFee(subtotal);
  const total = roundMoney(subtotal + deliveryFee);
  const reachedMinimum = subtotal >= MIN_ORDER_VALUE;
  const missingAmount = Math.max(0, MIN_ORDER_VALUE - subtotal);
  const minProgress = Math.min(100, (subtotal / MIN_ORDER_VALUE) * 100);

  const fieldErrors: FieldErrors = attempted ? validateCheckoutFields(form) : {};
  const isSubmitting = checkout.status === 'submitting';

  const update = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (checkout.status === 'error') checkout.reset();
  };

  const focusFirstInvalid = (errors: FieldErrors) => {
    const first = (['name', 'phone', 'address'] as const).find((key) => errors[key]);
    if (first) document.getElementById(`${idPrefix}-${first}`)?.focus();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    const errors = validateCheckoutFields(form);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(errors);
      return;
    }
    if (checkout.hasBackend) void checkout.submit(form);
  };

  // Envio direto pelo app do WhatsApp (site estático ou falha no envio automático).
  const whatsAppLink = reachedMinimum && Object.keys(validateCheckoutFields(form)).length === 0
    ? checkout.prepareWhatsAppLink(form)
    : null;

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
              Seu Carrinho
            </h2>
            <span className="text-[11px] text-amber-400 font-semibold uppercase">{STORE.shortName} {STORE.kind}</span>
          </div>
        </div>
        <DialogCloseButton onClose={onClose} label="Fechar carrinho" />
      </div>

      {!isOpenStore && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>A loja abre às {STORE_OPENS_AT}. Você pode antecipar e agendar seu pedido normalmente!</span>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="flex-1 text-center py-20 px-6 flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
            <ShoppingBag className="w-8 h-8" aria-hidden="true" />
          </div>
          <p className="text-zinc-200 text-sm font-medium">Seu carrinho está vazio.</p>
          <p className="text-xs text-zinc-400 max-w-xs">Adicione nossos smash burgers para começar seu pedido!</p>
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
        <form onSubmit={handleSubmit} noValidate className="flex-1 min-h-0 flex flex-col" aria-busy={isSubmitting}>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
            {/* Pedido mínimo */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-zinc-200">Pedido mínimo ({formatBRL(MIN_ORDER_VALUE)}):</span>
                {reachedMinimum ? (
                  <span className="text-green-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Atingido!
                  </span>
                ) : (
                  <span className="text-amber-300 font-bold">Faltam {formatBRL(missingAmount)}</span>
                )}
              </div>
              <div
                className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden"
                role="progressbar"
                aria-label="Progresso até o pedido mínimo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(minProgress)}
              >
                <div
                  className={`h-full w-full origin-left transition-transform duration-300 ${reachedMinimum ? 'bg-green-400' : 'bg-amber-400'}`}
                  style={{ transform: `scaleX(${minProgress / 100})` }}
                />
              </div>
            </div>

            {/* Itens */}
            <ul className="space-y-3" aria-label="Itens no carrinho">
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
                        aria-label={`Remover ${cartItem.item.name} do carrinho`}
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

            {/* Dados de entrega */}
            <fieldset className="pt-4 border-t border-white/10 space-y-4" disabled={isSubmitting}>
              <legend className="text-sm font-bold text-white uppercase tracking-wider mb-3">Dados para entrega</legend>

              <Field
                id={`${idPrefix}-name`}
                label="Seu nome"
                icon={<User className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />}
                error={fieldErrors.name}
              >
                {(a11y) => (
                  <input
                    {...a11y}
                    type="text"
                    value={form.name}
                    autoComplete="name"
                    maxLength={ORDER_LIMITS.nameMax}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="Como devemos te chamar?"
                    className={inputClass}
                  />
                )}
              </Field>

              <Field
                id={`${idPrefix}-phone`}
                label="Celular (WhatsApp)"
                icon={<Phone className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />}
                error={fieldErrors.phone}
                hint="Com DDD. Usamos só para falar sobre este pedido."
              >
                {(a11y) => (
                  <input
                    {...a11y}
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    autoComplete="tel"
                    maxLength={20}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="(48) 99999-9999"
                    className={inputClass}
                  />
                )}
              </Field>

              <Field
                id={`${idPrefix}-address`}
                label={`Endereço (${STORE_LOCATION})`}
                icon={<MapPin className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />}
                error={fieldErrors.address}
                hint="Rua, número, bairro e complemento."
              >
                {(a11y) => (
                  <input
                    {...a11y}
                    type="text"
                    value={form.address}
                    autoComplete="street-address"
                    maxLength={ORDER_LIMITS.addressMax}
                    onChange={(e) => update('address', e.target.value)}
                    placeholder={`Ex.: Rua das Flores, 123 - ${STORE.neighborhoods[0]}`}
                    className={inputClass}
                  />
                )}
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-xs font-bold text-zinc-200 mb-2">Forma de pagamento (na entrega)</legend>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map(({ value, label, Icon }) => (
                    <label
                      key={value}
                      className={`min-h-14 p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400 ${
                        form.paymentMethod === value
                          ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                          : 'bg-white/5 border-white/15 text-zinc-200 hover:text-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${idPrefix}-payment`}
                        value={value}
                        checked={form.paymentMethod === value}
                        onChange={() => update('paymentMethod', value)}
                        className="sr-only"
                      />
                      <Icon className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {form.paymentMethod === 'cash' && (
                  <div className="pt-1">
                    <label htmlFor={`${idPrefix}-change`} className="text-[11px] text-zinc-300 block mb-1">
                      Troco para quanto? (opcional)
                    </label>
                    <input
                      id={`${idPrefix}-change`}
                      type="text"
                      inputMode="decimal"
                      value={form.changeFor}
                      maxLength={ORDER_LIMITS.changeForMax}
                      onChange={(e) => update('changeFor', e.target.value)}
                      placeholder="Ex.: R$ 100"
                      className={inputClass}
                    />
                  </div>
                )}
              </fieldset>
            </fieldset>
          </div>

          {/* Resumo e envio */}
          <div className="p-4 sm:p-6 bg-black/85 border-t border-white/10 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <dl className="space-y-1 text-xs text-zinc-300">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="text-white font-mono">{formatBRL(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Entrega ({STORE.city})</dt>
                <dd className={deliveryFee === 0 ? 'text-green-400 font-bold' : 'text-white font-mono'}>
                  {deliveryFee === 0 ? `Grátis (acima de ${brl(STORE.delivery.freeAbove)})` : formatBRL(deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-white/10">
                <dt>Total</dt>
                <dd className="text-amber-400 font-display">{formatBRL(total)}</dd>
              </div>
            </dl>

            {/* Erro amigável (anunciado a leitores de tela) */}
            <div aria-live="assertive">
              {checkout.status === 'error' && checkout.error && (
                <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-400/40 text-xs text-red-100 space-y-2">
                  <p className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-px" aria-hidden="true" />
                    <span>{checkout.error.message}</span>
                  </p>
                  {checkout.error.details.length > 0 && (
                    <ul className="list-disc pl-8 space-y-0.5">
                      {checkout.error.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  )}
                  {checkout.error.offerWhatsAppLink && whatsAppLink && (
                    <a
                      href={whatsAppLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={whatsAppLink.finalize}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-bold"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                      Enviar pelo WhatsApp
                      <span className="sr-only">(abre o WhatsApp em nova aba)</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {checkout.hasBackend ? (
              <button
                type="submit"
                disabled={!reachedMinimum || isSubmitting}
                className="w-full py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(251,191,36,0.3)] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Enviando pedido...</span>
                  </>
                ) : (
                  <>
                    <span>{reachedMinimum ? 'Finalizar pedido' : 'Pedido mínimo não atingido'}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            ) : whatsAppLink ? (
              <a
                href={whatsAppLink.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={whatsAppLink.finalize}
                className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-400 text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Enviar pedido pelo WhatsApp</span>
                <span className="sr-only">(abre o WhatsApp em nova aba)</span>
              </a>
            ) : (
              <button
                type="submit"
                disabled={!reachedMinimum}
                className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>{reachedMinimum ? 'Enviar pedido pelo WhatsApp' : 'Pedido mínimo não atingido'}</span>
              </button>
            )}
          </div>
        </form>
      )}
    </Dialog>
  );
};

export default CartDrawer;
