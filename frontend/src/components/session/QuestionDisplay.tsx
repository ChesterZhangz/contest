import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { BookOpen, CheckCircle2, Layers } from 'lucide-react'
import { type Question } from '@/types'
import { QuestionRenderer, MathRenderer } from '@/components/math/MathRenderer'

interface QuestionDisplayProps {
  question: Question | null
  questionIndex: number
  totalQuestions: number
  roundNumber: number
  showAnswer?: boolean
  answer?: { answer: string; solution?: string }
  compact?: boolean
}

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

export function QuestionDisplay({
  question,
  questionIndex,
  totalQuestions,
  roundNumber,
  showAnswer = false,
  answer,
  compact = false,
}: QuestionDisplayProps) {
  const { t } = useTranslation()

  // Empty / waiting state
  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
        <BookOpen className="w-12 h-12 opacity-30" />
        <p className="text-base font-medium">{t('session.waitingToStart')}</p>
      </div>
    )
  }

  const correctChoice = showAnswer ? answer?.answer ?? question.correctChoice : undefined

  return (
    <div className={clsx('flex flex-col', compact ? 'gap-3' : 'gap-6')}>
      {/* Top meta bar */}
      {!compact && (
        <div className="flex items-center justify-between gap-3">
          {/* Round badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-semibold">
              <Layers className="w-3.5 h-3.5" />
              {t('session.round', { n: roundNumber })}
            </span>
          </div>

          {/* Question number counter */}
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <span className="text-teal-600 font-bold text-base">
              {t('session.question')} {questionIndex + 1}
            </span>
            <span className="text-slate-300">{t('session.of')}</span>
            <span>{totalQuestions}</span>
          </div>
        </div>
      )}

      {/* Progress bar — hidden in compact mode */}
      {!compact && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500"
            style={{
              width: totalQuestions > 0 ? `${((questionIndex + 1) / totalQuestions) * 100}%` : '0%',
            }}
          />
        </div>
      )}

      {/* Question content */}
      <div
        className={clsx(
          'bg-white rounded-xl border border-slate-200 shadow-sm',
          compact ? 'p-3' : 'p-6 rounded-2xl',
          showAnswer && 'border-teal-200'
        )}
      >
        <QuestionRenderer
          content={question.content}
          className={compact ? 'text-sm leading-6' : 'text-base leading-8'}
        />
      </div>

      {/* Multiple choice options */}
      {question.type === 'multiple_choice' && question.choices && question.choices.length > 0 && (
        <div className={clsx('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 gap-2.5 sm:grid-cols-2')}>
          {question.choices.map((choice, idx) => {
            const label = CHOICE_LABELS[idx] ?? String(idx + 1)
            const isCorrect = showAnswer && correctChoice === choice.label

            return (
              <div
                key={choice.label}
                className={clsx(
                  'flex items-start gap-2 rounded-xl border transition-all duration-200',
                  compact ? 'px-2.5 py-2' : 'px-4 py-3',
                  isCorrect
                    ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                    : 'bg-white border-slate-200'
                )}
              >
                {/* Choice label circle */}
                <span
                  className={clsx(
                    'shrink-0 rounded-lg flex items-center justify-center font-bold mt-0.5',
                    compact ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-xs',
                    isCorrect
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {label}
                </span>

                {/* Choice content */}
                <div className="flex-1 min-w-0">
                  <MathRenderer
                    content={choice.content}
                    className={clsx(
                      'leading-relaxed',
                      compact ? 'text-xs' : 'text-sm',
                      isCorrect ? 'text-emerald-800 font-medium' : 'text-slate-700'
                    )}
                  />
                </div>

                {isCorrect && (
                  <CheckCircle2 className={clsx('text-emerald-500 shrink-0 mt-0.5', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Answer reveal panel */}
      {showAnswer && answer && (
        <div className="flex flex-col gap-3">
          {/* Answer */}
          <div className={clsx('bg-emerald-50 border border-emerald-200 rounded-xl', compact ? 'p-2.5' : 'rounded-2xl p-5')}>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">
                {t('session.answer')}
              </span>
            </div>
            <MathRenderer
              content={answer.answer}
              className={clsx('text-emerald-800 font-medium leading-relaxed', compact ? 'text-xs' : 'text-base')}
            />
          </div>

          {/* Solution / explanation — hidden in compact mode */}
          {!compact && answer.solution && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">
                  {t('session.solution')}
                </span>
              </div>
              <QuestionRenderer
                content={answer.solution}
                className="text-blue-900 text-sm leading-7"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
