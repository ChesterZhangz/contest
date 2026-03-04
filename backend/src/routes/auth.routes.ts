import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { asyncHandler } from '../utils/async-handler';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { magicLinkSchema, refreshSchema, registerSchema, requestMagicLinkSchema, verifyMagicLinkSchema } from '../utils/schemas';

export const authRouter = Router();

authRouter.post('/magic-link', validateBody(magicLinkSchema), asyncHandler(controller.magicLink));
authRouter.post('/register', validateBody(registerSchema), asyncHandler(controller.register));
authRouter.post('/request-magic-link', validateBody(requestMagicLinkSchema), asyncHandler(controller.requestMagicLink));
authRouter.post('/verify-magic-link', validateBody(verifyMagicLinkSchema), asyncHandler(controller.verifyMagicLink));
authRouter.post('/logout', requireAuth, asyncHandler(controller.logout));
authRouter.get('/me', requireAuth, asyncHandler(controller.me));
authRouter.post('/refresh', validateBody(refreshSchema), asyncHandler(controller.refresh));
