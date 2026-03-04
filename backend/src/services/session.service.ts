import { ContestModel } from '../models/Contest.model';
import { ContestSessionModel } from '../models/ContestSession.model';
import { QuestionModel } from '../models/Question.model';
import { ScoreLogModel } from '../models/ScoreLog.model';
import { ContestStatus } from '../types/contest.types';
import { ScoreOpType, SessionState } from '../types/session.types';
import { UserRole } from '../types/user.types';
import { ApiError } from '../utils/api-error';
import { toObjectId } from '../utils/object-id';
import { applyScore, revertScore } from './scoring.service';

interface AccessContext {
  userId: string;
  role: UserRole;
}

function isHostForContest(contest: { hostId: unknown }, access: AccessContext): boolean {
  return String(contest.hostId) === access.userId;
}

function isJudgeForContest(contest: { judgeIds?: unknown[] }, access: AccessContext): boolean {
  return (contest.judgeIds ?? []).some((id) => String(id) === access.userId);
}

function isHostOperator(contest: { hostId: unknown }, access: AccessContext): boolean {
  return access.role === UserRole.SUPER_ADMIN || isHostForContest(contest, access);
}

function isJudgeOperator(contest: { judgeIds?: unknown[] }, access: AccessContext): boolean {
  return access.role === UserRole.SUPER_ADMIN || isJudgeForContest(contest, access);
}

const DEFAULT_TIME_PER_QUESTION_SECONDS = 60;
const MIN_TIME_PER_QUESTION_SECONDS = 1;

function toPositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
}

function normalizeTimerSeconds(value: unknown, fallback = DEFAULT_TIME_PER_QUESTION_SECONDS): number {
  return toPositiveInt(value) ?? fallback;
}

function inferRoundIndexByQuestionPosition(
  rounds: Array<{ questionCount?: unknown }>,
  questionIndex: number,
): number {
  if (questionIndex < 0 || rounds.length === 0) {
    return 0;
  }

  let cursor = 0;
  for (let i = 0; i < rounds.length; i += 1) {
    const count = toPositiveInt(rounds[i]?.questionCount) ?? 0;
    if (count > 0 && questionIndex < cursor + count) {
      return i;
    }
    cursor += count;
  }

  return Math.max(0, Math.min(questionIndex, rounds.length - 1));
}

function resolveRoundMeta(
  contest: { rounds?: Array<{ roundNumber?: unknown; questionCount?: unknown; timePerQuestion?: unknown }> },
  sequenceRoundNumber: unknown,
  questionIndex: number,
) {
  const rounds = contest.rounds ?? [];
  if (rounds.length === 0) {
    return {
      roundIndex: 0,
      roundNumber: 1,
      round: undefined as { roundNumber?: unknown; questionCount?: unknown; timePerQuestion?: unknown } | undefined,
    };
  }

  const requestedRoundNumber = toPositiveInt(sequenceRoundNumber);
  if (requestedRoundNumber) {
    const byRoundNumber = rounds.findIndex((item) => toPositiveInt(item?.roundNumber) === requestedRoundNumber);
    if (byRoundNumber >= 0) {
      return {
        roundIndex: byRoundNumber,
        roundNumber: requestedRoundNumber,
        round: rounds[byRoundNumber],
      };
    }

    const byOrdinal = requestedRoundNumber - 1;
    if (byOrdinal >= 0 && byOrdinal < rounds.length) {
      const round = rounds[byOrdinal];
      return {
        roundIndex: byOrdinal,
        roundNumber: toPositiveInt(round?.roundNumber) ?? requestedRoundNumber,
        round,
      };
    }
  }

  const inferredIndex = inferRoundIndexByQuestionPosition(rounds, questionIndex);
  const inferredRound = rounds[inferredIndex];
  return {
    roundIndex: inferredIndex,
    roundNumber: toPositiveInt(inferredRound?.roundNumber) ?? inferredIndex + 1,
    round: inferredRound,
  };
}

