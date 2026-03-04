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
questionRouter.use(requireRole(UserRole.HOST, UserRole.JUDGE, UserRole.SUPER_ADMIN));

questionRouter.get('/', validateQuery(questionQuerySchema), asyncHandler(controller.queryQuestions));
questionRouter.post('/', validateBody(createQuestionSchema), asyncHandler(controller.createQuestion));
questionRouter.post('/batch', validateBody(batchQuestionsSchema), asyncHandler(controller.batchCreateQuestions));
questionRouter.post('/preview-import', validateBody(importQuestionsSchema), asyncHandler(controller.previewImport));
questionRouter.post('/import', validateBody(importQuestionsSchema), asyncHandler(controller.importQuestions));
questionRouter.get('/export/:bankId', asyncHandler(controller.exportQuestions));
questionRouter.get('/:id', asyncHandler(controller.getQuestionById));
questionRouter.patch('/:id', validateBody(updateQuestionSchema), asyncHandler(controller.updateQuestion));
questionRouter.delete('/:id', asyncHandler(controller.deleteQuestion));
