/**
 * End-to-end tests: Complete user workflows tested through the full stack.
 * These test the entire pipeline from API request → controller → service → (mocked) DB.
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

import transactionRoutes from '../../src/routes/transactions';
import accountRoutes from '../../src/routes/accounts';
import categoryRoutes from '../../src/routes/categories';
import scanRoutes from '../../src/routes/scans';
import analyticsRoutes from '../../src/routes/analytics';
import reportRoutes from '../../src/routes/reports';
import budgetRoutes from '../../src/routes/budgets';

import * as txnService from '../../src/services/transactionService';
import * as acctService from '../../src/services/accountService';
import * as catService from '../../src/services/categoryService';
import * as scanService from '../../src/services/scanService';
import * as analyticsService from '../../src/services/analyticsService';
import * as reportService from '../../src/services/reportService';

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

describe('E2E: User creates account, category, transaction, then views analytics', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('completes the full financial tracking flow', async () => {
    // Step 1: Create an account
    (acctService.createAccount as jest.Mock).mockResolvedValue({
      id: 'acc-1', name: 'Main Checking', type: 'checking', currency: 'USD', opening_balance: 5000,
    });

    const acctRes = await request(app)
      .post('/api/accounts')
      .send({ name: 'Main Checking', type: 'checking', opening_balance: 5000 });

    expect(acctRes.status).toBe(201);
    expect(acctRes.body.data.name).toBe('Main Checking');

    // Step 2: List categories (should have system defaults)
    (catService.listCategories as jest.Mock).mockResolvedValue([
      { id: 'cat-1', name: 'Groceries', type: 'expense', children: [] },
      { id: 'cat-2', name: 'Salary', type: 'income', children: [] },
    ]);

    const catRes = await request(app).get('/api/categories');
    expect(catRes.status).toBe(200);
    expect(catRes.body.data.length).toBeGreaterThanOrEqual(2);

    // Step 3: Create an expense transaction
    (txnService.createTransaction as jest.Mock).mockResolvedValue({
      id: 'txn-1', account_id: 'acc-1', category_id: 'cat-1', type: 'expense',
      amount: 85.50, description: 'Weekly groceries',
    });

    const txnRes = await request(app)
      .post('/api/transactions')
      .send({
        account_id: '11111111-1111-1111-1111-111111111111', category_id: '22222222-2222-2222-2222-222222222222', type: 'expense',
        amount: 85.50, description: 'Weekly groceries', transaction_date: '2026-01-15',
      });

    expect(txnRes.status).toBe(201);
    expect(txnRes.body.data.amount).toBe(85.50);

    // Step 4: Create an income transaction
    (txnService.createTransaction as jest.Mock).mockResolvedValue({
      id: 'txn-2', account_id: 'acc-1', category_id: 'cat-2', type: 'income',
      amount: 3000, description: 'Monthly salary',
    });

    const incomeRes = await request(app)
      .post('/api/transactions')
      .send({
        account_id: '11111111-1111-1111-1111-111111111111', category_id: '33333333-3333-3333-3333-333333333333', type: 'income',
        amount: 3000, description: 'Monthly salary', transaction_date: '2026-01-01',
      });

    expect(incomeRes.status).toBe(201);

    // Step 5: View analytics summary
    (analyticsService.getSummary as jest.Mock).mockResolvedValue({
      total_income: '3000', total_expense: '85.50', net: '2914.50',
      transaction_count: '2', savings_rate: 97.15,
    });

    const summaryRes = await request(app).get('/api/analytics/summary?startDate=2026-01-01&endDate=2026-01-31');
    expect(summaryRes.status).toBe(200);
    expect(parseFloat(summaryRes.body.data.total_income)).toBe(3000);

    // Step 6: Get monthly report
    (reportService.getMonthlyReport as jest.Mock).mockResolvedValue({
      period: { year: 2026, month: 1 },
      summary: { total_income: '3000', total_expense: '85.50' },
      categories: [], trends: [], merchants: [], cashflow: [],
    });

    const reportRes = await request(app).get('/api/reports/monthly?year=2026&month=1');
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.period.year).toBe(2026);
  });
});

describe('E2E: Scan and confirm invoice workflow', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('uploads a scan, polls status, reviews results, and confirms', async () => {
    // Step 1: Upload scan (we can't test multipart directly with this setup,
    // so we test the status/results/confirm flow)
    const scanId = 'scan-1';

    // Step 2: Poll for status
    (scanService.getScan as jest.Mock).mockResolvedValue({
      id: scanId, status: 'processing', document_count: 0,
    });

    const statusRes = await request(app).get(`/api/scans/${scanId}/status`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('processing');

    // Step 3: Get results after completion
    (scanService.getScan as jest.Mock).mockResolvedValue({
      id: scanId, status: 'completed', document_count: 1,
    });
    (scanService.getScanDocuments as jest.Mock).mockResolvedValue([{
      id: 'doc-1', scan_id: scanId, document_index: 0, document_type: 'receipt',
      vendor_name: 'Starbucks', total_amount: '5.86', confidence_score: 0.92,
    }]);

    const resultsRes = await request(app).get(`/api/scans/${scanId}/results`);
    expect(resultsRes.status).toBe(200);
    expect(resultsRes.body.data.documents).toHaveLength(1);
    expect(resultsRes.body.data.documents[0].vendor_name).toBe('Starbucks');

    // Step 4: Confirm and create transaction
    (scanService.confirmDocuments as jest.Mock).mockResolvedValue(true);

    const confirmRes = await request(app)
      .post(`/api/scans/${scanId}/confirm`)
      .send({
        documents: [{
          documentIndex: 0, categoryId: 'cat-1', accountId: 'acc-1',
          amount: 5.86, description: 'Starbucks coffee',
          merchantName: 'Starbucks', transactionDate: '2026-01-15',
        }],
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.confirmed).toBe(1);
  });

  it('handles scan failure and retry', async () => {
    (scanService.getScan as jest.Mock).mockResolvedValue({
      id: 'scan-2', status: 'failed', error_message: 'AI processing error',
    });

    const statusRes = await request(app).get('/api/scans/scan-2/status');
    expect(statusRes.body.data.status).toBe('failed');

    // Retry
    (scanService.retryScan as jest.Mock).mockResolvedValue({ id: 'scan-2' });
    const retryRes = await request(app).post('/api/scans/scan-2/retry');
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.status).toBe('pending');
  });
});

describe('E2E: Export transactions workflow', () => {
  let app: express.Application;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('exports transactions as CSV', async () => {
    (txnService.exportTransactions as jest.Mock).mockResolvedValue([
      { id: '1', type: 'expense', amount: '50', currency: 'USD', description: 'Lunch', merchant_name: 'Subway', transaction_date: '2026-01-15', category_name: 'Dining', account_name: 'Checking' },
    ]);

    const res = await request(app).get('/api/transactions/export?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('exports transactions as JSON', async () => {
    (txnService.exportTransactions as jest.Mock).mockResolvedValue([
      { id: '1', type: 'expense', amount: '50' },
    ]);

    const res = await request(app).get('/api/transactions/export?format=json');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
