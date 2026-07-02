import { query } from '../db';
import { validateCategoryExists } from '../utils/validators';

export async function listBudgets(userId: string) {
  const result = await query(`
    SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = $1
    ORDER BY c.name
  `, [userId]);
  return result.rows;
}

export async function createBudget(userId: string, data: {
  category_id: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date?: string;
}) {
  await validateCategoryExists(data.category_id, userId);
  const result = await query(
    `INSERT INTO budgets (user_id, category_id, amount, period, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, data.category_id, data.amount, data.period, data.start_date, data.end_date || null]
  );
  return result.rows[0];
}

export async function updateBudget(id: string, userId: string, data: {
  amount?: number;
  period?: string;
  start_date?: string;
  end_date?: string;
}) {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(value);
    }
  }

  if (fields.length === 0) return null;
  params.push(id, userId);

  const result = await query(
    `UPDATE budgets SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function deleteBudget(id: string, userId: string) {
  const result = await query('DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return result.rows[0] || null;
}
