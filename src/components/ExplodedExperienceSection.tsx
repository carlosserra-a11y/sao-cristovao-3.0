import React, { useState } from 'react';
import { Sparkles, Flame, ArrowDown, ShoppingBag } from 'lucide-react';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';

/**
 * Seção editorial sobre a anatomia do burger. O vídeo de fundo (fixo e
 * controlado pela rolagem) fica visível na coluna central desta seção.
 */
export const ExplodedExperienceSection: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<number | null>(null);

  const layers = [
    {
      id: 0,
      side: 'left',
      title: 'Brioche Tostado',
      subtitle: 'Pão Dourado na Chapa',
      desc: 'Pão brioche artesanal selado na manteiga com gergelim tostado. Macio por dentro, com barreira térmica que retém todos os sucos da carne.',
      temp: '180°C Selagem',
      badge: 'Brioche Artesanal',
      color: 'border-amber-400 text-amber-300',
    },
    {
      id: 1,
      side: 'left',
      title: 'Frescor Local',
      subtitle: 'Alface Americana & Tomates',
      desc: 'Folhas crocantes lavadas e selecionadas diariamente na Grande Florianópolis e fatias de tomate no ponto exato de acidez.',
      temp: 'Horta Local',
      badge: 'Crocância Pura',
      color: 'border-green-400 text-green-300',
    },
    {
      id: 2,
      side: 'right',
      title: 'Double Cheddar',
      subtitle: 'Derretido no Abafador',
      desc: 'Queijo cheddar legítimo em dose dupla, abafado com vapor d’água na chapa para envolver a carne num abraço cremoso e brilhante.',
      temp: 'Fusão Perfeita',
      badge: 'Cheddar Cremoso',
      color: 'border-amber-500 text-amber-300',
    },
    {
      id: 3,
      side: 'right',
      title: 'Smash Angus 120g',
      subtitle: 'Crosta de Maillard a 200°C',
      desc: 'Costela e acém frescos moídos no dia. Prensado com espátula pesada na chapa de ferro a mais de 200°C, gerando a lendária crosta caramelizada.',
      temp: '200°C na Chapa',
      badge: '100% Carne Angus',
      color: 'border-red-500 text-red-300',
    },
    {
      id: 4,
      side: 'left',
      title: 'Pão Base Selado',
      subtitle: 'Sustentação & Suculência',
      desc: 'Base estruturada que absorve a maionese secreta da casa e a gordura boa do smash sem amolecer até a última mordida.',
      temp: 'Estrutura Firme',
      badge: 'Base Firme',
      color: 'border-amber-400 text-amber-300',
    },
  ];

  return (
    <section
      id="a-experiencia"
      aria-labelledby="experiencia-title"
      className="relative min-h-[130vh] py-28 z-20 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center space-y-4 mb-16">
          <div className="flex items-center gap-3">
            <SaoCristovaoLogo size={58} className="shadow-[0_0_25px_rgba(251,191,36,0.5)]" />
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Camadas Flutuantes</span>
            </div>
          </div>

          <h2 id="experiencia-title" className="text-[6vw] lg:text-6xl font-black uppercase tracking-tight text-white font-display">
            O BURGER SE <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">DESTRINCHANDO</span>
          </h2>

          <p className="text-zinc-300 max-w-2xl text-sm sm:text-base leading-relaxed font-light">
            Nosso smash burger se desmonta em camadas no fundo do site, no ritmo do seu scroll. Veja a qualidade de cada ingrediente antes de fazer seu pedido.
          </p>
        </div>

        {/* 3-Column Layout: Left Cards | Open Center for Background Burger | Right Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[580px]">
          {/* Left Cards */}
          <div className="lg:col-span-4 space-y-5">
            {layers.filter((l) => l.side === 'left').map((item) => (
              <div
                key={item.id}
                onMouseEnter={() => setActiveLayer(item.id)}
                onMouseLeave={() => setActiveLayer(null)}
                className={`p-5 rounded-2xl border transition-[transform,background-color,border-color,box-shadow] duration-300 lg:backdrop-blur-md ${
                  activeLayer === item.id
                    ? `${item.color} bg-black/85 shadow-[0_0_30px_rgba(251,191,36,0.3)] translate-x-2`
                    : 'bg-black/80 lg:bg-black/60 border-white/10 hover:border-white/20 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white">
                    {item.badge}
                  </span>
                  <span className="text-[11px] font-mono text-amber-400">{item.temp}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-light">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Center Column: Intentionally open and transparent so the real floating layers burger in the background is the hero! */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-6 min-h-[380px] pointer-events-none">
            <div className="p-4 rounded-3xl bg-black/60 border border-white/10 max-w-xs space-y-2 pointer-events-auto">
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <Flame className="w-5 h-5 animate-pulse" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Chapa a 200°C • Maillard
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-tight">
                Role a página: cada ingrediente se separa conforme você desce — e volta ao subir.
              </p>
              <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400 pt-1">
                <ArrowDown className="w-3 h-3 animate-bounce text-amber-400" aria-hidden="true" />
                <span>Role para conferir o cardápio completo</span>
              </div>
            </div>
          </div>

          {/* Right Cards */}
          <div className="lg:col-span-4 space-y-5">
            {layers.filter((l) => l.side === 'right').map((item) => (
              <div
                key={item.id}
                onMouseEnter={() => setActiveLayer(item.id)}
                onMouseLeave={() => setActiveLayer(null)}
                className={`p-5 rounded-2xl border transition-[transform,background-color,border-color,box-shadow] duration-300 lg:backdrop-blur-md ${
                  activeLayer === item.id
                    ? `${item.color} bg-black/85 shadow-[0_0_30px_rgba(251,191,36,0.3)] -translate-x-2`
                    : 'bg-black/80 lg:bg-black/60 border-white/10 hover:border-white/20 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white">
                    {item.badge}
                  </span>
                  <span className="text-[11px] font-mono text-amber-400">{item.temp}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-light">{item.desc}</p>
              </div>
            ))}

            {/* CTA Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-400/30 bg-black/70 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>Gostou da Anatomia?</span>
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Peça agora mesmo com entrega rápida em Palhoça - SC.
              </p>
              <a
                href="#cardapio"
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <span>Ir para o Cardápio</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
