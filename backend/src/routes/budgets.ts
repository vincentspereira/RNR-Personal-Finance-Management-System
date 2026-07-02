import { Router } from 'express';
import * as ctrl from '../controllers/budgetController';
import { validate } from '../middleware/validate';
import { CreateBudgetSchema, UpdateBudgetSchema } from '../schemas';

const router = Router();

router.get('/', ctrl.listBudgets);
router.post('/', validate(CreateBudgetSchema), ctrl.createBudget);
router.put('/:id', validate(UpdateBudgetSchema), ctrl.updateBudget);
router.delete('/:id', ctrl.deleteBudget);

export default router;
