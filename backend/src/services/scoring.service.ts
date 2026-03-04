import { ScoreLogModel } from '../models/ScoreLog.model';
import { ContestSessionModel } from '../models/ContestSession.model';
import { ApiError } from '../utils/api-error';
import { toObjectId } from '../utils/object-id';
import type { ScoreOpType } from '../types/session.types';

interface ScoreInput {
  teamId: string;
  delta: number;
  type: ScoreOpType;
  questionId?: string;
  note?: string;
}

export async function applyScore(sessionId: string, operatorId: string, payload: ScoreInput) {
  const session = await ContestSessionModel.findById(toObjectId(sessionId, 'sessionId'));
  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', '比赛会话不存在');
  }

  const scoreItem = session.scores.find((item) => item.teamId === payload.teamId);
  if (!scoreItem) {
    throw new ApiError(404, 'TEAM_NOT_FOUND', '计分目标队伍不存在');
  }

  const before = Number(scoreItem.score ?? 0);
  const after = before + payload.delta;
  scoreItem.score = after;

  await session.save();

  const log = await ScoreLogModel.create({
    sessionId: session._id,
    contestId: session.contestId,
    operatorId: toObjectId(operatorId, 'operatorId'),
    operationType: payload.type,
    targetTeamId: payload.teamId,
    delta: payload.delta,
    scoreBefore: before,
    scoreAfter: after,
    questionId: payload.questionId ? toObjectId(payload.questionId, 'questionId') : undefined,
    roundNumber:
      session.currentQuestionIndex >= 0 ? session.questionSequence[session.currentQuestionIndex]?.roundNumber ?? undefined : undefined,
    note: payload.note,
    isReverted: false,
  });

  return {
    session: session.toJSON(),
    log: log.toJSON(),
  };
}

export async function revertScore(sessionId: string, logId: string, operatorId: string) {
  const session = await ContestSessionModel.findById(toObjectId(sessionId, 'sessionId'));
  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', '比赛会话不存在');
  }

  const log = await ScoreLogModel.findOne({ _id: toObjectId(logId, 'logId'), sessionId: session._id });
  if (!log) {
    throw new ApiError(404, 'SCORE_LOG_NOT_FOUND', '计分日志不存在');
  }

  if (log.isReverted) {
    throw new ApiError(409, 'INVALID_SESSION_STATE', '该计分已撤销');
  }

  const scoreItem = session.scores.find((item) => item.teamId === log.targetTeamId);
  if (!scoreItem) {
    throw new ApiError(404, 'TEAM_NOT_FOUND', '计分目标队伍不存在');
  }

  scoreItem.score = Number(scoreItem.score ?? 0) - Number(log.delta);
  await session.save();

  log.isReverted = true;
  log.revertedBy = toObjectId(operatorId, 'operatorId');
  log.revertedAt = new Date();
  await log.save();

  const revertLog = await ScoreLogModel.create({
    sessionId: session._id,
    contestId: session.contestId,
    operatorId: toObjectId(operatorId, 'operatorId'),
    operationType: 'revert',
    targetTeamId: log.targetTeamId,
    delta: -Number(log.delta),
    scoreBefore: Number(scoreItem.score ?? 0) + Number(log.delta),
    scoreAfter: Number(scoreItem.score ?? 0),
    questionId: log.questionId,
    roundNumber: log.roundNumber,
    isReverted: false,
    note: `Revert ${String(log._id)}`,
  });

  return {
    session: session.toJSON(),
    log: log.toJSON(),
    revertLog: revertLog.toJSON(),
  };
}
