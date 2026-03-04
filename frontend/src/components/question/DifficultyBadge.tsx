import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { type Difficulty, DIFFICULTY_LABELS } from '@/types'

interface DifficultyBadgeProps {
  difficulty: Difficulty
  className?: string
  size?: 'sm' | 'md'
}

export function DifficultyBadge({ difficulty, className, size = 'md' }: DifficultyBadgeProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en'
  const label = DIFFICULTY_LABELS[difficulty]

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        label.color,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      {label[lang]}
    </span>
  )
}