function hasContestAccess(
  contest: {
    hostId: unknown;
    judgeIds?: unknown[];
    participants?: unknown[];
    teams?: Array<{ memberIds?: unknown[] }>;
    status?: unknown;
  },
  access: AccessContext,
): boolean {
  if (access.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  if (String(contest.hostId) === access.userId) {
    return true;
  }

  if ((contest.judgeIds ?? []).some((id) => String(id) === access.userId)) {
    return true;
  }

  if ((contest.participants ?? []).some((id) => String(id) === access.userId)) {
    return true;
  }

  if ((contest.teams ?? []).some((team) => (team.memberIds ?? []).some((id) => String(id) === access.userId))) {
    return true;
  }

  // Audience and unenrolled participants can view active/finished sessions (read-only)
  if (access.role === UserRole.AUDIENCE || access.role === UserRole.PARTICIPANT) {
    const status = String(contest.status ?? '');
    return status === ContestStatus.ACTIVE || status === ContestStatus.FINISHED;
  }

  return false;
}

function ensureTimerRemaining(timer: { totalSeconds: number; remainingSeconds: number; startedAt?: Date; isPaused: boolean }) {
  if (timer.isPaused || !timer.startedAt) {
    return Math.max(0, Number(timer.remainingSeconds ?? 0));
  }

  const elapsed = Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000);
  return Math.max(0, Number(timer.remainingSeconds ?? 0) - elapsed);
}

function ensureTimer(session: {
  timer?:
    | {
        totalSeconds?: number;
        remainingSeconds?: number;
        startedAt?: Date | null;
        isPaused?: boolean;
      }
    | null;
}) {
  if (!session.timer) {
    session.timer = {
      totalSeconds: 0,
      remainingSeconds: 0,
      startedAt: undefined,
      isPaused: true,
    };
  }

  return {
    totalSeconds: Number(session.timer.totalSeconds ?? 0),
    remainingSeconds: Number(session.timer.remainingSeconds ?? 0),
    startedAt: session.timer.startedAt ?? undefined,
    isPaused: Boolean(session.timer.isPaused ?? true),
  };
}

async function loadSessionWithContest(sessionId: string) {
  const session = await ContestSessionModel.findById(toObjectId(sessionId, 'sessionId'));
  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', '比赛会话不存在');
  }

  const contest = await ContestModel.findById(session.contestId);
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  return { session, contest };
}

