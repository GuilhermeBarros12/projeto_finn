# Plano de implementação: cartão de crédito

Este plano executa as decisões de
[`docs/decisoes/2026-11-16-cartao-de-credito.md`](../decisoes/2026-11-16-cartao-de-credito.md).
Leia aquele arquivo e o `CLAUDE.md` antes de começar. As decisões de produto já estão tomadas: se
algo aqui parecer errado ou faltar, **pare e pergunte** em vez de escolher sozinho.

## Como trabalhar

- Crie a branch `feat-cartao-de-credito` a partir de `main`.
- Faça **uma etapa por vez**, na ordem. Cada etapa termina com um commit.
- O commit usa o slug indicado na etapa como mensagem, e cada um tem um registro em
  `docs/commits/<slug>.txt` gerado com a skill `registrar-commit`.
- Ao fim de cada etapa, rode as checagens indicadas (skill `verificar-alteracao`), faça o commit e
  **pare**. Relate o que fez, as checagens e o resultado, e espere a revisão antes da etapa
  seguinte.
- Não toque em arquivos fora do que a etapa pede. Não adicione dependências npm.
- Código, mensagens de erro, nomes de teste e comentários em português, como no resto do projeto.
- Siga os padrões existentes: Zod com `.parse()` no controller, sem `try/catch` no controller,
  `AppError` para regra de negócio, `userId` como parâmetro em todo método de service.

## Visão geral

| Etapa | Entrega                                       | Slug do commit                                    |
| ----- | --------------------------------------------- | ------------------------------------------------- |
| 1     | Schema, migration e dados antigos             | `feat-schema-cartoes-parcelas-e-recorrencias`     |
| 2     | Regras de calendário da fatura                | `feat-api-regras-de-calendario-da-fatura`         |
| 3     | API de cartões                                | `feat-api-cartoes`                                |
| 4     | Criar lançamento parcelado e recorrente       | `feat-api-lancamentos-parcelados-e-recorrentes`   |
| 5     | Editar e apagar em grupo, renovar recorrência | `feat-api-edicao-em-grupo-e-recorrencias`         |
| 6     | API de faturas                                | `feat-api-faturas`                                |
| 7     | Calendário e carregamento de cartões no front | `feat-frontend-calendario-e-cartoes-no-workspace` |
| 8     | Formulário de lançamento com cartão e modos   | `feat-frontend-formulario-cartao-e-parcelas`      |
| 9     | Lista de lançamentos com parcelas e escopo    | `feat-frontend-lista-com-parcelas-e-escopo`       |
| 10    | Página Cartões                                | `feat-frontend-pagina-cartoes`                    |
| 11    | Aviso de recorrência e calendário nas metas   | `feat-frontend-aviso-de-recorrencia-e-metas`      |
| 12    | Ferramentas do assistente                     | `feat-agente-cartoes-e-faturas`                   |
| 13    | Documentação                                  | `docs-cartao-de-credito`                          |

---

## Etapa 1: schema, migration e dados antigos

**Arquivos:** `prisma/schema.prisma`, nova pasta em `prisma/migrations/`, `tests/helpers.ts`.

### Schema

Acrescente ao `prisma/schema.prisma`:

```prisma
model Card {
  id               String        @id @default(uuid(7))
  userId           String
  user             User          @relation(fields: [userId], references: [id])
  name             String
  closingDay       Int
  dueDay           Int
  isDefault        Boolean       @default(false)
  status           Boolean       @default(true)
  datesConfirmedAt DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  transactions     Transaction[]

  @@index([userId, status])
}

model Recurrence {
  id           String        @id @default(uuid(7))
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  endDate      DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  transactions Transaction[]

  @@index([userId])
}
```

Em `User`, acrescente `cards Card[]` e `recurrences Recurrence[]`.

Em `Transaction`, acrescente:

```prisma
  cardId             String?
  card               Card?       @relation(fields: [cardId], references: [id])
  installmentGroupId String?
  installmentNumber  Int?
  installmentCount   Int?
  recurrenceId       String?
  recurrence         Recurrence? @relation(fields: [recurrenceId], references: [id])

  @@index([cardId, date])
  @@index([installmentGroupId])
  @@index([recurrenceId, date])
```

Significado:

- `datesConfirmedAt` nulo indica que o cartão foi criado pela migration com datas padrão e ainda não
  foi revisado. Cartões criados pela API já nascem com a data atual.
- `installmentGroupId` é um UUID comum, sem tabela: só agrupa as parcelas.
- `Recurrence.endDate` guarda a data final que a pessoa escolheu. Nulo significa "sem data final",
  e só essas recorrências geram o aviso de renovação.

### Migration

1. Rode `npm run prisma:migrate -- --name add_cards_installments_recurrences --create-only`.
2. Edite o `migration.sql` gerado e acrescente **ao final**, nesta ordem:

