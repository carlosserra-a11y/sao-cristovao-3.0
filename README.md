# São Cristóvão 3.0 — Palhoça/SC

Cardápio digital premium da hamburgueria **São Cristóvão Burger**: vídeo cinematográfico do burger que se desmonta
conforme a rolagem, cardápio em abas, **atendente de IA que monta o pedido**, carrinho persistente e **pedido finalizado no iFood**
(canal oficial da loja). Com aviso de cookies (LGPD) e segurança em camadas.

## Novidades da 3.0

- **Hero com o burger (Higgsfield Seedance 2.0)** em tela cheia, controlado pela rolagem (sequência de quadros em canvas, funciona no iPhone), com tratamento de cor quente,
  mais nitidez e qualidade de compressão maior; iluminação do site refeita (vinheta suave + brilho dourado).
- **Cardápio em abas** (Destaques, Hambúrgueres, Combos, Acompanhamentos, Bebidas): uma categoria por vez,
  filtro "para quantas pessoas" nos combos e busca que mostra quantos resultados há em cada aba.
  Fotos quebradas do cardápio original substituídas.
- **Atendente de pedidos** (botão flutuante): entende frases como "quero 2 Cristovão Bacon e uma Coca" ou
  "combo para casal", adiciona ao carrinho e leva ao checkout. Com servidor + `GEMINI_API_KEY`, quem responde é o
  Gemini (prompt gerado do cardápio); sem servidor (GitHub Pages), o atendente automático responde sozinho.
- **Configuração central da loja** em [`shared/storeConfig.ts`](shared/storeConfig.ts): nome, telefone, WhatsApp,
  bairros, horário, pedido mínimo, taxa e frete grátis — o site inteiro (e o servidor) lê dali.

## Pedidos pelo iFood

A loja atende pelo iFood, então o site é a vitrine: o cliente monta o pedido (carrinho/atendente), copia o resumo e
toca em **Pedir no iFood**. O site **não coleta nome, telefone, endereço nem pagamento** (menos risco, menos LGPD).

**Configure o link da loja** (obrigatório antes de publicar — hoje os botões levam à página inicial do iFood):

- GitHub Pages: *Settings → Secrets and variables → Actions → Variables* → `IFOOD_URL`
- Local/servidor: `VITE_IFOOD_URL` no `.env`, ou `ifoodUrl` em [`shared/storeConfig.ts`](shared/storeConfig.ts)

O link é validado ([`shared/ifood.ts`](shared/ifood.ts)): só `https` e domínios do iFood; qualquer outro valor é ignorado.
O iFood **não aceita carrinho vindo de outro site**, por isso o carrinho vira um resumo copiável.

## Onde editar

| O quê | Arquivo |
| --- | --- |
| Dados da loja (horário, entrega, contato) | `shared/storeConfig.ts` |
| Itens, preços, fotos e categorias do cardápio | `shared/menuData.ts` |
| Adicionais e preços de personalização | `shared/pricing.ts` |
| Quadros do Hero | `public/media/frames/` + `src/lib/config.ts` |

**Stack:** React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Motion · Express · Google Gemini (`@google/genai`)

## Rodando localmente

Pré-requisito: Node.js 22.18+ (o `npm start` executa TypeScript nativamente).

```bash
npm install
cp .env.example .env   # e preencha GEMINI_API_KEY
npm run dev            # http://localhost:3000 (Express + Vite com HMR)
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor Express + Vite em modo middleware |
| `npm run lint` | Checagem de tipos (`tsc --noEmit`) do frontend, backend, código compartilhado e testes |
| `npm test` | Testes automatizados (`node:test`): atendente, telefone, horário, pedidos e API com Twilio simulada |
| `npm run build` | Build de produção do frontend em `dist/` |
| `NODE_ENV=production npm start` | Serve `dist/` + API com CSP e cache de produção |

Sem `GEMINI_API_KEY`, o app funciona normalmente e o chat/estúdio entram em **modo de contingência** (a UI avisa).

## Arquitetura

```
shared/                  Código usado pelo servidor E pelo navegador
├── storeHours.ts        Regra única do horário (18:00–23:30, America/Sao_Paulo)
├── api.ts               Contratos HTTP (tipos, enums, limites, envelope de resposta)
└── aiFallback.ts        Respostas de contingência (servidor e versão estática)

server/
├── app.ts               Monta o Express (segurança → API → frontend → erros)
├── server.ts            Vite (dev) / estáticos (prod), listen, shutdown gracioso
├── config/env.ts        Variáveis de ambiente validadas
├── routes/              aiRoutes (POST /api/chat, /api/generate-image), storeRoutes (GET /api/store/status)
├── controllers/         Recebem request → validam → chamam service → respondem
├── services/            geminiService (único acesso ao Gemini; contingência em shared/aiFallback.ts)
├── validators/          Validação estrita de payload (nunca confia no req.body)
├── middleware/          errorHandler, rateLimiter, security (Helmet, X-Request-Id)
├── errors/              AppError / AiProviderError com códigos estáveis
└── types/

