import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {buildCspDirectives, cspToMetaContent} from './shared/csp.ts';

/**
 * Só no build: injeta a CSP como <meta>. Em hospedagens estáticas (GitHub Pages)
 * não dá para definir cabeçalhos HTTP, então este é o freio de segurança do
 * navegador. No servidor Express a mesma política vai por cabeçalho (com
 * frame-ancestors, que <meta> não suporta). Em dev fica de fora: o HMR do Vite
 * precisa de script inline.
 */
function cspMetaPlugin(apiBaseUrl: string | undefined): Plugin {
  let connectOrigins: string[] = [];
  if (apiBaseUrl) {
    try {
      connectOrigins = [new URL(apiBaseUrl).origin];
    } catch {
      throw new Error(`VITE_API_BASE_URL inválida: ${apiBaseUrl}`);
    }
  }
  const content = cspToMetaContent(buildCspDirectives({ connectOrigins }));
  return {
    name: 'sao-cristovao:csp-meta',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Caminho público do site. "/" no servidor Express; o workflow do GitHub
    // Pages define BASE_PATH=/<nome-do-repo>/ para a versão estática.
    base: process.env.BASE_PATH || '/',
    plugins: [react(), tailwindcss(), cspMetaPlugin(env.VITE_API_BASE_URL)],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
