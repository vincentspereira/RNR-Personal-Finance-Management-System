import { Router, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

// GET /uploads/:filename — only the user whose scan references this file may read it.
// We strictly match on basename to defeat path traversal.
router.get('/:filename', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const raw = String(req.params.filename || '');
    const safeName = path.basename(raw);
    if (safeName !== raw || safeName.includes('..')) {
      throw createError(400, 'Invalid filename');
    }

    const userId = req.user?.id;
    if (!userId) throw createError(401, 'Not authenticated');

    // ACL: confirm a scan owned by this user references this path.
    const absPath = path.resolve(config.uploadDir, safeName);
    const result = await query(
      `SELECT id FROM scans
       WHERE user_id = $1
         AND (
           original_path = $2
           OR original_path LIKE '%' || $3
           OR filename = $3
         )
       LIMIT 1`,
      [userId, absPath, safeName]
    );
    if (result.rows.length === 0) {
      // Don't disclose whether the file exists if the user doesn't own it.
      throw createError(404, 'File not found');
    }

    if (!fs.existsSync(absPath)) {
      throw createError(404, 'File not found');
    }

    // Disable caching of private files in shared caches
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.sendFile(absPath);
  } catch (err) { next(err); }
});

export default router;
