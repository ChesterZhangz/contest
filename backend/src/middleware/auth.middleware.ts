import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../utils/jwt';
import { ApiError } from '../utils/api-error';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(new ApiError(401, 'AUTH_REQUIRED', '请先登录'));
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const payload = verifyJwt(token);
    if (payload.tokenType !== 'access') {
      throw new ApiError(401, 'AUTH_INVALID_TOKEN', 'Token 类型错误');
    }

    req.user = {
      id: payload.userId,
      role: payload.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}
