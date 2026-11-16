ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_card_matches_method" CHECK (
  ("paymentMethod" = 'CREDIT_CARD') = ("cardId" IS NOT NULL)
);
