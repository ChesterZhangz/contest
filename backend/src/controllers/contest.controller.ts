import type { Request, Response } from 'express';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/response';
import * as contestService from '../services/contest.service';
import { socketGateway } from '../socket/socket.gateway';

export async function listContests(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await contestService.listContests(req.user.id, req.user.role);
  sendSuccess(res, data);
}

export async function createContest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const data = await contestService.createContest(req.user.id, req.body);
  sendSuccess(res, data, '比赛创建成功', 201);
}

export async function getContestById(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const contestId = String(req.params.id);
  const data = await contestService.getContestById(contestId, {
    userId: req.user.id,
    role: req.user.role,
  });
  sendSuccess(res, data);
}

export async function updateContest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const contestId = String(req.params.id);
  const data = await contestService.updateContest(contestId, { userId: req.user.id, role: req.user.role }, req.body);
  sendSuccess(res, data, '比赛更新成功');
}

export async function deleteContest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const contestId = String(req.params.id);
  await contestService.deleteContest(contestId, { userId: req.user.id, role: req.user.role });
  sendSuccess(res, null, '比赛删除成功');
}

export async function previewQuestions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const contestId = String(req.params.id);
  const data = await contestService.previewQuestions(contestId, { userId: req.user.id, role: req.user.role });
  sendSuccess(res, data);
}

export async function startContest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const contestId = String(req.params.id);
  const data = await contestService.startContest(contestId, { userId: req.user.id, role: req.user.role });
  const sessionId = String((data.session as Record<string, unknown>).id ?? (data.session as Record<string, unknown>)._id);

  socketGateway.emitContestStarted(contestId, {
    contestId,
    sessionId,
    teams: data.contest.teams,
    totalQuestions: data.session.questionSequence.length,
    startedAt: data.contest.startedAt,
  });

  sendSuccess(res, { sessionId }, '比赛开始成功');
}

export async function getContestSession(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const contestId = String(req.params.id);
  const data = await contestService.getActiveSession(contestId, { userId: req.user.id, role: req.user.role });
  sendSuccess(res, data);
}

export async function joinContest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const { joinCode, teamId } = req.body as { joinCode?: string; teamId?: string };
  if (!joinCode) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请提供邀请码');
  }

  const data = await contestService.joinContest(String(joinCode), req.user.id, teamId ? String(teamId) : undefined);
  sendSuccess(res, data, '加入竞赛成功');
}

export async function getJoinCode(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const contestId = String(req.params.id);
  const data = await contestService.getJoinCode(contestId, { userId: req.user.id, role: req.user.role });
  sendSuccess(res, data);
}
