import { query } from '../db';

/**
 * Balance formula:
 *   opening_balance
 *   + sum(income on this account by this user)
 *   - sum(expense on this account by this user)
 *   + sum(transfer_in on this account by this user)     (when transfer destination = this account)
 *   - sum(transfer_out on this account by this user)    (when transfer source = this account)
 *
 * We represent transfers as paired transactions (see services/transferService.ts).
 * One row has type='transfer' with negative-style semantics on the source account,
 * another row on the destination account, linked by transfer_group_id.
 * For backwards compatibility, the balance treats `type='transfer'` rows as a
 * directional movement: amount on source account counts as outflow, on destination
 * as inflow. We disambiguate by the `transfer_direction` column ('out' or 'in').
 */
export async function listAccounts(userId: string) {
  const result = await query(`
    SELECT a.*,
      a.opening_balance
      + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.transfer_direction = 'in' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.transfer_direction = 'out' THEN t.amount ELSE 0 END), 0)
        AS current_balance
    FROM accounts a
    LEFT JOIN transactions t
      ON t.account_id = a.id AND t.user_id = $1
    WHERE a.is_archived = false AND a.user_id = $1
    GROUP BY a.id
    ORDER BY a.name
  `, [userId]);
  return result.rows;
}

export async function getAccount(id: string, userId: string) {
  const result = await query(`
    SELECT a.*,
      a.opening_balance
      + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.transfer_direction = 'in' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.transfer_direction = 'out' THEN t.amount ELSE 0 END), 0)
        AS current_balance
    FROM accounts a
    LEFT JOIN transactions t
      ON t.account_id = a.id AND t.user_id = $2
    WHERE a.id = $1 AND a.user_id = $2
    GROUP BY a.id
  `, [id, userId]);
  return result.rows[0] || null;
}

export async function createAccount(userId: string, data: {
  name: string;
  type: string;
  currency?: string;
  opening_balance?: number;
}) {
  const result = await query(
    `INSERT INTO accounts (user_id, name, type, currency, opening_balance)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, data.name, data.type, data.currency || 'USD', data.opening_balance || 0]
  );
  return result.rows[0];
}

export async function updateAccount(id: string, userId: string, data: {
  name?: string;
  type?: string;
  currency?: string;
  opening_balance?: number;
}) {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  const allowed = ['name', 'type', 'currency', 'opening_balance'];
  for (const key of allowed) {
    const value = (data as any)[key];
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(value);
    }
  }

  if (fields.length === 0) return null;
  fields.push('updated_at = NOW()');
  params.push(id, userId);

  const result = await query(
    `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function archiveAccount(id: string, userId: string) {
  const result = await query(
    `UPDATE accounts SET is_archived = true, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  return result.rows[0];
}

export async function getAccountBalanceHistory(id: string, userId: string, startDate?: string, endDate?: string) {
  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const result = await query(`
    WITH daily AS (
      SELECT transaction_date::date as date,
             SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
             SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) +
             SUM(CASE WHEN type = 'transfer' AND transfer_direction = 'in' THEN amount ELSE 0 END) -
             SUM(CASE WHEN type = 'transfer' AND transfer_direction = 'out' THEN amount ELSE 0 END) as daily_change
      FROM transactions
      WHERE account_id = $1 AND user_id = $4 AND transaction_date BETWEEN $2 AND $3
      GROUP BY transaction_date
    )
    SELECT date, daily_change,
           SUM(daily_change) OVER (ORDER BY date) +
           (SELECT opening_balance FROM accounts WHERE id = $1 AND user_id = $4) as running_balance
    FROM daily
    ORDER BY date
  `, [id, start, end, userId]);

  return result.rows;
}
