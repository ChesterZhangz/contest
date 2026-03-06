import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Wifi,
  WifiOff,
  Loader2,
  Eye,
  Clock,
  Layers,
  Trophy,
  Crown,
  Medal,
  Award,
} from 'lucide-react'
import { clsx } from 'clsx'
import { contestsService } from '@/services/contests'
import { Timer } from '@/components/session/Timer'
import { QuestionDisplay } from '@/components/session/QuestionDisplay'
import { useSocket } from '@/hooks/useSocket'
import { useSessionStore } from '@/store/session'
import { useAuthStore } from '@/store/auth'
import { getContestAccess } from '@/utils/contestAccess'

// ── Connection status banner ──────────────────────────────────────────────────

function ConnectionBanner({
  isConnected,
  isReconnecting,
  lang,
}: {
  isConnected: boolean
  isReconnecting: boolean
  lang: string
}) {
  if (isConnected) return null

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all duration-300',
        isReconnecting
          ? 'bg-amber-500 text-white'
          : 'bg-red-500 text-white'
      )}
    >
      {isReconnecting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <WifiOff className="w-4 h-4" />
      )}
      {isReconnecting
        ? lang === 'zh' ? '正在重新连接…' : 'Reconnecting to server…'
        : lang === 'zh' ? '连接已断开，请刷新页面' : 'Connection lost. Please refresh.'}
    </div>
  )
}

// ── Answer Revealed Banner ────────────────────────────────────────────────────

function AnswerRevealedBanner({ lang }: { lang: string }) {
  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-8 py-5 flex items-center justify-center gap-3 animate-pulse">
      <Eye className="w-6 h-6 text-amber-600" />
      <span className="text-xl font-bold text-amber-700">
        {lang === 'zh' ? '答案已揭示' : 'Answer Revealed'}
      </span>
    </div>
  )
}

// ── Status Card ───────────────────────────────────────────────────────────────

function StatusCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border',
        accent
          ? 'bg-teal-600 border-teal-700 text-white shadow-lg'
          : 'bg-white border-slate-200 text-slate-700 shadow-sm'
      )}
    >
      <div className={clsx('opacity-70', accent ? 'text-teal-200' : 'text-slate-400')}>
        {icon}
      </div>
      <span
        className={clsx(
          'text-3xl font-extrabold tabular-nums tracking-tight',
          accent ? 'text-white' : 'text-slate-800'
        )}
      >
        {value}
      </span>
      <span
        className={clsx(
          'text-sm font-medium',
          accent ? 'text-teal-200' : 'text-slate-500'
        )}
      >
        {label}
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AudienceView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const contestIdFromQuery = searchParams.get('contestId') ?? ''
  const { i18n } = useTranslation()
  const lang = i18n.language === 'zh' ? 'zh' : 'en'

  const {
    session,
    currentQuestion,
    currentBatch,
    currentAnswer,
    isConnected,
    isReconnecting,
  } = useSessionStore()
  const user = useAuthStore((s) => s.user)
  const effectiveContestId = contestIdFromQuery || session?.contestId || ''

  // ── Fetch contest ────────────────────────────────────────────────────────
  const { data: contest } = useQuery({
    queryKey: ['contest', effectiveContestId],
    queryFn: () => contestsService.get(effectiveContestId),
    enabled: Boolean(effectiveContestId),
  })

  // ── Socket (read-only, no emitting) ─────────────────────────────────────
  useSocket({ contestId: effectiveContestId, sessionId: sessionId ?? '' })

  // ── Derived state ─────────────────────────────────────────────────────────
  const timer = session?.timer
  const isExpired =
    session?.state === 'timer_expired' ||
    (timer ? !timer.isPaused && timer.remainingSeconds === 0 : false)

  const displayTeams = contest
    ? contest.mode === 'individual'
      ? (contest.participantDetails ?? []).map((p) => ({
          id: p.id,
          name: p.displayName,
          color: '#94a3b8',
        }))
      : contest.teams
    : []

  const currentQIdx = session?.currentQuestionIndex ?? 0
  const currentRoundIdx = session?.currentRoundIndex ?? 0
  const totalQuestions = session?.questionSequence?.length ?? 0
  const isAnswerRevealed = session?.state === 'answer_revealed'
  const isFinished = session?.state === 'finished'
  const isWaiting = !session || session.state === 'waiting'
  const showParticipantQuestion =
    session?.state === 'timer_running' ||
    session?.state === 'timer_paused' ||
    session?.state === 'timer_expired' ||
    session?.state === 'answer_revealed'
  const access = getContestAccess(contest, user)
  const viewer = session?.viewer
  const isContestantBySession = Boolean(viewer?.isEnrolledContestant)
  const isHostOrJudgeBySession = Boolean(viewer?.isHostForContest || viewer?.isJudgeForContest)
  const isContestantView =
    !isHostOrJudgeBySession &&
    !access.isHostForContest &&
    !access.isJudgeForContest &&
    (isContestantBySession || access.isParticipantForContest)
  const participantQuestion =
    currentQuestion && typeof currentQuestion.content === 'string' ? currentQuestion : null
  const answerForParticipant =
    currentAnswer ??
    (currentQuestion && typeof currentQuestion.answer === 'string'
      ? {
          answer: currentQuestion.answer,
          solution: typeof currentQuestion.solution === 'string' ? currentQuestion.solution : undefined,
        }
      : undefined)

  const isBatch = currentBatch.length > 1
  const batchGridClass =
    currentBatch.length <= 1
      ? 'grid-cols-1'
      : currentBatch.length === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : currentBatch.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2'

  const progressPct =
    totalQuestions > 0 ? ((currentQIdx + 1) / totalQuestions) * 100 : 0
  const statusValueZh = isFinished
    ? '结束'
    : isWaiting
    ? '等待'
    : isAnswerRevealed
    ? '揭晓'
    : session?.timer.isPaused
    ? '暂停'
    : '进行'
  const statusValueEn = isFinished
    ? 'Done'
    : isWaiting
    ? 'Wait'
    : isAnswerRevealed
    ? 'Show'
    : session?.timer.isPaused
    ? 'Pause'
    : 'Live'
  const statusValue = `${statusValueZh} / ${statusValueEn}`

  return (
    <div
      className={clsx(
        'min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50',
        'flex flex-col',
        !isConnected && 'pt-10' // space for disconnect banner
      )}
    >
      {/* Connection banner */}
      <ConnectionBanner
        isConnected={isConnected}
        isReconnecting={isReconnecting}
        lang={lang}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">
              {contest?.name ?? (lang === 'zh' ? '数学竞赛' : 'Math Competition')}
            </h1>
            <p className="text-xs text-slate-500">
              {isContestantView
                ? lang === 'zh' ? '参赛者视图' : 'Contestant View'
                : lang === 'zh' ? '观众视图' : 'Audience View'}
            </p>
          </div>
        </div>

        {/* Connection indicator */}
        <div
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
            isConnected
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-600'
          )}
        >
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              {lang === 'zh' ? '直播中' : 'Live'}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              {lang === 'zh' ? '已断线' : 'Offline'}
            </>
          )}
        </div>
      </header>

      {/* Finished overlay */}
      {isFinished && (
        <div className="bg-slate-800 text-white text-center py-4 px-6">
          <p className="text-xl font-bold">
            {lang === 'zh' ? '竞赛已结束！' : 'Contest Finished!'}
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Left: Timer + status cards */}
        <div className="flex flex-col gap-6 lg:w-80 shrink-0">
          {/* Timer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center gap-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === 'zh' ? '倒计时' : 'Time Remaining'}
            </p>

            {isWaiting ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  {lang === 'zh' ? '等待竞赛开始…' : 'Waiting for contest to start…'}
                </p>
              </div>
            ) : (
              <Timer
                totalSeconds={timer?.totalSeconds ?? 60}
                remainingSeconds={timer?.remainingSeconds ?? 60}
                isPaused={timer?.isPaused ?? true}
                isExpired={isExpired}
              />
            )}
          </div>

          {/* Status cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatusCard
              label={lang === 'zh' ? '当前题目' : 'Question'}
              value={totalQuestions > 0 ? `${currentQIdx + 1}` : '--'}
              icon={<Clock className="w-5 h-5" />}
              accent
            />
            <StatusCard
              label={lang === 'zh' ? '总题数' : 'Total'}
              value={totalQuestions > 0 ? `${totalQuestions}` : '--'}
              icon={<Clock className="w-5 h-5" />}
            />
            <StatusCard
              label={lang === 'zh' ? '环节' : 'Round'}
              value={contest ? `${currentRoundIdx + 1}/${contest.rounds.length}` : '--'}
              icon={<Layers className="w-5 h-5" />}
            />
            <StatusCard
              label="状态 / Status"
              value={statusValue}
              icon={<Trophy className="w-5 h-5" />}
            />
          </div>

          {/* Progress bar */}
          {totalQuestions > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500">
                  {lang === 'zh' ? '整体进度' : 'Overall Progress'}
                </span>
                <span className="text-xs font-semibold text-teal-600">
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Answer revealed state */}
          {isAnswerRevealed && <AnswerRevealedBanner lang={lang} />}
        </div>

        {/* Right: Large ScoreBoard */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {isContestantView && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-teal-500" />
                <h2 className="font-semibold text-slate-800">
                  {lang === 'zh' ? '当前题目' : 'Current Question'}
                </h2>
                {isBatch && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                    {lang === 'zh' ? `${currentBatch.length} 题` : `${currentBatch.length} questions`}
                  </span>
                )}
              </div>

              {showParticipantQuestion ? (
                isBatch ? (
                  <div className={`grid ${batchGridClass} gap-3`}>
                    {currentBatch.map((q, i) => (
                      <QuestionDisplay
                        key={q.id}
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
                    ))}
                  </div>
                ) : (
                  <QuestionDisplay
                    question={participantQuestion}
                    questionIndex={currentQIdx}
                    totalQuestions={totalQuestions}
                    roundNumber={currentRoundIdx + 1}
                    showAnswer={isAnswerRevealed}
                    answer={answerForParticipant}
                  />
                )
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {lang === 'zh'
                    ? '主持人切题并开始计时后，题目会显示在这里。'
                    : 'The question appears here after host loads it and starts the timer.'}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-800 text-lg">
              {lang === 'zh' ? '实时积分榜' : 'Live Scoreboard'}
            </h2>
          </div>

          {contest && session ? (
            <div className="space-y-3">
              {/* Render an expanded scoreboard suitable for projection */}
              {[...session.scores]
                .sort((a, b) => b.score - a.score)
                .map((entry, index) => {
                  const team = displayTeams.find((t) => t.id === entry.teamId)
                  if (!team) return null
                  const isFirst = index === 0

                  return (
                    <div
                      key={entry.teamId}
                      className={clsx(
                        'flex items-center gap-4 px-6 py-5 rounded-2xl border transition-all duration-500',
                        isFirst
                          ? 'bg-amber-50 border-amber-200 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {/* Rank */}
                      <div className="w-10 text-center shrink-0">
                        {index < 3 ? (
                          index === 0 ? (
                            <Crown className="w-7 h-7 text-amber-500 mx-auto" />
                          ) : index === 1 ? (
                            <Medal className="w-7 h-7 text-slate-500 mx-auto" />
                          ) : (
                            <Award className="w-7 h-7 text-orange-500 mx-auto" />
                          )
                        ) : (
                          <span
                            className={clsx(
                              'text-xl font-bold',
                              isFirst ? 'text-amber-600' : 'text-slate-400'
                            )}
                          >
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Team color bar */}
                      <div
                        className="w-1.5 h-12 rounded-full shrink-0"
                        style={{ backgroundColor: team.color }}
                      />

                      {/* Team name */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={clsx(
                            'font-bold text-xl truncate',
                            isFirst ? 'text-amber-800' : 'text-slate-800'
                          )}
                        >
                          {team.name}
                        </p>
                      </div>

                      {/* Score */}
                      <div
                        className={clsx(
                          'text-4xl font-extrabold tabular-nums tracking-tight shrink-0',
                          isFirst ? 'text-amber-700' : 'text-slate-800'
                        )}
                      >
                        {entry.score}
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center">
                {isConnected ? (
                  <Loader2 className="w-8 h-8 text-teal-300 animate-spin" />
                ) : (
                  <WifiOff className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <p className="text-slate-400 text-base font-medium">
                {isConnected
                  ? lang === 'zh' ? '正在加载积分榜…' : 'Loading scoreboard…'
                  : lang === 'zh' ? '等待连接…' : 'Waiting for connection…'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer info strip */}
      <footer className="border-t border-slate-200 bg-white/80 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {isContestantView
            ? lang === 'zh' ? '参赛者视图 · 显示题目与积分' : 'Contestant View · Questions and scores'
            : lang === 'zh' ? '观众专用视图 · 仅展示积分' : 'Audience View · Scores only'}
        </span>
        <span>
          {isConnected ? (
            <span className="flex items-center gap-1 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {lang === 'zh' ? '实时同步' : 'Live sync'}
            </span>
          ) : (
            <span className="text-red-400">
              {lang === 'zh' ? '连接中断' : 'Disconnected'}
            </span>
          )}
        </span>
      </footer>
    </div>
  )
}