```sql
-- Cartão principal para quem já lançou no crédito (decisão 6).
INSERT INTO "Card" ("id", "userId", "name", "closingDay", "dueDay", "isDefault", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'Cartão principal', 1, 10, true, true, now(), now()
FROM (SELECT DISTINCT "userId" FROM "Transaction" WHERE "paymentMethod" = 'CREDIT_CARD') AS owners;

UPDATE "Transaction" t
SET "cardId" = c."id"
FROM "Card" c
WHERE c."userId" = t."userId" AND t."paymentMethod" = 'CREDIT_CARD';

ALTER TABLE "Card"
ADD CONSTRAINT "Card_days_valid" CHECK (
  "closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31 AND "closingDay" <> "dueDay"
),
ADD CONSTRAINT "Card_default_is_active" CHECK (NOT ("isDefault" AND NOT "status"));

CREATE UNIQUE INDEX "Card_one_default_per_user" ON "Card" ("userId") WHERE "isDefault";

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_installment_fields" CHECK (
  ("installmentGroupId" IS NULL AND "installmentNumber" IS NULL AND "installmentCount" IS NULL)
  OR (
    "installmentGroupId" IS NOT NULL
    AND "installmentCount" BETWEEN 2 AND 48
    AND "installmentNumber" BETWEEN 1 AND "installmentCount"
    AND "paymentMethod" = 'CREDIT_CARD'
    AND "type" = 'EXPENSE'
  )
),
ADD CONSTRAINT "Transaction_installment_or_recurrence" CHECK (
  "installmentGroupId" IS NULL OR "recurrenceId" IS NULL
);
```

Use `gen_random_uuid()` (e não `uuidv7()`), porque precisa funcionar em todos os Postgres que o
projeto usa. Confira que o `INSERT` vem **depois** do `CREATE TABLE "Card"` e o `UPDATE` depois do
`ALTER TABLE "Transaction" ADD COLUMN "cardId"`.

3. Rode `npm run prisma:migrate` para aplicar e `npm run prisma:generate`.

### Testes

- Em `tests/helpers.ts`, inclua `"Card"` e `"Recurrence"` no `TRUNCATE` de `resetDatabase`.
- A regra "lançamento no crédito sempre tem cartão" **não** entra nesta migration: sem a API de
  cartões, os testes que lançam no crédito quebrariam. Ela entra na etapa 4, numa migration
  própria. A suíte inteira precisa continuar verde aqui.

**Checagens:** `npm run check`, `npm run lint`, `npm test`.

---

## Etapa 2: regras de calendário da fatura

**Arquivos:** novo `src/lib/billing-calendar.ts` e novo `tests/billing-calendar.test.ts`.

Tudo aqui são funções puras sobre datas à meia-noite UTC (o formato de `Transaction.date`). Não use
`new Date()` para "hoje": quem precisa de hoje recebe `calendarDay(new Date())` de
`src/lib/dates.ts`. Use sempre `Date.UTC`, `getUTCFullYear`, `getUTCMonth` e `getUTCDate`.

Exporte:

```ts
export interface CardDays {
  closingDay: number; // 1..31
  dueDay: number; // 1..31, diferente de closingDay
}

export interface InvoiceRef {
  year: number;
  month: number; // 1..12, mês do VENCIMENTO
}

export interface InvoicePeriod {
  ref: InvoiceRef;
  start: Date; // inclusivo: data do fechamento anterior
  closingDate: Date; // exclusivo: compras nesta data já vão para a fatura seguinte
  dueDate: Date;
}

/** Dia `day` do mês, ou o último dia quando o mês é mais curto. `month` é 1..12. */
export function clampedDate(year: number, month: number, day: number): Date;

/** A mesma data `months` meses depois, mantendo o dia de `date` (31/01 + 1 = 28/02, + 2 = 31/03). */
export function addMonthsKeepingDay(date: Date, months: number): Date;

/** Fatura em que cai uma compra feita em `date`. */
export function invoiceForDate(card: CardDays, date: Date): InvoicePeriod;

/** Período de uma fatura identificada pelo mês do vencimento. */
export function invoicePeriod(card: CardDays, ref: InvoiceRef): InvoicePeriod;

/** Referência da fatura seguinte ou anterior. */
export function shiftInvoiceRef(ref: InvoiceRef, months: number): InvoiceRef;
```

Regras, que são a parte que mais merece cuidado:

- `addMonthsKeepingDay` calcula sempre a partir da data original. **Não encadeie** (31/01 → 28/02 →
  28/03 está errado; o certo é 31/03).
- **Fechamento de uma compra em `date`:** seja `c = clampedDate(ano, mês de date, closingDay)`. Se
  `date < c`, a fatura fecha em `c`. Senão fecha em `clampedDate` do mês seguinte. Compra no dia
  do fechamento vai para a fatura seguinte (decisão 2).
- **Vencimento a partir do fechamento `f`:** seja `v = clampedDate(ano e mês de f, dueDay)`. Se
  `v > f`, o vencimento é `v`. Senão é `clampedDate` do mês seguinte com `dueDay`.
- `ref` é o ano e o mês do vencimento.
- `invoicePeriod(card, ref)` faz o caminho inverso: `dueDate = clampedDate(ref, dueDay)`. O
  fechamento é o último fechamento estritamente anterior ao vencimento: `clampedDate(ref,
closingDay)` se for menor que `dueDate`, senão o do mês anterior. `start` é o fechamento do mês
  anterior ao `closingDate`.
- As duas funções precisam concordar: para qualquer data `d`, `invoicePeriod(card,
invoiceForDate(card, d).ref)` devolve um período com `start <= d < closingDate`.

Implemente `invoiceForDate` calculando o `ref` e chamando `invoicePeriod`, para existir uma única
fonte de verdade sobre `start`.

### Testes obrigatórios

Em `tests/billing-calendar.test.ts`:

- Fecha 25, vence 5: compra em 10/03/2026 → fecha 25/03, vence 05/04, `ref` abril de 2026.
- A mesma regra com compra em 25/03/2026 → vai para a fatura que vence em 05/05.
- Fecha 20, vence 28: compra em 01/03/2026 → fecha 20/03, vence 28/03, `ref` março.
- Fecha 31: fevereiro de 2026 fecha em 28/02 e fevereiro de 2028 em 29/02.
- Virada de ano: fecha 25, vence 5, compra em 28/12/2026 → vence 05/02/2027.
- `addMonthsKeepingDay(31/01/2026, 1)` = 28/02/2026, `(…, 2)` = 31/03/2026,
  `(31/01/2028, 1)` = 29/02/2028, `(15/11/2026, 3)` = 15/02/2027.
