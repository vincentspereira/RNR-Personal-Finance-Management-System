import { Router } from 'express';
import * as ctrl from '../controllers/accountController';
import { validate } from '../middleware/validate';
import { CreateAccountSchema, UpdateAccountSchema } from '../schemas';

const router = Router();

router.get('/', ctrl.listAccounts);
router.post('/', validate(CreateAccountSchema), ctrl.createAccount);
router.get('/:id/balance', ctrl.getAccountBalance);
router.put('/:id', validate(UpdateAccountSchema), ctrl.updateAccount);
router.delete('/:id', ctrl.archiveAccount);

export default router;
