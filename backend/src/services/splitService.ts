import { query, getClient } from '../db';
import { validateAccountExists, validateCategoryExists } from '../utils/validators';

export interface CreateSplitInput {
  account_id: string;
  total_amount: number;
  type: 'expense' | 'income';
  transaction_date: string;
  description?: string;
  merchant_name?: string;
  notes?: string;
  tags?: string[];
  splits: Array<{
    category_id: string;
    amount: number;
    description?: string;
  }>;
}

/**
 * Split transactions: one parent row carries the merchant/date/account, plus
 * many child rows each with its own category/amount. Children link to parent
 * via parent_transaction_id, parent has is_split = true.
 *
 * Balance math treats only the parent (since children sum to parent.amount).
 * Reporting can drill into children for category breakdowns.
 */
export async function createSplit(userId: string, input: CreateSplitInput) {
  if (!input.account_id || !input.splits || input.splits.length < 2) {
    throw Object.assign(new Error('account_id and at least 2 splits required'), { statusCode: 400 });
  }
  if (input.type !== 'expense' && input.type !== 'income') {
    throw Object.assign(new Error('type must be income or expense'), { statusCode: 400 });
  }
  if (!Number.isFinite(input.total_amount) || input.total_amount <= 0) {
    throw Object.assign(new Error('total_amount must be > 0'), { statusCode: 400 });
  }

  const splitSum = input.splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  if (Math.abs(splitSum - input.total_amount) > 0.01) {
    throw Object.assign(
      new Error(`Splits sum to ${splitSum.toFixed(2)} but total_amount is ${input.total_amount.toFixed(2)}`),
      { statusCode: 400 }
    );
  }

  await validateAccountExists(input.account_id, userId);
  for (const s of input.splits) {
    await validateCategoryExists(s.category_id, userId);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const parent = await client.query(
      `INSERT INTO transactions (
        user_id, account_id, type, amount, description, merchant_name, notes, tags,
        transaction_date, source, is_split
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual', true)
      RETURNING *`,
      [
        userId, input.account_id, input.type, input.total_amount,
        input.description || null, input.merchant_name || null,
        input.notes || null, input.tags || [], input.transaction_date,
      ]
    );
    const parentId = parent.rows[0].id;

    const children = [] as any[];
    for (const s of input.splits) {
      const r = await client.query(
        `INSERT INTO transactions (
          user_id, account_id, category_id, type, amount, description, transaction_date,
          source, parent_transaction_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', $8)
        RETURNING *`,
        [
          userId, input.account_id, s.category_id, input.type, s.amount,
          s.description || input.description || null, input.transaction_date, parentId,
        ]
      );
      children.push(r.rows[0]);
    }
    await client.query('COMMIT');
    return { parent: parent.rows[0], children };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getSplit(userId: string, parentId: string) {
  const parent = await query(
    'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND is_split = true',
    [parentId, userId]
  );
  if (parent.rows.length === 0) return null;
  const children = await query(
    `SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.parent_transaction_id = $1 AND t.user_id = $2 ORDER BY t.amount DESC`,
    [parentId, userId]
  );
  return { parent: parent.rows[0], children: children.rows };
}

export async function deleteSplit(userId: string, parentId: string) {
  const r = await query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2 AND is_split = true RETURNING id',
    [parentId, userId]
  );
  return r.rows[0] || null;
}
