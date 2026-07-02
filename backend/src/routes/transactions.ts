import { Router } from 'express';
import * as ctrl from '../controllers/transactionController';
import { validate } from '../middleware/validate';
import { CreateTransactionSchema, UpdateTransactionSchema } from '../schemas';

const router = Router();

router.get('/', ctrl.listTransactions);
router.get('/export', ctrl.exportTransactions);
router.post('/bulk', ctrl.bulkCreateTransactions);
router.get('/:id', ctrl.getTransaction);
router.post('/', validate(CreateTransactionSchema), ctrl.createTransaction);
router.put('/:id', validate(UpdateTransactionSchema), ctrl.updateTransaction);
router.delete('/:id', ctrl.deleteTransaction);

export default router;
