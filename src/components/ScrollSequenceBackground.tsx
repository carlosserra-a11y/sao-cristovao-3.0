import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { HERO_SEQUENCE, HeroSequenceSet, heroFrameUrl } from '../lib/config';

/**
 * Fundo cinematográfico: a sequência de quadros do burger (Higgsfield
 * Seedance 2.0) é desenhada num <canvas> fixo atrás do site, e a ROLAGEM
 * escolhe o quadro:
 *
 *   topo da página      → burger montado
 *   rolando para baixo  → ingredientes se separam
 *   início do cardápio  → burger totalmente explodido
 *   rolando para cima   → tudo volta a se montar (reversível)
 *
 * Funciona em todos os navegadores, inclusive iPhone: não depende de
 * reprodução de vídeo (o Safari iOS não mostra vídeo "pulado" pela rolagem).
 *
 * Desempenho: nada de setState na rolagem — o progresso (com mola) só agenda
 * um desenho por quadro de tela (rAF); quadros vizinhos são misturados com
 * alfa, então a animação fica fluida mesmo com poucos quadros. Os quadros
 * carregam por prioridade (primeiro, último e depois refinando), então o
 * burger aparece imediatamente.
 *
 * Decorativo (aria-hidden). Com prefers-reduced-motion ou economia de dados,
 * mostra só o primeiro quadro.
 */

const SCROLL_SPRING = { stiffness: 140, damping: 30, mass: 0.4, restDelta: 0.0005 };
/** Fração da altura da tela em que o burger sai da direita e vai ao centro (desktop). */
const CENTERING_SCROLL_VH = 0.8;
const MOBILE_MAX_WIDTH = 767;
const DOWNLOAD_CONCURRENCY = 4;
/** Altura da navbar fixa: no celular o quadro começa logo abaixo dela. */
const MOBILE_TOP_OFFSET = 76;
/** Cor do fundo do site (#0c0c0e) usada nas máscaras desenhadas no canvas. */
const BG_RGB = '12,12,14';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Ordem de download: 0, último e depois refinando (a cada 8, 4, 2, 1 quadros). */
function loadOrder(count: number): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  const add = (i: number) => {
    if (i >= 0 && i < count && !seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  };
  add(0);
  add(count - 1);
  for (const stride of [8, 4, 2, 1]) for (let i = 0; i < count; i += stride) add(i);
  return order;
}

