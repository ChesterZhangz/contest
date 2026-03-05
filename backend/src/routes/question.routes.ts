import { Router } from 'express';
import * as controller from '../controllers/question.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateBody, validateQuery } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import {
  batchQuestionsSchema,
  createQuestionSchema,
  importQuestionsSchema,
  questionQuerySchema,
  updateQuestionSchema,
} from '../utils/schemas';
import { UserRole } from '../types/user.types';

export const questionRouter = Router();

questionRouter.use(requireAuth);

// Write routes: only host/judge/admin (specific paths before wildcard /:id)
questionRouter.post('/', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), validateBody(createQuestionSchema), asyncHandler(controller.createQuestion));
questionRouter.post('/batch', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), validateBody(batchQuestionsSchema), asyncHandler(controller.batchCreateQuestions));
questionRouter.post('/preview-import', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), validateBody(importQuestionsSchema), asyncHandler(controller.previewImport));
questionRouter.post('/import', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), validateBody(importQuestionsSchema), asyncHandler(controller.importQuestions));
questionRouter.get('/export/:bankId', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), asyncHandler(controller.exportQuestions));

// Read routes: any authenticated user can query/view questions (service layer checks public bank access)
questionRouter.get('/', validateQuery(questionQuerySchema), asyncHandler(controller.queryQuestions));
questionRouter.get('/:id', asyncHandler(controller.getQuestionById));
questionRouter.patch('/:id', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), validateBody(updateQuestionSchema), asyncHandler(controller.updateQuestion));
questionRouter.delete('/:id', requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN), asyncHandler(controller.deleteQuestion));
