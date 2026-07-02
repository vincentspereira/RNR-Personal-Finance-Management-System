import { Response, NextFunction } from 'express';
import * as txnService from '../services/transactionService';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

function escapeCSV(value: any): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function listTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await txnService.listTransactions(req.user!.id, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      categoryId: req.query.categoryId as string,
      type: req.query.type as string,
      accountId: req.query.accountId as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      merchant: req.query.merchant as string,
    });
    res.json({ success: true, data: result.rows, meta: { pagination: result } });
  } catch (err) { next(err); }
}

export async function getTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const txn = await txnService.getTransaction(req.params.id as string, req.user!.id);
    if (!txn) throw createError(404, 'Transaction not found');
    res.json({ success: true, data: txn });
  } catch (err) { next(err); }
}

export async function createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const txn = await txnService.createTransaction(req.user!.id, req.body);
    res.status(201).json({ success: true, data: txn });
  } catch (err) { next(err); }
}

export async function updateTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const txn = await txnService.updateTransaction(req.params.id as string, req.user!.id, req.body);
    if (!txn) throw createError(404, 'Transaction not found');
    res.json({ success: true, data: txn });
  } catch (err) { next(err); }
}

export async function deleteTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const txn = await txnService.deleteTransaction(req.params.id as string, req.user!.id);
    if (!txn) throw createError(404, 'Transaction not found');
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}

export async function bulkCreateTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { created, skipped } = await txnService.bulkCreateTransactions(req.user!.id, req.body.transactions);
    res.status(201).json({
      success: true,
      data: created,
      meta: { count: created.length, skipped: skipped.length, total: created.length + skipped.length },
    });
  } catch (err) { next(err); }
}

export async function exportTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await txnService.exportTransactions(req.user!.id, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      format: (req.query.format as 'csv' | 'json') || 'json',
    });

    if (req.query.format === 'csv') {
      const headers = ['id', 'type', 'amount', 'currency', 'description', 'merchant_name', 'transaction_date', 'category_name', 'account_name'];
      const csvRows = [headers.map(escapeCSV).join(',')];
      for (const row of rows) {
        csvRows.push(headers.map(h => escapeCSV((row as any)[h])).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      // Use CRLF per RFC 4180 to satisfy strict consumers (Excel/Numbers)
      res.send(csvRows.join('\r\n'));
    } else {
      res.json({ success: true, data: rows });
    }
  } catch (err) { next(err); }
}
