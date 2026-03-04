import { Router } from 'express';
import * as controller from '../controllers/settings.controller';
import { asyncHandler } from '../utils/async-handler';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { UserRole } from '../types/user.types';
import { updateSettingsSchema } from '../utils/schemas';

export const settingsRouter = Router();

// Public — frontend reads this for registration domain hints
settingsRouter.get('/public', asyncHandler(controller.getPublicSettings));

// Super-admin only
settingsRouter.use(requireAuth);
settingsRouter.use(requireRole(UserRole.SUPER_ADMIN));
settingsRouter.get('/', asyncHandler(controller.getSettings));
settingsRouter.put('/', validateBody(updateSettingsSchema), asyncHandler(controller.updateSettings));