- Propriedade: para fechamento e vencimento em `[1, 5, 15, 28, 29, 30, 31]` (pares diferentes) e
  todos os dias de 2026 a 2028, `start <= d < closingDate` e os períodos de faturas consecutivas
  são contíguos (`closingDate` de uma = `start` da seguinte).

**Checagens:** `npm run check`, `npm run lint`, `npx vitest run tests/billing-calendar.test.ts`.

---

## Etapa 3: API de cartões

**Arquivos:** novos `src/schemas/card.schema.ts`, `src/services/card.service.ts`,
`src/controllers/card.controller.ts`, `src/routes/cards.routes.ts`, `tests/cards.test.ts`. Altere
`src/routes/index.ts` (`routes.use("/cards", cardsRoutes)`) e `tests/isolation.test.ts`. Siga o
formato de `category.*`.

### Rotas (todas com `ensureAuthenticated`)

| Método e caminho                  | Corpo                                          | Resposta                          |
| --------------------------------- | ---------------------------------------------- | --------------------------------- |
| `GET /api/cards`                  | query `includeInactive` (`"true"` ou ausente)  | `200 { cards }`                   |
| `POST /api/cards`                 | `{ name, closingDay, dueDay, isDefault? }`     | `201 { card }`                    |
| `PUT /api/cards/:id`              | `{ name?, closingDay?, dueDay? }`, ao menos um | `200 { card }`                    |
| `PATCH /api/cards/:id/default`    | nenhum                                         | `200 { card }`                    |
| `PATCH /api/cards/:id/deactivate` | nenhum                                         | `200 { card, transactionsCount }` |

A rota `GET /api/cards/overview` entra na etapa 6. Registre-a **antes** das rotas com `/:id`.

### Validação (`card.schema.ts`)

- `name`: string, `trim`, 1 a 60 caracteres.
- `closingDay` e `dueDay`: inteiros de 1 a 31.
- `closingDay !== dueDay`, com a mensagem "O dia de fechamento e o de vencimento precisam ser
  diferentes.". No `PUT` com só um dos dois, compare com o valor salvo no service e lance
  `AppError(…, 422)`.

### Regras do service

- `list`: filtra por `userId`. Sem `includeInactive`, só `status: true`. Ordena por
  `isDefault desc, createdAt asc, id asc`.
- `create`: grava `datesConfirmedAt: new Date()`. Se a pessoa não tem cartão ativo, o novo é
  padrão mesmo com `isDefault` ausente ou falso. Se `isDefault` é verdadeiro e já existe padrão,
  desmarque o antigo e marque o novo **na mesma `prisma.$transaction`**, desmarcando primeiro por
  causa do índice único parcial.
- `update`: busca com `{ id, userId }` (404 "Cartão não encontrado." se não achar). Se o corpo
  traz `closingDay` ou `dueDay`, grava também `datesConfirmedAt: new Date()`. Cartão desativado
  pode ser editado (para corrigir histórico).
- `setDefault`: 404 se não for da pessoa. 422 "Ative o cartão antes de torná-lo padrão." se
  `status` for falso. Na mesma transação, desmarque o padrão atual e marque este.
- `deactivate`: 404 se não for da pessoa e 409 "O cartão já está desativado." se já estiver. Na
  mesma transação, grave `status: false, isDefault: false` e, se ele era o padrão, marque como
  padrão o cartão ativo mais antigo (`createdAt asc, id asc`) que sobrar. Sem cartão ativo, fica
  sem padrão. Devolva `transactionsCount` como `CategoryService.deactivate` faz.
- Exporte também `getUsableCard(userId, cardId)` (ativo e da pessoa, 422 "Cartão não encontrado,
  inativo ou não permitido para este usuário." caso contrário) e `getDefaultCard(userId)` (o
  padrão ativo ou `null`). A etapa 4 usa os dois.

### Testes (`tests/cards.test.ts`)

- Primeiro cartão vira padrão sem pedir. O segundo não vira.
- Criar com `isDefault: true` troca o padrão, e continua existindo um único padrão.
- `PATCH /default` troca o padrão. Em cartão desativado, devolve 422.
- Desativar o padrão passa o padrão para o cartão ativo mais antigo. Desativar o último deixa sem
  padrão.
- `closingDay === dueDay` devolve 400 no `POST` e 422 no `PUT` parcial.
- `PUT` com `closingDay` preenche `datesConfirmedAt`.
- `GET` sem `includeInactive` esconde os desativados.

### Isolamento (`tests/isolation.test.ts`)

Acrescente casos em que Bob não lista, não edita, não torna padrão e não desativa o cartão da
Alice (404 nas três escritas, lista vazia).

**Checagens:** `npm run check`, `npm run lint`, `npm test`.

---

## Etapa 4: criar lançamento parcelado e recorrente

**Arquivos:** `src/schemas/transaction.schema.ts`, `src/services/transaction.service.ts`,
`src/controllers/transaction.controller.ts`, `tests/transactions.test.ts`, `tests/helpers.ts`, e os
testes existentes que lançam no crédito.

### Migration da regra do cartão

Crie com `npm run prisma:migrate -- --name require_card_for_credit --create-only` uma migration só
com SQL (o schema não muda):

