import { Response, NextFunction } from 'express';
import { query } from '../db';
import { config } from '../config';
import { AuthRequest } from './auth';
import { createError } from './errorHandler';

/**
 * P1-8: Enforce a daily per-user quota on scan uploads.
 * This is on top of the per-IP rate limiter applied at the route level.
 *
 * Counts the number of `scans` rows the user has created in the last 24h.
 * The check happens before multer parses the body, so a quota miss
 * short-circuits the upload entirely.
 */
export async function enforceScanQuota(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      // authMiddleware should have run, but guard anyway
      throw createError(401, 'Not authenticated');
    }
    const limit = config.scansPerUserPerDay;
    if (!Number.isFinite(limit) || limit <= 0) return next();

    const result = await query(
      `SELECT COUNT(*)::int AS used
       FROM scans
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [req.user.id]
    );
    const used = (result.rows[0]?.used as number) || 0;
    if (used >= limit) {
      throw createError(
        429,
        `Daily scan quota reached (${used}/${limit}). Please try again tomorrow or contact support.`
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}
