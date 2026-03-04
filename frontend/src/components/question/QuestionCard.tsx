import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, BookOpen, Hash, Calendar } from 'lucide-react'
import { type Question } from '@/types'
import { MathRenderer } from '@/components/math/MathRenderer'
import { DifficultyBadge } from './DifficultyBadge'

interface QuestionCardProps {
  question: Question
  onEdit?: () => void
  onDelete?: () => void
  bankName?: string
}

export function QuestionCard({ question, onEdit, onDelete, bankName }: QuestionCardProps) {
  const { t } = useTranslation()

  const contentPreview =
    question.content.length > 200 ? question.content.slice(0, 200) + '…' : question.content

  const typeLabel =
    question.type === 'multiple_choice'
      ? t('questions.multiple_choice')
      : t('questions.short_answer')

  const typeColor =
    question.type === 'multiple_choice'
      ? 'bg-teal-50 text-teal-700'
      : 'bg-violet-50 text-violet-700'

  const createdDate = new Date(question.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className={clsx(
        'group bg-white rounded-2xl border border-slate-200 shadow-sm',
        'hover:shadow-md hover:border-teal-200 transition-all duration-200',
        'flex flex-col gap-3 p-4'
      )}
    >
      {/* Header row: type badge + difficulty badge + bank name */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={clsx(
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
            typeColor
          )}
        >
          {typeLabel}
        </span>
        <DifficultyBadge difficulty={question.difficulty} size="sm" />
        {bankName && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 ml-auto">
            <BookOpen className="w-3 h-3" />
            {bankName}
          </span>
        )}
      </div>

      {/* Question content preview */}
      <div className="flex-1 min-w-0">
        <MathRenderer
          content={contentPreview}
          className="text-sm text-slate-700 leading-relaxed line-clamp-3"
        />
      </div>

      {/* Choices (multiple choice only) */}
      {question.type === 'multiple_choice' && question.choices && question.choices.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {question.choices.map((choice) => (
            <div
              key={choice.label}
              className={clsx(
                'flex items-start gap-2 px-3 py-1.5 rounded-xl text-xs border',
                question.correctChoice === choice.label
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              )}
            >
              <span className={clsx(
                'shrink-0 font-semibold',
                question.correctChoice === choice.label ? 'text-emerald-600' : 'text-slate-400'
              )}>
                {choice.label}.
              </span>
              <MathRenderer content={choice.content} className="leading-relaxed" />
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {question.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
            >
              <Hash className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer row: meta + actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {question.usageCount !== undefined && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {t('questions.title')} ×{question.usageCount}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {createdDate}
          </span>
        </div>

        {onEdit && onDelete && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
          </div>
        )}
      </div>
    </div>
  )
}
