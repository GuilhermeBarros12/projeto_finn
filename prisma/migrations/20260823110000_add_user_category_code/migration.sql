-- Código de negócio para categorias pessoais. O identificador continua sendo a chave primária.
ALTER TABLE "Category" ADD COLUMN "code" TEXT;

-- Preserva todas as categorias existentes com um código determinístico derivado do UUID.
UPDATE "Category"
SET "code" = UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 10));

ALTER TABLE "Category" ALTER COLUMN "code" SET NOT NULL;

-- A repetição do código é permitida entre usuários diferentes, mas não para o mesmo usuário.
CREATE UNIQUE INDEX "Category_userId_code_key" ON "Category"("userId", "code");