src/
├── components/burger/   BurgerExplosion (animação) + arte vetorial das 7 camadas
├── components/ui/       Dialog acessível, SafeImage, LazyBoundary
├── hooks/               useCart, useStoreStatus, useDebounce, useModal, useBurgerLayout, usePointerTilt...
└── lib/                 pricing, cartStorage, api client, modalManager, format
```

### Fundo controlado pela rolagem ("Exploding Burger")

- Vídeo gerado com **Higgsfield Seedance 2.0** (720p, 16:9, sem áudio), tratado em cor/nitidez e
  convertido em **sequência de quadros WebP**, desenhada num `<canvas>` fixo em tela cheia
  (`src/components/ScrollSequenceBackground.tsx`):
  - desktop: 40 quadros 1280×720 (~2 MB) em `public/media/frames/desktop/`;
  - celular: 36 quadros 560×560 recortados no centro (~1,1 MB) em `public/media/frames/mobile/`,
    para o burger caber inteiro numa tela vertical.
- **Por que quadros e não `<video>`?** O Safari do iPhone não exibe um vídeo pausado que é "pulado"
  pela rolagem (e bloqueia vídeo em modo Pouca Energia). Imagens num canvas funcionam igual em qualquer
  navegador, inclusive iOS.
- A **rolagem escolhe o quadro**: topo = montado; rolando até o cardápio = totalmente explodido;
  rolando para cima = remonta. Sem loop autônomo, sem setState durante a rolagem: o progresso
  (`useScroll` → `useSpring`) só agenda um desenho por quadro de tela e quadros vizinhos são misturados
  com alfa (animação fluida com poucos quadros).
- Os quadros carregam por prioridade (primeiro, último e depois refinando), então o burger aparece
  na hora. A altura usa `100lvh`, estável quando a barra do Safari recolhe.
- Desktop: o burger começa na coluna direita do Hero e desliza para o centro; atrás do cardápio ele
  esmaece. Celular: burger mais discreto no Hero (muito texto) e pleno depois.
- `prefers-reduced-motion` ou "economia de dados": exibe apenas o primeiro quadro (burger montado).

### API

Todas as respostas seguem o envelope `{ success: true, data, meta? }` ou
`{ success: false, error: { code, message, details? } }`.

| Situação | Status | Código |
| --- | --- | --- |
| Payload inválido / JSON malformado | 400 | `INVALID_PAYLOAD` / `INVALID_JSON` |
| Rota inexistente | 404 | `NOT_FOUND` |
| Corpo grande demais | 413 | `PAYLOAD_TOO_LARGE` |
| Rate limit | 429 | `RATE_LIMITED` |
| Gemini: chave inválida / bad request | 502 | `AI_PROVIDER_AUTH` / `AI_PROVIDER_BAD_REQUEST` |
| Gemini indisponível / sem cota / modelo indisponível | 503 | `AI_PROVIDER_UNAVAILABLE` / `AI_PROVIDER_RATE_LIMITED` / `AI_MODEL_UNAVAILABLE` |
| Gemini timeout | 504 | `AI_PROVIDER_TIMEOUT` |
| Pedido abaixo do mínimo | 400 | `ORDER_BELOW_MINIMUM` |
| Origem não autorizada (CORS) | 403 | `FORBIDDEN_ORIGIN` |
| Twilio não configurada / número da loja recusado | 503 | `WHATSAPP_NOT_CONFIGURED` |
| Falha / limite da Twilio | 502 / 503 | `WHATSAPP_SEND_FAILED` / `WHATSAPP_RATE_LIMITED` |
| Timeout da Twilio | 504 | `WHATSAPP_TIMEOUT` |
| Erro interno | 500 | `INTERNAL_ERROR` |

Erros do Gemini viram resposta de contingência (`meta.fallback = true`) enquanto `AI_FALLBACK_ENABLED=true`;
o erro real sempre é logado com `requestId`. Erros de validação e bugs nunca são mascarados.

### Cardápio

- Categorias: Destaques, Hambúrgueres, Combos, Acompanhamentos, Bebidas e Sobremesas (categorias sem
  itens ficam ocultas). A categoria original de cada item foi mantida em `subcategory`.
- Abas fixas abaixo da navbar com rolagem suave e "scrollspy" (IntersectionObserver + `scrollend`).
- Busca por nome/ingrediente com debounce e sem acentos ("guarana" encontra "Guaraná").
- Cards simples (foto, título, descrição, preço); personalização e adicionais abrem no modal.

### Pedidos pelo WhatsApp (Twilio) — legado, desligado

> Não é mais usado: os pedidos são feitos no iFood. A rota só existe com `ENABLE_DIRECT_ORDERS=true`.

`POST /api/orders` valida o pedido, **recalcula todos os preços a partir do cardápio** (`shared/order.ts`),
normaliza o celular para E.164 (`+55DDD9XXXXXXXX`, `shared/phone.ts`) e envia o resumo ao WhatsApp da
loja pela API REST da Twilio (sem SDK, com timeout). Credenciais ficam só no servidor.

1. Crie uma conta na Twilio e ative o **WhatsApp Sandbox** (ou um remetente aprovado).
2. Do WhatsApp da loja, envie a mensagem de adesão (`join <código>`) para o número do sandbox.
3. Configure no servidor: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
   `STORE_WHATSAPP_TO` (veja `.env.example`).
4. Se o site estiver em outro domínio (GitHub Pages), defina `CORS_ORIGINS` no servidor e
   `VITE_API_BASE_URL` no build do frontend.

Sem servidor/Twilio (ex.: versão no GitHub Pages), o carrinho envia o mesmo resumo pelo app do
WhatsApp (link `wa.me`), usando `VITE_STORE_WHATSAPP_NUMBER`.

**GitHub Pages:** em *Settings → Secrets and variables → Actions → Variables*, crie
`STORE_WHATSAPP_NUMBER` (ex.: `5548996170281`, só dígitos) e, opcionalmente, `API_BASE_URL`,
`HERO_VIDEO_SRC` e `HERO_VIDEO_POSTER`. O próximo deploy já usa os valores.

### Cookies e LGPD

- Banner em [`CookieConsent.tsx`](src/components/CookieConsent.tsx): "Rejeitar não essenciais" e "Aceitar todos" têm o mesmo
  peso visual, nada vem pré-marcado e a escolha pode ser mudada pelo rodapé (*Preferências de cookies*).
- Categorias: Necessários (carrinho + a própria escolha), Estatísticas e Marketing. **Hoje não há nenhum rastreador de
  estatísticas/marketing instalado**; o mecanismo está pronto para quando houver.
- Escolha com validade de 180 dias e versionada ([`shared/consent.ts`](shared/consent.ts)); retirar um consentimento recarrega a página.
- **Para adicionar Google Analytics / Meta Pixel:** (1) libere o domínio em [`shared/csp.ts`](shared/csp.ts) (e em `public/_headers`),
  (2) carregue o script só dentro de `runWhenConsented('analytics', () => { ... })` ([`src/lib/consent.ts`](src/lib/consent.ts)),
  (3) atualize a tabela em [`LegalDialog.tsx`](src/components/legal/LegalDialog.tsx) e suba `CONSENT_VERSION`.
- Textos legais (`#privacidade`, `#cookies`, `#termos`) em [`LegalDialog.tsx`](src/components/legal/LegalDialog.tsx): são um
  **modelo fiel ao que o site faz hoje — peça revisão a um(a) advogado(a)** e preencha `privacyEmail` em `storeConfig.ts`.
