import { query, getClient } from '../db';
import { paginate, PaginatedResult, validateAccountExists, validateCategoryExists } from '../utils/validators';

export interface CreateTransactionInput {
  account_id: string;
  category_id?: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency?: string;
  description?: string;
  merchant_name?: string;
  transaction_date: string;
  notes?: string;
  tags?: string[];
  is_recurring?: boolean;
  recurrence_pattern?: any;
  source?: 'manual' | 'scanned' | 'imported';
  scan_id?: string;
  import_hash?: string;
}

export async function listTransactions(userId: string, filters: {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  type?: string;
  accountId?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
  minAmount?: number;
  maxAmount?: number;
  merchant?: string;
}): Promise<PaginatedResult> {
  const conditions: string[] = [`t.user_id = $1`];
  const params: any[] = [userId];
  let idx = 2;

  if (filters.startDate) {
    conditions.push(`t.transaction_date >= $${idx++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`t.transaction_date <= $${idx++}`);
    params.push(filters.endDate);
  }
  if (filters.categoryId) {
    conditions.push(`t.category_id = $${idx++}`);
    params.push(filters.categoryId);
  }
  if (filters.type) {
    conditions.push(`t.type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters.accountId) {
    conditions.push(`t.account_id = $${idx++}`);
    params.push(filters.accountId);
  }
  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`t.tags && $${idx++}`);
    params.push(filters.tags);
  }
  if (filters.search) {
    conditions.push(`(t.description ILIKE $${idx} OR t.merchant_name ILIKE $${idx} OR t.notes ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.minAmount !== undefined) {
    conditions.push(`t.amount >= $${idx++}`);
    params.push(filters.minAmount);
  }
  if (filters.maxAmount !== undefined) {
    conditions.push(`t.amount <= $${idx++}`);
    params.push(filters.maxAmount);
  }
  if (filters.merchant) {
    conditions.push(`t.merchant_name ILIKE $${idx++}`);
    params.push(`%${filters.merchant}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const baseQuery = `
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
           a.name as account_name, a.type as account_type
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    ${where}
    ORDER BY t.transaction_date DESC, t.created_at DESC
  `;

  const countQuery = `
    SELECT COUNT(*) FROM transactions t
    ${where}
  `;

  return paginate(baseQuery, countQuery, params, { page: filters.page, limit: filters.limit });
}

export async function getTransaction(id: string, userId: string) {
  const result = await query(
    `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
            a.name as account_name, a.type as account_type
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function createTransaction(userId: string, input: CreateTransactionInput) {
  // P0-3: enforce ownership of referenced account/category at write time
  if (!input.account_id) {
    throw Object.assign(new Error('account_id is required'), { statusCode: 400 });
  }
  await validateAccountExists(input.account_id, userId);
  if (input.category_id) {
    await validateCategoryExists(input.category_id, userId);
  }

  const result = await query(
    `INSERT INTO transactions (user_id, account_id, category_id, type, amount, currency, description,
     merchant_name, transaction_date, notes, tags, is_recurring, recurrence_pattern, source, scan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      userId,
      input.account_id,
      input.category_id || null,
      input.type,
      input.amount,
      input.currency || 'USD',
      input.description || null,
      input.merchant_name || null,
      input.transaction_date,
      input.notes || null,
      input.tags || [],
      input.is_recurring || false,
      JSON.stringify(input.recurrence_pattern) || null,
      input.source || 'manual',
      input.scan_id || null,
    ]
  );
  return result.rows[0];
}

export async function updateTransaction(id: string, userId: string, input: Partial<CreateTransactionInput>) {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  const allowed = ['account_id', 'category_id', 'type', 'amount', 'currency', 'description',
    'merchant_name', 'transaction_date', 'notes', 'tags', 'is_recurring', 'recurrence_pattern'];

  for (const key of allowed) {
    if ((input as any)[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push((input as any)[key]);
    }
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  params.push(id, userId);

  const result = await query(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function deleteTransaction(id: string, userId: string) {
  const result = await query('DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return result.rows[0] || null;
}

export async function bulkCreateTransactions(userId: string, inputs: CreateTransactionInput[]) {
  // P0-3: validate ownership of every referenced account/category up-front
  const accountIds = Array.from(new Set(inputs.map(i => i.account_id).filter(Boolean)));
  if (accountIds.length > 0) {
    const ownership = await query(
      'SELECT id FROM accounts WHERE id = ANY($1) AND user_id = $2 AND is_archived = false',
      [accountIds, userId]
    );
    const owned = new Set(ownership.rows.map((r: any) => r.id));
    const unowned = accountIds.filter(id => !owned.has(id));
    if (unowned.length > 0) {
      throw Object.assign(new Error(`Account(s) not found: ${unowned.join(', ')}`), { statusCode: 404 });
    }
  }
  const categoryIds = Array.from(new Set(inputs.map(i => i.category_id).filter(Boolean) as string[]));
  if (categoryIds.length > 0) {
    const ownership = await query(
      'SELECT id FROM categories WHERE id = ANY($1) AND (user_id = $2 OR user_id IS NULL OR is_system = true)',
      [categoryIds, userId]
    );
    const owned = new Set(ownership.rows.map((r: any) => r.id));
    const unowned = categoryIds.filter(id => !owned.has(id));
    if (unowned.length > 0) {
      throw Object.assign(new Error(`Category(ies) not found: ${unowned.join(', ')}`), { statusCode: 404 });
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const created: any[] = [];
    const skipped: CreateTransactionInput[] = [];

    // Collect import hashes for batch duplicate check
    const hashes = inputs.filter(i => i.import_hash).map(i => i.import_hash!);
    const existingHashes = new Set<string>();

    if (hashes.length > 0) {
      const dupResult = await client.query(
        `SELECT import_hash FROM transactions WHERE user_id = $1 AND import_hash = ANY($2)`,
        [userId, hashes]
      );
      dupResult.rows.forEach(r => existingHashes.add(r.import_hash));
    }

    for (const input of inputs) {
      // Skip if duplicate detected
      if (input.import_hash && existingHashes.has(input.import_hash)) {
        skipped.push(input);
        continue;
      }

      const result = await client.query(
        `INSERT INTO transactions (user_id, account_id, category_id, type, amount, currency, description,
         merchant_name, transaction_date, notes, tags, is_recurring, recurrence_pattern, source, scan_id, import_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          userId, input.account_id, input.category_id || null, input.type, input.amount,
          input.currency || 'USD', input.description || null, input.merchant_name || null,
          input.transaction_date, input.notes || null, input.tags || [],
          input.is_recurring || false, JSON.stringify(input.recurrence_pattern) || null,
          input.source || 'scanned', input.scan_id || null, input.import_hash || null,
        ]
      );
      created.push(result.rows[0]);
    }
    await client.query('COMMIT');
    return { created, skipped };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function exportTransactions(userId: string, filters: {
  startDate?: string;
  endDate?: string;
  format?: 'csv' | 'json';
}) {
  const conditions: string[] = [`t.user_id = $1`];
  const params: any[] = [userId];
  let idx = 2;

  if (filters.startDate) {
    conditions.push(`t.transaction_date >= $${idx++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`t.transaction_date <= $${idx++}`);
    params.push(filters.endDate);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const result = await query(
    `SELECT t.id, t.type, t.amount, t.currency, t.description, t.merchant_name,
            t.transaction_date, t.notes, t.tags, t.source, t.created_at,
            c.name as category_name, a.name as account_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     ${where}
     ORDER BY t.transaction_date DESC`,
    params
  );
  return result.rows;
}
