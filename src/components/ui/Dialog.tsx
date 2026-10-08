import React, { ReactNode, RefObject, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useModal } from '../../hooks/useModal';

interface DialogProps {
  onClose: () => void;
  /** id do título visível do diálogo (aria-labelledby). */
  labelledBy: string;
  /** id do texto descritivo (aria-describedby), quando houver. */
  describedBy?: string;
  /**
   * 'center' = modal centralizado · 'drawer' = painel lateral (carrinho) ·
   * 'panel' = chat: tela cheia no celular, janela no canto inferior direito no desktop.
   */
  variant?: 'center' | 'drawer' | 'panel';
  panelClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Casca acessível compartilhada por todos os modais (role="dialog",
 * aria-modal, focus trap, Escape, scroll lock, retorno de foco).
 * Renderizada em portal no <body>, fora do #root (que fica `inert`).
 */
export const Dialog: React.FC<DialogProps> = ({
  onClose,
  labelledBy,
  describedBy,
  variant = 'center',
  panelClassName = '',
  initialFocusRef,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  useModal(panelRef, onClose, { initialFocusRef });

  const isDrawer = variant === 'drawer';
  const isPanel = variant === 'panel';

  const containerClass = isDrawer
    ? 'fixed inset-0 z-50 flex justify-end'
    : isPanel
      ? 'fixed inset-0 z-50 flex items-end justify-end sm:p-5'
      : 'fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4';

  const initial = reduceMotion
    ? false
    : isDrawer
      ? { x: '100%' }
      : isPanel
        ? { opacity: 0, y: 24 }
        : { opacity: 0, y: 16, scale: 0.98 };
  const animate = isDrawer ? { x: 0 } : isPanel ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 };

  return createPortal(
    <div className={containerClass}>
      {/* Backdrop: clique fora fecha. Decorativo para leitores de tela. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 ${isPanel ? 'bg-black/50 sm:bg-black/30' : 'bg-black/80 backdrop-blur-sm'}`}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        initial={initial}
        animate={animate}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className={`relative outline-none ${panelClassName}`}
      >
        {children}
      </motion.div>
    </div>,
    document.body
  );
};

interface DialogCloseButtonProps {
  onClose: () => void;
  label?: string;
  className?: string;
}

export const DialogCloseButton: React.FC<DialogCloseButtonProps> = ({
  onClose,
  label = 'Fechar',
  className = 'p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer',
}) => (
  <button type="button" onClick={onClose} aria-label={label} className={className}>
    <X className="w-5 h-5" aria-hidden="true" />
  </button>
);