```sql
ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_card_matches_method" CHECK (
  ("paymentMethod" = 'CREDIT_CARD') = ("cardId" IS NOT NULL)
);
```

Aplique com `npm run prisma:migrate`. Isso quebra os testes que lançam no crédito sem cartão, que
esta etapa corrige.

### Corpo do `POST /api/transactions`

Os campos atuais continuam, e entram:

```ts
cardId?: string;          // uuid; só com paymentMethod CREDIT_CARD
mode?: "SINGLE" | "INSTALLMENTS" | "RECURRING"; // padrão "SINGLE"
installments?: {
  count: number;          // inteiro, 2..48
  valueMode: "TOTAL" | "PER_INSTALLMENT";
};
recurrence?: {
  endDate?: string;       // AAAA-MM-DD, com calendarDateSchema
};
```

Regras no `superRefine` do schema (400):

- `cardId` só é aceito com `paymentMethod === "CREDIT_CARD"`.
- `mode === "INSTALLMENTS"` exige `installments`, `paymentMethod === "CREDIT_CARD"` e
  `type === "EXPENSE"`. Nos outros modos, `installments` é proibido.
- `recurrence` só com `mode === "RECURRING"`. `recurrence.endDate`, se vier, não pode ser anterior
  a `date`.

O `value` continua passando pelo `moneySchema`. No modo `TOTAL` ele é o valor total da compra. No
modo `PER_INSTALLMENT` é o valor de cada parcela.

### Service

- **Cartão:** com `CREDIT_CARD`, use `cardId` (validado com `getUsableCard`) ou, se ausente, o
  `getDefaultCard`. Sem cartão nenhum, responda 422 "Cadastre um cartão de crédito antes de lançar
  no crédito.". Sem `CREDIT_CARD`, `cardId` é `null`.
- **Valores das parcelas:** trabalhe em centavos inteiros (`Math.round(value * 100)`; o
  `moneySchema` já garante duas casas). No modo `TOTAL`: `base = Math.floor(total / count)`,
  primeira parcela `= base + (total - base * count)`, demais `= base`. Se `total < count`
  centavos, responda 422 "O valor total não cobre uma parcela mínima de R$ 0,01.". No modo
  `PER_INSTALLMENT`, todas valem `value`. Converta de volta com `new Prisma.Decimal(cents).div(100)`.
- **Datas:** a parcela K (começando em 0) tem `date = addMonthsKeepingDay(date, K)`. A recorrência
  segue igual: K de 0 a 11, parando antes de qualquer data maior que `recurrence.endDate`.
- **Parcelado:** gere um `installmentGroupId` com `randomUUID()` de `node:crypto`. Cada parcela
  recebe `installmentNumber` (1..N) e `installmentCount` (N). A descrição é a mesma em todas: o
  "2/5" é montado na tela.
- **Recorrente:** crie um `Recurrence` com `userId` e `endDate` e ligue os lançamentos por
  `recurrenceId`.
- Crie tudo numa única `prisma.$transaction`.

### Resposta

`201 { transaction, transactions }`. `transaction` é o primeiro lançamento (o frontend atual usa
esse campo) e `transactions` é a lista completa, ordenada por data. No modo `SINGLE`,
`transactions` tem um item.

### Listagem

- Inclua `card: { select: { id: true, name: true } }` no `WITH_CATEGORY` de `TransactionService`.
  O nome da constante pode virar `WITH_RELATIONS`.
- Acrescente o filtro `cardId` (uuid opcional) em `filterFields` e no `buildWhere`.

### Testes

- Atualize os testes existentes que usam `CREDIT_CARD` para criar um cartão antes (crie um helper
  `createCard(token, overrides)` em `tests/helpers.ts`, no estilo de `createCategory`).
- Crédito sem `cardId` usa o padrão. Sem cartão, 422. `cardId` de cartão desativado, 422. `cardId`
  com PIX, 400.
- R$ 100,00 em 3x no modo total → 33,34, 33,33, 33,33, mesmo `installmentGroupId`, números 1 a 3.
- R$ 50,00 por parcela em 4x → quatro de 50,00.
- Compra em 31/01/2026 em 3x → 31/01, 28/02, 31/03.
- R$ 0,02 em 3x no modo total → 422.
- Parcelado com PIX, ou receita parcelada → 400.
- Recorrente sem data final gera 12 lançamentos mensais com o mesmo `recurrenceId`. Com
  `endDate` três meses depois, gera 4.
- Recorrente funciona com receita e com PIX.
- Filtro `cardId` na listagem.

**Checagens:** `npm run check`, `npm run lint`, `npm test`.

---

## Etapa 5: editar e apagar em grupo, renovar recorrência

**Arquivos:** os mesmos de lançamentos, mais novos `src/schemas/recurrence.schema.ts` (se
precisar), `src/services/recurrence.service.ts`, `src/controllers/recurrence.controller.ts`,
`src/routes/recurrences.routes.ts`, `tests/recurrences.test.ts`, e `src/routes/index.ts`.

### Escopo em `PUT` e `DELETE /api/transactions/:id`

Aceite a query `scope` com `"ONE"` (padrão, o comportamento atual) ou `"FOLLOWING"`.

- `FOLLOWING` atinge o lançamento e os seguintes do **mesmo grupo**: mesmo `installmentGroupId` com
  `installmentNumber >=` o atual, ou mesmo `recurrenceId` com `date >=` a atual. Num lançamento sem
  grupo, `FOLLOWING` age como `ONE`.
- `PUT` com `FOLLOWING` e `date` no corpo → 400 "Para mudar a data, edite um lançamento por vez.".
- Em parcelas, `type` diferente de `EXPENSE` ou `paymentMethod` diferente de `CREDIT_CARD` → 422
  "Parcelas precisam continuar como despesa no cartão de crédito.".
