import { Router } from 'express';
import * as ctrl from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { RegisterSchema, LoginSchema, RefreshSchema, ChangePasswordSchema } from '../schemas';

const router = Router();

router.post('/register', validate(RegisterSchema), ctrl.register);
router.post('/login', validate(LoginSchema), ctrl.login);
router.post('/refresh', validate(RefreshSchema), ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/profile', authMiddleware, ctrl.getProfile);
router.post('/change-password', authMiddleware, validate(ChangePasswordSchema), ctrl.changePassword);

export default router;
