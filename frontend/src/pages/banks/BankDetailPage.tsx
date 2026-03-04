import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Search,
  Plus,
  Upload,
  Download,
  SlidersHorizontal,
  X,
  Hash,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/Modal'
import { QuestionCard } from '@/components/question/QuestionCard'
import { useToast } from '@/hooks/useToast'
import { banksService } from '@/services/banks'
import { questionsService } from '@/services/questions'
import { useAuthStore } from '@/store/auth'
import type { Difficulty, Question, QuestionType } from '@/types'
import { DIFFICULTY_LABELS } from '@/types'
import { QuestionFormModal } from '@/pages/questions/QuestionFormPage'
import { ImportQuestionsModal } from '@/pages/questions/ImportQuestionsModal'

const PAGE_SIZE = 20

// ── Difficulty multi-select ───────────────────────────────────────────────

const DIFFICULTY_OPTIONS: Difficulty[] = [1, 2, 3, 4, 5]

interface DifficultyFilterProps {
  value: Difficulty[]
  onChange: (v: Difficulty[]) => void
}

function DifficultyFilter({ value, onChange }: DifficultyFilterProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en'

  const toggle = (d: Difficulty) => {
    if (value.includes(d)) {
      onChange(value.filter((x) => x !== d))
    } else {
      onChange([...value, d])
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {DIFFICULTY_OPTIONS.map((d) => {
        const cfg = DIFFICULTY_LABELS[d]
        const active = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            className={clsx(
              'px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors duration-150',
              active
                ? `${cfg.color} border-transparent`
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            )}
          >
            {cfg[lang]}
          </button>
        )
      })}
    </div>
  )
}

// ── Type filter ───────────────────────────────────────────────────────────

interface TypeFilterProps {
  value: QuestionType | ''
  onChange: (v: QuestionType | '') => void
}

