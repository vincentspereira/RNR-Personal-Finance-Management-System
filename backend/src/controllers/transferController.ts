import { Response, NextFunction } from 'express';
import * as transferService from '../services/transferService';
import * as splitService from '../services/splitService';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export async function createTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await transferService.createTransfer(req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function deleteTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const groupId = String(req.params.groupId);
    const removed = await transferService.deleteTransfer(req.user!.id, groupId);
    if (removed.length === 0) throw createError(404, 'Transfer not found');
    res.json({ success: true, data: { removed: removed.length } });
  } catch (err) { next(err); }
}

export async function createSplit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await splitService.createSplit(req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getSplit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await splitService.getSplit(req.user!.id, String(req.params.id));
    if (!data) throw createError(404, 'Split transaction not found');
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteSplit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const removed = await splitService.deleteSplit(req.user!.id, String(req.params.id));
    if (!removed) throw createError(404, 'Split transaction not found');
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