- `PUT` aplica os mesmos campos a todos os atingidos, com `updateMany` filtrado também por
  `userId`. Não recalcule valores: o `value` enviado vale para cada lançamento atingido.
- `paymentMethod` mudando para `CREDIT_CARD` exige cartão (`cardId` do corpo ou o padrão, como na
  criação). Mudando para outro método, grave `cardId: null`. `cardId` novo é validado com
  `getUsableCard` só quando muda, como a categoria já faz em `update`.
- `PUT` responde `200 { transaction, updatedCount }` e `DELETE` responde `204`.
- Ao apagar todos os lançamentos de uma recorrência, apague também o `Recurrence`.

O `updateTransactionSchema` ganha `cardId` opcional. Não aceita `mode`, `installments` nem
`recurrence`: um lançamento não muda de modo na edição.

### Rotas de recorrência (`/api/recurrences`)

| Método e caminho                    | Resposta               |
| ----------------------------------- | ---------------------- |
| `GET /api/recurrences/ending`       | `200 { recurrences }`  |
| `POST /api/recurrences/:id/renew`   | `201 { transactions }` |
| `PATCH /api/recurrences/:id/finish` | `200 { recurrence }`   |

- `ending` lista as recorrências da pessoa com `endDate` nulo cujo último lançamento cai entre
  hoje e hoje + 2 meses (use `calendarDay(new Date())` e `addMonthsKeepingDay`). Cada item tem
  `{ id, description, value, type, lastDate, cardName }`, com os dados do último lançamento.
- `renew` copia o último lançamento (categoria, tipo, descrição, valor, método, cartão) para os 12
  meses seguintes. As datas usam o dia do **primeiro** lançamento da recorrência como âncora:
  primeiro lançamento em 31/01 gera 31/05 depois de 30/04. O cartão precisa estar ativo (422 se
  não estiver).
- `finish` grava `endDate` com a data do último lançamento, o que tira o aviso. Não apaga nada.
- 404 em recorrência de outra pessoa.

### Testes

- `scope=FOLLOWING` na parcela 3 de 5 apaga 3, 4 e 5 e mantém 1 e 2. Edita a descrição só de 3 a 5.
- `scope=ONE` numa parcela muda só ela, incluindo a data.
- Data com `FOLLOWING` → 400. Parcela mudando para PIX → 422.
- `ending` lista uma recorrência cujo último lançamento é daqui a 1 mês e não lista uma com
  `endDate` nem uma que acaba daqui a 6 meses.
- `renew` gera 12 lançamentos depois do último e mantém o dia âncora. `finish` tira da lista.
- No `tests/isolation.test.ts`: Bob não vê, não renova e não encerra recorrência da Alice, e
  `scope=FOLLOWING` dele em lançamento da Alice devolve 404.

**Checagens:** `npm run check`, `npm run lint`, `npm test`.

---

## Etapa 6: API de faturas

**Arquivos:** novo `src/services/invoice.service.ts`, `src/schemas/invoice.schema.ts`,
`src/controllers/invoice.controller.ts`, `tests/invoices.test.ts`. As rotas entram em
`src/routes/cards.routes.ts`.

### Rotas

| Método e caminho                           | Resposta          |
| ------------------------------------------ | ----------------- |
| `GET /api/cards/overview`                  | `200 { cards }`   |
| `GET /api/cards/:id/invoices/current`      | `200 { invoice }` |
| `GET /api/cards/:id/invoices/:year/:month` | `200 { invoice }` |

`current` é a fatura em que cairia uma compra feita hoje (`invoiceForDate(card, today)`).

`year` de 2000 a 2100 e `month` de 1 a 12, com `z.coerce.number().int()`. Cartão de outra pessoa
→ 404. Cartão desativado também tem faturas (histórico).

### Formato

```ts
interface InvoiceSummary {
  ref: { year: number; month: number };
  start: string; // AAAA-MM-DD, primeiro dia de compras
  end: string; // AAAA-MM-DD, último dia de compras (closingDate - 1 dia)
  closingDate: string;
  dueDate: string;
  status: "CLOSED" | "OPEN" | "FUTURE";
  total: number;
  transactionsCount: number;
}

interface Invoice extends InvoiceSummary {
  card: { id: string; name: string; closingDay: number; dueDay: number };
  transactions: TransactionWithRelations[]; // ordenadas por data e createdAt
}
```

- `status`: com `today = calendarDay(new Date())`, é `CLOSED` se `closingDate <= today`, `OPEN` se
  `start <= today < closingDate` e `FUTURE` se `start > today`.
- Lançamentos da fatura: `where: { userId, cardId, date: { gte: start, lt: closingDate } }`. Some
  com `aggregate` e `_sum` em `Prisma.Decimal` e converta para `number` só na resposta, como o
  `DashboardService` faz.
- `overview` devolve, para cada cartão **ativo**, `{ card, current, next }`. `current` é a fatura
  `OPEN` (`invoiceForDate(card, today)`) e `next` a seguinte (`shiftInvoiceRef(current.ref, 1)`),
  ambas como `InvoiceSummary`. Inclua `card.datesConfirmedAt` e `card.isDefault`.
- Exporte do service um método `invoiceSummary(userId, cardId, ref)` sem lista de lançamentos: a
  etapa 12 reaproveita.
- Datas na resposta saem como `AAAA-MM-DD` (`toISOString().slice(0, 10)`).

### Testes