- Fontes hospedadas por nós (`@fontsource-variable`): nenhuma requisição ao Google Fonts.
  Ainda há fotos do cardápio vindas do Unsplash (citado na política); o ideal é trocá-las por fotos reais da loja em `public/`.

### Segurança

Defesa em camadas — nenhum site é "inviolável", mas aqui cada camada reduz o estrago se outra falhar:

- **CSP restritiva** ([`shared/csp.ts`](shared/csp.ts)): sem script inline/`eval`, sem scripts de terceiros, sem `<iframe>`/`<object>`,
  `frame-ancestors 'none'`. Vai por cabeçalho no Express e por `<meta>` no build estático (GitHub Pages).
- HSTS (1 ano), `X-Content-Type-Options`, COOP/CORP, `Referrer-Policy`, `Permissions-Policy` (câmera, microfone, localização, pagamento… desligados).
- Pedidos diretos/Twilio **desligados por padrão** (`ENABLE_DIRECT_ORDERS`): a rota nem existe.
- Arquivos ocultos (`/.env`, `/.git`…) nunca são servidos; timeouts contra conexões lentas (slowloris).
- Link do iFood validado; `rel="noopener noreferrer"` em links externos.
- CI: `npm audit` (falha em vulnerabilidade alta), **CodeQL** semanal e Dependabot ([`.github/`](.github)); `security.txt` em `/.well-known/`.
- Testes de segurança: [`tests/securityHeaders.test.ts`](tests/securityHeaders.test.ts), [`tests/ifood.test.ts`](tests/ifood.test.ts), [`tests/consent.test.ts`](tests/consent.test.ts).
- **Fora do código (faça você):** ative 2FA no GitHub, *Secret scanning* e *Push protection* (Settings → Code security),
  proteção da branch `main`, e use HTTPS/domínio próprio com Cloudflare (WAF + proteção DDoS) à frente do site.
  Nunca coloque chaves em variáveis `VITE_*` (vão para o navegador).

#### Controles já existentes

- `GEMINI_API_KEY` só existe no servidor.
- Helmet com CSP restritiva em produção; rate limit por IP (geração de imagem é a mais restrita).
- Limites de corpo por rota (chat 160 KB, pedidos 32 KB, imagem 8 KB — antes 15 MB globais).
- CORS por lista de permissões (`CORS_ORIGINS`); origens desconhecidas recebem 403 no preflight.
- Carrinho no `localStorage` guarda apenas ids e quantidades; preços são sempre recalculados a partir do cardápio.
