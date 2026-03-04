import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../types/user.types';
import { ApiError } from '../utils/api-error';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'AUTH_REQUIRED', '请先登录'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'FORBIDDEN', '无操作权限'));
      return;
    }

    next();
  };
}
