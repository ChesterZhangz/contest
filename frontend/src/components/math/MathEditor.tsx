import { useState, useRef, useCallback } from 'react'
import { Eye, Edit3, HelpCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { QuestionRenderer } from './MathRenderer'
import { useTranslation } from 'react-i18next'

interface MathEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  rows?: number
  error?: string
  hint?: string
  className?: string
}

const LATEX_SHORTCUTS = [
  { label: 'Fraction', insert: '\\frac{a}{b}' },
  { label: 'Sqrt', insert: '\\sqrt{x}' },
  { label: 'Sum', insert: '\\sum_{i=1}^{n}' },
  { label: 'Integral', insert: '\\int_{a}^{b}' },
  { label: 'Limit', insert: '\\lim_{x \\to \\infty}' },
  { label: 'Greek α', insert: '\\alpha' },
  { label: 'Greek β', insert: '\\beta' },
  { label: 'Greek π', insert: '\\pi' },
  { label: 'Greek θ', insert: '\\theta' },
  { label: '±', insert: '\\pm' },
  { label: '≤', insert: '\\leq' },
  { label: '≥', insert: '\\geq' },
  { label: '≠', insert: '\\neq' },
  { label: '∞', insert: '\\infty' },
  { label: '×', insert: '\\times' },
  { label: '÷', insert: '\\div' },
  { label: 'Inline $', insert: '$x$' },
  { label: 'Block $$', insert: '$$\nx^2\n$$' },
]

export function MathEditor({
  value,
  onChange,
  label,
  placeholder,
  rows = 6,
  error,
  hint,
  className,
}: MathEditorProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split')
  const [showHelp, setShowHelp] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertText = useCallback((text: string) => {
    const ta = textareaRef.current
    if (!ta) return

    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newValue = value.slice(0, start) + text + value.slice(end)
    onChange(newValue)

    // Restore cursor position
    setTimeout(() => {
      ta.focus()
      const newPos = start + text.length
      ta.setSelectionRange(newPos, newPos)
    }, 0)
  }, [value, onChange])

  const wrapSelection = useCallback((before: string, after: string) => {
    const ta = textareaRef.current
    if (!ta) return

    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newValue)

    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }, [value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      insertText('  ')
    }
    // Ctrl/Cmd + M → wrap inline $
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault()
      wrapSelection('$', '$')
    }
    // Ctrl/Cmd + Shift + M → wrap block $$
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
      e.preventDefault()
      wrapSelection('\n$$\n', '\n$$\n')
    }
  }, [insertText, wrapSelection])

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Mode switcher */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(['edit', 'split', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                mode === m
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {m === 'edit' && <Edit3 className="w-3 h-3" />}
              {m === 'preview' && <Eye className="w-3 h-3" />}
              {m === 'split' && (
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-3 bg-current rounded-sm opacity-70" />
                  <span className="w-1.5 h-3 bg-current rounded-sm opacity-70" />
                </span>
              )}
              {m === 'edit' ? t('questions.editMode') : m === 'preview' ? t('questions.previewMode') : '分栏'}
            </button>
          ))}
        </div>

        {/* LaTeX shortcuts */}
        <div className="flex items-center gap-1 flex-wrap">
          {LATEX_SHORTCUTS.slice(0, 8).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insertText(s.insert)}
              className="px-2 py-1 text-xs bg-slate-50 hover:bg-primary-50 text-slate-600 hover:text-primary-700 border border-slate-200 rounded-lg font-mono transition-colors"
              title={s.insert}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="LaTeX 帮助"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">LaTeX 快捷参考</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {LATEX_SHORTCUTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => insertText(s.insert)}
                className="text-left px-2 py-1.5 bg-white hover:bg-primary-50 border border-slate-200 rounded-lg group transition-colors"
              >
                <p className="text-xs font-medium text-slate-700 group-hover:text-primary-700">{s.label}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{s.insert}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
            <p className="text-xs text-slate-500"><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Ctrl+M</kbd> — 行内公式 $x$</p>
            <p className="text-xs text-slate-500"><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Ctrl+Shift+M</kbd> — 块级公式 $$x$$</p>
            <p className="text-xs text-slate-500"><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Tab</kbd> — 插入空格缩进</p>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div
        className={clsx(
          'flex gap-2',
          mode === 'split' ? 'flex-row' : 'flex-col'
        )}
        style={{ minHeight: rows * 24 + 'px' }}
      >
        {/* Textarea */}
        {(mode === 'edit' || mode === 'split') && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={rows}
            placeholder={placeholder || '输入题目内容，支持 LaTeX: $x^2$ 或 $$\\frac{a}{b}$$'}
            className={clsx(
              'flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5',
              'text-sm text-slate-800 font-mono leading-relaxed',
              'placeholder:text-slate-400 transition-colors resize-y',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              error && 'border-red-400 focus:ring-red-400',
              mode === 'split' && 'min-w-0'
            )}
          />
        )}

        {/* Preview */}
        {(mode === 'preview' || mode === 'split') && (
          <div
            className={clsx(
              'flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 overflow-auto',
              mode === 'split' && 'min-w-0'
            )}
            style={{ minHeight: rows * 24 + 'px' }}
          >
            {value ? (
              <QuestionRenderer content={value} />
            ) : (
              <p className="text-sm text-slate-400 italic">预览将在此显示…</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
