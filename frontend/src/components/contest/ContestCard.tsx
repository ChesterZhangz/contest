import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import {
  Pencil,
  Trash2,
  Play,
  Eye,
  LogIn,
  Users,
  Layers,
  Calendar,
  User,
  Share2,
} from 'lucide-react'
import { type Contest } from '@/types'
import { ContestStatusBadge } from './ContestStatusBadge'

interface ContestCardProps {
  contest: Contest
  onEdit?: () => void
  onDelete?: () => void
  onStart?: () => void
  onView?: () => void
  onJoin?: () => void
  onShowCode?: () => void
}

export function ContestCard({ contest, onEdit, onDelete, onStart, onView, onJoin, onShowCode }: ContestCardProps) {
  const { t } = useTranslation()

  const scheduledDate = contest.scheduledAt
    ? new Date(contest.scheduledAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const canStart = (contest.status === 'draft' || contest.status === 'ready') && Boolean(onStart)
  const canView = (contest.status === 'active' || contest.status === 'finished') && Boolean(onView)
  const canJoin = contest.status !== 'finished' && Boolean(onJoin)

  const modeLabel =
    contest.mode === 'team' ? t('contests.team') : t('contests.individual')
  const modeColor =
    contest.mode === 'team'
      ? 'bg-teal-50 text-teal-700'
      : 'bg-violet-50 text-violet-700'

  return (
    <div
      className={clsx(
        'group bg-white rounded-2xl border border-slate-200 shadow-sm',
        'hover:shadow-md hover:border-teal-200 transition-all duration-200',
        'flex flex-col gap-3 p-5'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 text-base truncate leading-snug">
            {contest.name}
          </h3>
          {contest.description && (
            <p className="mt-0.5 text-sm text-slate-500 line-clamp-2 leading-relaxed">
              {contest.description}
            </p>
          )}
        </div>
        <ContestStatusBadge status={contest.status} className="shrink-0 mt-0.5" />
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={clsx(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
            modeColor
          )}
        >
          {contest.mode === 'team' ? (
            <Users className="w-3 h-3" />
          ) : (
            <User className="w-3 h-3" />
          )}
          {modeLabel}
        </span>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <Layers className="w-3 h-3" />
          {contest.rounds.length} {t('contests.rounds')}
        </span>

        {contest.mode === 'team' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            <Users className="w-3 h-3" />
            {contest.teams.length} {t('contests.teams')}
          </span>
        )}
      </div>

      {/* Scheduled date */}
      {scheduledDate && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{scheduledDate}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-auto">
        {/* Primary action */}
        {canStart && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStart?.()
            }}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
              'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
              'transition-colors duration-150 shadow-sm'
            )}
          >
            <Play className="w-3.5 h-3.5" />
            {t('contests.startContest')}
          </button>
        )}
        {canJoin && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onJoin?.()
            }}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
              'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
              'transition-colors duration-150 shadow-sm'
            )}
          >
            <LogIn className="w-3.5 h-3.5" />
            {t('contests.joinContest')}
          </button>
        )}
        {canView && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView?.()
            }}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
              'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
              'transition-colors duration-150 shadow-sm'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            {t('nav.session')}
          </button>
        )}

        {onShowCode && contest.status !== 'finished' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onShowCode()
            }}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
              'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300',
              'transition-colors duration-150'
            )}
          >
            <Share2 className="w-3.5 h-3.5" />
            {t('contests.showCode')}
          </button>
        )}

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium',
                  'text-teal-600 hover:bg-teal-50 active:bg-teal-100 transition-colors duration-150'
                )}
                title={t('common.edit')}
              >
                <Pencil className="w-3.5 h-3.5" />
                {t('common.edit')}
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium',
                  'text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors duration-150'
                )}
                title={t('common.delete')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('common.delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
