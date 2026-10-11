/**
 * Link da loja no iFood — validação pura (usada pelo navegador e pelos testes).
 *
 * O pedido é feito no iFood; o site só leva o cliente até lá. Como esse link
 * vem de configuração (variável de ambiente / storeConfig), ele é validado
 * antes de virar um <a href>: só https, só domínios do iFood, sem credenciais.
 * Isso impede que uma configuração adulterada transforme o botão "Pedir no
 * iFood" num redirecionamento para um site de terceiros (phishing).
 */

const ALLOWED_HOSTS = ['ifood.com.br', 'ifood.onelink.me'] as const;

const isAllowedHost = (hostname: string): boolean =>
  ALLOWED_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));

/** Devolve a URL normalizada se for um link legítimo do iFood; caso contrário, null. */
export function sanitizeIfoodUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;
  if (!isAllowedHost(url.hostname.toLowerCase())) return null;

  return url.toString();
}

/** Página inicial do iFood: usada apenas enquanto o link da loja não estiver configurado. */
export const IFOOD_HOME_URL = 'https://www.ifood.com.br/';
