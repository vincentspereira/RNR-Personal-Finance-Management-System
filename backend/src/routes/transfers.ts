import { Router } from 'express';
import * as ctrl from '../controllers/transferController';
import { validate } from '../middleware/validate';
import { CreateTransferSchema, CreateSplitSchema } from '../schemas';

const router = Router();

router.post('/transfers', validate(CreateTransferSchema), ctrl.createTransfer);
router.delete('/transfers/:groupId', ctrl.deleteTransfer);

router.post('/splits', validate(CreateSplitSchema), ctrl.createSplit);
router.get('/splits/:id', ctrl.getSplit);
router.delete('/splits/:id', ctrl.deleteSplit);

export default router;
