jest.mock('../../../src/db', () => require('./../../unit/__mocks__/db'));
const mockCallVision = jest.fn();
jest.mock('../../../src/services/vision', () => ({
  getVisionProvider: () => ({ name: 'zai', callVision: mockCallVision }),
  _setVisionProviderForTest: jest.fn(),
}));
jest.mock('sharp', () => jest.fn().mockReturnValue({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-jpeg-data')),
}));
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

import * as scanService from '../../../src/services/scanService';
import { queryMock, getClientMock, mockClient } from './../../unit/__mocks__/db';
import fs from 'fs';

// Backwards-compat alias for the previous test layout.
const mockCreate = {
  mockResolvedValueOnce: (v: any) => {
    // The previous tests handed back { content: [{ type: 'text', text: '...' }] }
    // The new adapter returns a string. Translate accordingly.
    const text = v.content?.find?.((c: any) => c.type === 'text')?.text ?? '';
    mockCallVision.mockResolvedValueOnce(text);
  },
  mockReset: () => mockCallVision.mockReset(),
};

const fakeScan = {
  id: 'scan-1', filename: 'receipt.jpg', original_path: '/tmp/receipt.jpg',
  status: 'pending', document_count: 0,
};

const fakeExtraction = {
  document_type: 'receipt',
  vendor: { name: 'Starbucks', address: '123 Main St', phone: null, email: null, website: null, tax_id: null },
  document_number: 'INV-001',
  dates: { document_date: '2026-01-15', due_date: null, service_period: null },
  amounts: { subtotal: 4.50, discount: null, tax: 0.36, tax_rate: 8, tips: 1.00, total: 5.86, amount_paid: 5.86, amount_due: null, currency: 'USD' },
  line_items: [{ description: 'Coffee', quantity: 1, unit: null, unit_price: 4.50, total: 4.50 }],
  payment: { method: 'Visa', reference: null, status: 'paid' },
  suggested_category: 'Dining',
  confidence: 0.92,
  notes: null,
};

const userId = 'test-user-id';

describe('scanService', () => {
  beforeEach(() => {
    queryMock.mockReset();
    mockCreate.mockReset();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe('createScanRecord', () => {
    it('creates a pending scan record', async () => {
      queryMock.mockResolvedValue({ rows: [fakeScan] });
      const result = await scanService.createScanRecord(userId, 'receipt.jpg', '/tmp/receipt.jpg');
      expect(result.filename).toBe('receipt.jpg');
      expect(result.status).toBe('pending');
    });
  });

  describe('getScan', () => {
    it('returns a scan by id', async () => {
      queryMock.mockResolvedValue({ rows: [fakeScan] });
      const result = await scanService.getScan('scan-1', userId);
      expect(result.id).toBe('scan-1');
    });

    it('returns null for non-existent scan', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const result = await scanService.getScan('missing', userId);
      expect(result).toBeNull();
    });
  });

  describe('getScanDocuments', () => {
    it('returns documents ordered by index', async () => {
      const docs = [
        { id: 'doc-1', scan_id: 'scan-1', document_index: 0, vendor_name: 'A' },
        { id: 'doc-2', scan_id: 'scan-1', document_index: 1, vendor_name: 'B' },
      ];
      queryMock.mockResolvedValue({ rows: docs });
      const result = await scanService.getScanDocuments('scan-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('listScans', () => {
    it('returns paginated scan list', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [fakeScan] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await scanService.listScans(userId, 1, 20);
      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('processScan', () => {
    it('processes a single document scan to completion', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ multiple_documents: false, count: 1, regions: [], layout: 'stack' }) }],
      });
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(fakeExtraction) }],
      });

      queryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [fakeScan] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await scanService.processScan('scan-1');

      const lastCall = queryMock.mock.calls[queryMock.mock.calls.length - 1];
      expect(lastCall[0]).toContain("status = 'completed'");
    });

    it('sets status to failed on error', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('Scan not found'));

      await scanService.processScan('scan-1');

      const failCall = queryMock.mock.calls[queryMock.mock.calls.length - 1];
      expect(failCall[0]).toContain("status = 'failed'");
    });
  });

  describe('retryScan', () => {
    it('resets a failed scan to pending', async () => {
      const failedScan = { ...fakeScan, status: 'failed' };
      queryMock
        .mockResolvedValueOnce({ rows: [failedScan] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await scanService.retryScan('scan-1', userId);
      expect(result).toBeDefined();
    });

    it('returns null for non-failed scan', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ ...fakeScan, status: 'completed' }] });
      const result = await scanService.retryScan('scan-1', userId);
      expect(result).toBeNull();
    });

    it('returns null for non-existent scan', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      const result = await scanService.retryScan('missing', userId);
      expect(result).toBeNull();
    });
  });

  describe('confirmDocuments', () => {
    it('creates transactions and links them to documents', async () => {
      // Ownership pre-checks: scan, account, category
      queryMock
        .mockResolvedValueOnce({ rows: [{ id: 'scan-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'acc-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });

      getClientMock.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: 'txn-new' }] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await scanService.confirmDocuments(userId, 'scan-1', [{
        documentIndex: 0, categoryId: 'cat-1', accountId: 'acc-1',
        amount: 50, description: 'Lunch', merchantName: 'Subway',
        transactionDate: '2026-01-15',
      }]);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });
});
