import React, { memo } from 'react';
import { ExternalLink, Bike, Layers } from 'lucide-react';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';
import { STORE_CLOSES_AT, STORE_OPENS_AT } from '../../shared/storeHours';
import { STORE, STORE_LOCATION } from '../../shared/storeConfig';
import { IFOOD_URL } from '../lib/config';

interface HeroSectionProps {
  isOpenStore: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = memo(function HeroSection({ isOpenStore }) {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="min-h-[100svh] flex items-center relative pt-24 pb-16 z-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 flex flex-col space-y-7 text-left">
          <div className="flex items-center gap-3.5">
            <SaoCristovaoLogo size={64} className="shadow-[0_0_25px_rgba(251,191,36,0.5)]" />
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-tight uppercase font-display">
                São Cristóvão Hamburgueria
              </span>
              <div className="inline-flex items-center gap-2 text-xs text-amber-400 font-semibold">
                <span className="relative flex w-2 h-2" aria-hidden="true">
                  {isOpenStore && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                  )}
                  <span
                    className={`relative inline-flex w-2 h-2 rounded-full ${isOpenStore ? 'bg-green-400' : 'bg-amber-400'}`}
                  />
                </span>
                <span>
                  {STORE_LOCATION} •{' '}
                  {isOpenStore ? (
                    <span className="text-green-400">Aberto agora até {STORE_CLOSES_AT}</span>
                  ) : (
                    `Abre às ${STORE_OPENS_AT}`
                  )}
                </span>
              </div>
            </div>
          </div>

          <h1
            id="hero-title"
            className="text-[2.75rem] leading-[0.95] min-[400px]:text-5xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-white sm:leading-[0.93] font-display"
          >
            A ARTE DO <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(251,191,36,0.35)]">
              SMASH REAL.
            </span>
          </h1>

          <p className="text-zinc-200 text-base sm:text-lg font-light leading-relaxed max-w-xl">
            Blend 100% fresco prensado a 200°C com a autêntica crosta de Maillard, dobro de cheddar derretido no abafador
            e pão brioche amanteigado. Sinta a diferença em cada mordida.
          </p>

          <ul className="flex flex-wrap items-center gap-3 text-xs" aria-label="Destaques da loja">
            <li className="px-3.5 py-2 rounded-xl bg-black/70 border border-white/10 flex items-center gap-2 text-zinc-200">
              <span className="text-amber-400 font-bold">★ {STORE.rating.value.toLocaleString('pt-BR')}</span>
              <span>({STORE.rating.reviews.toLocaleString('pt-BR')}+ avaliações)</span>
            </li>
            <li className="px-3.5 py-2 rounded-xl bg-black/70 border border-white/10 flex items-center gap-2 text-zinc-200">
              <Bike className="w-4 h-4 text-[#EA1D2C]" aria-hidden="true" />
              <span>Entrega pelo iFood</span>
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
            <a
              href={IFOOD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 sm:px-8 py-4 rounded-full font-black text-sm uppercase tracking-wider bg-[#EA1D2C] hover:bg-[#d11a28] text-white transition-[background-color,transform] duration-300 shadow-[0_0_25px_rgba(234,29,44,0.45)] hover:scale-105 active:scale-95 flex items-center gap-2.5 cursor-pointer"
            >
              <span>Pedir no iFood</span>
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">(abre o iFood em nova aba)</span>
            </a>

            <a
              href="#a-experiencia"
              className="px-6 py-4 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-white/5 border border-white/15 hover:bg-white/10 hover:border-amber-400/50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Ver Burger se Destrinchando</span>
            </a>
          </div>
        </div>

        {/* Coluna direita: aberta — o burger do vídeo de fundo aparece aqui. */}
        <div aria-hidden="true" className="hidden lg:block lg:col-span-6 min-h-[420px]" />
      </div>

      {/* Indicação de rolagem */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
        <span>Role para desmontar o burger</span>
        <span className="h-9 w-5 rounded-full border border-white/30 flex justify-center pt-1.5" aria-hidden="true">
          <span className="h-2 w-1 rounded-full bg-amber-400 animate-bounce" />
        </span>
      </div>
    </section>
  );
});
