import { Router } from 'express';
import * as ctrl from '../controllers/savingsGoalController';
import { validate } from '../middleware/validate';
import { CreateSavingsGoalSchema, UpdateSavingsGoalSchema } from '../schemas';

const router = Router();

router.get('/', ctrl.listGoals);
router.post('/', validate(CreateSavingsGoalSchema), ctrl.createGoal);
router.put('/:id', validate(UpdateSavingsGoalSchema), ctrl.updateGoal);
router.delete('/:id', ctrl.deleteGoal);

export default router;
