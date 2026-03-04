import { Router } from 'express';
import * as controller from '../controllers/tag.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/async-handler';
import { createTagSchema } from '../utils/schemas';
import { validateBody } from '../middleware/validate.middleware';
import { UserRole } from '../types/user.types';

export const tagRouter = Router();

tagRouter.use(requireAuth);

tagRouter.get('/', asyncHandler(controller.listTags));
tagRouter.post('/', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST, UserRole.JUDGE), validateBody(createTagSchema), asyncHandler(controller.createTag));
tagRouter.delete('/:name', requireRole(UserRole.SUPER_ADMIN), asyncHandler(controller.deleteTag));
