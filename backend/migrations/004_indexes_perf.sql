-- 004_indexes_perf.sql — composite/perf indexes referenced by P2-1/P2-2/P2-3 in the plan.

-- Most common list query: by user, ordered by date DESC.
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions(user_id, transaction_date DESC);

-- Common dashboard query: by user, type, date.
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date
  ON transactions(user_id, type, transaction_date DESC);

-- Tag overlap searches.
CREATE INDEX IF NOT EXISTS idx_transactions_tags
  ON transactions USING GIN (tags);

-- Merchant search and grouping.
CREATE INDEX IF NOT EXISTS idx_transactions_user_merchant
  ON transactions(user_id, merchant_name)
  WHERE merchant_name IS NOT NULL;

-- Trigram-based full-text search on descriptions, merchants, notes.
-- Falls back gracefully if pg_trgm is unavailable.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  -- Some hosted Postgres editions disallow extension creation by user;
  -- skipping silently is fine, the indexes below will then fail and be skipped.
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transactions_description_trgm
             ON transactions USING GIN (description gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transactions_merchant_trgm
             ON transactions USING GIN (merchant_name gin_trgm_ops)';
  END IF;
END $$;
