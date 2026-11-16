-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "installmentCount" INTEGER,
ADD COLUMN     "installmentGroupId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "recurrenceId" TEXT;

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "datesConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Card_userId_status_idx" ON "Card"("userId", "status");

-- CreateIndex
CREATE INDEX "Recurrence_userId_idx" ON "Recurrence"("userId");

-- CreateIndex
CREATE INDEX "Transaction_cardId_date_idx" ON "Transaction"("cardId", "date");

-- CreateIndex
CREATE INDEX "Transaction_installmentGroupId_idx" ON "Transaction"("installmentGroupId");

-- CreateIndex
CREATE INDEX "Transaction_recurrenceId_date_idx" ON "Transaction"("recurrenceId", "date");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "Recurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurrence" ADD CONSTRAINT "Recurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