- Cartão fecha 25 e vence 5. Compras em 24/03 e 25/03 caem em faturas diferentes (abril e maio).
- Parcelas de uma compra em 3x aparecem uma em cada uma de três faturas seguidas.
- Total soma só os lançamentos daquele cartão.
- Mudar o `closingDay` do cartão muda a fatura em que um lançamento aparece, sem migrar dados.
- `overview` mostra fatura atual e a próxima, e ignora cartões desativados.
- Status: use `vi.setSystemTime` para fixar hoje e conferir `CLOSED`, `OPEN` e `FUTURE`.
- No `tests/isolation.test.ts`: Bob recebe 404 na fatura do cartão da Alice e `overview` vazio.

**Checagens:** `npm run check`, `npm run lint`, `npm test`.

---

## Etapa 7: calendário e cartões no frontend

**Arquivos:** `frontend/src/types.ts`, `frontend/src/App.tsx`, novos
`frontend/src/lib/calendar.ts`, `frontend/src/lib/calendar.test.ts`,
`frontend/src/components/DatePicker.tsx` e `frontend/src/components/DatePicker.test.tsx`.

### Tipos

Em `types.ts`, acrescente `Card`, `InvoiceSummary`, `Invoice`, `CardOverview`, `EndingRecurrence`,
espelhando as respostas das etapas 3 a 6. Em `Transaction`, acrescente `cardId: string | null`,
`card: { id: string; name: string } | null`, `installmentGroupId`, `installmentNumber`,
`installmentCount` e `recurrenceId` (todos `| null`).

### Cartões no Workspace

Em `App.tsx`, carregue os cartões como as categorias: estado `cards`, `refreshCards` chamando
`GET /cards?includeInactive=true` e um aviso de erro igual ao das categorias. Passe `cards` e
`refreshCards` para as páginas que abrem o `TransactionModal` (Dashboard e TransactionsPage) e para
a futura página Cartões.

### `lib/calendar.ts`

Funções puras sobre strings `AAAA-MM-DD`, sem `Date` local (os testes rodam com
`TZ=America/Sao_Paulo` para pegar esse erro):

```ts
export const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MONTHS = ["janeiro", …, "dezembro"];
export function daysInMonth(year: number, month: number): number;
export function weekdayOf(isoDate: string): number; // 0 = domingo
/** Seis semanas de sete dias. Dias fora do mês vêm com `inMonth: false`. */
export function monthGrid(year: number, month: number): { iso: string; day: number; inMonth: boolean }[][];
export function addMonthsKeepingDay(isoDate: string, months: number): string; // mesma regra da API
export function formatLongDate(isoDate: string): string; // "seg, 16/11/2026"
```

Use `Date.UTC` e os métodos `getUTC*` por dentro. `addMonthsKeepingDay` repete a regra da etapa 2
e serve ao preview das parcelas. Os testes cobrem os mesmos casos de 31/01 e de ano bissexto.

### `DatePicker`

```ts
interface DatePickerProps {
  name: string; // vira um <input type="hidden"> para o FormData continuar funcionando
  label: string; // aria-label do botão
  value: string; // AAAA-MM-DD
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
}
```

- Fechado: um botão com o visual de `inputClass`, mostrando `formatLongDate(value)` e o ícone
  `CalendarDays` do `lucide-react`.
- Aberto: popover abaixo do botão, com seta de mês anterior, `select` de mês, `select` de ano (de
  2000 a 2100), seta de mês seguinte, a linha `WEEKDAYS` e a grade de `monthGrid`.
- Dias fora do mês ficam em cinza claro e são clicáveis (levam ao outro mês). O dia escolhido fica
  com `bg-finn-forest text-white`, e hoje (`todayInput()`) com um anel `ring-finn-lime`. Dias
  antes de `min` ficam desabilitados.
- Clique fora ou `Esc` fecha. Setas do teclado movem o foco entre os dias, `Enter` escolhe.
- Acessibilidade: popover com `role="dialog"` e a grade com `role="grid"`. Cada dia é um `button`
  com `aria-label` por extenso ("16 de novembro de 2026") e `aria-pressed` no escolhido.
- Use `frontend-design` só se precisar de direção visual. Siga as cores e raios já usados nos
  modais.

### Testes

`calendar.test.ts`: `monthGrid(2026, 2)` começa no domingo 01/02/2026, fevereiro de 2028 tem 29
dias e `weekdayOf("2026-11-16") === 1`. `DatePicker.test.tsx`: abre, navega para o mês seguinte,
escolhe um dia, chama `onChange` com `AAAA-MM-DD` e preenche o input escondido.

**Checagens:** `npm run lint`, `npm test --prefix frontend`, `npm run build --prefix frontend`.

---

## Etapa 8: formulário de lançamento com cartão e modos

**Arquivos:** `frontend/src/components/TransactionModal.tsx` e
`frontend/src/components/TransactionModal.test.tsx`.

Troque o `<input type="date">` pelo `DatePicker`. Novas props: `cards: Card[]`.

### Comportamento novo

- **Origem "Cartão de crédito":** aparece o `select` "Cartão" com os cartões ativos. O padrão vem
  marcado. Na edição, vem o cartão do lançamento, mesmo desativado, com " (desativado)" no nome,
  como as categorias desativadas. Sem cartão ativo, mostre o texto "Cadastre um cartão na página
  Cartões para lançar no crédito." com um link para `/cartoes`, e desabilite o botão de salvar.
- **Modo (só na criação):** botões segmentados no estilo de Despesa e Receita: "À vista",
  "Parcelado" e "Recorrente". "Parcelado" só aparece com origem cartão e tipo despesa. Ao trocar
  para receita ou conta com "Parcelado" marcado, volte para "À vista".
