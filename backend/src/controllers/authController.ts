import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

function isEmail(s: unknown): s is string {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body || {};
    if (!isEmail(email)) throw createError(400, 'Valid email is required');
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError(400, 'name is required');
    }
    if (typeof password !== 'string') throw createError(400, 'password is required');
    const result = await authService.register(email, password, name.trim());
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body || {};
    if (!isEmail(email)) throw createError(400, 'Valid email is required');
    if (typeof password !== 'string' || password.length === 0) {
      throw createError(400, 'password is required');
    }
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw createError(400, 'refreshToken is required');
    }
    const result = await authService.refreshSession(refreshToken);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken === 'string' && refreshToken) {
      await authService.logout(refreshToken);
    }
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');
    const { oldPassword, newPassword } = req.body || {};
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
      throw createError(400, 'oldPassword and newPassword are required');
    }
    await authService.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');
    const user = await authService.getUser(req.user.id);
    if (!user) throw createError(404, 'User not found');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}