function TypeFilter({ value, onChange }: TypeFilterProps) {
  const { t } = useTranslation()

  const options: { value: QuestionType | ''; label: string }[] = [
    { value: '', label: t('questions.allTypes', '全部类型') },
    { value: 'multiple_choice', label: t('questions.multiple_choice', '选择题') },
    { value: 'short_answer', label: t('questions.short_answer', '简答题') },
  ]

  return (
    <div className="flex items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            'px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors duration-150',
            value === o.value
              ? 'bg-teal-600 text-white border-transparent'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Tags filter input ─────────────────────────────────────────────────────

interface TagsFilterProps {
  value: string[]
  onChange: (v: string[]) => void
}

function TagsFilter({ value, onChange }: TagsFilterProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')

  const add = () => {
    const tag = input.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag))

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium"
        >
          <Hash className="w-2.5 h-2.5" />
          {tag}
          <button onClick={() => remove(tag)} className="text-teal-400 hover:text-teal-600">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={t('questions.filterByTag', '标签筛选…')}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 w-24 outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white placeholder:text-slate-400"
        />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function BankDetailPage() {
  const { bankId } = useParams<{ bankId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const userRole = useAuthStore((s) => s.user?.role ?? 'audience')

  // Filter state
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [difficulties, setDifficulties] = useState<Difficulty[]>([])
  const [questionType, setQuestionType] = useState<QuestionType | ''>('')
  const [tags, setTags] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Modal state
  const [questionModalOpen, setQuestionModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)

  const id = bankId ?? ''

  // Bank info query
  const bankQuery = useQuery({
    queryKey: ['banks', id],
    queryFn: () => banksService.get(id),
    enabled: !!id,
  })

  // Questions query
  const questionsQuery = useQuery({
    queryKey: ['questions', id, page, keyword, difficulties, questionType, tags],
    queryFn: () =>
      questionsService.list({
        bankId: id,
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        difficulty: difficulties.length > 0 ? difficulties : undefined,
        type: questionType ? [questionType] : undefined,
        tags: tags.length > 0 ? tags : undefined,
      }),
    enabled: !!id,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (qId: string) => questionsService.delete(qId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', id] })
      queryClient.invalidateQueries({ queryKey: ['banks', id] })
      toast.success(t('questions.deleted', '题目已删除'))
      setDeletingQuestion(null)
    },
    onError: () => toast.error(t('questions.deleteError', '删除失败，请重试')),
  })

  const bank = bankQuery.data
  const canManage = !!bank && String(bank.ownerId) === String(userId)
  const questions = questionsQuery.data?.items ?? []
  const total = questionsQuery.data?.total ?? 0
  const totalPages = questionsQuery.data?.totalPages ?? 0

  // ── Scroll container ref: reset to top on page change ──────────────────
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  // ── Access control: public banks only for super_admin / host ─────────────
  const canAccessPublicBank = userRole === 'super_admin' || userRole === 'host'
  useEffect(() => {
    if (!bank) return
    const isOwner = String(bank.ownerId) === String(userId)
    if (bank.isPublic && !isOwner && !canAccessPublicBank) {
      toast.error(t('banks.accessDenied', '您没有权限查看此题库'))
      navigate('/banks')
    }
  }, [bank, userId, canAccessPublicBank, navigate, toast, t])

  const handleExport = useCallback(async () => {
    try {
      const data = await questionsService.exportBank(id)
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${bankQuery.data?.name ?? 'bank'}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('questions.exported', '导出成功'))
    } catch {
      toast.error(t('questions.exportError', '导出失败'))
    }
  }, [id, bankQuery.data?.name, toast, t])

  const handleSaveQuestion = (q: Question) => {
    queryClient.invalidateQueries({ queryKey: ['questions', id] })
    queryClient.invalidateQueries({ queryKey: ['banks', id] })
    setQuestionModalOpen(false)
    setEditingQuestion(null)
    toast.success(
      editingQuestion
        ? t('questions.updated', '题目已更新')
        : t('questions.created', '题目已创建')
    )
  }

  const openEdit = (q: Question) => {
    setEditingQuestion(q)
    setQuestionModalOpen(true)
  }

  const hasActiveFilters =
    difficulties.length > 0 || questionType !== '' || tags.length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/banks')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            {bankQuery.isLoading ? (
              <div className="h-6 w-40 bg-slate-200 rounded-lg animate-pulse" />
            ) : (
              <h1 className="text-xl font-bold text-slate-800">
                {bank?.name ?? t('banks.untitled', '题库')}
                <span className="ml-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium align-middle">
                  <Hash className="w-3 h-3" />
                  {bank?.questionCount ?? 0} {t('banks.questions', '题')}
                </span>
              </h1>
            )}
            {bank?.description && (
              <p className="text-sm text-slate-500 mt-0.5 max-w-lg line-clamp-1">
                {bank.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                {t('questions.export', '导出')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setImportModalOpen(true)}
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                {t('questions.import', '导入题目')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingQuestion(null)
                  setQuestionModalOpen(true)
                }}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                {t('questions.new', '新建题目')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder={t('questions.searchPlaceholder', '搜索题目内容、答案、标签…')}
              leftIcon={<Search className="w-4 h-4" />}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors duration-150',
              filtersOpen || hasActiveFilters
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t('common.filter', '筛选')}
            {hasActiveFilters && (
              <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-bold">
                {difficulties.length + (questionType ? 1 : 0) + tags.length}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setDifficulties([])
                setQuestionType('')
                setTags([])
                setPage(1)
              }}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              {t('common.clearFilters', '清除筛选')}
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-start gap-4 pt-2 pb-1">
            <div>
              <p className="text-xs text-slate-400 mb-1.5">
                {t('questions.difficulty', '难度')}
              </p>
              <DifficultyFilter
                value={difficulties}
                onChange={(v) => {
                  setDifficulties(v)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">
                {t('questions.type', '类型')}
              </p>
              <TypeFilter
                value={questionType}
                onChange={(v) => {
                  setQuestionType(v)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">
                {t('questions.tags', '标签')}
              </p>
              <TagsFilter
                value={tags}
                onChange={(v) => {
                  setTags(v)
                  setPage(1)
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Question list */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {questionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loading />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">
              {hasActiveFilters || keyword
                ? t('questions.noResults', '没有匹配的题目')
                : t('questions.empty', '此题库暂无题目')}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {hasActiveFilters || keyword
                ? t('questions.tryAdjust', '试试调整筛选条件')
                : t('questions.addFirst', '点击「新建题目」开始添加')}
            </p>
            {!hasActiveFilters && !keyword && canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingQuestion(null)
                  setQuestionModalOpen(true)
                }}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                {t('questions.new', '新建题目')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                onEdit={canManage ? () => openEdit(q) : undefined}
                onDelete={canManage ? () => setDeletingQuestion(q) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 bg-white shrink-0">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Question form modal */}
      {questionModalOpen && (
        <QuestionFormModal
          bankId={id}
          question={editingQuestion ?? undefined}
          onSave={handleSaveQuestion}
          onClose={() => {
            setQuestionModalOpen(false)
            setEditingQuestion(null)
          }}
        />
      )}

      {/* Import modal */}
      {importModalOpen && (
        <ImportQuestionsModal
          bankId={id}
          onClose={() => {
            setImportModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['questions', id] })
            queryClient.invalidateQueries({ queryKey: ['banks', id] })
          }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletingQuestion}
        onClose={() => setDeletingQuestion(null)}
        onConfirm={() =>
          deletingQuestion && deleteMutation.mutate(deletingQuestion.id)
        }
        title={t('questions.deleteTitle', '删除题目')}
        message={t('questions.deleteConfirm', '确认删除此题目？此操作不可撤销。')}
        confirmLabel={t('common.delete', '删除')}
        cancelLabel={t('common.cancel', '取消')}
        loading={deleteMutation.isPending}
        danger
      />
    </div>
  )
}
