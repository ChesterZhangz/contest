import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message = '操作成功', status = 200): void {
  res.status(status).json({
    success: true,
    data,
    message,
  });
}
