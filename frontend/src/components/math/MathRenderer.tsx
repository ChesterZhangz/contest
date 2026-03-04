import { useMemo } from 'react'
import katex from 'katex'
import { clsx } from 'clsx'

interface MathRendererProps {
  content?: string | null
  className?: string
  block?: boolean
  throwOnError?: boolean
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Renders a single LaTeX expression (inline or block).
 */
export function MathInline({ content, className }: { content?: string | null; className?: string }) {
  const safeContent = safeText(content)
  const html = useMemo(() => {
    try {
      return katex.renderToString(safeContent, {
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: false,
      })
    } catch {
      return `<span class="text-red-500">[LaTeX error]</span>`
    }
  }, [safeContent])

  return (
    <span
      className={clsx('katex-inline', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function MathBlock({ content, className }: { content?: string | null; className?: string }) {
  const safeContent = safeText(content)
  const html = useMemo(() => {
    try {
      return katex.renderToString(safeContent, {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: false,
      })
    } catch {
      return `<span class="text-red-500">[LaTeX error: ${safeContent}]</span>`
    }
  }, [safeContent])

  return (
    <div
      className={clsx('katex-block overflow-x-auto py-2', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * Renders mixed text + LaTeX content.
 * Supports: $...$ for inline, $$...$$ for block.
 */
export function MathRenderer({ content, className }: MathRendererProps) {
  const safeContent = safeText(content)
  const parts = useMemo(() => parseMath(safeContent), [safeContent])

  return (
    <span className={clsx('math-content leading-relaxed', className)}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.value}</span>
        }
        if (part.type === 'block') {
          return <MathBlock key={i} content={part.value} />
        }
        return <MathInline key={i} content={part.value} />
      })}
    </span>
  )
}

/**
 * Full-content renderer for question text with proper block handling.
 */
export function QuestionRenderer({
  content,
  className,
}: {
  content?: string | null
  className?: string
}) {
  const safeContent = safeText(content)
  const parts = useMemo(() => parseMathFull(safeContent), [safeContent])

  return (
    <div className={clsx('question-content text-slate-800', className)}>
      {parts.map((part, i) => {
        if (part.type === 'block') {
          return (
            <div key={i} className="my-3 overflow-x-auto">
              <MathBlock content={part.value} />
            </div>
          )
        }
        if (part.type === 'paragraph') {
          const inlineParts = parseInlineMath(part.value)
          return (
            <p key={i} className="mb-2 last:mb-0 leading-7">
              {inlineParts.map((ip, j) =>
                ip.type === 'inline' ? (
                  <MathInline key={j} content={ip.value} />
                ) : (
                  <span key={j}>{ip.value}</span>
                )
              )}
            </p>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Parsers ───────────────────────────────────────────────────────────────

type MathPart =
  | { type: 'text'; value: string }
  | { type: 'inline'; value: string }
  | { type: 'block'; value: string }

function parseMath(content: string): MathPart[] {
  const parts: MathPart[] = []
  // Match $$...$$ first, then $...$
  const regex = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      parts.push({ type: 'block', value: match[1] })
    } else if (match[2] !== undefined) {
      parts.push({ type: 'inline', value: match[2] })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return parts
}

type FullPart =
  | { type: 'block'; value: string }
  | { type: 'paragraph'; value: string }

function parseMathFull(content: string): FullPart[] {
  const parts: FullPart[] = []
  // Split on $$...$$ blocks
  const blockRegex = /\$\$([\s\S]+?)\$\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      // Split text into paragraphs
      const paragraphs = text.split(/\n{2,}/)
      for (const p of paragraphs) {
        const trimmed = p.trim()
        if (trimmed) parts.push({ type: 'paragraph', value: trimmed })
      }
    }
    parts.push({ type: 'block', value: match[1].trim() })
    lastIndex = blockRegex.lastIndex
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    const paragraphs = text.split(/\n{2,}/)
    for (const p of paragraphs) {
      const trimmed = p.trim()
      if (trimmed) parts.push({ type: 'paragraph', value: trimmed })
    }
  }

  return parts
}

type InlinePart = { type: 'text' | 'inline'; value: string }

function parseInlineMath(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  const regex = /\$([^$\n]+?)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'inline', value: match[1] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts
}
