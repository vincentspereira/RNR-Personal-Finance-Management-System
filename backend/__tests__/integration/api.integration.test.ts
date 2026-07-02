/**
 * Integration tests: Express routes wired to mocked services.
 * Tests the full request→response cycle including middleware, routing,
 * query parsing, and error handling.
 */

jest.mock('../../src/services/transactionService');
jest.mock('../../src/services/accountService');
jest.mock('../../src/services/categoryService');
jest.mock('../../src/services/scanService');
jest.mock('../../src/services/analyticsService');
jest.mock('../../src/services/reportService');
jest.mock('../../src/services/budgetService');
jest.mock('../../src/models/migrations', () => ({ runMigrations: jest.fn() }));
jest.mock('../../src/models/seeds', () => ({ runSeeds: jest.fn() }));

import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/errorHandler';

const mockAuth = (req: any, _res: any, next: any) => {
  req.user = { id: 'test-user-id', email: 'test@test.com' };
  next();
};

// Import routes
import transactionRoutes from '../../src/routes/transactions';
import accountRoutes from '../../src/routes/accounts';
import categoryRoutes from '../../src/routes/categories';
import scanRoutes from '../../src/routes/scans';
import analyticsRoutes from '../../src/routes/analytics';
import reportRoutes from '../../src/routes/reports';
import budgetRoutes from '../../src/routes/budgets';

// Import services for mock setup
import * as txnService from '../../src/services/transactionService';
import * as acctService from '../../src/services/accountService';
import * as catService from '../../src/services/categoryService';
import * as budgetSvc from '../../src/services/budgetService';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/transactions', mockAuth, transactionRoutes);
  app.use('/api/accounts', mockAuth, accountRoutes);
  app.use('/api/categories', mockAuth, categoryRoutes);
  app.use('/api/scans', mockAuth, scanRoutes);
  app.use('/api/analytics', mockAuth, analyticsRoutes);
  app.use('/api/reports', mockAuth, reportRoutes);
  app.use('/api/budgets', mockAuth, budgetRoutes);
  app.use(errorHandler);
  return app;
}

describe('Integration: Transaction API', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/transactions returns list', async () => {
    (txnService.listTransactions as jest.Mock).mockResolvedValue({
      rows: [{ id: '1', amount: '50' }], total: 1, page: 1, limit: 50, totalPages: 1,
    });

    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /api/transactions passes query params', async () => {
    (txnService.listTransactions as jest.Mock).mockResolvedValue({
      rows: [], total: 0, page: 1, limit: 50, totalPages: 0,
    });

    await request(app).get('/api/transactions?type=expense&startDate=2026-01-01&search=coffee&page=2');
    expect(txnService.listTransactions).toHaveBeenCalledWith(
      'test-user-id',
      expect.objectContaining({ type: 'expense', startDate: '2026-01-01', search: 'coffee', page: 2 })
    );
  });

  it('POST /api/transactions creates a transaction', async () => {
    (txnService.createTransaction as jest.Mock).mockResolvedValue({ id: 'new', amount: 100 });

    const res = await request(app)
      .post('/api/transactions')
      .send({
        account_id: '11111111-1111-1111-1111-111111111111',
        type: 'expense',
        amount: 100,
        transaction_date: '2026-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/transactions rejects non-uuid account_id (zod validation)', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ account_id: 'a1', type: 'expense', amount: 100, transaction_date: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/transactions/:id returns single transaction', async () => {
    (txnService.getTransaction as jest.Mock).mockResolvedValue({ id: '1', amount: 50 });

    const res = await request(app).get('/api/transactions/1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('1');
  });

  it('GET /api/transactions/:id returns 404 for missing', async () => {
    (txnService.getTransaction as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get('/api/transactions/missing');
    expect(res.status).toBe(404);
  });

  it('PUT /api/transactions/:id updates transaction', async () => {
    (txnService.updateTransaction as jest.Mock).mockResolvedValue({ id: '1', amount: 75 });

    const res = await request(app).put('/api/transactions/1').send({ amount: 75 });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/transactions/:id deletes transaction', async () => {
    (txnService.deleteTransaction as jest.Mock).mockResolvedValue({ id: '1' });

    const res = await request(app).delete('/api/transactions/1');
    expect(res.status).toBe(200);
  });

  it('POST /api/transactions/bulk creates multiple', async () => {
    (txnService.bulkCreateTransactions as jest.Mock).mockResolvedValue({
      created: [{ id: '1' }, { id: '2' }],
      skipped: [],
    });

    const res = await request(app)
      .post('/api/transactions/bulk')
      .send({ transactions: [{ type: 'expense', amount: 10 }, { type: 'income', amount: 20 }] });

    expect(res.status).toBe(201);
    expect(res.body.meta.count).toBe(2);
    expect(res.body.meta.skipped).toBe(0);
  });
});

describe('Integration: Account API', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/accounts returns all accounts', async () => {
    (acctService.listAccounts as jest.Mock).mockResolvedValue([{ id: 'a1' }]);

    const res = await request(app).get('/api/accounts');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST /api/accounts creates account', async () => {
    (acctService.createAccount as jest.Mock).mockResolvedValue({ id: 'new' });

    const res = await request(app).post('/api/accounts').send({ name: 'Checking', type: 'checking' });
    expect(res.status).toBe(201);
  });

  it('DELETE /api/accounts/:id archives account', async () => {
    (acctService.archiveAccount as jest.Mock).mockResolvedValue({ id: 'a1', is_archived: true });

    const res = await request(app).delete('/api/accounts/a1');
    expect(res.status).toBe(200);
  });

  it('GET /api/accounts/:id/balance returns history', async () => {
    (acctService.getAccountBalanceHistory as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/accounts/a1/balance?startDate=2026-01-01');
    expect(res.status).toBe(200);
  });
});

describe('Integration: Category API', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/categories returns tree', async () => {
    (catService.listCategories as jest.Mock).mockResolvedValue([{ id: 'c1' }]);

    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
  });

  it('DELETE /api/categories/:id with reassignTo', async () => {
    (catService.deleteCategory as jest.Mock).mockResolvedValue({ id: 'c1' });

    const res = await request(app).delete('/api/categories/c1?reassignTo=c2');
    expect(catService.deleteCategory).toHaveBeenCalledWith('c1', 'test-user-id', 'c2');
    expect(res.status).toBe(200);
  });
});

describe('Integration: Budget API', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/budgets returns all budgets', async () => {
    (budgetSvc.listBudgets as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/budgets');
    expect(res.status).toBe(200);
  });

  it('POST /api/budgets creates budget', async () => {
    (budgetSvc.createBudget as jest.Mock).mockResolvedValue({ id: 'b1' });

    const res = await request(app).post('/api/budgets').send({
      category_id: '22222222-2222-2222-2222-222222222222',
      amount: 500,
      period: 'monthly',
      start_date: '2026-01-01',
    });
    expect(res.status).toBe(201);
  });
});

describe('Integration: Error handling', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('returns consistent error format for service errors', async () => {
    (txnService.listTransactions as jest.Mock).mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});
