jest.mock('../../../src/db', () => require('./../../unit/__mocks__/db'));

import * as txnService from '../../../src/services/transactionService';
import { queryMock, getClientMock, mockClient } from './../../unit/__mocks__/db';

const mockTxn = {
  id: 'txn-1', account_id: 'acc-1', category_id: 'cat-1', type: 'expense',
  amount: 50, currency: 'USD', description: 'Lunch', merchant_name: 'Subway',
  transaction_date: '2026-01-15', notes: null, tags: [], is_recurring: false,
  recurrence_pattern: null, source: 'manual', scan_id: null,
  category_name: 'Dining', category_color: '#f97316', account_name: 'Checking',
};

const userId = 'test-user-id';

describe('transactionService', () => {
  beforeEach(() => {
    queryMock.mockReset();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
  });

  describe('listTransactions', () => {
    it('returns paginated transactions with no filters', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockTxn] });

      const result = await txnService.listTransactions(userId, { page: 1, limit: 50 });
      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('applies date range filters', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await txnService.listTransactions(userId, { startDate: '2026-01-01', endDate: '2026-01-31' });

      const countCall = queryMock.mock.calls[0];
      expect(countCall[1]).toContain('2026-01-01');
      expect(countCall[1]).toContain('2026-01-31');
    });

    it('applies type filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await txnService.listTransactions(userId, { type: 'income' });
      const sql = queryMock.mock.calls[0][0];
      expect(sql).toContain("t.type = $2");
    });

    it('applies category filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await txnService.listTransactions(userId, { categoryId: 'cat-1' });
      expect(queryMock).toHaveBeenCalled();
    });

    it('applies account filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await txnService.listTransactions(userId, { accountId: 'acc-1' });
      expect(queryMock).toHaveBeenCalled();
    });

    it('applies tags filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await txnService.listTransactions(userId, { tags: ['food', 'lunch'] });
      const call = queryMock.mock.calls[0];
      // Tags are passed as an array param
      expect(call[1]).toEqual(expect.arrayContaining([['food', 'lunch']]));
    });

    it('applies search filter with ILIKE', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await txnService.listTransactions(userId, { search: 'subway' });
      const sql = queryMock.mock.calls[0][0];
      expect(sql).toContain('ILIKE');
    });

    it('combines multiple filters', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await txnService.listTransactions(userId, {
        startDate: '2026-01-01', type: 'expense', accountId: 'acc-1', search: 'test',
      });
      const sql = queryMock.mock.calls[0][0];
      expect(sql).toContain('WHERE');
      expect(sql).toContain('AND');
    });
  });

  describe('getTransaction', () => {
    it('returns a transaction by id', async () => {
      queryMock.mockResolvedValue({ rows: [mockTxn] });
      const result = await txnService.getTransaction('txn-1', userId);
      expect(result).toEqual(mockTxn);
    });

    it('returns null for non-existent transaction', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const result = await txnService.getTransaction('missing', userId);
      expect(result).toBeNull();
    });
  });

  describe('createTransaction', () => {
    it('creates a transaction and returns it', async () => {
      // First call: validateAccountExists ownership check
      queryMock
        .mockResolvedValueOnce({ rows: [{ id: 'acc-1' }] })
        .mockResolvedValueOnce({ rows: [mockTxn] });

      const result = await txnService.createTransaction(userId, {
        account_id: 'acc-1', type: 'expense' as const, amount: 50,
        transaction_date: '2026-01-15',
      });

      expect(result).toEqual(mockTxn);
      const insertCall = queryMock.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO transactions/);
      expect(insertCall[1]).toEqual(expect.arrayContaining(['acc-1', null, 'expense', 50]));
    });

    it('sets defaults for optional fields', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ id: 'acc-1' }] })  // validateAccountExists
        .mockResolvedValueOnce({ rows: [mockTxn] });          // INSERT

      await txnService.createTransaction(userId, {
        account_id: 'acc-1', type: 'expense' as const, amount: 100,
        transaction_date: '2026-01-01',
      });

      const params = queryMock.mock.calls[1][1];
      expect(params[5]).toBe('USD');
      expect(params[11]).toBe(false);
      expect(params[13]).toBe('manual');
    });

    it('rejects creation when account does not belong to user (cross-tenant)', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] }); // ownership check returns nothing
      await expect(
        txnService.createTransaction(userId, {
          account_id: 'foreign-acc', type: 'expense' as const, amount: 50,
          transaction_date: '2026-01-15',
        })
      ).rejects.toMatchObject({ statusCode: 404, message: 'Account not found' });
    });
  });

  describe('updateTransaction', () => {
    it('updates specified fields', async () => {
      const updated = { ...mockTxn, amount: 75 };
      queryMock.mockResolvedValue({ rows: [updated] });

      const result = await txnService.updateTransaction('txn-1', userId, { amount: 75 });
      expect(result.amount).toBe(75);
      const sql = queryMock.mock.calls[0][0];
      expect(sql).toContain('UPDATE transactions SET');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('returns null when no fields provided', async () => {
      const result = await txnService.updateTransaction('txn-1', userId, {});
      expect(result).toBeNull();
    });
  });

  describe('deleteTransaction', () => {
    it('deletes and returns the id', async () => {
      queryMock.mockResolvedValue({ rows: [{ id: 'txn-1' }] });
      const result = await txnService.deleteTransaction('txn-1', userId);
      expect(result).toEqual({ id: 'txn-1' });
    });

    it('returns null when transaction not found', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const result = await txnService.deleteTransaction('missing', userId);
      expect(result).toBeNull();
    });
  });

  describe('bulkCreateTransactions', () => {
    it('creates multiple transactions in a transaction', async () => {
      // ownership pre-checks
      queryMock.mockResolvedValueOnce({ rows: [{ id: 'acc-1' }] });
      getClientMock.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [mockTxn] });

      const inputs = [
        { account_id: 'acc-1', type: 'expense' as const, amount: 50, transaction_date: '2026-01-15' },
        { account_id: 'acc-1', type: 'income' as const, amount: 1000, transaction_date: '2026-01-16' },
      ];

      const result = await txnService.bulkCreateTransactions(userId, inputs);
      expect(result.created).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back on error', async () => {
      // ownership pre-check passes
      queryMock.mockResolvedValueOnce({ rows: [{ id: 'a' }] });
      getClientMock.mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // first INSERT fails

      await expect(
        txnService.bulkCreateTransactions(userId, [
          { account_id: 'a', type: 'expense' as const, amount: 10, transaction_date: '2026-01-01' },
        ])
      ).rejects.toThrow('DB error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rejects when any account is not owned by the user', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] }); // no rows = none owned
      await expect(
        txnService.bulkCreateTransactions(userId, [
          { account_id: 'foreign', type: 'expense' as const, amount: 10, transaction_date: '2026-01-01' },
        ])
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('exportTransactions', () => {
    it('exports transactions without filters', async () => {
      queryMock.mockResolvedValue({ rows: [mockTxn] });
      const result = await txnService.exportTransactions(userId, {});
      expect(result).toHaveLength(1);
    });

    it('applies date filters to export', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      await txnService.exportTransactions(userId, { startDate: '2026-01-01', endDate: '2026-12-31' });
      const sql = queryMock.mock.calls[0][0];
      expect(sql).toContain('WHERE');
    });
  });
});
