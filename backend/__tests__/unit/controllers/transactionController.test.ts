jest.mock('../../../src/services/transactionService');

import * as ctrl from '../../../src/controllers/transactionController';
import * as txnService from '../../../src/services/transactionService';

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('transactionController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listTransactions', () => {
    it('returns paginated transactions', async () => {
      const req: any = { query: { page: '1', limit: '10' } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.listTransactions as jest.Mock).mockResolvedValue({
        rows: [{ id: '1' }], total: 1, page: 1, limit: 10, totalPages: 1,
      });

      await ctrl.listTransactions(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [{ id: '1' }] })
      );
    });

    it('passes all filter params to service', async () => {
      const req: any = {
        query: {
          startDate: '2026-01-01', endDate: '2026-12-31', type: 'expense',
          categoryId: 'cat-1', accountId: 'acc-1', search: 'test', tags: 'food,lunch',
        },
        user: { id: 'test-user-id', email: 'test@test.com' },
      };
      const res = mockRes();

      (txnService.listTransactions as jest.Mock).mockResolvedValue({
        rows: [], total: 0, page: 1, limit: 50, totalPages: 0,
      });

      await ctrl.listTransactions(req, res, mockNext);

      expect(txnService.listTransactions).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          startDate: '2026-01-01', type: 'expense', tags: ['food', 'lunch'],
        })
      );
    });

    it('calls next on error', async () => {
      const req: any = { query: {} , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();
      (txnService.listTransactions as jest.Mock).mockRejectedValue(new Error('DB error'));

      await ctrl.listTransactions(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getTransaction', () => {
    it('returns a single transaction', async () => {
      const req: any = { params: { id: 'txn-1' } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.getTransaction as jest.Mock).mockResolvedValue({ id: 'txn-1', amount: 50 });

      await ctrl.getTransaction(req, res, mockNext);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(res.json.mock.calls[0][0].data.id).toBe('txn-1');
    });

    it('returns 404 when transaction not found', async () => {
      const req: any = { params: { id: 'missing' } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.getTransaction as jest.Mock).mockResolvedValue(null);

      await ctrl.getTransaction(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('createTransaction', () => {
    it('creates and returns 201', async () => {
      const req: any = { body: { account_id: 'a', type: 'expense', amount: 50, transaction_date: '2026-01-01' } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.createTransaction as jest.Mock).mockResolvedValue({ id: 'new' });

      await ctrl.createTransaction(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('updateTransaction', () => {
    it('updates and returns the transaction', async () => {
      const req: any = { params: { id: 'txn-1' }, body: { amount: 75 } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.updateTransaction as jest.Mock).mockResolvedValue({ id: 'txn-1', amount: 75 });

      await ctrl.updateTransaction(req, res, mockNext);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when transaction not found', async () => {
      const req: any = { params: { id: 'missing' }, body: { amount: 1 } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.updateTransaction as jest.Mock).mockResolvedValue(null);

      await ctrl.updateTransaction(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('deleteTransaction', () => {
    it('deletes and returns success', async () => {
      const req: any = { params: { id: 'txn-1' } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.deleteTransaction as jest.Mock).mockResolvedValue({ id: 'txn-1' });

      await ctrl.deleteTransaction(req, res, mockNext);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: null }));
    });

    it('returns 404 when not found', async () => {
      const req: any = { params: { id: 'missing' } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.deleteTransaction as jest.Mock).mockResolvedValue(null);

      await ctrl.deleteTransaction(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('bulkCreateTransactions', () => {
    it('creates bulk transactions and reports created vs skipped counts', async () => {
      const req: any = { body: { transactions: [{ type: 'expense', amount: 10 }] } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.bulkCreateTransactions as jest.Mock).mockResolvedValue({
        created: [{ id: '1' }, { id: '2' }],
        skipped: [{ id: 'dup' }],
      });

      await ctrl.bulkCreateTransactions(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [{ id: '1' }, { id: '2' }],
          meta: { count: 2, skipped: 1, total: 3 },
        })
      );
    });
  });

  describe('exportTransactions', () => {
    it('returns JSON by default', async () => {
      const req: any = { query: {} , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.exportTransactions as jest.Mock).mockResolvedValue([{ id: '1' }]);

      await ctrl.exportTransactions(req, res, mockNext);
      expect(res.json).toHaveBeenCalled();
    });

    it('returns CSV when format=csv', async () => {
      const req: any = { query: { format: 'csv' } , user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      (txnService.exportTransactions as jest.Mock).mockResolvedValue([
        { id: '1', type: 'expense', amount: 50, currency: 'USD', description: 'Lunch', merchant_name: 'Subway', transaction_date: '2026-01-15', category_name: 'Dining', account_name: 'Checking' },
      ]);

      await ctrl.exportTransactions(req, res, mockNext);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/csv'));
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('transactions.csv'));
      expect(res.send).toHaveBeenCalled();
    });
  });
});
