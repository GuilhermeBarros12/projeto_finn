# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Finn é uma aplicação de controle financeiro pessoal: API Express 5 + Prisma 7/PostgreSQL na raiz e
SPA React 19 + Vite em `frontend/`. São dois pacotes npm independentes, cada um com seu lockfile e
seu `node_modules`, sem workspaces. Código, mensagens de erro e documentação são em português.

## Comandos

Rode na raiz, exceto quando indicado. Node 24 ou superior.

```bash
npm run dev                  # API em http://localhost:3333/api (tsx watch)
npm run dev --prefix frontend  # Frontend em http://localhost:5173

npm run check                # Tipos da API, dos testes e do seed
npm run lint                 # ESLint da API e do frontend (config única na raiz)
npm run format:check         # Prettier; `npm run format` corrige
npm run build                # Compila a API

npm test                     # API; exige TEST_DATABASE_URL e Postgres no ar
npm test --prefix frontend   # Frontend (jsdom, sem banco)
npm run build --prefix frontend  # tsc + vite build: é a checagem de tipos do frontend

npx vitest run tests/auth.test.ts               # Um arquivo da API
npx vitest run tests/auth.test.ts -t "trecho"   # Um teste pelo nome
npm test --prefix frontend -- src/lib/format.test.ts  # Um arquivo do frontend

npm run prisma:migrate       # Cria e aplica migration em desenvolvimento
npm run prisma:deploy        # Aplica as migrations existentes
npm run prisma:seed          # Cria as categorias globais
```

O CI (`.github/workflows/ci.yml`) roda, nesta ordem, `format:check`, `lint`, `check`, `build`, os
testes e `npm audit`, além do build das imagens Docker. `npm run check` não cobre o frontend.

## Testes da API

- Usam Postgres real via Supertest, sem mocks. `TEST_DATABASE_URL` é separado de `DATABASE_URL`,
  e `tests/test-database.ts` recusa bancos sem `test` no nome porque tudo é truncado entre testes.
- `tests/global-setup.ts` aplica as migrations no banco de teste antes da suíte.
- `fileParallelism: false` é necessário: os arquivos compartilham o mesmo banco.
- `tests/helpers.ts` tem `createUser` e `resetDatabase`. `tests/isolation.test.ts` cobre o
  isolamento entre usuários; atualize-o ao criar um recurso novo.

## Arquitetura da API

O fluxo é `routes` -> `controllers` -> `services` -> Prisma, com `src/routes/index.ts` montando tudo
sob `/api`.

- **Controllers** validam com Zod (`src/schemas/`) chamando `.parse()` e não usam `try/catch`: o
  Express 5 repassa rejeições ao `error-handler.middleware.ts`, que traduz `ZodError` (400),
  `AppError` (status próprio) e Prisma `P2002` (409). Regra de negócio falha com `AppError`.
- **Services** recebem `userId` como parâmetro e todo acesso a dados do usuário filtra por ele. O
  `request.userId` vem do `ensureAuthenticated`, aplicado por router.
- **`src/config/env.ts`** é a única leitura de ambiente, e a validação derruba a API na subida.
  Variável nova entra lá, em `.env.example` e, se usada em produção, em `.env.production.example` e
  `docker-compose.yml`.
- **Prisma** gera o cliente em `generated/prisma` (não em `node_modules`), via `postinstall`. Importe
  de lá e rode `npm run prisma:generate` depois de alterar o schema.

### Regras transversais

- **Categorias:** `userId` nulo significa categoria global, criada pelo seed e visível a todos; com
  `userId`, é pessoal. Consultas usam `OR: [{ userId: null }, { userId }]`. Categorias são
  desativadas (`status`), não apagadas, e o tipo do lançamento deve ser igual ao da categoria.
- **Datas:** lançamentos guardam o dia do calendário à meia-noite UTC. Para "hoje", use `calendarDay`
  de `src/lib/dates.ts`, que respeita `APP_TIMEZONE`; `new Date()` erra à noite no Brasil. O frontend
  roda os testes com `TZ=America/Sao_Paulo` para expor esses bugs.
- **Dinheiro:** `Decimal(15, 2)` no banco, com `CHECK` de valor positivo nas migrations.
- **Sessão:** access token JWT curto, enviado por `Authorization: Bearer` e mantido só em memória no
  frontend (`frontend/src/api.ts`, nunca em `localStorage`). O refresh token fica em cookie HttpOnly
  `SameSite=Strict`, é guardado como hash e roda a cada uso. Reutilizar um token antigo fora da janela
  de 30 s derruba toda a família (`auth.service.ts`).
- **Exportação:** faz streaming em lotes com cursor (`TransactionService.iterate`) e neutraliza
  fórmulas no CSV (`csvValue`). Não carregue o histórico inteiro em memória.

## Frontend

`frontend/src/App.tsx` define as rotas, com páginas em `lazy`. `api.ts` concentra o cliente axios: em
caso de 401, uma única renovação é compartilhada entre as requisições pendentes. Os tipos em
`types.ts` são mantidos à mão e espelham a API, sem geração a partir do backend. O estilo é Tailwind 4.

## Deploy

`docker-compose.yml` sobe `db`, `migrate` (uso único), `api` e `web`. O nginx de `frontend/nginx.conf`
serve a SPA e faz proxy de `/api` na mesma origem, o que o cookie `SameSite=Strict` exige. Detalhes
em `docs/DEPLOY.md`.

## Convenções do repositório

- Commits usam um slug no lugar da mensagem, como `feat-frontend-refinar-categorias`. Cada entrega
  tem um registro em `docs/commits/<slug>.txt`; a skill `registrar-commit` gera esse arquivo.
- `docs/commits`, `prisma/migrations` e `.claude` estão fora do Prettier.
- Use a skill `verificar-alteracao` para escolher as checagens de uma mudança.
