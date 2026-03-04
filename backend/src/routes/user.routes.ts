import { Router } from 'express';
import * as controller from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/async-handler';
import { createUserSchema, updateUserSchema } from '../utils/schemas';
import { validateBody } from '../middleware/validate.middleware';
import { UserRole } from '../types/user.types';

export const userRouter = Router();

userRouter.use(requireAuth);

// HOST needs to list users when assigning team members; write operations are SUPER_ADMIN only
userRouter.get('/', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST), asyncHandler(controller.listUsers));
userRouter.post('/', requireRole(UserRole.SUPER_ADMIN), validateBody(createUserSchema), asyncHandler(controller.createUser));
userRouter.patch('/:id', requireRole(UserRole.SUPER_ADMIN), validateBody(updateUserSchema), asyncHandler(controller.updateUser));
userRouter.delete('/:id', requireRole(UserRole.SUPER_ADMIN), asyncHandler(controller.deleteUser));
userRouter.post('/:id/resend-invite', requireRole(UserRole.SUPER_ADMIN), asyncHandler(controller.resendInvite));
