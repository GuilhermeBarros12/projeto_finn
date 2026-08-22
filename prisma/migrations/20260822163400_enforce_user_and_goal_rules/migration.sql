ALTER TABLE "User"
ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email"));

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_category_matches_type" CHECK (
  ("type" = 'SAVINGS' AND "categoryId" IS NULL)
  OR ("type" = 'SPENDING_LIMIT' AND "categoryId" IS NOT NULL)
);