export async function getSession(sessionId: string, access: AccessContext) {
  const { session, contest } = await loadSessionWithContest(sessionId);

  if (!hasContestAccess(contest, access)) {
    throw new ApiError(403, 'FORBIDDEN', '无权限查看该会话');
  }

  const safeQuestionIndex = Number.isInteger(session.currentQuestionIndex) ? session.currentQuestionIndex : -1;
  const currentSequence = safeQuestionIndex >= 0 ? session.questionSequence[safeQuestionIndex] : null;
  const question = currentSequence
    ? await QuestionModel.findById(currentSequence.questionId)
        .select('content answer solution type difficulty tags choices source')
        .lean()
    : null;
  const roundMeta = resolveRoundMeta(contest, currentSequence?.roundNumber, safeQuestionIndex);
  const fallbackTotalSeconds = normalizeTimerSeconds(roundMeta.round?.timePerQuestion);

  const isEnrolledContestant =
    (contest.participants ?? []).some((id) => String(id) === access.userId) ||
    (contest.teams ?? []).some((team) => (team.memberIds ?? []).some((id) => String(id) === access.userId));
  const isHostViewer = isHostForContest(contest, access);
  const isJudgeViewer = isJudgeForContest(contest, access);

  const canSeeQuestion = isHostViewer || isJudgeViewer || isEnrolledContestant || access.role === UserRole.SUPER_ADMIN;
  const canSeeAnswer =
    isHostViewer || isJudgeViewer || access.role === UserRole.SUPER_ADMIN || Boolean(currentSequence?.isRevealed);

  const questionForViewer = question
    ? {
        id: String(question._id),
        content: canSeeQuestion ? question.content : undefined,
        answer: canSeeAnswer ? question.answer : undefined,
        solution: canSeeAnswer ? question.solution : undefined,
        type: question.type,
        difficulty: question.difficulty,
        tags: question.tags,
        choices: canSeeQuestion ? question.choices : undefined,
        source: question.source,
      }
    : null;

  const timerState = ensureTimer(session);
  const timerRemaining = ensureTimerRemaining(timerState);
  const timerTotal = normalizeTimerSeconds(timerState.totalSeconds, fallbackTotalSeconds);

  if (!timerState.isPaused && timerRemaining === 0 && session.state === SessionState.TIMER_RUNNING) {
    session.state = SessionState.TIMER_EXPIRED;
    session.timer = {
      ...timerState,
      totalSeconds: timerTotal,
      remainingSeconds: 0,
      isPaused: true,
      startedAt: undefined,
    };
    await session.save();
  }

  return {
    id: String(session._id),
    contestId: String(session.contestId),
    state: session.state,
    currentQuestionIndex: safeQuestionIndex,
    currentRoundIndex:
      Number.isInteger(session.currentRoundIndex) &&
      session.currentRoundIndex >= 0 &&
      session.currentRoundIndex < (contest.rounds?.length ?? 1)
        ? session.currentRoundIndex
        : roundMeta.roundIndex,
    timer: {
      totalSeconds: timerTotal,
      remainingSeconds: timerRemaining,
      startedAt: timerState.startedAt,
      isPaused: timerState.isPaused,
    },
    scores: session.scores,
    questionSequence: session.questionSequence.map((item) => ({
      questionId: String(item.questionId),
      roundNumber: item.roundNumber,
      orderInRound: item.orderInRound,
      globalOrder: item.globalOrder,
      isRevealed: item.isRevealed,
      revealedAt: item.revealedAt,
    })),
    currentQuestion: questionForViewer,
    viewer: {
      isHostForContest: isHostViewer || access.role === UserRole.SUPER_ADMIN,
      isJudgeForContest: isJudgeViewer || access.role === UserRole.SUPER_ADMIN,
      isEnrolledContestant,
    },
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function getSessionScores(sessionId: string, access: AccessContext) {
  const { session, contest } = await loadSessionWithContest(sessionId);

  if (!hasContestAccess(contest, access)) {
    throw new ApiError(403, 'FORBIDDEN', '无权限查看该会话');
  }

  return {
    scores: session.scores,
  };
}

function requireHost(contest: { hostId: unknown }, access: AccessContext) {
  if (!isHostOperator(contest, access)) {
    throw new ApiError(403, 'FORBIDDEN', '仅主持人可执行此操作');
  }
}

export async function nextQuestion(sessionId: string, access: AccessContext, skipTo?: number) {
  const { session, contest } = await loadSessionWithContest(sessionId);
  requireHost(contest, access);

  const targetIndex = skipTo !== undefined ? skipTo - 1 : session.currentQuestionIndex + 1;

  if (targetIndex < 0 || targetIndex >= session.questionSequence.length) {
    throw new ApiError(409, 'INVALID_SESSION_STATE', '题目序号超出范围');
  }

  session.currentQuestionIndex = targetIndex;
  const sequence = session.questionSequence[targetIndex];
  const roundMeta = resolveRoundMeta(contest, sequence?.roundNumber, targetIndex);
  session.currentRoundIndex = roundMeta.roundIndex;
  session.state = SessionState.QUESTION_ACTIVE;

  const totalSeconds = normalizeTimerSeconds(roundMeta.round?.timePerQuestion);

  session.timer = {
    totalSeconds,
    remainingSeconds: totalSeconds,
    isPaused: true,
    startedAt: undefined,
  };

  await session.save();

  const question = await QuestionModel.findById(sequence.questionId)
    .select('content answer solution type difficulty tags choices source')
    .lean();

  if (!question) {
    throw new ApiError(404, 'QUESTION_NOT_FOUND', '题目不存在');
  }

  return {
    session: session.toJSON(),
    questionMeta: {
      questionIndex: targetIndex,
      roundIndex: roundMeta.roundIndex,
      roundNumber: roundMeta.roundNumber,
      globalOrder: Number(sequence.globalOrder),
      timePerQuestion: totalSeconds,
      orderInRound: Number(sequence.orderInRound),
      totalInRound: toPositiveInt(roundMeta.round?.questionCount) ?? 0,
      questionId: String(question._id),
    },
    questionDetail: {
      questionIndex: sequence.globalOrder,
      question: {
        id: String(question._id),
        content: question.content,
        answer: question.answer,
        solution: question.solution,
        type: question.type,
        difficulty: question.difficulty,
        tags: question.tags,
        choices: question.choices,
        source: question.source,
      },
      isLastQuestion: targetIndex === session.questionSequence.length - 1,
    },
  };
}

export async function controlTimer(sessionId: string, access: AccessContext, action: 'start' | 'pause' | 'reset') {
  const { session, contest } = await loadSessionWithContest(sessionId);
  requireHost(contest, access);

  if (session.currentQuestionIndex < 0) {
    throw new ApiError(409, 'INVALID_SESSION_STATE', '请先切题');
  }

  const now = new Date();
  const timerState = ensureTimer(session);
  const sequence = session.questionSequence[session.currentQuestionIndex];
  const roundMeta = resolveRoundMeta(contest, sequence?.roundNumber, session.currentQuestionIndex);
  const safeTotalSeconds = normalizeTimerSeconds(timerState.totalSeconds, normalizeTimerSeconds(roundMeta.round?.timePerQuestion));

  if (action === 'start') {
    const remaining = Math.max(0, ensureTimerRemaining(timerState)) || safeTotalSeconds;
    session.timer = {
      ...timerState,
      totalSeconds: safeTotalSeconds,
      remainingSeconds: remaining,
      startedAt: now,
      isPaused: false,
    };
    session.state = SessionState.TIMER_RUNNING;
  }

  if (action === 'pause') {
    const remaining = ensureTimerRemaining(timerState);
    session.timer = {
      ...timerState,
      totalSeconds: safeTotalSeconds,
      remainingSeconds: remaining,
      startedAt: undefined,
      isPaused: true,
    };
    session.state = SessionState.TIMER_PAUSED;
  }

  if (action === 'reset') {
    session.timer = {
      ...timerState,
      totalSeconds: safeTotalSeconds,
      remainingSeconds: safeTotalSeconds,
      startedAt: undefined,
      isPaused: true,
    };
    session.state = SessionState.QUESTION_ACTIVE;
  }

  await session.save();
  const finalTimer = ensureTimer(session);

  return {
    action,
    timer: {
      totalSeconds: normalizeTimerSeconds(finalTimer.totalSeconds, safeTotalSeconds),
      remainingSeconds: finalTimer.remainingSeconds,
      startedAt: finalTimer.startedAt,
    },
  };
}

export async function adjustTimer(sessionId: string, access: AccessContext, deltaSeconds: number) {
  const { session, contest } = await loadSessionWithContest(sessionId);
  requireHost(contest, access);

  if (session.currentQuestionIndex < 0) {
    throw new ApiError(409, 'INVALID_SESSION_STATE', '请先切题');
  }

  if (!Number.isFinite(deltaSeconds) || Math.trunc(deltaSeconds) === 0) {
    throw new ApiError(422, 'INVALID_PAYLOAD', '调整秒数必须是非 0 整数');
  }

  const timerState = ensureTimer(session);
  const sequence = session.questionSequence[session.currentQuestionIndex];
  const roundMeta = resolveRoundMeta(contest, sequence?.roundNumber, session.currentQuestionIndex);

  const baseTotal = normalizeTimerSeconds(timerState.totalSeconds, normalizeTimerSeconds(roundMeta.round?.timePerQuestion));
  const currentRemaining = ensureTimerRemaining(timerState);
  const baseRemaining =
    currentRemaining > 0
      ? currentRemaining
      : [SessionState.QUESTION_ACTIVE, SessionState.TIMER_PAUSED].includes(session.state)
      ? baseTotal
      : 0;

  const nextTotal = Math.max(MIN_TIME_PER_QUESTION_SECONDS, baseTotal + Math.trunc(deltaSeconds));
  const nextRemaining = baseRemaining + Math.trunc(deltaSeconds);
  const shouldRun = session.state === SessionState.TIMER_RUNNING && !timerState.isPaused;

  if (nextRemaining <= 0) {
    session.timer = {
      totalSeconds: nextTotal,
      remainingSeconds: 0,
      startedAt: undefined,
      isPaused: true,
    };
    session.state = SessionState.TIMER_EXPIRED;
  } else {
    session.timer = {
      totalSeconds: nextTotal,
      remainingSeconds: nextRemaining,
      startedAt: shouldRun ? new Date() : undefined,
      isPaused: !shouldRun,
    };

    if (shouldRun) {
      session.state = SessionState.TIMER_RUNNING;
    } else if (session.state === SessionState.TIMER_EXPIRED) {
      session.state = SessionState.TIMER_PAUSED;
    }
  }

  await session.save();
  const finalTimer = ensureTimer(session);
  return {
    deltaSeconds: Math.trunc(deltaSeconds),
    state: session.state,
    timer: {
      totalSeconds: normalizeTimerSeconds(finalTimer.totalSeconds, nextTotal),
      remainingSeconds: finalTimer.remainingSeconds,
      startedAt: finalTimer.startedAt,
      isPaused: finalTimer.isPaused,
    },
  };
}

export async function revealAnswer(sessionId: string, access: AccessContext) {
  const { session, contest } = await loadSessionWithContest(sessionId);

  const canReveal = isHostOperator(contest, access) || isJudgeOperator(contest, access);

  if (!canReveal) {
    throw new ApiError(403, 'FORBIDDEN', '无权限公布答案');
  }

  if (session.currentQuestionIndex < 0) {
    throw new ApiError(409, 'INVALID_SESSION_STATE', '当前没有进行中的题目');
  }

  const currentSequence = session.questionSequence[session.currentQuestionIndex];
  if (!currentSequence) {
    throw new ApiError(409, 'INVALID_SESSION_STATE', '当前题目不存在');
  }

  currentSequence.isRevealed = true;
  currentSequence.revealedAt = new Date();
  session.state = SessionState.ANSWER_REVEALED;
  const timerState = ensureTimer(session);
  session.timer = {
    ...timerState,
    isPaused: true,
    startedAt: undefined,
    remainingSeconds: ensureTimerRemaining(timerState),
  };
  await session.save();

  const question = await QuestionModel.findById(currentSequence.questionId).select('answer solution').lean();
  if (!question) {
    throw new ApiError(404, 'QUESTION_NOT_FOUND', '题目不存在');
  }

  return {
    questionId: String(currentSequence.questionId),
    answer: question.answer,
    solution: question.solution,
  };
}

export async function scoreSession(
  sessionId: string,
  access: AccessContext,
  payload: { teamId: string; delta: number; type: ScoreOpType; questionId?: string; note?: string },
) {
  const { contest } = await loadSessionWithContest(sessionId);

  const canScore = isHostOperator(contest, access) || isJudgeOperator(contest, access);

  if (!canScore) {
    throw new ApiError(403, 'FORBIDDEN', '无权限计分');
  }

  return applyScore(sessionId, access.userId, payload);
}

export async function revertSessionScore(sessionId: string, access: AccessContext, logId: string) {
  const { contest } = await loadSessionWithContest(sessionId);

  const canScore = isHostOperator(contest, access) || isJudgeOperator(contest, access);

  if (!canScore) {
    throw new ApiError(403, 'FORBIDDEN', '无权限撤销计分');
  }

  return revertScore(sessionId, logId, access.userId);
}

export async function getSessionScoreLogs(sessionId: string, access: AccessContext) {
  const { contest } = await loadSessionWithContest(sessionId);

  const canView = isHostOperator(contest, access) || isJudgeOperator(contest, access);

  if (!canView) {
    throw new ApiError(403, 'FORBIDDEN', '无权限查看计分日志');
  }

  return ScoreLogModel.find({ sessionId: toObjectId(sessionId, 'sessionId') }).sort({ createdAt: -1 }).limit(200).lean();
}

export async function finishSession(sessionId: string, access: AccessContext) {
  const { session, contest } = await loadSessionWithContest(sessionId);
  requireHost(contest, access);

  session.state = SessionState.FINISHED;
  await session.save();

  contest.status = ContestStatus.FINISHED;
  contest.finishedAt = new Date();
  await contest.save();

  const teamNameMap = new Map((contest.teams ?? []).map((team) => [team.id, team.name]));

  const finalScores = [...session.scores]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((item, index) => ({
      teamId: item.teamId,
      teamName: teamNameMap.get(item.teamId) ?? item.teamId,
      score: Number(item.score),
      rank: index + 1,
    }));

  return {
    finalScores,
    finishedAt: contest.finishedAt,
  };
}
