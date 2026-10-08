# São Cristóvão 3.0 — Palhoça/SC

Cardápio digital premium da hamburgueria **São Cristóvão Burger**: vídeo cinematográfico do burger que se desmonta
conforme a rolagem, cardápio em abas, **atendente de IA que monta o pedido**, carrinho persistente e envio do pedido
pelo WhatsApp.

## Novidades da 3.0

- **Hero em vídeo (Higgsfield Seedance 2.0)** em tela cheia, controlado pela rolagem, com tratamento de cor quente,
  mais nitidez e qualidade de compressão maior; iluminação do site refeita (vinheta suave + brilho dourado).
- **Cardápio em abas** (Destaques, Hambúrgueres, Combos, Acompanhamentos, Bebidas): uma categoria por vez,
  filtro "para quantas pessoas" nos combos e busca que mostra quantos resultados há em cada aba.
  Fotos quebradas do cardápio original substituídas.
- **Atendente de pedidos** (botão flutuante): entende frases como "quero 2 Cristovão Bacon e uma Coca" ou
  "combo para casal", adiciona ao carrinho e leva ao checkout. Com servidor + `GEMINI_API_KEY`, quem responde é o
  Gemini (prompt gerado do cardápio); sem servidor (GitHub Pages), o atendente automático responde sozinho.
- **Configuração central da loja** em [`shared/storeConfig.ts`](shared/storeConfig.ts): nome, telefone, WhatsApp,
  bairros, horário, pedido mínimo, taxa e frete grátis — o site inteiro (e o servidor) lê dali.

## Onde editar

| O quê | Arquivo |
| --- | --- |
| Dados da loja (horário, entrega, contato) | `shared/storeConfig.ts` |
| Itens, preços, fotos e categorias do cardápio | `shared/menuData.ts` |
| Adicionais e preços de personalização | `shared/pricing.ts` |
| Vídeo do Hero | `public/media/` + `src/lib/config.ts` |

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

### Fundo em vídeo controlado pela rolagem ("Exploding Burger")

- Vídeo gerado com **Higgsfield Seedance 2.0** (720p, 16:9, sem áudio). Usamos o trecho
  "burger montado → explodido", recodificado com quadro-chave em todos os frames (all-intra, 60 fps)
  para que a busca seja instantânea: `public/media/hero-scroll-720.mp4` (desktop) e
  `hero-scroll-480.mp4` (celular), mais `hero-poster.jpg` (burger montado).
- O vídeo fica fixo em tela cheia e a **rolagem controla o tempo**: topo = montado; rolando até o
  cardápio = totalmente explodido; rolando para cima = remonta. Sem loop autônomo.
- `useScroll` → `useSpring` → `video.currentTime`, sem setState durante a rolagem e com no máximo uma
  busca pendente (evento `seeked`).
- Desktop: o burger começa na coluna direita do Hero e desliza para o centro; atrás do cardápio ele
  esmaece para não competir com os cards. Gradientes garantem legibilidade do texto.
- `prefers-reduced-motion` ou "economia de dados": exibe apenas a imagem estática (burger montado).

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

### Pedidos pelo WhatsApp (Twilio)

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
`STORE_WHATSAPP_NUMBER` (ex.: `5548999999999`, só dígitos) e, opcionalmente, `API_BASE_URL`,
`HERO_VIDEO_SRC` e `HERO_VIDEO_POSTER`. O próximo deploy já usa os valores.

### Segurança

- `GEMINI_API_KEY` só existe no servidor.
- Helmet com CSP restritiva em produção; rate limit por IP (geração de imagem é a mais restrita).
- Limites de corpo por rota (chat 160 KB, pedidos 32 KB, imagem 8 KB — antes 15 MB globais).
- CORS por lista de permissões (`CORS_ORIGINS`); origens desconhecidas recebem 403 no preflight.
- Carrinho no `localStorage` guarda apenas ids e quantidades; preços são sempre recalculados a partir do cardápio.
