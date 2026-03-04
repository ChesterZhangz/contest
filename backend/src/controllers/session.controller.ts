import type { Request, Response } from 'express';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/response';
import * as sessionService from '../services/session.service';
import { socketGateway } from '../socket/socket.gateway';
import { SessionState } from '../types/session.types';

function getAccess(req: Request) {
  if (!req.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', '请先登录');
  }

  return {
    userId: req.user.id,
    role: req.user.role,
  };
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.getSession(sessionId, getAccess(req));
  sendSuccess(res, data);
}

export async function getScores(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.getSessionScores(sessionId, getAccess(req));
  sendSuccess(res, data);
}

export async function nextQuestion(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.nextQuestion(sessionId, getAccess(req), req.body.skipTo);

  socketGateway.emitQuestionChanged(String(data.session.contestId), data.questionMeta);
  socketGateway.emitQuestionDetail(String(data.session.contestId), data.questionDetail);

  sendSuccess(res, data, '切题成功');
}

export async function timerControl(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.controlTimer(sessionId, getAccess(req), req.body.action);

  const sessionData = await sessionService.getSession(sessionId, getAccess(req));
  const contestId = sessionData.contestId;

  if (req.body.action === 'start') {
    socketGateway.emitTimerStarted(contestId, {
      totalSeconds: data.timer.totalSeconds,
      remainingSeconds: data.timer.remainingSeconds,
      startedAt: data.timer.startedAt,
    });
  }

  if (req.body.action === 'pause') {
    socketGateway.emitTimerPaused(contestId, {
      totalSeconds: data.timer.totalSeconds,
      remainingSeconds: data.timer.remainingSeconds,
    });
  }

  if (req.body.action === 'reset') {
    socketGateway.emitTimerReset(contestId, {
      totalSeconds: data.timer.totalSeconds,
    });
  }

  sendSuccess(res, data, '计时器已更新');
}

export async function adjustTimer(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.adjustTimer(sessionId, getAccess(req), req.body.deltaSeconds);

  const sessionData = await sessionService.getSession(sessionId, getAccess(req));
  const contestId = sessionData.contestId;

  if (data.state === SessionState.TIMER_RUNNING) {
    socketGateway.emitTimerStarted(contestId, {
      totalSeconds: data.timer.totalSeconds,
      remainingSeconds: data.timer.remainingSeconds,
      startedAt: data.timer.startedAt,
    });
  } else if (data.state === SessionState.TIMER_EXPIRED) {
    socketGateway.emitTimerExpired(contestId, {});
  } else {
    socketGateway.emitTimerPaused(contestId, {
      totalSeconds: data.timer.totalSeconds,
      remainingSeconds: data.timer.remainingSeconds,
    });
  }

  sendSuccess(res, data, '计时器已调整');
}

export async function revealAnswer(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.revealAnswer(sessionId, getAccess(req));

  const sessionData = await sessionService.getSession(sessionId, getAccess(req));
  socketGateway.emitAnswerRevealed(sessionData.contestId, data);

  sendSuccess(res, data, '答案已公布');
}

export async function score(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const result = await sessionService.scoreSession(sessionId, getAccess(req), req.body);
  const contestId = String((result.session as { contestId?: unknown }).contestId ?? '');

  socketGateway.emitScoresUpdated(contestId, {
    scores: result.session.scores,
    log: result.log,
  });
  const logData = result.log as Record<string, unknown>;
  socketGateway.emitScoreLogged(contestId, {
    ...logData,
    id: String(logData.id ?? logData._id ?? ''),
  });

  sendSuccess(res, result, '计分成功');
}

export async function revertScore(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const logId = String(req.params.logId);
  const result = await sessionService.revertSessionScore(sessionId, getAccess(req), logId);
  const contestId = String((result.session as { contestId?: unknown }).contestId ?? '');

  socketGateway.emitScoresUpdated(contestId, {
    scores: result.session.scores,
    log: result.revertLog,
  });

  sendSuccess(res, result, '撤销成功');
}

export async function scoreLogs(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.getSessionScoreLogs(sessionId, getAccess(req));
  sendSuccess(res, data);
}

export async function finish(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.id);
  const data = await sessionService.finishSession(sessionId, getAccess(req));

  const sessionData = await sessionService.getSession(sessionId, getAccess(req));
  socketGateway.emitContestFinished(sessionData.contestId, data);

  sendSuccess(res, data, '比赛结束');
}
