import { useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Eye,
  Flag,
  Wifi,
  WifiOff,
  Loader2,
  ChevronRight,
  BookOpen,
  Plus,
  Minus,
} from 'lucide-react'
import { clsx } from 'clsx'
import { contestsService } from '@/services/contests'
import { sessionsService } from '@/services/sessions'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Timer } from '@/components/session/Timer'
import { ScoreBoard } from '@/components/session/ScoreBoard'
import { QuestionDisplay } from '@/components/session/QuestionDisplay'
import { useSocket } from '@/hooks/useSocket'
import { useSessionStore } from '@/store/session'
import { useToast } from '@/hooks/useToast'
import { DIFFICULTY_LABELS } from '@/types'
import type { ScoreOpType, Question } from '@/types'

// ── Batch Scoring Row ─────────────────────────────────────────────────────────

function BatchScoringSection({
  batch,
  teams,
  scores,
  correctScore,
  wrongScore,
  onScore,
  lang,
}: {
  batch: Question[]
  teams: { id: string; name: string; color: string }[]
  scores: Map<string, number>
  correctScore: number
  wrongScore: number
  onScore: (teamId: string, delta: number, type: ScoreOpType, questionId?: string) => void
  lang: string
}) {
  const [activeQIdx, setActiveQIdx] = useState(0)
  const activeQ = batch[activeQIdx]

  if (!activeQ) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Question tabs */}
      {batch.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {batch.map((q, i) => {
            const label = DIFFICULTY_LABELS[q.difficulty]
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setActiveQIdx(i)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  activeQIdx === i
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                Q{i + 1}
                <span className={clsx('px-1.5 py-0.5 rounded-full text-xs', activeQIdx === i ? 'bg-white/20 text-white' : label.color)}>
                  {lang === 'zh' ? label.zh : label.en}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Team scoring for active question */}
      <div className="flex flex-col gap-2">
        {teams.map((team) => {
          const currentScore = scores.get(team.id) ?? 0
          return (
            <div
              key={team.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-sm font-medium text-slate-700 flex-1 truncate min-w-0">
                {team.name}
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-600 w-10 text-right">
                {currentScore}
              </span>
              <button
                onClick={() => onScore(team.id, correctScore, 'correct', activeQ.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
              >
                ✓ +{correctScore}
              </button>
              <button
                onClick={() => onScore(team.id, wrongScore, 'wrong', activeQ.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                ✗ {wrongScore}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HostPanel() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const contestId = searchParams.get('contestId') ?? ''
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const toast = useToast()
  const lang = i18n.language === 'zh' ? 'zh' : 'en'

  const {
    session,
    currentQuestion,
    currentBatch,
    currentAnswer,
    isConnected,
    isReconnecting,
    clearSession,
    setSession,
  } = useSessionStore()

  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isNexting, setIsNexting] = useState(false)
  const [isTimerAction, setIsTimerAction] = useState(false)
  const [isAdjustingTimer, setIsAdjustingTimer] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)

  // ── Fetch contest ────────────────────────────────────────────────────────
  const { data: contest } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => contestsService.get(contestId),
    enabled: Boolean(contestId),
  })

  // ── Socket ───────────────────────────────────────────────────────────────
  useSocket({
    contestId,
    sessionId: sessionId ?? '',
    onContestFinished: () => {
      navigate('/contests')
    },
  })

  // ── Session derived state ─────────────────────────────────────────────────
  const timer = session?.timer
  const state = session?.state

  const isTimerRunning = state === 'timer_running'
  const isTimerPaused = state === 'timer_paused'
  const isTimerExpired = state === 'timer_expired'
  const isAnswerRevealed = state === 'answer_revealed'
  const isFinished = state === 'finished'
  const stateLabelMap = {
    waiting: { zh: '等待开始', en: 'Waiting' },
    question_active: { zh: '题目已就绪', en: 'Question Ready' },
    timer_running: { zh: '计时进行中', en: 'Timer Running' },
    timer_paused: { zh: '计时已暂停', en: 'Timer Paused' },
    timer_expired: { zh: '时间到', en: 'Time Up' },
    answer_revealed: { zh: '答案已揭示', en: 'Answer Revealed' },
    round_break: { zh: '环节间歇', en: 'Round Break' },
    finished: { zh: '已结束', en: 'Finished' },
  } as const
  const stateLabelKey = (state ?? 'waiting') as keyof typeof stateLabelMap
  const stateLabel = `${stateLabelMap[stateLabelKey].zh} / ${stateLabelMap[stateLabelKey].en}`

  // Question is visible only after timer has started
  const showQuestion = isTimerRunning || isTimerPaused || isTimerExpired || isAnswerRevealed
  const isExpired = isTimerExpired || (timer ? !timer.isPaused && timer.remainingSeconds === 0 : false)

  const totalQuestions = session?.questionSequence?.length ?? 0
  const currentQIdx = session?.currentQuestionIndex ?? -1
  const currentQDisplay = currentQIdx >= 0 ? currentQIdx + 1 : 0
  const currentRoundIdx = session?.currentRoundIndex ?? 0
  const currentRound = contest?.rounds[currentRoundIdx]
  const progressPct = totalQuestions > 0 ? (currentQDisplay / totalQuestions) * 100 : 0
  const questionsPerBatch = currentRound?.questionsPerBatch ?? 1
  const isBatch = questionsPerBatch > 1 && currentBatch.length > 1

  const displayTeams = contest
    ? contest.mode === 'individual'
      ? (contest.participantDetails ?? []).map((p) => ({
          id: p.id,
          name: p.displayName,
          color: '#94a3b8',
          memberIds: [] as string[],
          initialScore: 0,
        }))
      : contest.teams
    : []

  const scoreMap = new Map(session?.scores.map((s) => [s.teamId, s.score]) ?? [])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleTimerControl = useCallback(
    async (action: 'start' | 'pause' | 'reset') => {
      if (!sessionId) return
      setIsTimerAction(true)
      try {
        await sessionsService.timerControl(sessionId, action)
      } catch {
        toast.error(lang === 'zh' ? '计时器操作失败' : 'Timer control failed')
      } finally {
        setIsTimerAction(false)
      }
    },
    [sessionId, toast, lang]
  )

  const handleNextQuestion = useCallback(async () => {
    if (!sessionId) return
    setIsNexting(true)
    try {
      await sessionsService.nextQuestion(sessionId)
    } catch {
      toast.error(lang === 'zh' ? '切换题目失败' : 'Failed to advance question')
    } finally {
      setIsNexting(false)
    }
  }, [sessionId, toast, lang])

  const handleRevealAnswer = useCallback(async () => {
    if (!sessionId) return
    setIsRevealing(true)
    try {
      await sessionsService.revealAnswer(sessionId)
    } catch {
      toast.error(lang === 'zh' ? '揭示答案失败' : 'Failed to reveal answer')
    } finally {
      setIsRevealing(false)
    }
  }, [sessionId, toast, lang])

  const handleAdjustTimer = useCallback(
    async (deltaSeconds: number) => {
      if (!sessionId || deltaSeconds === 0) return
      setIsAdjustingTimer(true)
      try {
        await sessionsService.adjustTimer(sessionId, deltaSeconds)
      } catch {
        toast.error(lang === 'zh' ? '调整倒计时失败' : 'Failed to adjust timer')
      } finally {
        setIsAdjustingTimer(false)
      }
    },
    [sessionId, toast, lang]
  )

  const handleScore = useCallback(
    async (teamId: string, delta: number, type: ScoreOpType, questionId?: string) => {
      if (!sessionId) return
      const current = useSessionStore.getState().session
      if (current) {
        const optimisticScores = current.scores.map((s) =>
          s.teamId === teamId ? { ...s, score: Number(s.score) + delta } : s
        )
        setSession({ ...current, scores: optimisticScores })
      }

      try {
        const result = await sessionsService.score(sessionId, {
          teamId,
          delta,
          type,
          questionId: questionId ?? currentQuestion?.id,
        })
        if (result?.session) setSession(result.session)
      } catch {
        try {
          const latest = await sessionsService.get(sessionId)
          setSession(latest)
        } catch {}
        toast.error(lang === 'zh' ? '计分失败' : 'Scoring failed')
      }
    },
    [sessionId, currentQuestion, toast, lang, setSession]
  )

  const handleFinish = useCallback(async () => {
    if (!sessionId) return
    setIsFinishing(true)
    try {
      await sessionsService.finish(sessionId)
      clearSession()
      navigate('/contests')
    } catch {
      toast.error(lang === 'zh' ? '结束竞赛失败' : 'Failed to finish contest')
    } finally {
      setIsFinishing(false)
      setShowFinishConfirm(false)
    }
  }, [sessionId, clearSession, navigate, toast, lang])

  // ── Grid class for batch display ─────────────────────────────────────────
  const batchGridClass =
    currentBatch.length === 1
      ? 'grid-cols-1'
      : currentBatch.length === 2
      ? 'grid-cols-2'
      : currentBatch.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-800 text-base truncate">
            {contest?.name ?? (lang === 'zh' ? '竞赛控制台' : 'Host Control Panel')}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {currentRound && (
              <span className="text-xs text-slate-500">
                {lang === 'zh' ? `第 ${currentRoundIdx + 1} 环节` : `Round ${currentRoundIdx + 1}`}
                {currentRound.name ? ` · ${currentRound.name}` : ''}
                {isBatch && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 font-medium">
                    {lang === 'zh' ? `每批 ${questionsPerBatch} 题` : `${questionsPerBatch}/batch`}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="hidden md:flex flex-col items-center gap-1 w-48">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            {lang === 'zh' ? '题目进度' : 'Progress'} {currentQDisplay}/{totalQuestions}
          </span>
        </div>

        {/* Connection status */}
        <div
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
            isConnected
              ? 'bg-emerald-50 text-emerald-700'
              : isReconnecting
              ? 'bg-amber-50 text-amber-700'
              : 'bg-red-50 text-red-600'
          )}
        >
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : isReconnecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {isConnected
            ? lang === 'zh' ? '已连接' : 'Connected'
            : isReconnecting
            ? lang === 'zh' ? '重连中…' : 'Reconnecting…'
            : lang === 'zh' ? '已断线' : 'Disconnected'}
        </div>
      </header>

      {/* ── Answer revealed banner ──────────────────────────────────────── */}
      {isAnswerRevealed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">
            {lang === 'zh' ? '答案已揭示' : 'Answer Revealed'}
          </span>
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 overflow-auto">

        {/* ── LEFT: Timer + All controls (1/4) ─────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-3">

          {/* Timer card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-center gap-4">
            <Timer
              totalSeconds={timer?.totalSeconds ?? 60}
              remainingSeconds={timer?.remainingSeconds ?? 60}
              isPaused={timer?.isPaused ?? true}
              isExpired={isExpired}
            />

            {/* Timer controls */}
            <div className="flex items-center gap-2 w-full justify-center">
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => handleTimerControl('reset')}
                disabled={isTimerAction || isFinished}
                loading={isTimerAction}
              >
                {lang === 'zh' ? '重置' : 'Reset'}
              </Button>

              {isTimerRunning ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Pause className="w-3.5 h-3.5" />}
                  onClick={() => handleTimerControl('pause')}
                  disabled={isTimerAction || isFinished}
                >
                  {lang === 'zh' ? '暂停' : 'Pause'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Play className="w-3.5 h-3.5" />}
                  onClick={() => handleTimerControl('start')}
                  disabled={
                    isTimerAction ||
                    isFinished ||
                    isAnswerRevealed ||
                    currentBatch.length === 0 ||
                    isTimerExpired
                  }
                >
                  {lang === 'zh' ? '开始' : 'Start'}
                </Button>
              )}
            </div>

            {/* Timer adjust controls */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                icon={<Minus className="w-3.5 h-3.5" />}
                onClick={() => handleAdjustTimer(-10)}
                disabled={isAdjustingTimer || isTimerAction || isFinished || !session || currentQIdx < 0}
              >
                {lang === 'zh' ? '减 10s' : '-10s'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => handleAdjustTimer(10)}
                disabled={isAdjustingTimer || isTimerAction || isFinished || !session || currentQIdx < 0}
              >
                {lang === 'zh' ? '加 10s' : '+10s'}
              </Button>
            </div>
          </div>

          {/* Navigation & reveal controls */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
            {/* Progress dots */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">
                  {lang === 'zh' ? '当前题目' : 'Question'}
                </span>
                <span className="font-bold text-teal-600 text-base tabular-nums">
                  Q{currentQIdx >= 0 ? currentQIdx + 1 : '--'}
                </span>
                <span className="text-slate-400 text-xs">/ {totalQuestions}</span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalQuestions, 8) }).map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'rounded-full transition-all duration-200',
                      i < currentQIdx
                        ? 'w-1.5 h-1.5 bg-teal-300'
                        : i === currentQIdx
                        ? 'w-2.5 h-2.5 bg-teal-600'
                        : 'w-1.5 h-1.5 bg-slate-200'
                    )}
                  />
                ))}
                {totalQuestions > 8 && (
                  <span className="text-xs text-slate-400 ml-0.5">…</span>
                )}
              </div>
            </div>

            {/* Reveal Answer */}
            <Button
              variant="outline"
              size="md"
              className="w-full"
              icon={<Eye className="w-4 h-4" />}
              onClick={handleRevealAnswer}
              loading={isRevealing}
              disabled={isAnswerRevealed || isFinished || currentBatch.length === 0 || !showQuestion}
              style={{ borderColor: '#f59e0b', color: '#b45309' }}
            >
              {lang === 'zh' ? '揭示答案' : 'Reveal Answer'}
            </Button>

            {/* Next Question */}
            <Button
              variant="primary"
              size="md"
              className="w-full"
              icon={<SkipForward className="w-4 h-4" />}
              onClick={handleNextQuestion}
              loading={isNexting}
              disabled={isFinished || totalQuestions === 0}
            >
              {isBatch
                ? lang === 'zh' ? '下一批' : 'Next Batch'
                : lang === 'zh' ? '下一题' : 'Next Question'}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>

            {/* Finish contest */}
            <Button
              variant="danger"
              size="md"
              className="w-full"
              icon={<Flag className="w-4 h-4" />}
              onClick={() => setShowFinishConfirm(true)}
              disabled={isFinished}
            >
              {lang === 'zh' ? '结束竞赛' : 'Finish Contest'}
            </Button>
          </div>

          {/* Session state indicator */}
          {session && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex items-center gap-2">
              <div
                className={clsx(
                  'w-2 h-2 rounded-full shrink-0',
                  state === 'timer_running'
                    ? 'bg-emerald-500 animate-pulse'
                    : state === 'timer_paused'
                    ? 'bg-amber-400'
                    : state === 'timer_expired'
                    ? 'bg-red-500 animate-ping'
                    : state === 'answer_revealed'
                    ? 'bg-blue-500'
                    : state === 'finished'
                    ? 'bg-slate-400'
                    : 'bg-slate-300'
                )}
              />
              <span className="text-xs text-slate-500">
                状态 / State:{' '}
                <span className="text-teal-600 font-medium">{stateLabel}</span>
              </span>
            </div>
          )}

          {/* Batch scoring (compact, left column) when batch > 1 */}
          {isBatch && showQuestion && session && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {lang === 'zh' ? '批量计分' : 'Batch Scoring'}
              </p>
              <BatchScoringSection
                batch={currentBatch}
                teams={displayTeams}
                scores={scoreMap}
                correctScore={currentRound?.scoring.correctScore ?? 10}
                wrongScore={currentRound?.scoring.wrongScore ?? 0}
                onScore={handleScore}
                lang={lang}
              />
            </div>
          )}
        </div>

        {/* ── CENTER: Question display (2/4) ─────────────────────────────── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-y-auto flex flex-col">
          {showQuestion ? (
            isBatch ? (
              /* Batch grid */
              <div className={clsx('grid gap-3 flex-1', batchGridClass)}>
                {currentBatch.map((q, i) => {
                  const label = DIFFICULTY_LABELS[q.difficulty]
                  return (
                    <div key={q.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Q{i + 1}</span>
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', label.color)}>
                          {lang === 'zh' ? label.zh : label.en}
                        </span>
                      </div>
                      <QuestionDisplay
                        question={q}
                        questionIndex={currentQIdx + i}
                        totalQuestions={totalQuestions}
                        roundNumber={currentRoundIdx + 1}
                        showAnswer={isAnswerRevealed}
                        answer={
                          isAnswerRevealed
                            ? { answer: q.answer, solution: q.solution }
                            : undefined
                        }
                        compact
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <QuestionDisplay
                question={currentQuestion}
                questionIndex={currentQIdx}
                totalQuestions={totalQuestions}
                roundNumber={currentRoundIdx + 1}
                showAnswer={isAnswerRevealed}
                answer={currentAnswer ?? undefined}
              />
            )
          ) : (
            /* ── Waiting placeholder ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-5 py-16">
              {currentBatch.length === 0 ? (
                <>
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-500">
                      {lang === 'zh' ? '等待开始' : 'Waiting to Start'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {lang === 'zh'
                        ? isBatch
                          ? '点击「下一批」载入第一批题目'
                          : '点击「下一题」载入第一道题目'
                        : isBatch
                        ? 'Click "Next Batch" to load the first batch'
                        : 'Click "Next Question" to load the first question'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-2xl bg-teal-50 flex items-center justify-center">
                    <Play className="w-10 h-10 text-teal-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-600">
                      {lang === 'zh' ? '题目已就绪' : 'Question Ready'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {lang === 'zh'
                        ? '按下「开始」计时以展示题目'
                        : 'Press "Start" to reveal the question'}
                    </p>
                  </div>
                  {currentRound && (
                    <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-teal-50 border border-teal-100 text-sm">
                      <span className="text-teal-600 font-medium">
                        {lang === 'zh' ? `第 ${currentRoundIdx + 1} 环节` : `Round ${currentRoundIdx + 1}`}
                        {currentRound.name ? ` · ${currentRound.name}` : ''}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-emerald-600">+{currentRound.scoring.correctScore}</span>
                      <span className="text-red-500">{currentRound.scoring.wrongScore}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: ScoreBoard (1/4) ────────────────────────────────────── */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-y-auto">
          {contest && session ? (
            <ScoreBoard
              scores={session.scores}
              teams={displayTeams}
              onScore={!isBatch ? handleScore : undefined}
            />
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              {lang === 'zh' ? '等待连接…' : 'Waiting for connection…'}
            </div>
          )}
        </div>
      </main>

      {/* ── Finish confirm dialog ────────────────────────────────────────── */}
      <ConfirmDialog
        open={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        onConfirm={handleFinish}
        loading={isFinishing}
        danger
        title={lang === 'zh' ? '结束竞赛' : 'Finish Contest'}
        message={
          lang === 'zh'
            ? '确定要结束竞赛吗？结束后将无法继续操作，所有分数将被锁定。'
            : 'Are you sure you want to finish the contest? All scores will be locked and this cannot be undone.'
        }
        confirmLabel={lang === 'zh' ? '确认结束' : 'Finish'}
        cancelLabel={lang === 'zh' ? '取消' : 'Cancel'}
      />
    </div>
  )
}
