jest.mock('../../../src/db', () => require('./../../unit/__mocks__/db'));
jest.mock('../../../src/middleware/errorHandler', () => ({
  createError: (statusCode: number, message: string) => {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    return err;
  },
}));

import {
  paginate,
  parsePagination,
  validateAccountExists,
  validateCategoryExists,
  validateScanExists,
  validateBudgetExists,
  validateSavingsGoalExists,
  clampInt,
} from '../../../src/utils/validators';
import { queryMock } from './../../unit/__mocks__/db';

const userId = 'user-1';
const otherUserId = 'user-2';

describe('parsePagination', () => {
  it('parses page and limit from query', () => {
    const result = parsePagination({ page: '2', limit: '25' });
    expect(result).toEqual({ page: 2, limit: 25 });
  });

  it('returns undefined for missing values', () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: undefined, limit: undefined });
  });

  it('handles partial params', () => {
    expect(parsePagination({ page: '3' })).toEqual({ page: 3, limit: undefined });
    expect(parsePagination({ limit: '10' })).toEqual({ page: undefined, limit: 10 });
  });
});

describe('paginate', () => {
  beforeEach(() => queryMock.mockReset());

  it('paginates results correctly', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: '100' }] })
      .mockResolvedValueOnce({ rows: [{ id: '1' }, { id: '2' }] });

    const result = await paginate('SELECT *', 'SELECT COUNT(*)', [], { page: 1, limit: 50 });
    expect(result).toEqual({ rows: [{ id: '1' }, { id: '2' }], total: 100, page: 1, limit: 50, totalPages: 2 });
  });

  it('defaults to page 1 and limit 50', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '10' }] }).mockResolvedValueOnce({ rows: [] });
    const result = await paginate('SELECT *', 'SELECT COUNT(*)');
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.totalPages).toBe(1);
  });

  it('clamps limit to max 100', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rows: [] });
    const result = await paginate('SEL', 'SEL', [], { limit: 500 });
    expect(result.limit).toBe(100);
  });

  it('clamps page to min 1', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rows: [] });
    const result = await paginate('SEL', 'SEL', [], { page: -5 });
    expect(result.page).toBe(1);
  });

  it('passes params to both queries', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '1' }] }).mockResolvedValueOnce({ rows: [{ id: 'a' }] });
    await paginate('SELECT * WHERE x=$1', 'SELECT COUNT(*) WHERE x=$1', ['val']);
    expect(queryMock).toHaveBeenNthCalledWith(1, 'SELECT COUNT(*) WHERE x=$1', ['val']);
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'SELECT * WHERE x=$1 LIMIT $2 OFFSET $3',
      ['val', 50, 0]
    );
  });
});

describe('validateAccountExists (tenant-isolated)', () => {
  beforeEach(() => queryMock.mockReset());

  it('does not throw when account exists for this user', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'abc' }] });
    await expect(validateAccountExists('abc', userId)).resolves.toBeUndefined();
    // SQL must include user_id predicate
    expect(queryMock.mock.calls[0][0]).toMatch(/user_id\s*=\s*\$2/);
    expect(queryMock.mock.calls[0][1]).toEqual(['abc', userId]);
  });

  it('throws 404 when account belongs to a different user (cross-tenant attempt)', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    await expect(validateAccountExists('abc', otherUserId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Account not found',
    });
  });

  it('throws 400 when missing userId', async () => {
    await expect(validateAccountExists('abc', '' as any)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('validateCategoryExists (tenant-isolated)', () => {
  beforeEach(() => queryMock.mockReset());

  it('accepts system categories (user_id NULL) for any user', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'sys-cat' }] });
    await expect(validateCategoryExists('sys-cat', userId)).resolves.toBeUndefined();
    expect(queryMock.mock.calls[0][0]).toMatch(/is_system\s*=\s*true/);
  });

  it('throws 404 when category not visible to user', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    await expect(validateCategoryExists('missing', userId)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('validateScanExists / validateBudgetExists / validateSavingsGoalExists', () => {
  beforeEach(() => queryMock.mockReset());

  it.each([
    ['scan', validateScanExists, 'Scan not found'],
    ['budget', validateBudgetExists, 'Budget not found'],
    ['goal', validateSavingsGoalExists, 'Savings goal not found'],
  ])('throws 404 for cross-tenant access to %s', async (_label, fn, expected) => {
    queryMock.mockResolvedValue({ rows: [] });
    await expect(fn('id', otherUserId)).rejects.toMatchObject({ statusCode: 404, message: expected });
  });
});

describe('clampInt', () => {
  it('clamps within [min,max]', () => {
    expect(clampInt(5, 1, 10, 0)).toBe(5);
    expect(clampInt(-100, 1, 10, 0)).toBe(1);
    expect(clampInt(1e6, 1, 10, 0)).toBe(10);
  });

  it('falls back when not a finite number', () => {
    expect(clampInt('abc', 1, 10, 7)).toBe(7);
    expect(clampInt(NaN, 1, 10, 7)).toBe(7);
    expect(clampInt(undefined, 1, 10, 7)).toBe(7);
  });

  it('truncates floats', () => {
    expect(clampInt(3.9, 1, 10, 0)).toBe(3);
  });
});
