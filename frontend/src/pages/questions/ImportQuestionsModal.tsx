import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import {
  X,
  FileJson,
  FileSpreadsheet,
  Eye,
  CheckCircle2,
  AlertCircle,
  Upload,
  Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { DifficultyBadge } from '@/components/question/DifficultyBadge'
import { questionsService } from '@/services/questions'
import type { Question, Difficulty, QuestionType } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────

type Format = 'json' | 'csv'

const JSON_EXAMPLE = `[
  {
    "content": "若 $a + b = 5$，$ab = 6$，求 $a^2 + b^2$ 的值。",
    "answer": "13",
    "solution": "$a^2 + b^2 = (a+b)^2 - 2ab = 25 - 12 = 13$",
    "type": "short_answer",
    "difficulty": 2,
    "tags": ["代数", "整式"]
  },
  {
    "content": "下列哪个是质数？",
    "answer": "B. 7",
    "type": "multiple_choice",
    "difficulty": 1,
    "tags": ["数论"],
    "choices": [
      { "label": "A", "content": "4" },
      { "label": "B", "content": "7" },
      { "label": "C", "content": "9" },
      { "label": "D", "content": "15" }
    ],
    "correctChoice": "B"
  }
]`

const CSV_EXAMPLE = `content,answer,type,difficulty,tags,source
"若 $x^2 = 4$，则 $x$ 的值是","$x = \\pm 2$",short_answer,1,"代数,方程","2023联赛"
"$1 + 1 = ?$","A. 2",multiple_choice,1,"基础",""
`

// ── Sub-components ─────────────────────────────────────────────────────────

interface FormatTabProps {
  active: Format
  onChange: (f: Format) => void
}

function FormatTabs({ active, onChange }: FormatTabProps) {
  const { t } = useTranslation()

  const tabs: { key: Format; icon: React.ReactNode; label: string; desc: string }[] = [
    {
      key: 'json',
      icon: <FileJson className="w-4 h-4" />,
      label: 'JSON',
      desc: t('import.jsonDesc', '结构化 JSON 格式，支持完整字段'),
    },
    {
      key: 'csv',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      label: 'CSV',
      desc: t('import.csvDesc', '表格格式，适合批量基础题目'),
    },
  ]

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={clsx(
            'flex-1 flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors duration-150',
            active === tab.key
              ? 'border-teal-300 bg-teal-50 text-teal-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          )}
        >
          <span
            className={clsx(
              'shrink-0',
              active === tab.key ? 'text-teal-600' : 'text-slate-400'
            )}
          >
            {tab.icon}
          </span>
          <div>
            <p className="text-sm font-semibold">{tab.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{tab.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

interface ExampleBlockProps {
  format: Format
  onUse: (content: string) => void
}

function ExampleBlock({ format, onUse }: ExampleBlockProps) {
  const { t } = useTranslation()
  const example = format === 'json' ? JSON_EXAMPLE : CSV_EXAMPLE

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
        <p className="text-xs font-semibold text-slate-500">
          {t('import.exampleFormat', '格式示例')} — {format.toUpperCase()}
        </p>
        <button
          type="button"
          onClick={() => onUse(example)}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
        >
          {t('import.useExample', '使用此示例')}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-36">
        {example}
      </pre>
    </div>
  )
}

// ── Preview Table ─────────────────────────────────────────────────────────

interface PreviewTableProps {
  questions: Question[]
}

function PreviewTable({ questions }: PreviewTableProps) {
  const { t } = useTranslation()

  const truncate = (s: string, n = 60) =>
    s.length > n ? s.slice(0, n) + '…' : s

  const typeLabel = (type: QuestionType) =>
    type === 'multiple_choice'
      ? t('questions.multiple_choice', '选择题')
      : t('questions.short_answer', '简答题')

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2.5 text-slate-500 font-semibold w-8">#</th>
            <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">
              {t('questions.content', '题目内容')}
            </th>
            <th className="text-left px-3 py-2.5 text-slate-500 font-semibold w-24">
              {t('questions.type', '类型')}
            </th>
            <th className="text-left px-3 py-2.5 text-slate-500 font-semibold w-20">
              {t('questions.difficulty', '难度')}
            </th>
            <th className="text-left px-3 py-2.5 text-slate-500 font-semibold w-28">
              {t('questions.answer', '答案')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {questions.map((q, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
              <td className="px-3 py-2.5 text-slate-700 max-w-xs">
                <span className="line-clamp-2 font-mono">{truncate(q.content)}</span>
                {q.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {q.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 text-[10px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium',
                    q.type === 'multiple_choice'
                      ? 'bg-teal-50 text-teal-700'
                      : 'bg-violet-50 text-violet-700'
                  )}
                >
                  {typeLabel(q.type)}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <DifficultyBadge difficulty={q.difficulty as Difficulty} size="sm" />
              </td>
              <td className="px-3 py-2.5 text-slate-600 font-mono max-w-[6rem]">
                <span className="truncate block">{truncate(q.answer, 30)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────

interface ImportQuestionsModalProps {
  bankId: string
  onClose: () => void
}

export function ImportQuestionsModal({ bankId, onClose }: ImportQuestionsModalProps) {
  const { t } = useTranslation()

  const [format, setFormat] = useState<Format>('json')
  const [content, setContent] = useState('')
  const [previewData, setPreviewData] = useState<Question[] | null>(null)
  const [previewStats, setPreviewStats] = useState<{ total: number; valid: number; invalid: number } | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () =>
      questionsService.previewImport(bankId, format, content),
    onSuccess: (data) => {
      setPreviewData(data.preview as Question[])
      setPreviewStats({ total: data.total, valid: data.valid, invalid: data.invalid })
      setParseError(null)
    },
    onError: (err: Error) => {
      setParseError(err.message || t('import.parseError', '解析失败，请检查格式'))
      setPreviewData(null)
      setPreviewStats(null)
    },
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: () =>
      questionsService.import(bankId, format, content),
    onSuccess: (data) => {
      setSuccessCount(data.success)
      setPreviewData(null)
      setPreviewStats(null)
    },
    onError: (err: Error) => {
      setParseError(err.message || t('import.importError', '导入失败，请重试'))
    },
  })

  const handleFormatChange = (f: Format) => {
    setFormat(f)
    setPreviewData(null)
    setPreviewStats(null)
    setParseError(null)
    setSuccessCount(null)
  }

  const handleContentChange = (v: string) => {
    setContent(v)
    setPreviewData(null)
    setPreviewStats(null)
    setParseError(null)
    setSuccessCount(null)
  }

  const isPreviewLoading = previewMutation.isPending
  const isImportLoading = importMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {t('import.title', '批量导入题目')}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  Import Questions
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Success state */}
          {successCount !== null ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">
                {t('import.success', '导入成功！')}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {t('import.successCount', '成功导入 {{count}} 道题目', { count: successCount })}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => {
                  setSuccessCount(null)
                  setContent('')
                  setPreviewData(null)
                  setPreviewStats(null)
                }}>
                  {t('import.importMore', '继续导入')}
                </Button>
                <Button onClick={onClose}>
                  {t('common.done', '完成')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Format selector */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  {t('import.selectFormat', '选择导入格式')}
                </p>
                <FormatTabs active={format} onChange={handleFormatChange} />
              </div>

              {/* Example */}
              <ExampleBlock format={format} onUse={handleContentChange} />

              {/* Paste area */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    {t('import.pasteContent', '粘贴内容')}
                  </label>
                  {content && (
                    <button
                      type="button"
                      onClick={() => handleContentChange('')}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {t('common.clear', '清空')}
                    </button>
                  )}
                </div>
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  rows={10}
                  placeholder={
                    format === 'json'
                      ? t('import.jsonPlaceholder', '粘贴 JSON 数组格式的题目数据…')
                      : t('import.csvPlaceholder', '粘贴 CSV 格式数据（第一行为表头）…')
                  }
                  className={clsx(
                    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5',
                    'text-sm font-mono text-slate-800 placeholder:text-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
                    'transition-colors resize-y leading-relaxed',
                    parseError && 'border-red-300 focus:ring-red-400 focus:border-red-400'
                  )}
                />
                {parseError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{parseError}</p>
                  </div>
                )}
              </div>

              {/* Preview result */}
              {previewData !== null && previewData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">
                      {t('import.previewResult', '预览结果')}
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
                        {previewStats?.valid ?? previewData.length} {t('banks.questions', '题')}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {previewStats && previewStats.total > previewData.length
                        ? `已解析 ${previewStats.total} 题，当前仅预览前 ${previewData.length} 题`
                        : t('import.confirmHint', '确认无误后点击「确认导入」')}
                    </p>
                  </div>
                  {previewStats && (
                    <div className="text-xs text-slate-500">
                      有效 {previewStats.valid} 题，失败 {previewStats.invalid} 题
                    </div>
                  )}
                  <PreviewTable questions={previewData} />
                </div>
              )}

              {previewData !== null && previewData.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">
                    {t('import.emptyPreview', '解析结果为空，请检查内容格式')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {successCount === null && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
            <div className="text-xs text-slate-400">
              {format === 'json'
                ? t('import.jsonHint', '支持 JSON 数组，每个对象代表一道题目')
                : t('import.csvHint', 'CSV 第一行需包含列名：content, answer, type, difficulty')}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                {t('common.cancel', '取消')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => previewMutation.mutate()}
                disabled={!content.trim() || isPreviewLoading || isImportLoading}
                icon={
                  isPreviewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )
                }
              >
                {t('import.preview', '预览导入')}
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={
                  !previewData ||
                  previewData.length === 0 ||
                  isImportLoading ||
                  isPreviewLoading
                }
                loading={isImportLoading}
                icon={<Upload className="w-4 h-4" />}
              >
                {t('import.confirm', '确认导入')}
                {previewStats && previewStats.valid > 0 && (
                  <span className="ml-1 opacity-80">({previewStats.valid})</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImportQuestionsModal
