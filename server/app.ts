import express from 'express';
import type { Express } from 'express';
import { env } from './config/env.ts';
import { apiLimiter } from './middleware/rateLimiter.ts';
import { noStore, requestId, securityHeaders } from './middleware/security.ts';
import { apiNotFound, errorHandler } from './middleware/errorHandler.ts';
import { corsPolicy } from './middleware/cors.ts';
import { aiRoutes } from './routes/aiRoutes.ts';
import { storeRoutes } from './routes/storeRoutes.ts';
import { orderRoutes } from './routes/orderRoutes.ts';

export interface CreateAppOptions {
  /** Registra o frontend (Vite em dev / estáticos em prod) antes do errorHandler. */
  registerFrontend?: (app: Express) => void | Promise<void>;
}

/**
 * Monta a aplicação Express (sem abrir porta — facilita testes).
 * Ordem: segurança → API (rate limit, rotas, 404 JSON) → frontend → erros.
 */
export async function createApp({ registerFrontend }: CreateAppOptions = {}): Promise<Express> {
  const app = express();

  // Atrás de proxy (Cloud Run/AI Studio) o IP real vem em X-Forwarded-For —
  // necessário para o rate limit por IP funcionar corretamente.
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(securityHeaders());

  const api = express.Router();
  api.use(corsPolicy, noStore, apiLimiter);
  api.use('/store', storeRoutes);
  if (env.directOrders) api.use('/orders', orderRoutes);
  api.use(aiRoutes);
  api.use(apiNotFound);
  app.use('/api', api);

  if (registerFrontend) await registerFrontend(app);

  app.use(errorHandler);
  return app;
}
