import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Flame, PackageCheck, Bike, MessageCircle } from 'lucide-react';
import { Order } from '../types/burger';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';
import { Dialog, DialogCloseButton } from './ui/Dialog';
import { formatBRL } from '../lib/format';
import { buildWhatsAppLink } from '../lib/config';
import { formatBrazilianMobile } from '../../shared/phone';
import { STORE, STORE_ETA_LABEL, STORE_LOCATION } from '../../shared/storeConfig';

interface OrderStatusModalProps {
  order: Order;
  onClose: () => void;
}

const STEPS = [
  { num: 1, title: 'Pedido Recebido', desc: 'Confirmado na cozinha', icon: CheckCircle2 },
  { num: 2, title: 'Na Chapa a 200°C', desc: 'Criando crosta de Maillard', icon: Flame },
  { num: 3, title: 'Embalando com Cuidado', desc: 'Batatas crocantes e molhos', icon: PackageCheck },
  { num: 4, title: 'Saiu para Entrega', desc: `A caminho de ${STORE.city}`, icon: Bike },
] as const;

/** Momento (ms após a abertura) em que cada etapa simulada é alcançada. */
const STEP_SCHEDULE: ReadonlyArray<readonly [step: number, atMs: number]> = [
  [2, 4_000],
  [3, 12_000],
  [4, 22_000],
];

const STEP_MESSAGES: Record<number, string> = {
  1: 'O restaurante confirmou seu pedido e está separando os pães e carnes artesanais.',
  2: 'Seus burgers estão na chapa quente a 200°C com queijo cheddar derretendo no abafador!',
  3: 'Estamos montando a embalagem térmica para que tudo chegue crocante e quentinho.',
  4: `O motoboy saiu do restaurante em direção ao seu endereço em ${STORE.city}!`,
};

const PAYMENT_LABELS: Record<Order['paymentMethod'], string> = {
  pix: 'Pix',
  card: 'Cartão',
  cash: 'Dinheiro',
};

const CONTACT_MESSAGE = `Olá, gostaria de saber sobre meu pedido no ${STORE.name}`;

const OrderStatusModal: React.FC<OrderStatusModalProps> = ({ order, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  useEffect(() => {
    const timers = STEP_SCHEDULE.map(([step, atMs]) => window.setTimeout(() => setCurrentStep(step), atMs));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  const titleId = 'order-status-title';
  const descriptionId = 'order-status-description';
  const currentTitle = STEPS.find((s) => s.num === currentStep)?.title ?? '';

  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descriptionId}
      panelClassName="w-full max-w-xl my-auto bg-[#121216] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-5 sm:p-8 space-y-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <SaoCristovaoLogo size={52} className="hidden sm:block" />
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Pedido #{order.id} em Produção
            </div>
            <h2 id={titleId} className="text-2xl font-black text-white uppercase font-display mt-1">
              Acompanhar Pedido
            </h2>
            <p id={descriptionId} className="text-xs text-zinc-400">
              Previsão de entrega: {STORE_ETA_LABEL} • {STORE_LOCATION}
            </p>
          </div>
        </div>
        <DialogCloseButton onClose={onClose} label="Fechar acompanhamento do pedido" />
      </div>

      {order.channel === 'whatsapp-link' ? (
        <p className="p-3 rounded-xl bg-green-500/10 border border-green-400/30 text-xs text-green-100">
          Abrimos o WhatsApp com o resumo do seu pedido. <strong>Toque em enviar na conversa</strong> para a loja
          receber e confirmar.
        </p>
      ) : (
        <p className="p-3 rounded-xl bg-green-500/10 border border-green-400/30 text-xs text-green-100">
          Pedido enviado para o WhatsApp da loja
          {order.customerPhone ? ` — vamos falar com você no ${formatBrazilianMobile(order.customerPhone)}` : ''}.
        </p>
      )}

      {/* Etapas */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
        <ol className="relative flex items-start justify-between" aria-label="Etapas do pedido">
          <div aria-hidden="true" className="absolute top-[18px] left-4 right-4 h-0.5 bg-zinc-800" />
          <div
            aria-hidden="true"
            className="absolute top-[18px] left-4 right-4 h-0.5 bg-amber-400 origin-left transition-transform duration-700"
            style={{ transform: `scaleX(${(currentStep - 1) / (STEPS.length - 1)})` }}
          />

          {STEPS.map((st) => {
            const Icon = st.icon;
            const isDone = currentStep >= st.num;
            const isCurrent = currentStep === st.num;
            return (
              <li
                key={st.num}
                className="relative z-10 flex flex-col items-center"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-110'
                      : isDone
                        ? 'bg-amber-400 text-black'
                        : 'bg-zinc-800 text-zinc-400 border border-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-bold mt-2 text-center max-w-[70px] ${
                    isDone ? 'text-amber-300' : 'text-zinc-400'
                  }`}
                >
                  {st.title}
                  <span className="sr-only">{isDone ? ' — concluída' : ' — pendente'}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <p className="text-xs text-zinc-300" role="status" aria-live="polite">
            <span className="sr-only">{currentTitle}: </span>
            {STEP_MESSAGES[currentStep]}
          </p>
        </div>
      </div>

      <dl className="space-y-3 text-xs">
        <div className="flex justify-between gap-4 text-zinc-400">
          <dt>Endereço de Entrega:</dt>
          <dd className="text-white font-medium text-right max-w-xs break-words">{order.address}</dd>
        </div>
        <div className="flex justify-between gap-4 text-zinc-400">
          <dt>Pagamento:</dt>
          <dd className="text-white font-medium">
            {PAYMENT_LABELS[order.paymentMethod]}
            {order.paymentMethod === 'cash' && order.changeFor ? ` (troco para ${order.changeFor})` : ''}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-zinc-400">
          <dt>Total Pago:</dt>
          <dd className="text-amber-400 font-bold text-sm">{formatBRL(order.total)}</dd>
        </div>
      </dl>

      <div className="pt-2 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer"
        >
          Continuar no Cardápio
        </button>
        <a
          href={buildWhatsAppLink(`${CONTACT_MESSAGE} (${order.id}).`)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
          <span>Falar no WhatsApp</span>
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>
    </Dialog>
  );
};

export default OrderStatusModal;
