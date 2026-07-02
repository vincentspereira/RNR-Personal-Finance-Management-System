import { Router } from 'express';
import * as ctrl from '../controllers/analyticsController';

const router = Router();

router.get('/summary', ctrl.getSummary);
router.get('/by-category', ctrl.getByCategory);
router.get('/trends', ctrl.getTrends);
router.get('/top-merchants', ctrl.getTopMerchants);
router.get('/cashflow', ctrl.getCashflow);
router.get('/cashflow-forecast', ctrl.getCashflowForecast);
router.get('/budget-vs-actual', ctrl.getBudgetVsActual);
router.get('/recurring', ctrl.getRecurring);
router.get('/net-worth', ctrl.getNetWorth);
router.get('/net-worth-history', ctrl.getNetWorthHistory);
router.get('/budget-alerts', ctrl.getBudgetAlerts);

export default router;
