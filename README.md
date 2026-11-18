# Finn

Aplicação web de controle financeiro pessoal: lance receitas e despesas, acompanhe o mês por
categoria e origem, defina metas e exporte seus dados.

## Funcionalidades

- Cadastro, login e sessão renovada automaticamente
- Lançamentos com categorias globais e pessoais
- Painel do mês e análise de despesas e receitas
- Cartões de crédito com faturas calculadas a partir do fechamento e do vencimento, vendo a atual e a próxima
- Compras parceladas e lançamentos recorrentes, com aviso para renovar
- Metas de economia e de limite de gasto, com progresso calculado
- Exportação completa em CSV ou JSON

## Tecnologias

| Camada   | Ferramentas                                            |
| -------- | ------------------------------------------------------ |
| API      | Node.js 24, Express 5, TypeScript, Zod, Prisma 7, pino |
| Banco    | PostgreSQL                                             |
| Frontend | React 19, Vite, Tailwind CSS 4, Recharts, React Router |
| Testes   | Vitest, Supertest, Testing Library                     |
| Entrega  | Docker, Docker Compose, nginx, GitHub Actions          |

## Como rodar localmente

Requisitos: Node.js 24 ou superior e PostgreSQL.

```bash
npm install
cp .env.example .env
```

Edite o `.env` com o acesso ao seu banco e um `JWT_SECRET` próprio. Depois prepare o banco e suba a
API em `http://localhost:3333/api`:

```bash
npm run prisma:deploy
npm run prisma:seed
npm run dev
```

Em outro terminal, suba o frontend em `http://localhost:5173`:

```bash
cd frontend
npm install
npm run dev
```

## Testes e qualidade

Os testes da API usam um banco real, que é **apagado a cada teste**. Crie um banco separado e
aponte `TEST_DATABASE_URL` para ele. Por segurança, a suíte recusa bancos sem `test` no nome.

| Comando                      | O que faz                             |
| ---------------------------- | ------------------------------------- |
| `npm test`                   | Testes da API                         |
| `npm test --prefix frontend` | Testes do frontend                    |
| `npm run lint`               | ESLint na API e no frontend           |
| `npm run format`             | Formata o código com Prettier         |
| `npm run check`              | Checagem de tipos da API e dos testes |

O GitHub Actions roda tudo isso a cada push e pull request.

## Estrutura

```text
src/        API: routes -> controllers -> services -> Prisma, com schemas Zod
prisma/     Modelo de dados, migrations e seed
tests/      Testes de integração da API
frontend/   Aplicação React: pages, components e lib
docs/       Guia de deploy e histórico de alterações
```

## Principais rotas

Tudo fica sob `/api`. Exceto login, cadastro, saúde e configuração, as rotas exigem a sessão
(cookie da tela ou `Authorization: Bearer` com o token da sessão).

| Método e rota                       | Descrição                                  |
| ----------------------------------- | ------------------------------------------ |
| `POST /auth/sign-up/email`          | Cria a conta e já abre a sessão            |
| `POST /auth/sign-in/email`          | Entra e define o cookie de sessão          |
| `POST /auth/sign-out`               | Encerra a sessão                           |
| `POST /auth/request-password-reset` | Envia o link de "esqueci a senha"          |
| `POST /auth/reset-password`         | Troca a senha com o token do link          |
| `POST /auth/sign-in/social`         | Começa o login com o Google                |
| `GET, POST /categories`             | Lista ou cria categorias                   |
| `PATCH /categories/:id/deactivate`  | Desativa uma categoria pessoal             |
| `GET, POST /transactions`           | Lista com filtros ou cria um lançamento    |
| `PUT, DELETE /transactions/:id`     | Edita ou exclui um lançamento              |
| `GET /dashboard/summary`            | Totais do mês                              |
| `GET /dashboard/by-category`        | Totais por categoria                       |
| `GET /dashboard/by-origin`          | Totais por conta e cartão                  |
| `GET, POST /cards`                  | Lista ou cria cartões de crédito           |
| `GET /cards/overview`               | Fatura atual e próxima de cada cartão      |
| `GET /cards/:id/invoices/:ano/:mes` | Fatura pelo mês do vencimento              |
| `GET /recurrences/ending`           | Recorrências que estão para acabar         |
| `GET, POST /goals`                  | Lista com progresso ou cria uma meta       |
| `PUT, DELETE /goals/:id`            | Edita ou exclui uma meta                   |
| `GET /exports/transactions`         | Exporta tudo em CSV ou JSON                |
| `POST /agent/chat`                  | Pergunta ao assistente, que só lê os dados |
| `GET /health`                       | Verifica a API e o banco                   |

## Deploy

Há dois caminhos: um servidor com Docker Compose ([guia](docs/DEPLOY.md)) ou serviços gerenciados, com a tela na Vercel, a API no Cloud Run e o banco no Neon ([guia](docs/DEPLOY-NUVEM.md)).

## Licença

ISC
