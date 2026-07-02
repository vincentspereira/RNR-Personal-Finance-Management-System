import { Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { parseImportFile, mapRowToTransaction, computeImportHash, MappedTransaction } from '../services/importService';
import { bulkCreateTransactions } from '../services/transactionService';

const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.qif'].includes(ext)) {
      cb(null, true);
    } else {
      cb(createError(400, 'Only CSV and QIF files are supported'));
    }
  },
});

export { upload };

export async function importPreview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw createError(400, 'No file uploaded');
    }

    const file = files[0];
    const preview = parseImportFile(file.path);

    // Clean up uploaded file
    try { fs.unlinkSync(file.path); } catch {}

    res.json({
      success: true,
      data: {
        fileName: file.originalname,
        fileType: preview.fileType,
        headers: preview.headers,
        rows: preview.rows.slice(0, 10), // Preview first 10 rows
        detectedMappings: preview.detectedMappings,
        totalRows: preview.totalRows,
        availableFields: FIELD_NAMES,
      },
    });
  } catch (err) { next(err); }
}

export async function importConfirm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rows, mappings, accountId, categoryId } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw createError(400, 'No rows provided');
    }
    if (!mappings || typeof mappings !== 'object') {
      throw createError(400, 'Column mappings are required');
    }
    if (!accountId) {
      throw createError(400, 'Account ID is required');
    }

    const transactions: MappedTransaction[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const txn = mapRowToTransaction(rows[i], mappings, accountId);
        if (txn) {
          if (categoryId) txn.category_id = categoryId;
          transactions.push(txn);
        } else {
          errors.push({ row: i + 1, error: 'Could not parse date or amount' });
        }
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    if (transactions.length === 0) {
      throw createError(400, 'No valid transactions found. Check your column mappings.');
    }

    const { created, skipped } = await bulkCreateTransactions(req.user!.id, transactions.map(t => ({
      ...t,
      source: 'imported' as const,
      import_hash: computeImportHash(t),
    })));

    res.status(201).json({
      success: true,
      data: {
        imported: created.length,
        duplicates: skipped.length,
        skipped: errors.length,
        errors: errors.slice(0, 20),
      },
    });
  } catch (err) { next(err); }
}

const FIELD_NAMES = [
  'date', 'description', 'amount', 'debit', 'credit',
  'category', 'merchant', 'notes', 'tags',
];
