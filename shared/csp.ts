/**
 * Content-Security-Policy em um só lugar. Usada por:
 *  - server/middleware/security.ts (cabeçalho HTTP, quando o Express serve o site);
 *  - vite.config.ts (<meta http-equiv>, para hospedagens estáticas como o GitHub
 *    Pages, que não permitem definir cabeçalhos).
 *
 * Princípios: nada de script de terceiros, nada de `unsafe-inline`/`unsafe-eval`
 * em scripts, nenhum <iframe>/<object>, formulários e <base> só para a própria
 * origem. Para liberar um novo serviço (ex.: analytics), adicione o domínio
 * AQUI de propósito — e só carregue o script depois do consentimento
 * (ver src/lib/consent.ts).
 */

export interface CspOptions {
  /** Origens que podem embutir o site em <iframe> (só vale no cabeçalho HTTP). */
  frameAncestors?: readonly string[];
  /** Origens extras para fetch/XHR (ex.: a API quando o site está em outro domínio). */
  connectOrigins?: readonly string[];
}

export type CspDirectives = Record<string, string[]>;

export function buildCspDirectives({ frameAncestors = [], connectOrigins = [] }: CspOptions = {}): CspDirectives {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    // Folhas de estilo só do próprio site; atributos style="" (Motion/React) continuam permitidos.
    'style-src': ["'self'"],
    'style-src-attr': ["'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    // Fotos do cardápio vêm do Unsplash; data:/blob: para imagens geradas e quadros do Hero.
    'img-src': ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
    'connect-src': ["'self'", ...connectOrigins],
    'media-src': ["'self'"],
    'manifest-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': frameAncestors.length > 0 ? ["'self'", ...frameAncestors] : ["'none'"],
  };
}

/** Diretivas que <meta http-equiv> não suporta (o navegador as ignora e avisa no console). */
const NOT_ALLOWED_IN_META = new Set(['frame-ancestors']);

export function cspToMetaContent(directives: CspDirectives): string {
  return Object.entries(directives)
    .filter(([name]) => !NOT_ALLOWED_IN_META.has(name))
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .concat('upgrade-insecure-requests')
    .join('; ');
}
