import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { type ContestStatus } from '@/types'

interface ContestStatusBadgeProps {
  status: ContestStatus
  className?: string
}

const STATUS_STYLES: Record<ContestStatus, string> = {
  draft: 'bg-slate-100 text-slate-500',
  ready: 'bg-blue-50 text-blue-600',
  active: 'bg-emerald-50 text-emerald-600',
  finished: 'bg-slate-200 text-slate-500',
}

export function ContestStatusBadge({ status, className }: ContestStatusBadgeProps) {
  const { t } = useTranslation()

  const labelMap: Record<ContestStatus, string> = {
    draft: t('contests.draft'),
    ready: t('contests.ready'),
    active: t('contests.active'),
    finished: t('contests.finished'),
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        STATUS_STYLES[status],
        className
      )}
    >
      {status === 'active' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {labelMap[status]}
    </span>
  )
}
