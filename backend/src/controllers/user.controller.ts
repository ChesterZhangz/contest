import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';
import * as userService from '../services/user.service';

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const data = await userService.listUsers();
  sendSuccess(res, data);
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const data = await userService.createUser(req.body);
  sendSuccess(res, data, '用户创建成功', 201);
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const userId = String(req.params.id);
  const data = await userService.updateUser(userId, req.body);
  sendSuccess(res, data, '用户更新成功');
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const userId = String(req.params.id);
  await userService.disableUser(userId);
  sendSuccess(res, null, '用户已禁用');
}

export async function resendInvite(req: Request, res: Response): Promise<void> {
  const userId = String(req.params.id);
  await userService.resendInvite(userId);
  sendSuccess(res, null, '邀请邮件已重新发送');
}
