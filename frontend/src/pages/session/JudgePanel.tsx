import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  RotateCcw,
  Wifi,
  WifiOff,
  Loader2,
  Gavel,
  ClipboardList,
} from 'lucide-react'
import { clsx } from 'clsx'
import { contestsService } from '@/services/contests'
import { sessionsService } from '@/services/sessions'
import { settingsService } from '@/services/settings'
import { Button } from '@/components/ui/Button'
import { ScoreBoard } from '@/components/session/ScoreBoard'
import { QuestionDisplay } from '@/components/session/QuestionDisplay'
import { useSocket } from '@/hooks/useSocket'
import { useSessionStore } from '@/store/session'
import { useToast } from '@/hooks/useToast'
import { DIFFICULTY_LABELS } from '@/types'
import type { ScoreLog, ScoreOpType, Team, Question } from '@/types'

// ── Score Log Row ─────────────────────────────────────────────────────────────

function ScoreLogRow({
  log,
  teams,
  onRevert,
  lang,
}: {
  log: ScoreLog
  teams: Team[]
  onRevert: (logId: string) => void
  lang: string
}) {
  const team = teams.find((t) => t.id === log.targetTeamId)
  const isPositive = log.delta >= 0
  const canRevert = !log.isReverted

  const opLabels: Record<ScoreOpType, { zh: string; en: string }> = {
    correct: { zh: '答对', en: 'Correct' },
    wrong: { zh: '答错', en: 'Wrong' },
    bonus: { zh: '加分', en: 'Bonus' },
    penalty: { zh: '扣分', en: 'Penalty' },
    manual: { zh: '手动', en: 'Manual' },
    revert: { zh: '撤销', en: 'Revert' },
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all duration-150',
        log.isReverted
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : 'bg-white border-slate-200 hover:border-slate-300'
      )}
    >
      {/* Op type badge */}
      <span
        className={clsx(
          'shrink-0 px-2 py-0.5 rounded-full text-xs font-medium',
          log.operationType === 'correct'
            ? 'bg-emerald-50 text-emerald-700'
            : log.operationType === 'wrong'
            ? 'bg-red-50 text-red-600'
            : log.operationType === 'revert'
            ? 'bg-slate-100 text-slate-500'
            : 'bg-teal-50 text-teal-700'
        )}
      >
        {lang === 'zh'
          ? opLabels[log.operationType].zh
          : opLabels[log.operationType].en}
      </span>

      {/* Team color + name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: team?.color || '#94a3b8' }}
        />
        <span className="truncate text-slate-700 font-medium">
          {team?.name ?? log.targetTeamId}
        </span>
      </div>

      {/* Delta */}
      <span
        className={clsx(
          'font-bold tabular-nums shrink-0',
          isPositive ? 'text-emerald-600' : 'text-red-500'
        )}
      >
        {isPositive ? '+' : ''}{log.delta}
      </span>

      {/* Score range */}
      <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
        {log.scoreBefore} → {log.scoreAfter}
      </span>

      {/* Revert button */}
      {canRevert && (
        <button
          onClick={() => onRevert(log.id)}
          title={lang === 'zh' ? '撤销此操作' : 'Revert this operation'}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

      {log.isReverted && (
        <span className="text-xs text-slate-400 shrink-0">
          {lang === 'zh' ? '已撤销' : 'Reverted'}
        </span>
      )}
    </div>
  )
}

// ── Team Scoring Card ─────────────────────────────────────────────────────────

