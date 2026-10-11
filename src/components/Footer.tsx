import React from 'react';
import { MapPin, Clock, Phone, Instagram, Facebook, MessageCircle, Bike, CreditCard, ExternalLink } from 'lucide-react';
import { SaoCristovaoLogo } from './SaoCristovaoLogo';
import { CATEGORIES, MENU_ITEMS } from '../data/menuData';
import { IFOOD_URL, buildWhatsAppLink } from '../lib/config';
import { openCookiePreferences } from '../lib/consent';
import {
  STORE,
  STORE_HOURS_LABEL,
  STORE_LOCATION,
  STORE_NEIGHBORHOODS_LABEL,
} from '../../shared/storeConfig';

// Só categorias que têm itens (Sobremesas fica oculta enquanto não houver produtos).
const FOOTER_CATEGORIES = CATEGORIES.filter((c) => MENU_ITEMS.some((i) => i.category === c));

const headingClass = 'font-bold text-white uppercase tracking-wider text-xs font-sans';

export const Footer: React.FC = () => {
  const socials = [
    { url: STORE.instagramUrl, label: 'Instagram', Icon: Instagram },
    { url: STORE.facebookUrl, label: 'Facebook', Icon: Facebook },
  ].filter((s) => s.url);

  return (
    <footer className="relative z-20 bg-black border-t border-white/10 text-zinc-300 text-xs pt-14 pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Marca */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SaoCristovaoLogo size={52} alt="" />
              <div className="flex flex-col">
                <span className="font-extrabold text-base text-white uppercase tracking-tight font-display">
                  {STORE.shortName}
                </span>
                <span className="text-[11px] tracking-wider font-bold text-amber-400 uppercase">{STORE.kind}</span>
              </div>
            </div>
            <p className="text-zinc-300 leading-relaxed">{STORE.slogan}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={IFOOD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA1D2C] hover:bg-[#d11a28] text-white font-bold transition-colors"
              >
                Pedir no iFood
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
              <a
                href={buildWhatsAppLink(`Olá! Vim pelo site do ${STORE.name}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
                Dúvidas? WhatsApp
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </div>
            {socials.length > 0 && (
              <div className="flex items-center gap-3 pt-1">
                {socials.map(({ url, label, Icon }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} do ${STORE.name} (abre em nova aba)`}
                    className="p-3 rounded-lg bg-white/5 hover:bg-amber-400 hover:text-black transition-colors"
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Funcionamento e entrega */}
          <div className="space-y-3">
            <h2 className={headingClass}>Funcionamento & Entrega</h2>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-px" aria-hidden="true" />
                <span>{STORE_HOURS_LABEL}</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-px" aria-hidden="true" />
                <span>
                  {STORE_LOCATION} — {STORE_NEIGHBORHOODS_LABEL}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Bike className="w-4 h-4 text-amber-400 shrink-0 mt-px" aria-hidden="true" />
                <span>Entrega pelo iFood — taxa e tempo conforme a sua região, no app.</span>
              </li>
            </ul>
          </div>

          {/* Cardápio */}
          <nav aria-label="Categorias do cardápio (rodapé)" className="space-y-3">
            <h2 className={headingClass}>Cardápio</h2>
            <ul className="space-y-2">
              {FOOTER_CATEGORIES.map((category) => (
                <li key={category}>
                  <a href="#cardapio" className="hover:text-amber-400 transition-colors">
                    {category}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Atendimento */}
          <div className="space-y-3">
            <h2 className={headingClass}>Atendimento</h2>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-amber-400 shrink-0 mt-px" aria-hidden="true" />
                <span>{STORE.phoneDisplay}</span>
              </li>
              <li className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-amber-400 shrink-0 mt-px" aria-hidden="true" />
                <span>Pagamento direto no iFood.</span>
              </li>
              <li className="text-zinc-400">CNPJ {STORE.cnpj}</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-400 text-[11px]">
          <p>
            © {new Date().getFullYear()} {STORE.name} • {STORE_LOCATION}. Todos os direitos reservados.
          </p>
          <nav aria-label="Informações legais" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#privacidade" className="hover:text-amber-400 transition-colors py-1">
              Política de Privacidade
            </a>
            <a href="#cookies" className="hover:text-amber-400 transition-colors py-1">
              Política de Cookies
            </a>
            <a href="#termos" className="hover:text-amber-400 transition-colors py-1">
              Termos de Uso
            </a>
            <button
              type="button"
              onClick={openCookiePreferences}
              className="hover:text-amber-400 transition-colors py-1 cursor-pointer"
            >
              Preferências de cookies
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
};
