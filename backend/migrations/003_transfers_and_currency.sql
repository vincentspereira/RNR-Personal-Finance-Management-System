-- 003_transfers_and_currency.sql — transfer pairing, splits, currency in account-native amount

-- Pair two transfer rows together via transfer_group_id, with direction so balance
-- math knows which side of the move this row represents.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_group_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_direction VARCHAR(4)
  CHECK (transfer_direction IS NULL OR transfer_direction IN ('in', 'out'));

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id)
  WHERE transfer_group_id IS NOT NULL;

-- For multi-currency accounts we record the amount converted to the account's currency.
-- If null, callers should fall back to t.amount.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_in_account_currency DECIMAL(15,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(20,10);

-- Receipt attachment metadata for manual transactions (P3-3 in plan: receipt attach).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_path VARCHAR(1000);

-- Split transactions (one parent row, many child line rows). Children reference parent.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS parent_transaction_id UUID
  REFERENCES transactions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_transactions_parent ON transactions(parent_transaction_id)
  WHERE parent_transaction_id IS NOT NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE;
