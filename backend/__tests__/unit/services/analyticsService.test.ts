jest.mock('../../../src/db', () => require('./../../unit/__mocks__/db'));

import * as analyticsService from '../../../src/services/analyticsService';
import { queryMock } from './../../unit/__mocks__/db';

const userId = 'test-user-id';

describe('analyticsService', () => {
  beforeEach(() => queryMock.mockReset());

  describe('getSummary', () => {
    it('returns summary with income, expense, net, and changes', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ total_income: '5000', total_expense: '3000', net: '2000', transaction_count: '25' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_income: '4500', total_expense: '2800' }],
        });

      const result = await analyticsService.getSummary(userId, '2026-01-01', '2026-01-31');

      expect(result.total_income).toBe('5000');
      expect(result.total_expense).toBe('3000');
      expect(result.net).toBe('2000');
      expect(result.savings_rate).toBe(40); // 2000/5000 * 100
      expect(result.income_change).toBeCloseTo(11.11, 1);
      expect(result.expense_change).toBeCloseTo(7.14, 1);
    });

    it('handles zero previous period', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ total_income: '1000', total_expense: '500', net: '500', transaction_count: '5' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_income: '0', total_expense: '0' }],
        });

      const result = await analyticsService.getSummary(userId, '2026-01-01', '2026-01-31');
      expect(result.income_change).toBeNull();
      expect(result.expense_change).toBeNull();
      expect(result.savings_rate).toBe(50);
    });

    it('handles zero income for savings rate', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ total_income: '0', total_expense: '100', net: '-100', transaction_count: '1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_income: '0', total_expense: '0' }],
        });

      const result = await analyticsService.getSummary(userId, '2026-01-01', '2026-01-31');
      expect(result.savings_rate).toBe(0);
    });
  });

  describe('getByCategory', () => {
    it('returns spending by category', async () => {
      queryMock.mockResolvedValue({
        rows: [
          { id: 'cat-1', name: 'Groceries', type: 'expense', color: '#22c55e', icon: 'icon', total: '500', transaction_count: '10' },
          { id: 'cat-2', name: 'Dining', type: 'expense', color: '#f97316', icon: 'icon', total: '300', transaction_count: '5' },
        ],
      });

      const result = await analyticsService.getByCategory(userId, '2026-01-01', '2026-01-31', 'expense');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Groceries');
    });

    it('returns all types when type not specified', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      await analyticsService.getByCategory(userId, '2026-01-01', '2026-01-31');
      const sql = queryMock.mock.calls[0][0];
      expect(sql).not.toContain("AND t.type = 'expense'");
    });
  });

  describe('getTrends', () => {
    it('returns monthly trend data', async () => {
      queryMock.mockResolvedValue({
        rows: [
          { month: '2026-01', income: '5000', expense: '3000', net: '2000' },
          { month: '2026-02', income: '5500', expense: '3200', net: '2300' },
        ],
      });

      const result = await analyticsService.getTrends(userId, 12);
      expect(result).toHaveLength(2);
    });

    it('passes months parameter to query as parameterised value (not interpolated)', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      await analyticsService.getTrends(userId, 6);
      const sql = queryMock.mock.calls[0][0];
      const params = queryMock.mock.calls[0][1];
      // Parameterised — the SQL itself does NOT contain a literal months value
      expect(sql).toMatch(/\$1::int/);
      expect(params[0]).toBe(6);
    });

    it('clamps months to [1, 60]', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      await analyticsService.getTrends(userId, -99999);
      expect(queryMock.mock.calls[0][1][0]).toBe(1);
      queryMock.mockReset();
      queryMock.mockResolvedValue({ rows: [] });
      await analyticsService.getTrends(userId, 99999);
      expect(queryMock.mock.calls[0][1][0]).toBe(60);
    });
  });

  describe('getTopMerchants', () => {
    it('returns merchants ranked by spend', async () => {
      queryMock.mockResolvedValue({
        rows: [
          { merchant_name: 'Amazon', transaction_count: '10', total_spent: '1500' },
          { merchant_name: 'Walmart', transaction_count: '5', total_spent: '800' },
        ],
      });

      const result = await analyticsService.getTopMerchants(userId, '2026-01-01', '2026-12-31', 10);
      expect(result).toHaveLength(2);
      expect(result[0].merchant_name).toBe('Amazon');
    });

    it('uses default limit of 10', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      await analyticsService.getTopMerchants(userId, '2026-01-01', '2026-12-31');
      const params = queryMock.mock.calls[0][1];
      expect(params[3]).toBe(10);
    });
  });

  describe('getCashflow', () => {
    it('returns daily cashflow data', async () => {
      queryMock.mockResolvedValue({
        rows: [
          { date: '2026-01-01', income: '5000', expense: '100', net: '4900' },
          { date: '2026-01-02', income: '0', expense: '200', net: '-200' },
        ],
      });

      const result = await analyticsService.getCashflow(userId, '2026-01-01', '2026-01-31');
      expect(result).toHaveLength(2);
    });
  });

  describe('getBudgetVsActual', () => {
    it('returns budget comparison data', async () => {
      queryMock.mockResolvedValue({
        rows: [
          { budget_id: 'b1', budget_amount: '500', period: 'monthly', category_id: 'c1', category_name: 'Groceries', color: '#22c55e', actual_spent: '450' },
        ],
      });

      const result = await analyticsService.getBudgetVsActual(userId, '2026-01-01', '2026-01-31');
      expect(result).toHaveLength(1);
      expect(result[0].category_name).toBe('Groceries');
    });
  });

  describe('getRecurring', () => {
    it('returns recurring transaction analysis', async () => {
      queryMock.mockResolvedValue({
        rows: [
          { description: 'Netflix', merchant_name: 'Netflix', avg_amount: '15.99', occurrence_count: '12', first_occurrence: '2025-01-01', last_occurrence: '2025-12-01' },
        ],
      });

      const result = await analyticsService.getRecurring(userId);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Netflix');
    });
  });
});
