import { Router } from 'express';
import * as controller from '../controllers/session.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateBody } from '../middleware/validate.middleware';
import { nextQuestionSchema, scoreSchemaRequest, timerAdjustSchema, timerControlSchema } from '../utils/schemas';

export const sessionRouter = Router();

sessionRouter.use(requireAuth);

sessionRouter.get('/:id', asyncHandler(controller.getSession));
sessionRouter.get('/:id/scores', asyncHandler(controller.getScores));
sessionRouter.post('/:id/next-question', validateBody(nextQuestionSchema), asyncHandler(controller.nextQuestion));
sessionRouter.post('/:id/timer/start', asyncHandler((req, res) => {
  req.body = { action: 'start' };
  return controller.timerControl(req, res);
}));
sessionRouter.post('/:id/timer/pause', asyncHandler((req, res) => {
  req.body = { action: 'pause' };
  return controller.timerControl(req, res);
}));
sessionRouter.post('/:id/timer/reset', asyncHandler((req, res) => {
  req.body = { action: 'reset' };
  return controller.timerControl(req, res);
}));
sessionRouter.post('/:id/timer/control', validateBody(timerControlSchema), asyncHandler(controller.timerControl));
sessionRouter.post('/:id/timer/adjust', validateBody(timerAdjustSchema), asyncHandler(controller.adjustTimer));
sessionRouter.post('/:id/reveal-answer', asyncHandler(controller.revealAnswer));
sessionRouter.post('/:id/score', validateBody(scoreSchemaRequest), asyncHandler(controller.score));
sessionRouter.post('/:id/score/revert/:logId', asyncHandler(controller.revertScore));
sessionRouter.get('/:id/score-logs', asyncHandler(controller.scoreLogs));
sessionRouter.post('/:id/finish', asyncHandler(controller.finish));
