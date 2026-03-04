import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/response';

export async function logout(_req: Request, res: Response): Promise<void> {
  await authService.logout();
  sendSuccess(res, null, '注销成功');
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await authService.me(req.user.id);
  sendSuccess(res, data);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const data = await authService.refresh(req.body.refreshToken);
  sendSuccess(res, data, '刷新成功');
}

export async function requestMagicLink(req: Request, res: Response): Promise<void> {
  await authService.requestMagicLink(req.body.email);
  sendSuccess(res, null, '如果该邮箱已注册，登录链接已发送至您的邮箱');
}

export async function verifyMagicLink(req: Request, res: Response): Promise<void> {
  const data = await authService.verifyMagicLink(req.body.token);
  sendSuccess(res, data, '登录成功');
}

export async function magicLink(req: Request, res: Response): Promise<void> {
  const result = await authService.magicLink(req.body.email, req.body.displayName);
  const message = result.isNewUser && !result.needsName
    ? '注册成功，验证链接已发送至您的邮箱'
    : result.isNewUser
      ? '请填写您的显示名称'
      : '登录链接已发送至您的邮箱';
  sendSuccess(res, result, message);
}

export async function register(req: Request, res: Response): Promise<void> {
  await authService.register(req.body.email, req.body.displayName);
  sendSuccess(res, null, '注册成功，验证链接已发送至您的邮箱');
}