- **Parcelado:** campo "Número de parcelas" (2 a 48) e a escolha entre "Valor total" e "Valor da
  parcela", em dois botões de rádio. O rótulo do campo de valor muda junto ("Valor total da
  compra" ou "Valor de cada parcela"). Abaixo, um preview com cada parcela: "1/3 · 16/11/2026 · R$
  33,34". As datas vêm de `addMonthsKeepingDay` e os valores seguem a regra de centavos da etapa 4,
  calculada em centavos no próprio componente. Mostre também o total ("Total: R$ 100,00").
- **Recorrente:** texto "Repete todo mês, por 12 meses." e um `DatePicker` opcional "Termina em",
  com `min` igual à data do lançamento e um botão para limpar.
- **Envio:** monte `mode`, `cardId`, `installments` e `recurrence` como na etapa 4. Não envie
  `cardId` fora do crédito.
- **Edição de lançamento em grupo:** mostre "Parcela 2 de 5" ou "Lançamento recorrente" no topo e
  dois botões de rádio, "Só este" (padrão) e "Este e os seguintes". Com "Este e os seguintes", o
  `DatePicker` fica desabilitado e a data não é enviada. Envie `?scope=ONE` ou `?scope=FOLLOWING`
  no `PUT`.

### Testes

- Origem cartão pré-seleciona o cartão padrão.
- Parcelado com valor total de R$ 100,00 em 3x mostra 33,34, 33,33 e 33,33 e envia o corpo
  esperado.
- Modo "valor da parcela" envia `valueMode: "PER_INSTALLMENT"`.
- Recorrente envia `mode: "RECURRING"` e, com data final, `recurrence.endDate`.
- Receita não mostra "Parcelado".
- Editar a parcela 2 de 5 com "Este e os seguintes" envia `scope=FOLLOWING` e não envia `date`.

**Checagens:** `npm run lint`, `npm test --prefix frontend`, `npm run build --prefix frontend`.

---

## Etapa 9: lista de lançamentos com parcelas e escopo

**Arquivos:** `frontend/src/pages/TransactionsPage.tsx`, `frontend/src/components/RecentTransactions.tsx`,
`frontend/src/components/ConfirmDialog.tsx` e os testes dessas telas.

- Na lista, ao lado da descrição, mostre um selo "2/5" nas parcelas e o ícone `Repeat` com o título
  "Recorrente" nos recorrentes. Em lançamentos no crédito, mostre o nome do cartão no lugar de
  "Cartão de crédito".
- Exclusão de lançamento em grupo: o diálogo pergunta "Só este" ou "Este e os seguintes" e chama
  `DELETE /transactions/:id?scope=…`. Generalize o `ConfirmDialog` com uma prop opcional
  `options?: { label: string; value: string }[]`. Quando ela vier, o diálogo mostra um botão por
  opção e passa o valor escolhido para `onConfirm(value)`, cuja assinatura passa a ser
  `(value?: string) => Promise<void>`. Sem `options`, o comportamento atual não
  muda.
- Passe `cards` para o `TransactionModal` e acrescente um filtro "Cartão" na página quando a origem
  filtrada for cartão de crédito.

**Testes:** o selo "2/5" aparece, e excluir uma parcela com "Este e os seguintes" chama a URL com
`scope=FOLLOWING`.

**Checagens:** `npm run lint`, `npm test --prefix frontend`, `npm run build --prefix frontend`.

---

## Etapa 10: página Cartões

**Arquivos:** novos `frontend/src/pages/CardsPage.tsx`, `frontend/src/pages/CardsPage.test.tsx`,
`frontend/src/components/CardModal.tsx` e `frontend/src/components/CardModal.test.tsx`. Altere
`App.tsx` (rotas `/cartoes` e `/cartoes/:cardId`, com `lazy`) e `AppSidebar.tsx` (link "Cartões"
com o ícone `CreditCard`, entre "Receitas" e "Metas").

### Lista (`/cartoes`)

- Cabeçalho "Cartões" e botão "Novo cartão", que abre o `CardModal`.
- Dados de `GET /cards/overview`. Um bloco por cartão ativo, com o nome, o selo "Padrão" e "Fecha
  dia 25 · vence dia 5".
- Em destaque, a **fatura atual** (valor, "Aberta", "Fecha em 25/11" e "Vence em 05/12") e, logo
  abaixo, a **próxima fatura** (valor e "Vence em 05/01"). Essa é a resposta à pergunta "quanto vai
  ser minha fatura do mês que vem".
- Botões no bloco: "Ver faturas" (vai para `/cartoes/:id`) e "Ajustar" (abre o `CardModal` em
  modo de edição).
- Cartão com `datesConfirmedAt` nulo mostra um aviso âmbar: "Confira os dias de fechamento e
  vencimento deste cartão. Enquanto isso, as faturas podem estar erradas." com o botão "Ajustar
  agora".
- Sem cartões: estado vazio explicando a página, com o botão "Cadastrar primeiro cartão".
- Seção recolhível "Cartões desativados", com os inativos de `cards` e o link para ver as faturas
  deles.

### Detalhe (`/cartoes/:cardId`)

- Mês na URL, em `?ano=2026&mes=12`. Sem query, chame `GET /cards/:id/invoices/current` e grave o
  `ref` recebido na query com `replace`, para as setas e o botão voltar funcionarem.
- Topo: nome do cartão, seta anterior, "Fatura de dezembro de 2026", seta seguinte. As setas mudam
  a query.
