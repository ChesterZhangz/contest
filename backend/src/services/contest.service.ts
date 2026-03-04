import { Types } from 'mongoose';
import { ContestModel } from '../models/Contest.model';
import { ContestSessionModel } from '../models/ContestSession.model';
import { QuestionModel } from '../models/Question.model';
import { UserModel } from '../models/User.model';
import { ContestMode, ContestStatus, SelectionMode } from '../types/contest.types';
import { UserRole } from '../types/user.types';
import { ApiError } from '../utils/api-error';
import { toObjectId } from '../utils/object-id';
import { generateQuestionSequence } from '../utils/question-sampler';
import { incrementQuestionUsage } from './question.service';

export interface ContestAccess {
  userId: string;
  role: UserRole;
}

async function getParticipantDetails(participantIds: unknown[]) {
  if (!participantIds.length) return [];
  const users = await UserModel.find({ _id: { $in: participantIds as Types.ObjectId[] } })
    .select('displayName username')
    .lean();
  return users.map((u) => ({
    id: String(u._id),
    displayName: String(u.displayName),
    username: String(u.username),
  }));
}

function computeJoinCode(contestId: string, contestName: string): string {
  const raw = `${contestId}-${contestName}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).toUpperCase().slice(0, 8);
}

function normalizeContestInput(payload: Record<string, unknown>, options?: { partial?: boolean }) {
  const partial = options?.partial ?? false;
  const normalized: Record<string, unknown> = {};

  const assignRaw = (key: string) => {
    if (!partial || key in payload) {
      normalized[key] = payload[key];
    }
  };

  assignRaw('name');
  assignRaw('description');
  assignRaw('mode');
  assignRaw('status');
  assignRaw('scheduledAt');

  if (!partial || 'judgeIds' in payload) {
    normalized.judgeIds = ((payload.judgeIds as string[] | undefined) ?? []).map((id) => toObjectId(id, 'judgeId'));
  }

  if (!partial || 'participants' in payload) {
    normalized.participants = ((payload.participants as string[] | undefined) ?? []).map((id) =>
      toObjectId(id, 'participantId'),
    );
  }

  if (!partial || 'teams' in payload) {
    normalized.teams = ((payload.teams as Array<Record<string, unknown>> | undefined) ?? []).map((team) => ({
      ...team,
      memberIds: ((team.memberIds as string[] | undefined) ?? []).map((id) => toObjectId(id, 'team.memberId')),
      initialScore: Number(team.initialScore ?? 0),
    }));
  }

  if (!partial || 'rounds' in payload) {
    normalized.rounds = ((payload.rounds as Array<Record<string, unknown>> | undefined) ?? []).map((round) => ({
      ...round,
      bankId: toObjectId(String(round.bankId), 'round.bankId'),
      questionIds: ((round.questionIds as string[] | undefined) ?? []).map((id) => toObjectId(id, 'round.questionId')),
    }));
  }

  return normalized;
}

function canAccessContest(contest: { hostId: unknown; judgeIds?: unknown[]; participants?: unknown[]; teams?: Array<{ memberIds?: unknown[] }>; status?: unknown }, access: ContestAccess): boolean {
  if (access.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  const userId = access.userId;

  if (String(contest.hostId) === userId) {
    return true;
  }

  if ((contest.judgeIds ?? []).some((id) => String(id) === userId)) {
    return true;
  }

  if ((contest.participants ?? []).some((id) => String(id) === userId)) {
    return true;
  }

  if ((contest.teams ?? []).some((team) => (team.memberIds ?? []).some((id) => String(id) === userId))) {
    return true;
  }

  // Audience and unenrolled participants can view active/finished contests
  if (access.role === UserRole.AUDIENCE || access.role === UserRole.PARTICIPANT) {
    const status = String(contest.status ?? '');
    return status === ContestStatus.ACTIVE || status === ContestStatus.FINISHED;
  }

  return false;
}

function mapRoundsForSampler(rounds: Array<Record<string, unknown>>) {
  return rounds.map((round, idx) => ({
    roundNumber: Number(round.roundNumber) > 0 ? Number(round.roundNumber) : idx + 1,
    questionCount: Number(round.questionCount),
    bankId: round.bankId as Types.ObjectId,
    selectionMode: round.selectionMode as SelectionMode,
    difficultyConstraint: round.difficultyConstraint as { min?: number; max?: number; distribution?: Array<{ difficulty: number; count: number }> } | undefined,
    tagConstraints: round.tagConstraints as { required?: string[]; forbidden?: string[]; preferred?: string[] } | undefined,
    questionIds: (round.questionIds as Types.ObjectId[] | undefined) ?? [],
  }));
}

function requireContestHostOrSuperAdmin(contest: { hostId: unknown }, access: ContestAccess, action: string): void {
  if (access.role === UserRole.SUPER_ADMIN) {
    return;
  }

  if (String(contest.hostId) !== access.userId) {
    throw new ApiError(403, 'FORBIDDEN', `仅主持人可${action}`);
  }
}

function assertTeamIntegrity(
  mode: ContestMode,
  teams: Array<{ id?: unknown; name?: unknown; memberIds?: unknown[] }> | undefined,
): void {
  if (mode !== ContestMode.TEAM) {
    return;
  }

  const normalizedTeams = teams ?? [];
  if (normalizedTeams.length === 0) {
    throw new ApiError(422, 'INVALID_CONTEST_CONFIG', '团队赛至少需要 1 支队伍');
  }

  const teamIds = new Set<string>();
  const memberOwnerTeam = new Map<string, string>();

  for (const team of normalizedTeams) {
    const teamId = String(team.id ?? '').trim();
    const teamName = String(team.name ?? '').trim();
    if (!teamId) {
      throw new ApiError(422, 'INVALID_CONTEST_CONFIG', '队伍 ID 不能为空');
    }
    if (!teamName) {
      throw new ApiError(422, 'INVALID_CONTEST_CONFIG', '队伍名称不能为空');
    }
    if (teamIds.has(teamId)) {
      throw new ApiError(422, 'INVALID_CONTEST_CONFIG', `队伍 ID 重复：${teamId}`);
    }
    teamIds.add(teamId);

    for (const memberId of team.memberIds ?? []) {
      const uid = String(memberId);
      const ownerTeam = memberOwnerTeam.get(uid);
      if (ownerTeam && ownerTeam !== teamId) {
        throw new ApiError(422, 'INVALID_CONTEST_CONFIG', '同一参赛者不能同时属于多支队伍');
      }
      memberOwnerTeam.set(uid, teamId);
    }
  }
}

export async function listContests(userId: string, role: UserRole) {
  if (role === UserRole.SUPER_ADMIN) {
    const docs = await ContestModel.find().sort({ createdAt: -1 });
    return docs.map((d) => d.toJSON());
  }

  if (role === UserRole.HOST) {
    const docs = await ContestModel.find({ hostId: toObjectId(userId, 'userId') }).sort({ createdAt: -1 });
    return docs.map((d) => d.toJSON());
  }

  if (role === UserRole.JUDGE) {
    const docs = await ContestModel.find({ judgeIds: toObjectId(userId, 'userId') }).sort({ createdAt: -1 });
    return docs.map((d) => d.toJSON());
  }

  if (role === UserRole.PARTICIPANT) {
    // Participants see contests they are enrolled in (plus all active ones)
    const docs = await ContestModel.find({
      $or: [
        { participants: toObjectId(userId, 'userId') },
        { 'teams.memberIds': toObjectId(userId, 'userId') },
        { status: ContestStatus.ACTIVE },
      ],
    }).sort({ createdAt: -1 });
    return docs.map((d) => d.toJSON());
  }

  // AUDIENCE: show all active and finished contests
  const docs = await ContestModel.find({
    status: { $in: [ContestStatus.ACTIVE, ContestStatus.FINISHED] },
  }).sort({ createdAt: -1 });
  return docs.map((d) => d.toJSON());
}

export async function createContest(hostId: string, payload: Record<string, unknown>) {
  const normalized = normalizeContestInput(payload);
  const mode = (payload.mode as ContestMode) ?? ContestMode.TEAM;
  assertTeamIntegrity(mode, normalized.teams as Array<{ id?: unknown; name?: unknown; memberIds?: unknown[] }> | undefined);

  const contest = await ContestModel.create({
    ...normalized,
    hostId: toObjectId(hostId, 'hostId'),
    mode,
    status: (payload.status as ContestStatus) ?? ContestStatus.DRAFT,
  });

  return contest.toJSON();
}

export async function getContestById(contestId: string, access: ContestAccess) {
  const contest = await ContestModel.findById(toObjectId(contestId, 'contestId'));
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  if (!canAccessContest(contest, access)) {
    throw new ApiError(403, 'FORBIDDEN', '无权限查看该比赛');
  }

  const participantDetails = await getParticipantDetails(contest.participants ?? []);
  return { ...contest.toJSON(), participantDetails };
}

export async function updateContest(contestId: string, access: ContestAccess, payload: Record<string, unknown>) {
  const contest = await ContestModel.findById(toObjectId(contestId, 'contestId'));
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  requireContestHostOrSuperAdmin(contest, access, '修改比赛');

  if (contest.status === ContestStatus.ACTIVE || contest.status === ContestStatus.FINISHED) {
    throw new ApiError(409, 'CONTEST_ALREADY_STARTED', '比赛已开始或已结束，无法修改');
  }

  const normalized = normalizeContestInput(payload, { partial: true });
  const nextMode = ((normalized.mode as ContestMode | undefined) ?? (contest.mode as ContestMode));
  const nextTeams =
    (normalized.teams as Array<{ id?: unknown; name?: unknown; memberIds?: unknown[] }> | undefined) ??
    ((contest.teams ?? []) as unknown as Array<{ id?: unknown; name?: unknown; memberIds?: unknown[] }>);
  assertTeamIntegrity(nextMode, nextTeams);
  Object.assign(contest, normalized);
  await contest.save();

  return contest.toJSON();
}

export async function deleteContest(contestId: string, access: ContestAccess): Promise<void> {
  const contest = await ContestModel.findById(toObjectId(contestId, 'contestId'));
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  requireContestHostOrSuperAdmin(contest, access, '删除比赛');

  await Promise.all([
    ContestSessionModel.deleteOne({ contestId: contest._id }),
    ContestModel.deleteOne({ _id: contest._id }),
  ]);
}

export async function previewQuestions(contestId: string, access: ContestAccess) {
  const contest = await ContestModel.findById(toObjectId(contestId, 'contestId')).lean();
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  requireContestHostOrSuperAdmin(contest, access, '预览抽题');

  const sequence = await generateQuestionSequence(
    mapRoundsForSampler(contest.rounds as unknown as Array<Record<string, unknown>>),
  );

  const questions = await QuestionModel.find({ _id: { $in: sequence.map((item) => item.questionId) }, isDeleted: false })
    .select('content difficulty tags type source')
    .lean();

  const questionMap = new Map(questions.map((q) => [String(q._id), q]));

  return sequence.map((item) => ({
    ...item,
    question: questionMap.get(String(item.questionId)) ?? null,
  }));
}

export async function startContest(contestId: string, access: ContestAccess) {
  const contest = await ContestModel.findById(toObjectId(contestId, 'contestId'));
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  requireContestHostOrSuperAdmin(contest, access, '开始比赛');

  if (contest.status === ContestStatus.ACTIVE) {
    throw new ApiError(409, 'CONTEST_ALREADY_STARTED', '比赛已开始');
  }

  if (contest.status === ContestStatus.FINISHED) {
    throw new ApiError(409, 'INVALID_SESSION_STATE', '比赛已结束，无法再次开始');
  }

  assertTeamIntegrity(
    contest.mode as ContestMode,
    (contest.teams ?? []) as unknown as Array<{ id?: unknown; name?: unknown; memberIds?: unknown[] }>,
  );

  const sequence = await generateQuestionSequence(mapRoundsForSampler(contest.rounds as unknown as Array<Record<string, unknown>>));

  const initialScores =
    contest.mode === ContestMode.INDIVIDUAL
      ? (contest.participants ?? []).map((pid) => ({
          teamId: String(pid),
          score: 0,
        }))
      : (contest.teams ?? []).map((team) => ({
          teamId: team.id,
          score: Number(team.initialScore ?? 0),
        }));

  const session = await ContestSessionModel.findOneAndUpdate(
    { contestId: contest._id },
    {
      $set: {
        contestId: contest._id,
        questionSequence: sequence,
        currentQuestionIndex: -1,
        currentRoundIndex: 0,
        state: 'waiting',
        timer: {
          totalSeconds: 0,
          remainingSeconds: 0,
          isPaused: true,
        },
        scores: initialScores,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  contest.status = ContestStatus.ACTIVE;
  contest.startedAt = new Date();
  await Promise.all([contest.save(), incrementQuestionUsage(sequence.map((item) => item.questionId))]);

  return {
    contest: contest.toJSON(),
    session: session.toJSON(),
  };
}

export async function getActiveSession(contestId: string, access: ContestAccess) {
  const contest = await ContestModel.findById(toObjectId(contestId, 'contestId'));
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  if (!canAccessContest(contest, access)) {
    throw new ApiError(403, 'FORBIDDEN', '无权限查看该比赛');
  }

  const session = await ContestSessionModel.findOne({ contestId: contest._id });
  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', '比赛会话不存在');
  }

  return { sessionId: String(session._id) };
}

export async function getJoinCode(contestId: string, access: ContestAccess) {
  const contest = await ContestModel.findById(toObjectId(contestId, 'contestId')).lean();
  if (!contest) {
    throw new ApiError(404, 'CONTEST_NOT_FOUND', '比赛不存在');
  }

  requireContestHostOrSuperAdmin(contest, access, '查看邀请码');

  const raw = `${contestId}-${contest.name}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }

  return {
    joinCode: hash.toString(36).toUpperCase().slice(0, 8),
  };
}

