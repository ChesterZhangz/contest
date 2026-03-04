import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

interface TimerProps {
  totalSeconds: number
  remainingSeconds: number
  isPaused: boolean
  isExpired: boolean
}

function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(clamped / 60)
  const ss = clamped % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function Timer({ totalSeconds, remainingSeconds, isPaused, isExpired }: TimerProps) {
  const { t } = useTranslation()

  // Local countdown state — syncs from props, counts down locally when running
  const [localSeconds, setLocalSeconds] = useState(remainingSeconds)

  // Sync from external state changes (pause, reset, new question)
  useEffect(() => {
    setLocalSeconds(remainingSeconds)
  }, [remainingSeconds])

  // Run local countdown when timer is active
  useEffect(() => {
    if (isPaused || isExpired) return
    const id = setInterval(() => {
      setLocalSeconds((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [isPaused, isExpired])

  // Effective expired: either prop or local countdown hit 0
  const effectivelyExpired = isExpired || (!isPaused && localSeconds === 0)

  // Derived fractions using local seconds
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, localSeconds / totalSeconds)) : 0
  const pct30 = fraction < 0.3
  const pct10 = fraction < 0.1

  // SVG ring
  const SIZE = 160
  const STROKE = 10
  const RADIUS = (SIZE - STROKE) / 2
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const dashOffset = CIRCUMFERENCE * (1 - fraction)

  // Color palette
  const ringColor = effectivelyExpired
    ? '#ef4444'
    : pct10
    ? '#ef4444'
    : pct30
    ? '#f59e0b'
    : '#10b981'

  const textColor = effectivelyExpired
    ? 'text-red-500'
    : pct10
    ? 'text-red-500'
    : pct30
    ? 'text-amber-500'
    : 'text-emerald-600'

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        {t('session.timer')}
      </span>

      <div className={clsx('relative inline-flex', effectivelyExpired && 'animate-pulse')}>
        {/* Track ring */}
        <svg
          width={SIZE}
          height={SIZE}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={STROKE}
          />
          {/* Progress arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.4s ease' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span
            className={clsx(
              'text-3xl font-bold tabular-nums tracking-tight transition-colors duration-400',
              textColor
            )}
          >
            {formatTime(localSeconds)}
          </span>
          {isPaused && !effectivelyExpired && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('session.pause')}
            </span>
          )}
          {effectivelyExpired && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">
              00:00
            </span>
          )}
        </div>
      </div>

      {/* Status indicator row */}
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'w-2 h-2 rounded-full',
            effectivelyExpired
              ? 'bg-red-500 animate-ping'
              : isPaused
              ? 'bg-amber-400'
              : 'bg-emerald-500 animate-pulse'
          )}
        />
        <span className="text-xs text-slate-500">
          {effectivelyExpired
            ? t('session.timer')
            : isPaused
            ? t('session.pause')
            : t('session.start')}
        </span>
      </div>
    </div>
  )
}
