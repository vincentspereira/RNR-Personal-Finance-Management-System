import { query } from '../db';
import { validateCategoryExists } from '../utils/validators';

export async function listCategories(userId: string) {
  const result = await query(`
    SELECT c.*, pc.name as parent_name
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE c.user_id = $1 OR c.is_system = true
    ORDER BY c.type, c.name
  `, [userId]);

  const tree: any[] = [];
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.id, { ...row, children: [] });
  }
  for (const row of result.rows) {
    const node = map.get(row.id);
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id).children.push(node);
    } else {
      tree.push(node);
    }
  }
  return tree;
}

export async function createCategory(userId: string, data: {
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  parent_id?: string;
}) {
  if (data.parent_id) {
    await validateCategoryExists(data.parent_id, userId);
    // Prevent self-cycle by virtue of parent_id being a different row
  }
  const result = await query(
    `INSERT INTO categories (user_id, name, type, color, icon, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, data.name, data.type, data.color || '#3b82f6', data.icon || null, data.parent_id || null]
  );
  return result.rows[0];
}

export async function updateCategory(id: string, userId: string, data: {
  name?: string;
  color?: string;
  icon?: string;
  parent_id?: string;
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
    `UPDATE categories SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function deleteCategory(id: string, userId: string, reassignTo?: string) {
  if (reassignTo) {
    await query('UPDATE transactions SET category_id = $1 WHERE category_id = $2 AND user_id = $3', [reassignTo, id, userId]);
  }
  const result = await query('DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return result.rows[0] || null;
}
