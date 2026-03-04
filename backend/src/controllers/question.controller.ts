import type { Request, Response } from 'express';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/response';
import * as questionService from '../services/question.service';

export async function queryQuestions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const query = ((req as Request & { validatedQuery?: Record<string, unknown> }).validatedQuery ??
    req.query) as Record<string, unknown>;
  const data = await questionService.queryQuestions(req.user.id, query);
  sendSuccess(res, data);
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await questionService.createQuestion(req.user.id, req.body);
  sendSuccess(res, data, '题目创建成功', 201);
}

export async function getQuestionById(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const questionId = String(req.params.id);
  const data = await questionService.getQuestionById(req.user.id, questionId);
  sendSuccess(res, data);
}

export async function updateQuestion(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const questionId = String(req.params.id);
  const data = await questionService.updateQuestion(req.user.id, questionId, req.body);
  sendSuccess(res, data, '题目更新成功');
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const questionId = String(req.params.id);
  await questionService.deleteQuestion(req.user.id, questionId);
  sendSuccess(res, null, '题目删除成功');
}

export async function batchCreateQuestions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await questionService.batchCreateQuestions(req.user.id, req.body.bankId, req.body.questions);
  sendSuccess(res, data, '批量创建成功', 201);
}

export async function previewImport(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await questionService.previewImportQuestions(req.user.id, req.body.bankId, req.body.format, req.body.content);
  sendSuccess(res, data);
}

export async function importQuestions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await questionService.importQuestions(req.user.id, req.body.bankId, req.body.format, req.body.content);
  sendSuccess(res, data, '导入完成');
}

export async function exportQuestions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const bankId = String(req.params.bankId);
  const data = await questionService.exportQuestionsByBank(req.user.id, bankId);
  sendSuccess(res, data);
}
