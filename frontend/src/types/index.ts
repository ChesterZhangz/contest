// ─── User & Auth ───────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'host' | 'judge' | 'participant' | 'audience'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  email?: string
  avatarUrl?: string
  ownedBankIds?: string[]
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AuthTokens {
  token: string
  refreshToken: string
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: User
}

// ─── Question Bank ─────────────────────────────────────────────────────────

export interface QuestionBank {
  id: string
  name: string
  description?: string
  ownerId: string
  isPublic: boolean
  questionCount: number
  tags: string[]
  isDeleted?: boolean
  createdAt: string
  updatedAt: string
}

// ─── Question ──────────────────────────────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'short_answer'

export type Difficulty = 1 | 2 | 3 | 4 | 5

export const DIFFICULTY_LABELS: Record<Difficulty, { zh: string; en: string; color: string }> = {
  1: { zh: '简单', en: 'Easy', color: 'text-emerald-600 bg-emerald-50' },
  2: { zh: '中等', en: 'Medium', color: 'text-blue-600 bg-blue-50' },
  3: { zh: '困难', en: 'Hard', color: 'text-amber-600 bg-amber-50' },
  4: { zh: '专家', en: 'Expert', color: 'text-orange-600 bg-orange-50' },
  5: { zh: '极难', en: 'Extreme', color: 'text-red-600 bg-red-50' },
}

export interface QuestionChoice {
  label: string
  content: string
}

export interface Question {
  id: string
  bankId: string
  content: string
  contentRich?: string
  answer: string
  solution?: string
  type: QuestionType
  difficulty: Difficulty
  tags: string[]
  choices?: QuestionChoice[]
  correctChoice?: string
  source?: string
  authorId?: string
  usageCount?: number
  isDeleted?: boolean
  createdAt: string
  updatedAt: string
}

export interface QuestionsPage {
  items: Question[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Tag ───────────────────────────────────────────────────────────────────

export interface Tag {
  id: string
  name: string
  category?: string
  color?: string
  questionCount: number
  createdAt: string
}

// ─── Contest ───────────────────────────────────────────────────────────────

export type ContestMode = 'team' | 'individual'
export type ContestStatus = 'draft' | 'ready' | 'active' | 'finished'
export type SelectionMode = 'random' | 'manual' | 'by_rule'

export interface Team {
  id: string
  name: string
  color: string
  memberIds: string[]
  initialScore: number
}

export interface DifficultyAllocation {
  difficulty: Difficulty
  count: number
}

export interface RoundSource {
  bankId: string
  allocations: DifficultyAllocation[]
}

export interface DifficultyTiming {
  difficulty: Difficulty
  timeSeconds: number
}

export interface DifficultyDistribution {
  difficulty: Difficulty
  count: number
}

export interface DifficultyConstraint {
  min?: Difficulty
  max?: Difficulty
  distribution?: DifficultyDistribution[]
}

export interface TagConstraints {
  required?: string[]
  forbidden?: string[]
  preferred?: string[]
}

export interface RoundScoring {
  correctScore: number
  wrongScore: number
  partialScore?: number
}

export interface ContestRound {
  roundNumber: number
  name: string
  questionsPerBatch: number
  sources: RoundSource[]
  tagConstraints?: TagConstraints
  timings: DifficultyTiming[]
  scoring: RoundScoring
}

export interface ParticipantDetail {
  id: string
  displayName: string
  username: string
}

export interface Contest {
  id: string
  name: string
  description?: string
  hostId: string
  judgeIds: string[]
  mode: ContestMode
  status: ContestStatus
  teams: Team[]
  participants: string[]
  participantDetails?: ParticipantDetail[]
  rounds: ContestRound[]
  scheduledAt?: string
  startedAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

// ─── Session ───────────────────────────────────────────────────────────────

export type SessionState =
  | 'waiting'
  | 'question_active'
  | 'timer_running'
  | 'timer_paused'
  | 'timer_expired'
  | 'answer_revealed'
  | 'round_break'
  | 'finished'

export interface SessionTimer {
  totalSeconds: number
  remainingSeconds: number
  startedAt?: string
  isPaused: boolean
}

export interface TeamScore {
  teamId: string
  score: number
}

export interface QuestionSequenceItem {
  questionId: string
  roundNumber: number
  orderInRound: number
  globalOrder: number
  isRevealed: boolean
  revealedAt?: string
}

export interface ContestSession {
  id: string
  contestId: string
  state: SessionState
  currentQuestionIndex: number
  currentRoundIndex: number
  timer: SessionTimer
  scores: TeamScore[]
  questionSequence: QuestionSequenceItem[]
  currentQuestion?: Question | null
  currentBatch?: Question[]
  viewer?: {
    isHostForContest: boolean
    isJudgeForContest: boolean
    isEnrolledContestant: boolean
  }
  createdAt: string
  updatedAt: string
}

// ─── Score Log ─────────────────────────────────────────────────────────────

export type ScoreOpType = 'correct' | 'wrong' | 'bonus' | 'penalty' | 'manual' | 'revert'

export interface ScoreLog {
  id: string
  sessionId: string
  contestId: string
  operatorId: string
  operationType: ScoreOpType
  targetTeamId: string
  delta: number
  scoreBefore: number
  scoreAfter: number
  questionId?: string
  roundNumber?: number
  isReverted: boolean
  revertedBy?: string
  revertedAt?: string
  note?: string
  createdAt: string
}

// ─── API Response Wrappers ─────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true
  data: T
  message?: string
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Socket Events ────────────────────────────────────────────────────────

export interface SocketQuestionChangedPayload {
  questionIndex: number
  roundIndex: number
  roundNumber: number
  globalOrder: number
  timePerQuestion: number
}

export interface SocketAnswerRevealedPayload {
  answer: string
  solution?: string
  questionId: string
}

export interface SocketScoresUpdatedPayload {
  scores: TeamScore[]
  log?: Partial<ScoreLog>
}

export interface SocketContestStartedPayload {
  contestId: string
  sessionId: string
  teams: Team[]
  totalQuestions: number
  startedAt: string
}

export interface SocketTimerPayload {
  totalSeconds?: number
  remainingSeconds?: number
  startedAt?: string
}
