import { Router } from 'express';
import * as controller from '../controllers/bank.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { createBankSchema, updateBankSchema } from '../utils/schemas';
import { UserRole } from '../types/user.types';

export const bankRouter = Router();

bankRouter.use(requireAuth);

bankRouter.get('/', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), asyncHandler(controller.getBanks));
bankRouter.post(
  '/',
  requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN),
  validateBody(createBankSchema),
  asyncHandler(controller.createBank),
);
bankRouter.get('/public', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), asyncHandler(controller.getPublicBanks));
bankRouter.get('/all', requireRole(UserRole.SUPER_ADMIN), asyncHandler(controller.getAllBanks));
bankRouter.get('/:id', asyncHandler(controller.getBankById));
bankRouter.patch('/:id', validateBody(updateBankSchema), asyncHandler(controller.updateBank));
bankRouter.delete('/:id', asyncHandler(controller.deleteBank));
