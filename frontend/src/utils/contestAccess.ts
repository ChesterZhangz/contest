import type { Contest, UserRole } from '@/types'

type IdentityLike = {
  id?: unknown
  _id?: unknown
  role?: UserRole
} | null | undefined

export interface ContestAccess {
  userId: string
  isHostForContest: boolean
  isJudgeForContest: boolean
  isParticipantForContest: boolean
  isManagerForContest: boolean
  shouldJoinInsteadOfView: boolean
}

export function normalizeId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as Record<string, unknown>
  const preferred = record.id ?? record._id ?? record.$oid
  if (typeof preferred === 'string' || typeof preferred === 'number') {
    return String(preferred)
  }

  const maybeToHexString = (record as { toHexString?: unknown }).toHexString
  if (typeof maybeToHexString === 'function') {
    try {
      return String((maybeToHexString as () => string)())
    } catch {
      // Fall through to generic toString handling.
    }
  }

  if (typeof record.toString === 'function') {
    const text = record.toString()
    return text !== '[object Object]' ? text : ''
  }

  return ''
}

function hasId(list: unknown[] | undefined, userId: string): boolean {
  return (list ?? []).some((item) => normalizeId(item) === userId)
}

export function getContestAccess(contest: Contest | null | undefined, user: IdentityLike): ContestAccess {
  const userId = normalizeId(user?.id ?? user?._id)
  const isHostForContest = Boolean(contest && userId && normalizeId(contest.hostId) === userId)
  const isJudgeForContest = Boolean(contest && userId && hasId(contest.judgeIds, userId))
  const isParticipantForContest = Boolean(
    contest &&
      userId &&
      (hasId(contest.participants, userId) ||
        (contest.teams ?? []).some((team) => hasId(team.memberIds, userId)))
  )
  const isManagerForContest = Boolean(user?.role === 'super_admin' || isHostForContest)
  const shouldJoinInsteadOfView = Boolean(
    contest &&
      contest.mode === 'team' &&
      contest.status !== 'finished' &&
      !isManagerForContest &&
      !isJudgeForContest
  )

  return {
    userId,
    isHostForContest,
    isJudgeForContest,
    isParticipantForContest,
    isManagerForContest,
    shouldJoinInsteadOfView,
  }
}
