---
name: verificar-alteracao
description: Escolhe e executa as checagens do Finn para as alterações pendentes, da mais barata para a mais cara. Use depois de editar código, antes de dizer que algo está pronto ou antes de um commit.
---

# Verificar alteração

Execute apenas o que a mudança exige e informe o que ficou de fora.

## 1. Definir o escopo

Rode `git status --short` e separe os arquivos em API (`src/`, `tests/`, `prisma/`), frontend
(`frontend/`) ou apenas documentação. Se for só documentação, rode `npx prettier --check` nos arquivos
alterados e encerre.

## 2. Rodar as checagens

Pare na primeira falha e corrija antes de seguir. Comece sempre por:

```bash
npx prettier --check <arquivos alterados>
npx eslint <arquivos .ts e .tsx alterados>
```

Se tocou a API:

```bash
npm run check
npx vitest run tests/<arquivo-relacionado>.test.ts
```

Se tocou o frontend:

```bash
npm test --prefix frontend -- <arquivo-relacionado>
npx --prefix frontend tsc -p frontend/tsconfig.json
```

Se alterou `prisma/schema.prisma`, rode antes `npm run prisma:generate`. Criar migration
(`npm run prisma:migrate`) altera o banco e só deve ser feito com autorização.

## 3. Banco de teste

Os testes da API truncam o banco apontado por `TEST_DATABASE_URL`. Antes de rodá-los:

- Confira se a variável existe sem exibir o valor: `grep -c '^TEST_DATABASE_URL=' .env`.
- Se ela faltar ou o Postgres estiver fora do ar, informe que os testes da API não rodaram. Nunca
  aponte a variável para o banco de desenvolvimento.

## 4. Suíte completa

Antes de um commit, ou quando a mudança for transversal (autenticação, `error-handler`, schema),
repita o que o CI faz:

```bash
npm run format:check
npm run lint
npm run check
npm run build
npm test
npm test --prefix frontend
npm run build --prefix frontend
```

## Resultado

Liste cada comando executado e o resultado, seguido do que não foi verificado e do motivo. Só diga
que passou se o comando rodou nesta sessão.