- Resumo: total grande, selo de status ("Fechada", "Aberta" ou "Futura"), "Compras de 25/10 a
  24/11", "Fecha em 25/11" e "Vence em 05/12".
- Lista dos lançamentos da fatura: data, descrição, selo de parcela, categoria e valor. Clicar abre
  o `TransactionModal` de edição. Ao salvar, recarregue a fatura.
- Fatura sem lançamentos: "Nenhum lançamento nesta fatura.".
- Botão "Novo lançamento no cartão", que abre o `TransactionModal` com origem cartão e esse cartão
  marcado (acrescente as props `defaultOrigin` e `defaultCardId` ao modal).

### `CardModal` (a aba de ajuste)

- Campos: "Nome do cartão", "Dia do fechamento" (`select` de 1 a 31), "Dia do vencimento" (`select`
  de 1 a 31) e a caixa "Usar como cartão padrão" (só na criação).
- Ajuda abaixo dos dias: "Compras feitas a partir do dia {fechamento} entram na fatura seguinte."
  e, quando o dia passar de 28, "Nos meses mais curtos, vale o último dia do mês.".
- Fechamento igual ao vencimento: erro no próprio formulário, antes de enviar.
- Na edição: botões "Tornar padrão" (escondido se já for padrão) e "Desativar cartão". Desativar
  pede confirmação com `ConfirmDialog` e avisa que os lançamentos e as faturas continuam no
  histórico.
- Depois de salvar: chame `refreshCards` e recarregue o `overview`.

### Testes

- A lista mostra a fatura atual e a próxima com os valores do `overview` simulado.
- O aviso de datas não confirmadas aparece e o botão abre o modal.
- O detalhe navega para o mês seguinte e muda a query.
- O `CardModal` recusa fechamento igual ao vencimento e envia o `POST` esperado.

**Checagens:** `npm run lint`, `npm test --prefix frontend`, `npm run build --prefix frontend`.

---

## Etapa 11: aviso de recorrência e calendário nas metas

**Arquivos:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/GoalModal.tsx` e os
testes deles.

- No Dashboard, chame `GET /recurrences/ending`. Para cada item, mostre um aviso: "{descrição}
  termina em {mês/ano}." com os botões "Renovar por 12 meses" (`POST /recurrences/:id/renew`) e
  "Deixar terminar" (`PATCH /recurrences/:id/finish`). Depois de cada ação, o aviso some e os dados
  do dashboard recarregam.
- No `GoalModal`, troque o `type="date"` pelo `DatePicker`.

**Testes:** o aviso aparece e "Renovar" chama a URL certa. O `GoalModal` continua enviando
`dueDate` em `AAAA-MM-DD`.

**Checagens:** `npm run lint`, `npm test --prefix frontend`, `npm run build --prefix frontend`.

---

## Etapa 12: ferramentas do assistente

**Arquivos:** `src/services/agent-tools.ts`, `src/services/agent.service.ts` (só se as instruções
precisarem citar cartões), `tests/agent.test.ts` e `tests/isolation.test.ts`.

Acrescente duas ferramentas, ambas só de leitura e com `strict: true`, no mesmo formato das
atuais:

- `listar_cartoes`, sem parâmetros. Devolve os cartões ativos com `id`, `nome`, `diaFechamento`,
  `diaVencimento` e `padrao`.
- `consultar_fatura`, com `cardId` (string ou null), `month` e `year` (inteiros ou null).
  - Sem `cardId`, usa o cartão padrão. Sem cartão nenhum, devolve um erro de `AppError` 422 que o
    `runAgentTool` já repassa ao modelo.
  - Sem `month` e `year`, devolve a fatura atual e a próxima. Com os dois, devolve a fatura de
    vencimento naquele mês. Um sem o outro gera erro de validação.
  - Cada fatura sai com `cartao`, `vencimento`, `fechamento`, `periodo`, `situacao`, `total` e até
    50 `lancamentos` (`data`, `descricao`, `valor`, `parcela` no formato "2/5" ou null).
  - Reaproveite o `InvoiceService` da etapa 6. Não repita regra de calendário aqui.

A descrição de `consultar_fatura` precisa dizer que o mês é o **mês do vencimento**, para o modelo
responder certo "quanto vai ser a fatura do mês que vem".

**Testes:** com o modelo simulado de `tests/fake-model.ts`, a ferramenta devolve o total certo.
No isolamento, a ferramenta chamada por Bob com o `cardId` da Alice devolve erro, e não os dados.

**Checagens:** `npm run check`, `npm run lint`, `npm test`.

---

## Etapa 13: documentação

- `CLAUDE.md`: em "Regras transversais", acrescente uma regra **Cartões e faturas**, resumindo que
  a fatura é calculada por `src/lib/billing-calendar.ts` a partir de `closingDay` e `dueDay`, que
  ela é identificada pelo mês do vencimento, que parcelas e recorrências são transações reais
  agrupadas, e que lançamento `CREDIT_CARD` sempre tem `cardId`.
- `README.md`: acrescente a funcionalidade na lista, se houver uma.
- Rode `npm run format`.

**Checagens:** `npm run format:check`.

---

## O que não fazer

- Não crie tabela de faturas nem guarde totais: a fatura é sempre calculada.
- Não mude o dashboard, a exportação nem as metas para usar a data da fatura.
- Não implemente limite do cartão, pagamento de fatura, recorrência semanal ou anual, nem reativar
  cartão.
- Não use `new Date()` para "hoje" na API: use `calendarDay`.
- Não use `Date` com fuso local no frontend para montar o calendário.
- Não adicione bibliotecas de data nem de componentes.
