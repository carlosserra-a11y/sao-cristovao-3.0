import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { env } from '../config/env.ts';
import { buildCspDirectives } from '../../shared/csp.ts';

/** Recursos do navegador que o site nunca usa: desligados para que nenhum script injetado os acesse. */
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=(self)',
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'usb=()',
  'interest-cohort=()',
].join(', ');

/**
 * Headers de segurança via Helmet.
 *
 * - Produção: CSP restritiva definida em shared/csp.ts (a mesma vira <meta> no
 *   build estático), HSTS por 1 ano, COOP/CORP, Permissions-Policy e
 *   `frame-ancestors 'none'` (anti-clickjacking) salvo FRAME_ANCESTORS.
 * - Desenvolvimento: CSP desativada porque o Vite injeta scripts inline
 *   (preamble do React Refresh) e usa WebSocket de HMR. Os demais headers
 *   do Helmet continuam ativos.
 * - FRAME_ANCESTORS: permite embutir o app em iframe de origens confiáveis
 *   (ex.: preview do AI Studio). Sem ele, ninguém pode embutir o site.
 */
export function securityHeaders(): RequestHandler {
  const directives = buildCspDirectives({ frameAncestors: env.frameAncestors });

  const helmetHandler = helmet({
    contentSecurityPolicy: env.isProd ? { useDefaults: false, directives: { ...directives, 'upgrade-insecure-requests': [] } } : false,
    // Necessário para carregar imagens de terceiros (Unsplash) sem CORP.
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    // X-Frame-Options não suporta lista de origens; com FRAME_ANCESTORS a CSP assume o controle.
    frameguard: env.frameAncestors.length > 0 ? false : { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  return (req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    helmetHandler(req, res, next);
  };
}

/** Correlaciona logs e respostas: X-Request-Id em toda requisição. */
export const requestId: RequestHandler = (_req, res, next) => {
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

/** Respostas da API nunca devem ser cacheadas (conteúdo dinâmico/pessoal). */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
