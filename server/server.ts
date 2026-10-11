import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Express } from 'express';
import { createApp } from './app.ts';
import { env, isGeminiConfigured } from './config/env.ts';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

async function registerFrontend(app: Express): Promise<void> {
  if (!env.isProd) {
    // Vite só é carregado em desenvolvimento.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: PROJECT_ROOT,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    return;
  }

  // Arquivos ocultos (.env, .git...) nunca são servidos — nem pelo fallback da SPA.
  // Única exceção: /.well-known/ (security.txt).
  app.use((req, res, next) => {
    if (/(^|\/)\.(?!well-known(\/|$))/.test(req.path)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    next();
  });
  app.get('/.well-known/security.txt', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type('text/plain; charset=utf-8').sendFile(path.join(DIST_DIR, '.well-known', 'security.txt'), (err) => {
      if (err && !res.headersSent) res.status(404).type('text/plain').send('Not found');
    });
  });

  // Assets com hash no nome: cache longo e imutável.
  app.use(
    '/assets',
    express.static(path.join(DIST_DIR, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false })
  );
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  // Fallback da SPA: o index.html nunca é cacheado (sempre aponta para os assets atuais).
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

export async function startServer(): Promise<void> {
  const app = await createApp({ registerFrontend });

  if (!isGeminiConfigured()) {
    console.warn('⚠️  GEMINI_API_KEY não configurada — o assistente e o estúdio usarão respostas de contingência.');
  }

  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`🚀 Servidor São Cristóvão Burger rodando em http://localhost:${env.port} (${env.nodeEnv})`);
  });

  // Conexões lentas/penduradas (slowloris) não podem ocupar o servidor indefinidamente.
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;

  // Encerramento gracioso (Cloud Run envia SIGTERM antes de desligar a instância).
  const shutdown = (signal: string) => {
    console.log(`${signal} recebido — encerrando servidor...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
