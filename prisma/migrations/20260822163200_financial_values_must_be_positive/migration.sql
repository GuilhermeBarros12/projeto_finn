ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_value_positive" CHECK ("value" > 0);

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_targetValue_positive" CHECK ("targetValue" > 0);
