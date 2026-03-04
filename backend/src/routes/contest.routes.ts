import { Router } from 'express';
import * as controller from '../controllers/contest.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { createContestSchema, updateContestSchema } from '../utils/schemas';
import { UserRole } from '../types/user.types';

export const contestRouter = Router();

contestRouter.use(requireAuth);

contestRouter.get('/', asyncHandler(controller.listContests));
contestRouter.post('/', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST), validateBody(createContestSchema), asyncHandler(controller.createContest));
contestRouter.post('/join', asyncHandler(controller.joinContest));
contestRouter.get('/:id', asyncHandler(controller.getContestById));
contestRouter.patch('/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST), validateBody(updateContestSchema), asyncHandler(controller.updateContest));
contestRouter.delete('/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST), asyncHandler(controller.deleteContest));
contestRouter.post('/:id/start', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST), asyncHandler(controller.startContest));
contestRouter.get('/:id/session', asyncHandler(controller.getContestSession));
contestRouter.post('/:id/preview-questions', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST), asyncHandler(controller.previewQuestions));
contestRouter.get('/:id/join-code', requireRole(UserRole.SUPER_ADMIN, UserRole.HOST), asyncHandler(controller.getJoinCode));
