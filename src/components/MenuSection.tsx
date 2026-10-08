import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Flame, Users } from 'lucide-react';
import { MenuItem } from '../types/burger';
import { CATEGORIES, MENU_ITEMS } from '../data/menuData';
import { useDebounce } from '../hooks/useDebounce';
import { MenuCard } from './MenuCard';

interface MenuSectionProps {
  onSelectItem: (item: MenuItem) => void;
}

const SEARCH_DEBOUNCE_MS = 250;
/** Altura da navbar fixa: ao trocar de aba, o topo do cardápio fica logo abaixo dela. */
const NAVBAR_OFFSET = 88;

/** Remove acentos: "guarana" encontra "Guaraná". */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Cardápio estático: índice de busca e agrupamento calculados uma única vez.
const SEARCH_INDEX: ReadonlyMap<string, string> = new Map(
  MENU_ITEMS.map((item) => [item.id, normalize(`${item.name} ${item.description} ${item.subcategory ?? ''}`)])
);

/** Categorias com itens (ex.: Sobremesas fica oculta enquanto não houver produtos). */
const TABS: string[] = CATEGORIES.filter((category) => MENU_ITEMS.some((item) => item.category === category));

/** "Serve 2 pessoas" → 2 (filtro "para quantas pessoas"). */
const peopleOf = (item: MenuItem): number | null => {
  const match = item.serves?.match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const PEOPLE_FILTERS = [
  { value: 0, label: 'Todos' },
  { value: 1, label: '1 pessoa' },
  { value: 2, label: '2 pessoas' },
  { value: 3, label: '3+ pessoas' },
] as const;

const matchesPeople = (item: MenuItem, people: number) => {
  if (people === 0) return true;
  const n = peopleOf(item);
  return n !== null && (people === 3 ? n >= 3 : n === people);
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Cardápio em abas: uma categoria por vez (bem mais curto que a lista única).
 *
 * - Padrão WAI-ARIA "Tabs": role=tablist/tab/tabpanel, aria-selected, setas
 *   ←/→, Home/End trocam de aba (ativação automática), tabindex itinerante.
 * - Busca por nome/ingrediente: as abas mostram quantos resultados cada uma tem
 *   e as sem resultado somem; a aba ativa pula para a primeira com resultado.
 * - Categorias longas (Combos): filtro extra "para quantas pessoas".
 */
export const MenuSection: React.FC<MenuSectionProps> = ({ onSelectItem }) => {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);
  const [people, setPeople] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const sectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const query = normalize(debouncedSearch.trim());

  const itemsByTab = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const tab of TABS) {
      map.set(
        tab,
        MENU_ITEMS.filter(
          (item) => item.category === tab && (!query || SEARCH_INDEX.get(item.id)?.includes(query))
        )
      );
    }
    return map;
  }, [query]);

  const visibleTabs = useMemo(() => TABS.filter((tab) => (itemsByTab.get(tab)?.length ?? 0) > 0), [itemsByTab]);

  // A busca tirou a aba atual da lista → vai para a primeira aba com resultado.
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
  }, [visibleTabs, activeTab]);

  const tabItems = itemsByTab.get(activeTab) ?? [];
  const showPeopleFilter = !query && tabItems.length > 6 && tabItems.some((item) => peopleOf(item) !== null);
  const panelItems = showPeopleFilter ? tabItems.filter((item) => matchesPeople(item, people)) : tabItems;
  const totalResults = visibleTabs.reduce((sum, tab) => sum + (itemsByTab.get(tab)?.length ?? 0), 0);

  const selectTab = useCallback((tab: string, focus = false) => {
    setActiveTab(tab);
    setPeople(0);
    if (focus) tabRefs.current.get(tab)?.focus();
    // Se o usuário já rolou além do topo do cardápio, volta para o início da aba.
    const tabsBar = sectionRef.current?.querySelector<HTMLElement>('[data-menu-tabs]');
    const panel = sectionRef.current?.querySelector<HTMLElement>('[role="tabpanel"]');
    if (tabsBar && panel && panel.getBoundingClientRect().top < tabsBar.getBoundingClientRect().bottom) {
      const target = window.scrollY + panel.getBoundingClientRect().top - NAVBAR_OFFSET - tabsBar.offsetHeight - 8;
      window.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, []);

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = visibleTabs.indexOf(activeTab);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % visibleTabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + visibleTabs.length) % visibleTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = visibleTabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectTab(visibleTabs[next], true);
  };

  const tabId = (tab: string) => `${baseId}-tab-${TABS.indexOf(tab)}`;
  const panelId = `${baseId}-panel`;

  return (
    <section
      ref={sectionRef}
      id="cardapio"
      aria-labelledby="cardapio-title"
      className="pt-24 pb-24 relative z-20 bg-[#0c0c0e]/85 border-t border-white/5"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            Cardápio Oficial
          </div>
          <h2
            id="cardapio-title"
            className="text-4xl sm:text-5xl font-black uppercase text-white tracking-tight font-display"
          >
            Escolha seu{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
              Smash Favorito
            </span>
          </h2>
          <p className="text-zinc-300 max-w-2xl text-sm sm:text-base">
            Escolha uma categoria e toque no item para ver detalhes, adicionais e montar seu pedido.
          </p>
        </header>

        {/* Busca */}
        <div className="max-w-2xl mx-auto mb-3 relative" role="search">
          <label htmlFor={`${baseId}-search`} className="sr-only">
            Buscar no cardápio por nome ou ingrediente
          </label>
          <Search
            className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id={`${baseId}-search`}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou ingrediente (ex.: costela, bacon, coca)"
            autoComplete="off"
            enterKeyHint="search"
            aria-describedby={`${baseId}-search-status`}
            className="w-full pl-12 pr-20 py-3.5 bg-zinc-900 border border-white/15 rounded-2xl text-base sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-amber-400 transition-colors [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>
        <p
          id={`${baseId}-search-status`}
          className="text-center text-xs text-zinc-400 mb-6"
          aria-live="polite"
          aria-atomic="true"
        >
          {query
            ? `${totalResults} ${totalResults === 1 ? 'item encontrado' : 'itens encontrados'} para "${debouncedSearch.trim()}"`
            : `${MENU_ITEMS.length} itens em ${TABS.length} categorias`}
        </p>
      </div>

      {visibleTabs.length === 0 ? (
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center py-16 bg-zinc-900/80 rounded-3xl border border-white/10">
            <p className="text-zinc-200 text-base mb-4">Nenhum item encontrado para sua busca.</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-5 py-3 rounded-xl bg-amber-400 text-black font-bold text-xs uppercase cursor-pointer"
            >
              Ver cardápio completo
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Abas fixas logo abaixo da navbar */}
          <div
            data-menu-tabs
            className="sticky top-20 z-30 mb-6 bg-[#0c0c0e]/95 backdrop-blur-md border-y border-white/10"
          >
            <div
              role="tablist"
              aria-label="Categorias do cardápio"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleTabs.map((tab) => {
                const selected = tab === activeTab;
                const count = itemsByTab.get(tab)?.length ?? 0;
                return (
                  <button
                    key={tab}
                    ref={(el) => {
                      if (el) tabRefs.current.set(tab, el);
                      else tabRefs.current.delete(tab);
                    }}
                    id={tabId(tab)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(tab)}
                    onKeyDown={onTabKeyDown}
                    className={`shrink-0 min-h-11 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-colors flex items-center gap-2 cursor-pointer ${
                      selected
                        ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35)]'
                        : 'bg-zinc-900 text-zinc-200 border-white/15 hover:border-amber-400/60 hover:text-white'
                    }`}
                  >
                    {tab}
                    <span
                      className={`text-[11px] px-1.5 rounded-full ${selected ? 'bg-black/15 text-black' : 'bg-white/10 text-zinc-300'}`}
                    >
                      <span className="sr-only">(</span>
                      {count}
                      <span className="sr-only">{count === 1 ? " item)" : " itens)"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId(activeTab)}
              tabIndex={0}
              className="scroll-mt-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-3xl"
            >
              <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <h3 className="text-xl min-[400px]:text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
                  {activeTab}
                  <span className="ml-3 text-sm font-semibold text-zinc-400 normal-case tracking-normal font-sans">
                    {panelItems.length} {panelItems.length === 1 ? 'item' : 'itens'}
                  </span>
                </h3>

                {showPeopleFilter && (
                  <div role="group" aria-label="Para quantas pessoas?" className="flex flex-wrap items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    {PEOPLE_FILTERS.map((filter) => {
                      const count = tabItems.filter((item) => matchesPeople(item, filter.value)).length;
                      if (count === 0) return null;
                      const pressed = people === filter.value;
                      return (
                        <button
                          key={filter.value}
                          type="button"
                          aria-pressed={pressed}
                          onClick={() => setPeople(filter.value)}
                          className={`min-h-9 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                            pressed
                              ? 'bg-white text-black border-white'
                              : 'bg-zinc-900 text-zinc-200 border-white/15 hover:border-white/40'
                          }`}
                        >
                          {filter.label} <span className="opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {panelItems.map((item) => (
                  <li key={item.id} className="flex">
                    <MenuCard item={item} onSelect={onSelectItem} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
