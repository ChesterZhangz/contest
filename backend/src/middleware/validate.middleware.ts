import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/api-error';

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ApiError(422, 'VALIDATION_ERROR', '请求体校验失败', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ApiError(422, 'VALIDATION_ERROR', '查询参数校验失败', result.error.flatten()));
      return;
    }
    (req as Request & { validatedQuery?: T }).validatedQuery = result.data;
    next();
  };
}
