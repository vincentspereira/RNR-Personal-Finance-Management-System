import crypto from 'crypto';
import { query, getClient } from '../db';
import { validateAccountExists } from '../utils/validators';
import { convertAmount } from './currencyService';

export interface CreateTransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number; // amount in source account currency
  transaction_date: string;
  description?: string;
  notes?: string;
  tags?: string[];
  category_id?: string;
  fx_rate?: number; // optional override
}

/**
 * P0-5: Transfers are modelled as two paired transaction rows, one on each
 * account, linked by transfer_group_id, with transfer_direction = 'out' on
 * the source and 'in' on the destination. Account balances must include both
 * sides for correct math.
 */
export async function createTransfer(userId: string, input: CreateTransferInput) {
  if (!input.from_account_id || !input.to_account_id) {
    throw Object.assign(new Error('from_account_id and to_account_id are required'), { statusCode: 400 });
  }
  if (input.from_account_id === input.to_account_id) {
    throw Object.assign(new Error('Cannot transfer to the same account'), { statusCode: 400 });
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error('amount must be > 0'), { statusCode: 400 });
  }

  await Promise.all([
    validateAccountExists(input.from_account_id, userId),
    validateAccountExists(input.to_account_id, userId),
  ]);

  // Fetch both accounts to know currencies
  const acctRes = await query(
    'SELECT id, currency FROM accounts WHERE id = ANY($1) AND user_id = $2',
    [[input.from_account_id, input.to_account_id], userId]
  );
  const accountsById = new Map<string, any>();
  for (const r of acctRes.rows) accountsById.set(r.id, r);
  const fromAcct = accountsById.get(input.from_account_id);
  const toAcct = accountsById.get(input.to_account_id);
  if (!fromAcct || !toAcct) {
    throw Object.assign(new Error('Account not found'), { statusCode: 404 });
  }

  // Convert amount to destination currency
  let destAmount = input.amount;
  let fxRate = 1;
  if (fromAcct.currency !== toAcct.currency) {
    if (input.fx_rate && input.fx_rate > 0) {
      fxRate = input.fx_rate;
      destAmount = round2(input.amount * fxRate);
    } else {
      const converted = await convertAmount(input.amount, fromAcct.currency, toAcct.currency);
      destAmount = round2(converted.amount);
      fxRate = converted.rate;
    }
  }

  const groupId = crypto.randomUUID();
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const outRow = await client.query(
      `INSERT INTO transactions (
        user_id, account_id, category_id, type, amount, currency, description, notes, tags,
        transaction_date, source, transfer_group_id, transfer_direction,
        amount_in_account_currency, fx_rate
      ) VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, $8, $9, 'manual', $10, 'out', $4, 1)
      RETURNING *`,
      [
        userId, input.from_account_id, input.category_id || null, input.amount, fromAcct.currency,
        input.description || `Transfer to ${toAcct.id}`, input.notes || null, input.tags || [],
        input.transaction_date, groupId,
      ]
    );

    const inRow = await client.query(
      `INSERT INTO transactions (
        user_id, account_id, category_id, type, amount, currency, description, notes, tags,
        transaction_date, source, transfer_group_id, transfer_direction,
        amount_in_account_currency, fx_rate
      ) VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, $8, $9, 'manual', $10, 'in', $4, $11)
      RETURNING *`,
      [
        userId, input.to_account_id, input.category_id || null, destAmount, toAcct.currency,
        input.description || `Transfer from ${fromAcct.id}`, input.notes || null, input.tags || [],
        input.transaction_date, groupId, fxRate,
      ]
    );

    await client.query('COMMIT');
    return {
      group_id: groupId,
      from: outRow.rows[0],
      to: inRow.rows[0],
      fx_rate: fxRate,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteTransfer(userId: string, groupId: string) {
  const r = await query(
    `DELETE FROM transactions WHERE user_id = $1 AND transfer_group_id = $2 RETURNING id`,
    [userId, groupId]
  );
  return r.rows;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