export async function joinContest(joinCode: string, userId: string, teamId?: string) {
  const contests = await ContestModel.find({ status: { $nin: [ContestStatus.FINISHED] } });

  let target = null;
  for (const contest of contests) {
    if (computeJoinCode(String(contest._id), contest.name) === joinCode.toUpperCase().trim()) {
      target = contest;
      break;
    }
  }

  if (!target) throw new ApiError(404, 'CONTEST_NOT_FOUND', '邀请码无效或已过期');

  const userOid = toObjectId(userId, 'userId');
  const isInParticipants = (target.participants ?? []).some((id) => String(id) === userId);
  const isInAnyTeam = (target.teams ?? []).some((team) => (team.memberIds ?? []).some((id) => String(id) === userId));

  if (target.mode === ContestMode.TEAM) {
    // Legacy compatibility: old flows may have added team-mode users into participants.
    if (isInParticipants) {
      target.participants = (target.participants ?? []).filter((id) => String(id) !== userId);
    }

    if (isInAnyTeam) {
      throw new ApiError(409, 'ALREADY_JOINED', '您已加入该竞赛');
    }

    const teams = target.teams ?? [];
    if (teams.length === 0) {
      throw new ApiError(409, 'TEAM_NOT_AVAILABLE', '当前比赛暂无可加入队伍');
    }

    if (!teamId) {
      throw new ApiError(409, 'TEAM_SELECTION_REQUIRED', '团队赛请先选择队伍', {
        contestId: String(target._id),
        contestName: target.name,
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,
          color: team.color,
          memberCount: (team.memberIds ?? []).length,
        })),
      });
    }

    const selectedTeam = teams.find((team) => team.id === teamId);
    if (!selectedTeam) {
      throw new ApiError(404, 'TEAM_NOT_FOUND', '队伍不存在或已失效');
    }

    // Ensure one participant belongs to at most one team.
    for (const team of teams) {
      team.memberIds = (team.memberIds ?? []).filter((id) => String(id) !== userId);
    }
    selectedTeam.memberIds = selectedTeam.memberIds ?? [];
    (selectedTeam.memberIds as unknown[]).push(userOid);
  } else {
    if (isInParticipants || isInAnyTeam) {
      throw new ApiError(409, 'ALREADY_JOINED', '您已加入该竞赛');
    }
    (target.participants as unknown[]).push(userOid);
  }

  await target.save();

  const participantDetails = await getParticipantDetails(target.participants ?? []);
  return { ...target.toJSON(), participantDetails };
}