function TeamScoringCard({
  team,
  currentScore,
  correctScore,
  wrongScore,
  bonusDelta,
  penaltyDelta,
  onScore,
  lang,
}: {
  team: Team
  currentScore: number
  correctScore: number
  wrongScore: number
  bonusDelta: number
  penaltyDelta: number
  onScore: (teamId: string, delta: number, type: ScoreOpType) => void
  lang: string
}) {
  const [customDelta, setCustomDelta] = useState<string>('')

  const handleCustomScore = (type: ScoreOpType) => {
    const delta = Number(customDelta)
    if (isNaN(delta) || delta === 0) return
    onScore(team.id, delta, type)
    setCustomDelta('')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
      {/* Team header */}
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow-sm"
          style={{ backgroundColor: team.color }}
        />
        <span className="font-semibold text-slate-800 text-sm">{team.name}</span>
        <span className="ml-auto font-bold text-xl tabular-nums text-slate-800">
          {currentScore}
        </span>
      </div>

      {/* Quick buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onScore(team.id, correctScore, 'correct')}
          className={clsx(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200'
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          {lang === 'zh' ? '答对' : 'Correct'} +{correctScore}
        </button>

        <button
          onClick={() => onScore(team.id, wrongScore, 'wrong')}
          className={clsx(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:bg-red-200'
          )}
        >
          <XCircle className="w-4 h-4" />
          {lang === 'zh' ? '答错' : 'Wrong'} {wrongScore}
        </button>
      </div>

      {/* Bonus / penalty buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onScore(team.id, bonusDelta, 'bonus')}
          className={clsx(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 active:bg-blue-200'
          )}
        >
          <Plus className="w-4 h-4" />
          {lang === 'zh' ? '加分' : 'Bonus'} +{bonusDelta}
        </button>

        <button
          onClick={() => onScore(team.id, penaltyDelta, 'penalty')}
          className={clsx(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 active:bg-orange-200'
          )}
        >
          <Minus className="w-4 h-4" />
          {lang === 'zh' ? '减分' : 'Penalty'} {penaltyDelta}
        </button>
      </div>

      {/* Custom delta */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden flex-1">
          <button
            onClick={() => setCustomDelta((v) => String((Number(v) || 0) - 1))}
            className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            value={customDelta}
            onChange={(e) => setCustomDelta(e.target.value)}
            placeholder="0"
            className="flex-1 text-center text-sm text-slate-800 outline-none py-2 bg-transparent tabular-nums"
          />
          <button
            onClick={() => setCustomDelta((v) => String((Number(v) || 0) + 1))}
            className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => handleCustomScore('manual')}
          disabled={!customDelta || Number(customDelta) === 0}
          className={clsx(
            'px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
            'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {lang === 'zh' ? '应用' : 'Apply'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function JudgePanel() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const contestId = searchParams.get('contestId') ?? ''
  const { i18n } = useTranslation()
  const toast = useToast()
  const lang = i18n.language === 'zh' ? 'zh' : 'en'

  const [activeBatchIdx, setActiveBatchIdx] = useState(0)

  const {
    session,
    currentQuestion,
    currentBatch,
    currentAnswer,
    scoreLogs,
    isConnected,
    isReconnecting,
    setScoreLogs,
    setSession,
  } = useSessionStore()

  // ── Fetch contest ────────────────────────────────────────────────────────
  const { data: contest } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => contestsService.get(contestId),
    enabled: Boolean(contestId),
  })
  const { data: appSettings } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: settingsService.getPublic,
  })

  // ── Socket ───────────────────────────────────────────────────────────────
  useSocket({ contestId, sessionId: sessionId ?? '' })

  // ── Fetch score logs on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    sessionsService
      .getScoreLogs(sessionId)
      .then(setScoreLogs)
      .catch(() => {})
  }, [sessionId, setScoreLogs])

  // ── Score actions ─────────────────────────────────────────────────────────
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
        if (result?.session) {
          setSession(result.session)
        }
      } catch {
        // Resync on failure to avoid optimistic drift.
        try {
          const latest = await sessionsService.get(sessionId)
          setSession(latest)
        } catch {}
        toast.error(lang === 'zh' ? '计分失败' : 'Scoring failed')
      }
    },
    [sessionId, currentQuestion, toast, lang, setSession]
  )

  const handleRevert = useCallback(
    async (logId: string) => {
      if (!sessionId) return
      try {
        const result = await sessionsService.revertScore(sessionId, logId)
        if (result?.session) {
          setSession(result.session)
        }
        const logs = await sessionsService.getScoreLogs(sessionId)
        setScoreLogs(logs)
        toast.success(lang === 'zh' ? '已撤销操作' : 'Operation reverted')
      } catch {
        toast.error(lang === 'zh' ? '撤销失败' : 'Revert failed')
      }
    },
    [sessionId, setScoreLogs, toast, lang, setSession]
  )

  // ── Derived state ─────────────────────────────────────────────────────────
  const currentQIdx = session?.currentQuestionIndex ?? 0
  const currentRoundIdx = session?.currentRoundIndex ?? 0
  const totalQuestions = session?.questionSequence?.length ?? 0
  const isAnswerRevealed = session?.state === 'answer_revealed'
  const currentRound = contest?.rounds[currentRoundIdx]
  const correctScore = currentRound?.scoring.correctScore ?? 10
  const wrongScore = currentRound?.scoring.wrongScore ?? 0
  const bonusDelta = appSettings?.defaultBonusDelta ?? 1
  const penaltyDelta = appSettings?.defaultPenaltyDelta ?? -1

  const scoreMap = new Map(session?.scores.map((s) => [s.teamId, s.score]) ?? [])

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

  // Batch display
  const isBatch = currentBatch.length > 1
  const clampedBatchIdx = Math.min(activeBatchIdx, Math.max(0, currentBatch.length - 1))
  const activeQuestion: Question | null = isBatch
    ? (currentBatch[clampedBatchIdx] ?? null)
    : currentQuestion

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
          <Gavel className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-800 text-base truncate">
            {lang === 'zh' ? '裁判控制台' : 'Judge Panel'}
          </h1>
          <p className="text-xs text-slate-500">
            {contest?.name}
            {currentRound ? ` · ${lang === 'zh' ? '第' : 'Round'} ${currentRoundIdx + 1}` : ''}
          </p>
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

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Left column: Question + Score log */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Question display - judges see full details including answers */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {lang === 'zh' ? '当前题目（裁判视角）' : 'Current Question (Judge View)'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 text-xs font-medium">
                {lang === 'zh' ? '含答案' : 'With Answer'}
              </span>
              {isBatch && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                  {lang === 'zh' ? `批次 ${currentBatch.length} 题` : `Batch of ${currentBatch.length}`}
                </span>
              )}
            </div>

            {/* Batch tabs */}
            {isBatch && (
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {currentBatch.map((q, i) => {
                  const label = DIFFICULTY_LABELS[q.difficulty]
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveBatchIdx(i)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        clampedBatchIdx === i
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      Q{i + 1}
                      <span
                        className={clsx(
                          'px-1.5 py-0.5 rounded-full text-xs',
                          clampedBatchIdx === i ? 'bg-white/20 text-white' : label.color
                        )}
                      >
                        {lang === 'zh' ? label.zh : label.en}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <QuestionDisplay
              question={activeQuestion}
              questionIndex={currentQIdx + (isBatch ? clampedBatchIdx : 0)}
              totalQuestions={totalQuestions}
              roundNumber={currentRoundIdx + 1}
              showAnswer={true}
              answer={
                currentAnswer ??
                (activeQuestion
                  ? { answer: activeQuestion.answer, solution: activeQuestion.solution }
                  : undefined)
              }
              compact={isBatch}
            />
          </div>

          {/* Score log table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">
                {lang === 'zh' ? '最近计分记录' : 'Recent Score Operations'}
              </h2>
              <span className="ml-auto text-xs text-slate-400">
                {scoreLogs.length} {lang === 'zh' ? '条' : 'entries'}
              </span>
            </div>

            {scoreLogs.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
                {lang === 'zh' ? '暂无计分记录' : 'No score operations yet'}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                {scoreLogs.slice(0, 30).map((log) => (
                  <ScoreLogRow
                    key={log.id}
                    log={log}
                    teams={displayTeams}
                    onRevert={handleRevert}
                    lang={lang}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Scoreboard + Scoring controls */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Scoreboard */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            {contest && session ? (
              <ScoreBoard
                scores={session.scores}
                teams={displayTeams}
                readonly
              />
            ) : (
              <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
                {lang === 'zh' ? '等待连接…' : 'Waiting for connection…'}
              </div>
            )}
          </div>

          {/* Per-team/participant scoring */}
          {displayTeams.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                {contest?.mode === 'individual'
                  ? lang === 'zh' ? '选手计分' : 'Participant Scoring'
                  : lang === 'zh' ? '队伍计分' : 'Team Scoring'}
                {isBatch && (
                  <span className="ml-2 font-normal text-teal-600 normal-case">
                    {lang === 'zh' ? `Q${clampedBatchIdx + 1}` : `Q${clampedBatchIdx + 1}`}
                  </span>
                )}
              </p>
              {displayTeams.map((team) => (
                <TeamScoringCard
                  key={team.id}
                  team={team}
                  currentScore={scoreMap.get(team.id) ?? 0}
                  correctScore={correctScore}
                  wrongScore={wrongScore}
                  bonusDelta={bonusDelta}
                  penaltyDelta={penaltyDelta}
                  onScore={(teamId, delta, type) =>
                    handleScore(teamId, delta, type, activeQuestion?.id)
                  }
                  lang={lang}
                />
              ))}
            </div>
          )}

          {/* Round info */}
          {currentRound && (
            <div className="bg-teal-50 rounded-xl border border-teal-100 p-4">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-2">
                {lang === 'zh' ? '当前环节规则' : 'Current Round Rules'}
              </p>
              <div className="flex flex-col gap-1 text-sm text-teal-800">
                <div className="flex justify-between">
                  <span className="text-teal-600">{lang === 'zh' ? '答对' : 'Correct'}</span>
                  <span className="font-bold">+{correctScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">{lang === 'zh' ? '答错' : 'Wrong'}</span>
                  <span className="font-bold">{wrongScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">{lang === 'zh' ? '默认加分' : 'Default Bonus'}</span>
                  <span className="font-bold">+{bonusDelta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">{lang === 'zh' ? '默认扣分' : 'Default Penalty'}</span>
                  <span className="font-bold">{penaltyDelta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">{lang === 'zh' ? '每批题数' : 'Per Batch'}</span>
                  <span className="font-bold">{currentRound.questionsPerBatch ?? 1}</span>
                </div>
                {currentRound.timings && currentRound.timings.length > 0 && (
                  <div className="mt-1 pt-1 border-t border-teal-200">
                    <span className="text-teal-600 text-xs">{lang === 'zh' ? '难度计时' : 'Timings'}</span>
                    {currentRound.timings.map((t) => {
                      const label = DIFFICULTY_LABELS[t.difficulty]
                      return (
                        <div key={t.difficulty} className="flex justify-between text-xs mt-0.5">
                          <span className={clsx('px-1.5 py-0.5 rounded-full', label.color)}>
                            {lang === 'zh' ? label.zh : label.en}
                          </span>
                          <span className="font-medium">{t.timeSeconds}s</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
