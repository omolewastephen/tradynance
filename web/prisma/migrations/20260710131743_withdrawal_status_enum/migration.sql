-- Add the new WithdrawalStatus value. Must be its own migration so it commits before any
-- later migration uses it as a default/value (Postgres rejects add+use in one transaction).
ALTER TYPE "WithdrawalStatus" ADD VALUE 'AWAITING_CONFIRMATION';
