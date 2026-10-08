import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { HERO_SCROLL_VIDEO } from '../lib/config';

/**
 * Fundo cinematográfico: o vídeo do burger (Higgsfield Seedance 2.0) fica
 * fixo atrás do site e a ROLAGEM controla o tempo do vídeo.
 *
 *   topo da página        → burger montado (primeiro quadro)
 *   rolando para baixo    → ingredientes se separam
 *   início do cardápio    → burger totalmente explodido (último quadro)
 *   rolando para cima     → tudo volta a se montar (reversível)
 *
 * Por que isso é fluido: o MP4 foi recodificado com quadro-chave em TODOS os
 * frames (all-intra, 60 fps), então pular para qualquer instante é imediato.
 * O tempo é suavizado com useSpring e aplicado sem setState (zero re-render
 * do React durante a rolagem). Novas buscas esperam a anterior terminar
 * (`seeked`), evitando fila de decodificação.
 *
 * Acessibilidade/consumo: decorativo (aria-hidden); com prefers-reduced-motion
 * ou "economia de dados" mostra só a imagem estática do burger montado.
 */

const SCROLL_SPRING = { stiffness: 140, damping: 30, mass: 0.4, restDelta: 0.0005 };
/** Fração da altura da tela até o burger sair do lado direito para o centro (desktop). */
const CENTERING_SCROLL_VH = 0.8;

const url = (path: string) => `${import.meta.env.BASE_URL}${path}`;

function prefersStaticBackground(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

export const ScrollVideoBackground: React.FC = () => {
  const reduceMotion = useReducedMotion() ?? false;
  const [staticOnly] = useState(prefersStaticBackground);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [videoSrc] = useState(() =>
    url(window.matchMedia('(min-width: 768px)').matches ? HERO_SCROLL_VIDEO.desktop : HERO_SCROLL_VIDEO.mobile)
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  // A seção do cardápio já está no DOM quando esta camada (lazy) monta.
  const menuRef = useRef<HTMLElement | null>(document.getElementById('cardapio'));
  const useVideo = !reduceMotion && !staticOnly;

  // Distância de rolagem em que a explosão acontece: do topo até o cardápio.
  const explodeDistance = useMotionValue(1);
  const viewportHeight = useMotionValue(window.innerHeight);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    let frame = 0;
    const measure = () => {
      frame = 0;
      const menu = document.getElementById('cardapio');
      const vh = window.innerHeight;
      viewportHeight.set(vh);
      explodeDistance.set(Math.max(vh, (menu?.offsetTop ?? vh * 2) - vh * 0.35));
      setIsDesktop(media.matches);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('resize', schedule, { passive: true });
    media.addEventListener('change', schedule);
    // O conteúdo (imagens lazy, fontes) muda a altura da página: remede.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', schedule);
      media.removeEventListener('change', schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [explodeDistance, viewportHeight]);

  const { scrollY } = useScroll();
  const rawProgress = useTransform([scrollY, explodeDistance], ([y, d]: number[]) =>
    Math.min(1, Math.max(0, y / d))
  );
  const progress = useSpring(rawProgress, SCROLL_SPRING);

  // Rolagem → tempo do vídeo (com fila de 1 busca pendente).
  const pendingTime = useRef<number | null>(null);
  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) {
      pendingTime.current = time;
      return;
    }
    if (video.seeking) {
      pendingTime.current = time;
      return;
    }
    if (Math.abs(video.currentTime - time) > 1 / 120) video.currentTime = time;
  };

  useMotionValueEvent(progress, 'change', (p) => {
    const video = videoRef.current;
    if (!useVideo || !video || !Number.isFinite(video.duration)) return;
    seekTo(p * Math.max(0, video.duration - 0.02));
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !useVideo) return;
    const flush = () => {
      if (pendingTime.current === null) return;
      const next = pendingTime.current;
      pendingTime.current = null;
      seekTo(next);
    };
    const onReady = () => {
      video.pause();
      seekTo(progress.get() * Math.max(0, video.duration - 0.02));
      flush();
    };
    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('seeked', flush);
    if (video.readyState >= 1) onReady();
    return () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('seeked', flush);
    };
    // seekTo/progress são estáveis para este efeito.
  }, [useVideo]);

  // Desktop: o burger começa na coluna direita do Hero e desliza para o centro.
  const x = useTransform([scrollY, viewportHeight], ([y, vh]: number[]) => {
    if (!isDesktop) return '0vw';
    const t = Math.min(1, Math.max(0, y / (vh * CENTERING_SCROLL_VH)));
    const eased = t * t * (3 - 2 * t);
    return `${(1 - eased) * 22}vw`;
  });

  // Esmaece atrás do cardápio para não competir com os cards.
  const { scrollYProgress: menuEnter } = useScroll({
    target: menuRef,
    offset: ['start end', 'start 0.2'],
  });
  const opacity = useTransform(menuEnter, [0, 1], [1, 0.22]);
  // Luz de estúdio quente atrás do burger: cresce conforme os ingredientes se abrem.
  const glowOpacity = useTransform(progress, [0, 1], [0.35, 0.7]);
  const glowScale = useTransform(progress, [0, 1], [0.9, 1.25]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0c0c0e]">
      <motion.div className="absolute inset-0 will-change-transform" style={{ x, opacity }}>
        {useVideo ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={url(HERO_SCROLL_VIDEO.poster)}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={url(HERO_SCROLL_VIDEO.poster)}
            alt=""
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Brilho de estúdio por cima do vídeo (blend só nesta área, não no vídeo inteiro) */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen bg-[radial-gradient(closest-side,rgba(251,176,59,0.32),rgba(239,68,68,0.08)_60%,transparent)]"
          style={{ opacity: glowOpacity, scale: glowScale }}
        />
      </motion.div>

      {/*
        Tratamento cinematográfico — leve o bastante para o burger "brilhar":
        vinheta suave nas bordas, sombra só onde há texto e fusão com o fundo do site.
      */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(12,12,14,0.7)_100%)]" />
      {/* Desktop: sombra à esquerda para o título do Hero */}
      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-[#0c0c0e]/90 via-[#0c0c0e]/25 via-45% to-transparent to-65%" />
      {/* Celular/tablet: texto no topo, burger no centro */}
      <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-[#0c0c0e]/85 via-[#0c0c0e]/35 via-55% to-[#0c0c0e]/70" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0c0c0e] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0c0c0e] to-transparent" />
    </div>
  );
};

export default ScrollVideoBackground;
