import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Trophy, Crown, Medal, Award } from 'lucide-react'
import { type TeamScore, type Team, type ScoreOpType } from '@/types'

interface ScoreBoardProps {
  scores: TeamScore[]
  teams: Team[]
  onScore?: (teamId: string, delta: number, type: ScoreOpType) => void
  readonly?: boolean
}

interface AnimatedScore {
  teamId: string
  delta: number
  id: number
}

let animIdCounter = 0

export function ScoreBoard({ scores, teams, onScore, readonly = false }: ScoreBoardProps) {
  const { t } = useTranslation()
  const [animations, setAnimations] = useState<AnimatedScore[]>([])

  const triggerAnim = useCallback((teamId: string, delta: number) => {
    const id = ++animIdCounter
    setAnimations((prev) => [...prev, { teamId, delta, id }])
    setTimeout(() => {
      setAnimations((prev) => prev.filter((a) => a.id !== id))
    }, 1200)
  }, [])

  const handleScore = useCallback(
    (teamId: string, delta: number, type: ScoreOpType) => {
      onScore?.(teamId, delta, type)
      triggerAnim(teamId, delta)
    },
    [onScore, triggerAnim]
  )

  // Build sorted ranked list
  const teamMap = new Map(teams.map((t) => [t.id, t]))

  const ranked = [...scores]
    .map((s) => ({ ...s, team: teamMap.get(s.teamId) }))
    .filter((s) => s.team !== undefined)
    .sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col gap-2">
      {/* Title */}
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-slate-700">{t('session.scoreBoard')}</span>
      </div>

      {ranked.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">{t('common.noData')}</div>
      )}

      <div className="flex flex-col gap-2">
        {ranked.map((entry, index) => {
          const team = entry.team!
          const anim = animations.filter((a) => a.teamId === entry.teamId)
          const isFirst = index === 0

          return (
            <div
              key={entry.teamId}
              className={clsx(
                'relative flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300',
                isFirst
                  ? 'bg-amber-50 border-amber-200 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              )}
            >
              {/* Rank indicator */}
              <div className="w-7 text-center shrink-0">
                {index < 3 ? (
                  index === 0 ? (
                    <Crown className="w-4 h-4 text-amber-500 mx-auto" />
                  ) : index === 1 ? (
                    <Medal className="w-4 h-4 text-slate-500 mx-auto" />
                  ) : (
                    <Award className="w-4 h-4 text-orange-500 mx-auto" />
                  )
                ) : (
                  <span className="text-sm font-semibold text-slate-400">{index + 1}</span>
                )}
              </div>

              {/* Team color dot + name */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                  style={{ backgroundColor: team.color || '#94a3b8' }}
                />
                <span
                  className={clsx(
                    'font-medium truncate',
                    isFirst ? 'text-amber-800 text-sm' : 'text-slate-700 text-sm'
                  )}
                >
                  {team.name}
                </span>
              </div>

              {/* Score */}
              <div className="relative shrink-0">
                <span
                  className={clsx(
                    'text-xl font-bold tabular-nums transition-all duration-300',
                    isFirst ? 'text-amber-700' : 'text-slate-800'
                  )}
                >
                  {entry.score}
                </span>

                {/* Score delta animations */}
                {anim.map((a) => (
                  <span
                    key={a.id}
                    className={clsx(
                      'absolute -top-5 right-0 text-sm font-bold pointer-events-none',
                      'animate-bounce-up opacity-0',
                      a.delta >= 0 ? 'text-emerald-500' : 'text-red-500'
                    )}
                    style={{
                      animation: 'scoreFloat 1.2s ease-out forwards',
                    }}
                  >
                    {a.delta >= 0 ? `+${a.delta}` : a.delta}
                  </span>
                ))}
              </div>

              {/* Scoring buttons (non-readonly) */}
              {!readonly && onScore && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleScore(entry.teamId, 1, 'bonus')}
                    className={clsx(
                      'w-7 h-7 rounded-lg flex items-center justify-center',
                      'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:bg-emerald-200',
                      'transition-colors duration-150 border border-emerald-200'
                    )}
                    title={t('session.addScore')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleScore(entry.teamId, -1, 'penalty')}
                    className={clsx(
                      'w-7 h-7 rounded-lg flex items-center justify-center',
                      'bg-red-50 text-red-500 hover:bg-red-100 active:bg-red-200',
                      'transition-colors duration-150 border border-red-200'
                    )}
                    title={t('session.deductScore')}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Keyframe injection via style tag */}
      <style>{`
        @keyframes scoreFloat {
          0%   { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(-24px); }
          100% { opacity: 0; transform: translateY(-32px); }
        }
      `}</style>
    </div>
  )
}