function isMobileViewport(): boolean {
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

function saveDataEnabled(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

export const ScrollSequenceBackground: React.FC = () => {
  const reduceMotion = useReducedMotion() ?? false;
  const [staticOnly] = useState(saveDataEnabled);
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const animated = !reduceMotion && !staticOnly;

  const set: HeroSequenceSet = isMobile ? HERO_SEQUENCE.mobile : HERO_SEQUENCE.desktop;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<(HTMLImageElement | null)[]>([]);
  const progressRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const rafRef = useRef(0);
  const drawRef = useRef<() => void>(() => undefined);

  // Distância de rolagem da explosão: do topo até o cardápio.
  const explodeDistance = useMotionValue(1);
  const viewportHeight = useMotionValue(window.innerHeight);
  const menuRef = useRef<HTMLElement | null>(document.getElementById('cardapio'));

  const scheduleDraw = () => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        drawRef.current();
      });
    }
  };

  // --- Desenho -------------------------------------------------------------
  drawRef.current = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const frames = framesRef.current;
    if (!canvas || !ctx || frames.length === 0) return;
    const { w: cw, h: ch } = sizeRef.current;
    if (cw === 0 || ch === 0) return;

    const count = set.count;
    const position = animated ? clamp01(progressRef.current) * (count - 1) : 0;
    const lo = Math.floor(position);
    const hi = Math.min(count - 1, lo + 1);
    const mix = position - lo;

    // Quadro carregado mais próximo (a partir de `from`, em direção a `dir`).
    const nearest = (from: number): HTMLImageElement | null => {
      for (let d = 0; d < count; d++) {
        const a = frames[from - d];
        if (a) return a;
        const b = frames[from + d];
        if (b) return b;
      }
      return null;
    };
    const first = nearest(lo);
    if (!first) return;

    ctx.clearRect(0, 0, cw, ch);

    // Posição do quadro: desktop = "cover" em tela cheia; celular = largura da
    // tela (um pouco maior), colado sob a navbar, com esmaecimento embaixo.
    const place = (img: HTMLImageElement) => {
      if (!isMobile) {
        const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const w = img.naturalWidth * s;
        const h = img.naturalHeight * s;
        return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
      }
      const w = cw * 1.12;
      const h = (w * img.naturalHeight) / img.naturalWidth;
      return { x: (cw - w) / 2, y: MOBILE_TOP_OFFSET * sizeRef.current.dpr, w, h };
    };

    const r = place(first);
    ctx.globalAlpha = 1;
    ctx.drawImage(first, r.x, r.y, r.w, r.h);

    if (mix > 0.001 && hi !== lo) {
      const second = nearest(hi);
      if (second && second !== first) {
        ctx.globalAlpha = mix;
        const r2 = place(second);
        ctx.drawImage(second, r2.x, r2.y, r2.w, r2.h);
        ctx.globalAlpha = 1;
      }
    }

    if (isMobile) {
      // Funde a borda inferior do quadro com o fundo do site (sem linha dura).
      const fadeH = r.h * 0.22;
      const g = ctx.createLinearGradient(0, r.y + r.h - fadeH, 0, r.y + r.h);
      g.addColorStop(0, `rgba(${BG_RGB},0)`);
      g.addColorStop(1, `rgba(${BG_RGB},1)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, r.y + r.h - fadeH, cw, fadeH + 1);
    }
  };

  // --- Dimensões do canvas (estáveis: usa 100lvh, não muda com a barra do Safari) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      sizeRef.current = { w, h, dpr };

      const menu = document.getElementById('cardapio');
      menuRef.current = menu;
      const vh = window.innerHeight;
      viewportHeight.set(vh);
      explodeDistance.set(Math.max(vh, (menu?.offsetTop ?? vh * 2) - vh * 0.35));
      setIsMobile(isMobileViewport());
      setIsDesktopLayout(window.matchMedia('(min-width: 1024px)').matches);
      scheduleDraw();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', schedule, { passive: true });
    // Imagens/fontes mudam a altura da página → remede a distância da explosão.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
    // scheduleDraw/viewportHeight/explodeDistance são estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Download dos quadros -----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const frames: (HTMLImageElement | null)[] = new Array(set.count).fill(null);
    framesRef.current = frames;
    const order = animated ? loadOrder(set.count) : [0];
    let cursor = 0;

    const loadNext = () => {
      if (cancelled || cursor >= order.length) return;
      const index = order[cursor++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (cancelled) return;
        frames[index] = img;
        scheduleDraw();
        loadNext();
      };
      img.onerror = () => loadNext();
      img.src = heroFrameUrl(set, index);
    };
    for (let i = 0; i < DOWNLOAD_CONCURRENCY; i++) loadNext();

    return () => {
      cancelled = true;
    };
    // scheduleDraw é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, animated]);

  // --- Rolagem → quadro ------------------------------------------------------
  const { scrollY } = useScroll();
  const rawProgress = useTransform([scrollY, explodeDistance], ([y, d]: number[]) => clamp01(y / d));
  const progress = useSpring(rawProgress, SCROLL_SPRING);

  useMotionValueEvent(progress, 'change', (p) => {
    progressRef.current = p;
    if (animated) scheduleDraw();
  });

  // Desktop: o burger começa na coluna direita do Hero e desliza para o centro.
  const x = useTransform([scrollY, viewportHeight], ([y, vh]: number[]) => {
    if (!isDesktopLayout) return '0vw';
    const t = clamp01(y / (vh * CENTERING_SCROLL_VH));
    const eased = t * t * (3 - 2 * t);
    return `${(1 - eased) * 22}vw`;
  });

  // Celular: o Hero tem muito texto — burger mais discreto lá, pleno depois.
  const heroOpacity = isMobile ? 0.5 : 1;
  const intro = useTransform([scrollY, viewportHeight], ([y, vh]: number[]) => clamp01(y / (vh * 0.9)));
  const { scrollYProgress: menuEnter } = useScroll({ target: menuRef, offset: ['start end', 'start 0.2'] });
  const opacity = useTransform([intro, menuEnter], ([i, m]: number[]) => {
    const base = heroOpacity + (1 - heroOpacity) * i;
    return base * (1 - 0.78 * clamp01(m));
  });

  // Brilho de estúdio atrás do burger: cresce conforme os ingredientes se abrem.
  const glowOpacity = useTransform(progress, [0, 1], [0.35, 0.7]);
  const glowScale = useTransform(progress, [0, 1], [0.9, 1.25]);

  const gradients = useMemo(
    () => (
      <>
        {/* Vinheta suave nas bordas */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(12,12,14,0.7)_100%)]" />
        {/* Desktop: sombra à esquerda para o título do Hero */}
        <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-[#0c0c0e]/90 via-[#0c0c0e]/25 via-45% to-transparent to-65%" />
        {/* Celular/tablet: texto no topo, burger no centro */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-[#0c0c0e]/70 via-[#0c0c0e]/25 via-55% to-[#0c0c0e]/60" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0c0c0e] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0c0c0e] to-transparent" />
      </>
    ),
    []
  );

  return (
    // 100lvh = altura "grande" da tela: não muda quando a barra do Safari recolhe.
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[100lvh] overflow-hidden bg-[#0c0c0e]">
      <motion.div className="absolute inset-0 will-change-transform" style={{ x, opacity }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {/* Brilho por cima dos quadros (blend só nesta área) */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen bg-[radial-gradient(closest-side,rgba(251,176,59,0.32),rgba(239,68,68,0.08)_60%,transparent)]"
          style={{ opacity: glowOpacity, scale: glowScale }}
        />
      </motion.div>
      {gradients}
    </div>
  );
};

export default ScrollSequenceBackground;
