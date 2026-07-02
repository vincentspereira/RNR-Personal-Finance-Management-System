import { Router } from 'express';
import * as ctrl from '../controllers/categoryController';
import { validate } from '../middleware/validate';
import { CreateCategorySchema, UpdateCategorySchema } from '../schemas';

const router = Router();

router.get('/', ctrl.listCategories);
router.post('/', validate(CreateCategorySchema), ctrl.createCategory);
router.put('/:id', validate(UpdateCategorySchema), ctrl.updateCategory);
router.delete('/:id', ctrl.deleteCategory);

export default router;
