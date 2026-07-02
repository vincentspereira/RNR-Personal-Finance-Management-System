import { query } from '../db';
import { createError } from '../middleware/errorHandler';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult {
  rows: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function paginate(
  baseQuery: string,
  countQuery: string,
  params: any[] = [],
  pagination: PaginationParams = {}
): Promise<PaginatedResult> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 50));
  const offset = (page - 1) * limit;

  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  const rows = await query(
    `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { rows: rows.rows, total, page, limit, totalPages };
}

export function parsePagination(q: any): PaginationParams {
  return {
    page: q.page ? parseInt(q.page) : undefined,
    limit: q.limit ? parseInt(q.limit) : undefined,
  };
}

export async function validateAccountExists(accountId: string, userId: string) {
  if (!accountId || !userId) {
    throw createError(400, 'accountId and userId are required for ownership check');
  }
  const result = await query(
    'SELECT id FROM accounts WHERE id = $1 AND user_id = $2 AND is_archived = false',
    [accountId, userId]
  );
  if (result.rows.length === 0) {
    throw createError(404, 'Account not found');
  }
}

export async function validateCategoryExists(categoryId: string, userId: string) {
  if (!categoryId) {
    throw createError(400, 'categoryId is required for ownership check');
  }
  // Allow system categories (user_id NULL) OR user-owned categories
  const result = await query(
    'SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR user_id IS NULL OR is_system = true)',
    [categoryId, userId || null]
  );
  if (result.rows.length === 0) {
    throw createError(404, 'Category not found');
  }
}

export async function validateScanExists(scanId: string, userId: string) {
  const result = await query('SELECT id FROM scans WHERE id = $1 AND user_id = $2', [scanId, userId]);
  if (result.rows.length === 0) {
    throw createError(404, 'Scan not found');
  }
}

export async function validateBudgetExists(budgetId: string, userId: string) {
  const result = await query('SELECT id FROM budgets WHERE id = $1 AND user_id = $2', [budgetId, userId]);
  if (result.rows.length === 0) {
    throw createError(404, 'Budget not found');
  }
}

export async function validateSavingsGoalExists(goalId: string, userId: string) {
  const result = await query('SELECT id FROM savings_goals WHERE id = $1 AND user_id = $2', [goalId, userId]);
  if (result.rows.length === 0) {
    throw createError(404, 'Savings goal not found');
  }
}

export function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
