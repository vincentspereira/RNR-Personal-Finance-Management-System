import { Response, NextFunction } from 'express';
import * as analyticsService from '../services/analyticsService';
import * as budgetAlertService from '../services/budgetAlertService';
import * as reportService from '../services/reportService';
import { AuthRequest } from '../middleware/auth';

function monthStart(): string {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
}
function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const startDate = (req.query.startDate as string) || monthStart();
    const endDate = (req.query.endDate as string) || today();
    const data = await analyticsService.getSummary(req.user!.id, startDate, endDate);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getByCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const startDate = (req.query.startDate as string) || monthStart();
    const endDate = (req.query.endDate as string) || today();
    const data = await analyticsService.getByCategory(req.user!.id, startDate, endDate, req.query.type as string);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getTrends(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 12;
    const data = await analyticsService.getTrends(req.user!.id, months);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getTopMerchants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const startDate = (req.query.startDate as string) || monthStart();
    const endDate = (req.query.endDate as string) || today();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const data = await analyticsService.getTopMerchants(req.user!.id, startDate, endDate, limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCashflow(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const startDate = (req.query.startDate as string) || monthStart();
    const endDate = (req.query.endDate as string) || today();
    const data = await analyticsService.getCashflow(req.user!.id, startDate, endDate);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCashflowForecast(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
    const data = await analyticsService.getCashflowForecast(req.user!.id, days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getBudgetVsActual(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const startDate = (req.query.startDate as string) || monthStart();
    const endDate = (req.query.endDate as string) || today();
    const data = await analyticsService.getBudgetVsActual(req.user!.id, startDate, endDate);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getRecurring(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getRecurring(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getNetWorth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getNetWorth(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getNetWorthHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 12;
    const data = await reportService.getNetWorthHistory(req.user!.id, months);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getBudgetAlerts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const alerts = await budgetAlertService.getBudgetAlerts(req.user!.id);
    res.json({ success: true, data: alerts });
  } catch (err) { next(err); }
}
