jest.mock('../../../src/db', () => require('./../../unit/__mocks__/db'));

import * as budgetService from '../../../src/services/budgetService';
import { queryMock } from './../../unit/__mocks__/db';

const mockBudget = {
  id: 'bud-1', category_id: 'cat-1', amount: '500.00', period: 'monthly',
  start_date: '2026-01-01', end_date: null,
  category_name: 'Groceries', category_color: '#22c55e', category_icon: 'FaShoppingBasket',
};

const userId = 'test-user-id';

describe('budgetService', () => {
  beforeEach(() => queryMock.mockReset());

  describe('listBudgets', () => {
    it('returns budgets joined with categories', async () => {
      queryMock.mockResolvedValue({ rows: [mockBudget] });
      const result = await budgetService.listBudgets(userId);
      expect(result).toHaveLength(1);
      expect(result[0].category_name).toBe('Groceries');
    });

    it('returns empty when no budgets', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const result = await budgetService.listBudgets(userId);
      expect(result).toEqual([]);
    });
  });

  describe('createBudget', () => {
    it('creates a budget after verifying category ownership', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] }) // validateCategoryExists
        .mockResolvedValueOnce({ rows: [mockBudget] });
      const result = await budgetService.createBudget(userId, {
        category_id: 'cat-1', amount: 500, period: 'monthly', start_date: '2026-01-01',
      });
      expect(result).toEqual(mockBudget);
      const insertCall = queryMock.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO budgets/);
      expect(insertCall[1]).toEqual([userId, 'cat-1', 500, 'monthly', '2026-01-01', null]);
    });

    it('passes end_date when provided', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] })
        .mockResolvedValueOnce({ rows: [mockBudget] });
      await budgetService.createBudget(userId, {
        category_id: 'cat-1', amount: 500, period: 'yearly',
        start_date: '2026-01-01', end_date: '2026-12-31',
      });
      const params = queryMock.mock.calls[1][1];
      expect(params[5]).toBe('2026-12-31');
    });

    it('passes null for end_date when omitted', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] })
        .mockResolvedValueOnce({ rows: [mockBudget] });
      await budgetService.createBudget(userId, {
        category_id: 'cat-1', amount: 100, period: 'weekly', start_date: '2026-01-01',
      });
      const params = queryMock.mock.calls[1][1];
      expect(params[5]).toBeNull();
    });

    it('refuses to create against a category the user does not own', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      await expect(budgetService.createBudget(userId, {
        category_id: 'foreign', amount: 100, period: 'monthly', start_date: '2026-01-01',
      })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateBudget', () => {
    it('updates amount', async () => {
      const updated = { ...mockBudget, amount: '750.00' };
      queryMock.mockResolvedValue({ rows: [updated] });
      const result = await budgetService.updateBudget('bud-1', userId, { amount: 750 });
      expect(result.amount).toBe('750.00');
    });

    it('updates period', async () => {
      queryMock.mockResolvedValue({ rows: [mockBudget] });
      await budgetService.updateBudget('bud-1', userId, { period: 'yearly' });
      const sql = queryMock.mock.calls[0][0];
      expect(sql).toContain('period = $1');
    });

    it('returns null when no fields provided', async () => {
      const result = await budgetService.updateBudget('bud-1', userId, {});
      expect(result).toBeNull();
    });
  });

  describe('deleteBudget', () => {
    it('deletes a budget', async () => {
      queryMock.mockResolvedValue({ rows: [{ id: 'bud-1' }] });
      const result = await budgetService.deleteBudget('bud-1', userId);
      expect(result).toEqual({ id: 'bud-1' });
    });

    it('returns null for non-existent budget', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const result = await budgetService.deleteBudget('missing', userId);
      expect(result).toBeNull();
    });
  });
});
