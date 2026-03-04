import { useState, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'
import { clsx } from 'clsx'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  label?: string
  suggestions?: string[]
}

export function TagInput({ value, onChange, placeholder = '添加标签…', className, label, suggestions = [] }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const addTag = (tag: string) => {
    const t = tag.trim()
    if (t && !value.includes(t)) {
      onChange([...value, t])
    }
    setInput('')
    setShowSuggestions(false)
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input) {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  )

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-colors min-h-[42px]">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-primary-400 hover:text-primary-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setShowSuggestions(true)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-24 text-sm outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
          />
        </div>
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-float z-20 max-h-40 overflow-y-auto">
            {filtered.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => addTag(s)}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
