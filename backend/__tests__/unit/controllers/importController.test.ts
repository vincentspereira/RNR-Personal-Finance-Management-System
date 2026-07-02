jest.mock('../../../src/services/importService');
jest.mock('../../../src/services/transactionService');

import * as ctrl from '../../../src/controllers/importController';
import * as importService from '../../../src/services/importService';
import * as txnService from '../../../src/services/transactionService';
import fs from 'fs';

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn();

describe('importController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('importPreview', () => {
    it('returns 400 when no files uploaded', async () => {
      const req: any = { files: [], user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      await ctrl.importPreview(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('returns parsed preview data', async () => {
      const mockFile = { originalname: 'bank.csv', path: '/tmp/test.csv' };
      const req: any = { files: [mockFile], user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      const mockPreview = {
        headers: ['Date', 'Description', 'Amount'],
        rows: [{ Date: '2026-01-15', Description: 'Coffee', Amount: '5.00' }],
        detectedMappings: { Date: 'date', Description: 'description', Amount: 'amount' },
        totalRows: 1,
        fileType: 'csv' as const,
      };
      (importService.parseImportFile as jest.Mock).mockReturnValue(mockPreview);
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      await ctrl.importPreview(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          fileType: 'csv',
          totalRows: 1,
          headers: ['Date', 'Description', 'Amount'],
        }),
      }));
    });

    it('returns 400 when files is undefined', async () => {
      const req: any = { files: undefined, user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      await ctrl.importPreview(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('importConfirm', () => {
    it('returns 400 when no rows provided', async () => {
      const req: any = { body: {}, user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      await ctrl.importConfirm(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('returns 400 when no mappings provided', async () => {
      const req: any = { body: { rows: [{}] }, user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      await ctrl.importConfirm(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('returns 400 when no accountId provided', async () => {
      const req: any = { body: { rows: [{}], mappings: {} }, user: { id: 'test-user-id', email: 'test@test.com' } };
      const res = mockRes();

      await ctrl.importConfirm(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('imports valid transactions and returns 201', async () => {
      const rows = [
        { Date: '2026-01-15', Description: 'Coffee', Amount: '5.00' },
        { Date: '2026-01-16', Description: 'Salary', Amount: '-3000' },
      ];
      const mappings = { Date: 'date', Description: 'description', Amount: 'amount' };
      const req: any = {
        body: { rows, mappings, accountId: 'acc-1' },
        user: { id: 'test-user-id', email: 'test@test.com' },
      };
      const res = mockRes();

      const mappedTxn = {
        account_id: 'acc-1', type: 'expense' as const, amount: 5.0,
        transaction_date: '2026-01-15', description: 'Coffee',
      };
      (importService.mapRowToTransaction as jest.Mock).mockReturnValue(mappedTxn);
      (txnService.bulkCreateTransactions as jest.Mock).mockResolvedValue({ created: [{ id: '1' }, { id: '2' }], skipped: [] });

      await ctrl.importConfirm(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ imported: 2, skipped: 0 }),
      }));
    });

    it('handles rows that fail to map', async () => {
      const rows = [
        { Date: '2026-01-15', Description: 'Coffee', Amount: '5.00' },
        { Date: '', Description: 'Empty', Amount: '' },
      ];
      const mappings = { Date: 'date', Description: 'description', Amount: 'amount' };
      const req: any = {
        body: { rows, mappings, accountId: 'acc-1' },
        user: { id: 'test-user-id', email: 'test@test.com' },
      };
      const res = mockRes();

      const validTxn = {
        account_id: 'acc-1', type: 'expense' as const, amount: 5.0,
        transaction_date: '2026-01-15', description: 'Coffee',
      };
      (importService.mapRowToTransaction as jest.Mock)
        .mockReturnValueOnce(validTxn)
        .mockReturnValueOnce(null);
      (txnService.bulkCreateTransactions as jest.Mock).mockResolvedValue({ created: [{ id: '1' }], skipped: [] });

      await ctrl.importConfirm(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ imported: 1, skipped: 1 }),
      }));
    });
  });
});
