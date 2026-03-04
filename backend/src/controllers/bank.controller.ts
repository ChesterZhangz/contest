import type { Request, Response } from 'express';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/response';
import * as bankService from '../services/bank.service';

export async function getBanks(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await bankService.getMyBanks(req.user.id);
  sendSuccess(res, data);
}

export async function getPublicBanks(_req: Request, res: Response): Promise<void> {
  const data = await bankService.getPublicBanks();
  sendSuccess(res, data);
}

export async function createBank(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await bankService.createBank(req.user.id, req.body);
  sendSuccess(res, data, '题库创建成功', 201);
}

export async function getBankById(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const bankId = String(req.params.id);
  const data = await bankService.getBankById(bankId, req.user.id);
  sendSuccess(res, data);
}

export async function updateBank(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const bankId = String(req.params.id);
  const data = await bankService.updateBank(bankId, req.user.id, req.body);
  sendSuccess(res, data, '题库更新成功');
}

export async function deleteBank(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const bankId = String(req.params.id);
  await bankService.deleteBank(bankId, req.user.id);
  sendSuccess(res, null, '题库删除成功');
}
