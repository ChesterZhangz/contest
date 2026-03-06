import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Trash2,
  ChevronLeft,
  Users,
  User,
  Layers,
  Gavel,
  BookOpen,
  GripVertical,
  X,
  Search,
} from 'lucide-react'
import { clsx } from 'clsx'
import { contestsService } from '@/services/contests'
import { banksService } from '@/services/banks'
import { usersService } from '@/services/users'
import { questionsService } from '@/services/questions'
import { tagsService } from '@/services/tags'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { useToast } from '@/hooks/useToast'
import type {
  ContestMode,
  ContestRound,
  Team,
  Difficulty,
  DifficultyTiming,
  Tag,
} from '@/types'
import type { CreateContestInput } from '@/services/contests'
import { normalizeId } from '@/utils/contestAccess'
import { DIFFICULTY_LABELS } from '@/types'

// ── Color palette for teams ───────────────────────────────────────────────────

const TEAM_COLORS = [
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#0ea5e9', label: 'Sky' },
]

const ALL_DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5]

// ── Internal form types ───────────────────────────────────────────────────────

interface FormAllocation {
  difficulty: Difficulty
  count: number
  enabled: boolean
}

interface FormSource {
  _key: string
  bankId: string
  allocations: FormAllocation[]
}

interface FormRound {
  _key: string
  name: string
  questionsPerBatch: number
  sources: FormSource[]
  tagRequired: string[]
  tagForbidden: string[]
  timings: Partial<Record<Difficulty, number>>
  scoring: { correctScore: number; wrongScore: number }
}

// ── Default factories ─────────────────────────────────────────────────────────

const defaultSource = (): FormSource => ({
  _key: crypto.randomUUID(),
  bankId: '',
  allocations: ALL_DIFFICULTIES.map((d) => ({ difficulty: d, count: 1, enabled: false })),
})

const defaultFormRound = (): FormRound => ({
  _key: crypto.randomUUID(),
  name: '',
  questionsPerBatch: 1,
  sources: [defaultSource()],
  tagRequired: [],
  tagForbidden: [],
  timings: { 1: 60, 2: 90, 3: 120, 4: 150, 5: 180 },
  scoring: { correctScore: 10, wrongScore: 0 },
})

const defaultTeam = (): Omit<Team, 'id'> => ({
  name: '',
  color: TEAM_COLORS[0].hex,
  memberIds: [],
  initialScore: 0,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEnabledDifficulties(round: FormRound): Difficulty[] {
  const diffs = new Set<Difficulty>()
  for (const source of round.sources) {
    for (const alloc of source.allocations) {
      if (alloc.enabled && alloc.count > 0) diffs.add(alloc.difficulty)
    }
  }
  return ALL_DIFFICULTIES.filter((d) => diffs.has(d))
}

function getRoundTotalCount(round: FormRound): number {
  return round.sources.reduce(
    (sum, s) =>
      sum +
      s.allocations.filter((a) => a.enabled).reduce((s2, a) => s2 + Math.max(1, a.count), 0),
    0
  )
}

function formRoundToContestRound(r: FormRound, idx: number, lang: string): ContestRound {
  const enabledDiffs = getEnabledDifficulties(r)
  return {
    roundNumber: idx + 1,
    name: r.name || `${lang === 'zh' ? '第' : 'Round'} ${idx + 1}${lang === 'zh' ? '环节' : ''}`,
    questionsPerBatch: Math.max(1, Math.min(10, r.questionsPerBatch)),
    sources: r.sources
      .filter((s) => s.bankId && s.allocations.some((a) => a.enabled && a.count > 0))
      .map((s) => ({
        bankId: s.bankId,
        allocations: s.allocations
          .filter((a) => a.enabled && a.count > 0)
          .map((a) => ({ difficulty: a.difficulty, count: Math.max(1, a.count) })),
      })),
    tagConstraints:
      r.tagRequired.length > 0 || r.tagForbidden.length > 0
        ? {
            required: r.tagRequired.length > 0 ? r.tagRequired : undefined,
            forbidden: r.tagForbidden.length > 0 ? r.tagForbidden : undefined,
          }
        : undefined,
    timings: enabledDiffs.map((d) => ({
      difficulty: d,
      timeSeconds: Math.max(10, Math.min(600, r.timings[d] ?? 60)),
    })),
    scoring: r.scoring,
  }
}

function contestRoundToFormRound(r: ContestRound): FormRound {
  // Handle old format (bankId field) gracefully
  const oldFormat = r as unknown as {
    bankId?: string
    questionCount?: number
    timePerQuestion?: number
  }
  if (oldFormat.bankId) {
    // Legacy round — convert
    return {
      _key: String(r.roundNumber),
      name: r.name,
      questionsPerBatch: 1,
      sources: [
        {
          _key: crypto.randomUUID(),
          bankId: oldFormat.bankId,
          allocations: ALL_DIFFICULTIES.map((d) => ({
            difficulty: d,
            count: d === 1 ? Math.ceil((oldFormat.questionCount ?? 5) / 2) : 0,
            enabled: d === 1,
          })),
        },
      ],
      tagRequired: [],
      tagForbidden: [],
      timings: { 1: oldFormat.timePerQuestion ?? 60, 2: oldFormat.timePerQuestion ?? 90, 3: 120, 4: 150, 5: 180 },
      scoring: r.scoring,
    }
  }

  // New format
  const timingsRecord: Partial<Record<Difficulty, number>> = {}
  ;(r.timings ?? []).forEach((t: DifficultyTiming) => {
    timingsRecord[t.difficulty] = t.timeSeconds
  })
  ALL_DIFFICULTIES.forEach((d) => {
    if (!timingsRecord[d]) timingsRecord[d] = d * 30 + 30
  })

  return {
    _key: String(r.roundNumber),
    name: r.name,
    questionsPerBatch: r.questionsPerBatch ?? 1,
    sources: (r.sources ?? []).map((s) => ({
      _key: crypto.randomUUID(),
      bankId: s.bankId,
      allocations: ALL_DIFFICULTIES.map((d) => {
        const alloc = s.allocations.find((a) => a.difficulty === d)
        return { difficulty: d, count: alloc?.count ?? 1, enabled: Boolean(alloc) }
      }),
    })),
    tagRequired: r.tagConstraints?.required ?? [],
    tagForbidden: r.tagConstraints?.forbidden ?? [],
    timings: timingsRecord,
    scoring: r.scoring,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
        {icon}
      </div>
      <div>
        <h2 className="font-semibold text-slate-800 text-sm">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Tag search input ──────────────────────────────────────────────────────────

function TagSearchInput({
  selected,
  allTags,
  onChange,
  placeholder,
}: {
  selected: string[]
  allTags: Tag[]
  onChange: (tags: string[]) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = allTags
    .filter((t) => !selected.includes(t.name))
    .filter((t) => !query || t.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30)

  const add = (name: string) => {
    if (!selected.includes(name)) onChange([...selected, name])
    setQuery('')
  }

  const remove = (name: string) => onChange(selected.filter((t) => t !== name))

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
            >
              {tag}
              <button type="button" onClick={() => remove(tag)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">
                {query ? '无匹配标签 / No matches' : '暂无可用标签 / No tags'}
              </p>
            ) : (
              filtered.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onMouseDown={() => add(tag.name)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-teal-50 transition-colors text-left"
                >
                  <span className="text-slate-700 font-medium">{tag.name}</span>
                  <span className="text-slate-400">{tag.questionCount}题</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Round config card ─────────────────────────────────────────────────────────

function RoundCard({
  round,
  idx,
  banks,
  bankDiffCounts,
  allTags,
  canRemove,
  lang,
  onUpdate,
  onRemove,
}: {
  round: FormRound
  idx: number
  banks: { id: string; name: string; questionCount: number }[]
  bankDiffCounts: Record<string, Partial<Record<Difficulty, number>>>
  allTags: Tag[]
  canRemove: boolean
  lang: string
  onUpdate: (patch: Partial<FormRound>) => void
  onRemove: () => void
}) {
  const enabledDiffs = getEnabledDifficulties(round)
  const totalCount = getRoundTotalCount(round)

  // ── Source helpers ─────────────────────────────────────────────────────────
  const addSource = () => onUpdate({ sources: [...round.sources, defaultSource()] })
  const removeSource = (key: string) =>
    onUpdate({ sources: round.sources.filter((s) => s._key !== key) })
  const updateSource = (key: string, patch: Partial<FormSource>) =>
    onUpdate({
      sources: round.sources.map((s) => (s._key === key ? { ...s, ...patch } : s)),
    })
  const updateAllocation = (sourceKey: string, difficulty: Difficulty, patch: Partial<FormAllocation>) =>
    updateSource(sourceKey, {
      allocations: round.sources
        .find((s) => s._key === sourceKey)!
        .allocations.map((a) => (a.difficulty === difficulty ? { ...a, ...patch } : a)),
    })

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      {/* Round header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
            {idx + 1}
          </span>
          <input
            type="text"
            value={round.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={lang === 'zh' ? `第 ${idx + 1} 环节` : `Round ${idx + 1}`}
            className="bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none border-b border-transparent focus:border-teal-400 transition-colors px-1 py-0.5 w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {lang === 'zh' ? `共 ${totalCount} 题` : `${totalCount} total`}
          </span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-5">
        {/* ── A: Bank Sources ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {lang === 'zh' ? 'A. 题库来源' : 'A. Bank Sources'}
            </h3>
            <button
              type="button"
              onClick={addSource}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {lang === 'zh' ? '添加题库' : 'Add Bank'}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {round.sources.map((source) => (
              <div key={source._key} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <Select
                    label=""
                    placeholder={lang === 'zh' ? '选择题库' : 'Select bank'}
                    options={banks.map((b) => ({
                      value: b.id,
                      label: `${b.name} (${b.questionCount}${lang === 'zh' ? '题' : 'q'})`,
                    }))}
                    value={source.bankId}
                    onChange={(v) => updateSource(source._key, { bankId: v })}
                  />
                  {round.sources.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSource(source._key)}
                      className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors mt-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Difficulty allocation table */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      {lang === 'zh' ? '难度分配' : 'Difficulty Allocation'}
                    </span>
                    {source.bankId && !bankDiffCounts[source.bankId] && (
                      <span className="text-xs text-slate-400">
                        {lang === 'zh' ? '加载中…' : 'Loading…'}
                      </span>
                    )}
                  </div>
                  {source.allocations.map((alloc) => {
                    const label = DIFFICULTY_LABELS[alloc.difficulty]
                    const counts = source.bankId ? bankDiffCounts[source.bankId] : undefined
                    const maxAvailable = counts?.[alloc.difficulty]
                    // maxAvailable=undefined means not fetched yet (no cap); 0 means none exist
                    const hasNone = maxAvailable === 0
                    const exceeded = maxAvailable !== undefined && alloc.enabled && alloc.count > maxAvailable
                    return (
                      <label
                        key={alloc.difficulty}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
                          hasNone
                            ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                            : exceeded
                            ? 'border-red-300 bg-red-50 cursor-pointer'
                            : alloc.enabled
                            ? 'border-teal-200 bg-teal-50 cursor-pointer'
                            : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={alloc.enabled}
                          disabled={hasNone}
                          onChange={(e) =>
                            updateAllocation(source._key, alloc.difficulty, { enabled: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300 focus:ring-teal-500 disabled:cursor-not-allowed"
                        />
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', label.color)}>
                          {lang === 'zh' ? label.zh : label.en}
                        </span>

                        {/* Available count badge */}
                        {source.bankId && maxAvailable !== undefined && (
                          <span className={clsx(
                            'text-xs',
                            hasNone ? 'text-slate-400' : 'text-slate-500'
                          )}>
                            {lang === 'zh' ? `共 ${maxAvailable} 题` : `${maxAvailable} avail.`}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          <input
                            type="number"
                            min={1}
                            max={maxAvailable ?? 9999}
                            value={alloc.count}
                            disabled={!alloc.enabled || hasNone}
                            onChange={(e) => {
                              const raw = Math.max(1, Number(e.target.value))
                              const capped = maxAvailable !== undefined ? Math.min(raw, maxAvailable) : raw
                              updateAllocation(source._key, alloc.difficulty, { count: capped })
                            }}
                            className={clsx(
                              'w-14 text-center rounded-lg border px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed',
                              exceeded
                                ? 'border-red-400 bg-red-50 focus:ring-red-400'
                                : 'border-slate-200 bg-white focus:ring-teal-500'
                            )}
                          />
                          <span className={clsx('text-xs', exceeded ? 'text-red-500 font-semibold' : 'text-slate-500')}>
                            {maxAvailable !== undefined && alloc.enabled
                              ? `/ ${maxAvailable}`
                              : lang === 'zh' ? '题' : 'q'}
                          </span>
                        </div>

                        {exceeded && (
                          <span className="text-xs text-red-600 font-medium shrink-0">
                            {lang === 'zh' ? '超出！' : 'Exceeds!'}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── B: Tag Filters ──────────────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
            {lang === 'zh' ? 'B. 知识点标签' : 'B. Tag Filters'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">
                {lang === 'zh' ? '必须包含' : 'Required'}
              </span>
              <TagSearchInput
                selected={round.tagRequired}
                allTags={allTags.filter((t) => !round.tagForbidden.includes(t.name))}
                onChange={(tags) => onUpdate({ tagRequired: tags })}
                placeholder={lang === 'zh' ? '搜索标签…' : 'Search tags…'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">
                {lang === 'zh' ? '排除' : 'Forbidden'}
              </span>
              <TagSearchInput
                selected={round.tagForbidden}
                allTags={allTags.filter((t) => !round.tagRequired.includes(t.name))}
                onChange={(tags) => onUpdate({ tagForbidden: tags })}
                placeholder={lang === 'zh' ? '搜索标签…' : 'Search tags…'}
              />
            </div>
          </div>
        </div>

        {/* ── C: Difficulty Timings ───────────────────────────────────────── */}
        {enabledDiffs.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
              {lang === 'zh' ? 'C. 难度计时' : 'C. Difficulty Timings'}
            </h3>
            <div className="flex flex-col gap-2">
              {enabledDiffs.map((d) => {
                const label = DIFFICULTY_LABELS[d]
                return (
                  <div key={d} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-white">
                    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', label.color)}>
                      {lang === 'zh' ? label.zh : label.en}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="number"
                        min={10}
                        max={600}
                        step={5}
                        value={round.timings[d] ?? 60}
                        onChange={(e) =>
                          onUpdate({
                            timings: { ...round.timings, [d]: Math.max(10, Number(e.target.value)) },
                          })
                        }
                        className="w-20 text-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="text-xs text-slate-500">
                        {lang === 'zh' ? '秒' : 's'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── D: Questions per Batch ──────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
            {lang === 'zh' ? 'D. 每批展示' : 'D. Questions per Batch'}
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={10}
              value={round.questionsPerBatch}
              onChange={(e) =>
                onUpdate({ questionsPerBatch: Math.max(1, Math.min(10, Number(e.target.value))) })
              }
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-500">
              {lang === 'zh'
                ? `每次同时展示 ${round.questionsPerBatch} 道题`
                : `Show ${round.questionsPerBatch} question${round.questionsPerBatch > 1 ? 's' : ''} at once`}
            </span>
          </div>
        </div>

        {/* ── E: Scoring ──────────────────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
            {lang === 'zh' ? 'E. 得分设置' : 'E. Scoring'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'zh' ? '答对得分' : 'Correct Score'}
              </label>
              <input
                type="number"
                value={round.scoring.correctScore}
                onChange={(e) =>
                  onUpdate({ scoring: { ...round.scoring, correctScore: Number(e.target.value) } })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'zh' ? '答错扣分' : 'Wrong Score'}
              </label>
              <input
                type="number"
                value={round.scoring.wrongScore}
                onChange={(e) =>
                  onUpdate({ scoring: { ...round.scoring, wrongScore: Number(e.target.value) } })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ContestFormPage() {
  const { contestId } = useParams<{ contestId: string }>()
  const isEditing = Boolean(contestId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { i18n } = useTranslation()
  const lang = i18n.language === 'zh' ? 'zh' : 'en'

  // ── Form state ────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<ContestMode>('team')
  const [scheduledAt, setScheduledAt] = useState('')

  const [teams, setTeams] = useState<(Omit<Team, 'id'> & { _key: string })[]>([
    { ...defaultTeam(), _key: crypto.randomUUID() },
  ])

  const [judgeIds, setJudgeIds] = useState<string[]>([])
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState<Record<string, string>>({})
  const [rounds, setRounds] = useState<FormRound[]>([defaultFormRound()])

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: contest, isLoading: contestLoading } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => contestsService.get(contestId!),
    enabled: isEditing,
  })

  const { data: myBanks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: banksService.list,
  })

  const { data: publicBanks = [] } = useQuery({
    queryKey: ['banks', 'public'],
    queryFn: banksService.listPublic,
  })

  // Merge own banks and public banks, deduplicate by id
  const banks = [...myBanks, ...publicBanks.filter((pb) => !myBanks.some((mb) => mb.id === pb.id))]

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.list,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsService.list,
    select: (data) => {
      if (Array.isArray(data)) return data
      const d = data as unknown as { tags?: Tag[]; items?: Tag[] }
      return Array.isArray(d?.tags) ? d.tags : Array.isArray(d?.items) ? d.items : []
    },
  })

  const judges = allUsers.filter((u) => u.role === 'judge' || u.role === 'super_admin')
  const participantUsers = allUsers.filter((u) => u.role === 'participant' || u.role === 'audience')

  // ── Per-bank, per-difficulty question counts ──────────────────────────────
  // null = not fetched yet, empty Record = fetched (may have zeros)
  const [bankDiffCounts, setBankDiffCounts] = useState<
    Record<string, Partial<Record<Difficulty, number>>>
  >({})

  const selectedBankIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of rounds) {
      for (const s of r.sources) {
        if (s.bankId) ids.add(s.bankId)
      }
    }
    return [...ids]
  }, [rounds])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedBankIdsKey = selectedBankIds.join(',')

  useEffect(() => {
    for (const bankId of selectedBankIds) {
      if (bankDiffCounts[bankId] !== undefined) continue
      // Mark as loading immediately to prevent double-fetch
      setBankDiffCounts((prev) => ({ ...prev, [bankId]: {} }))
      Promise.all(
        ALL_DIFFICULTIES.map(async (d) => {
          const res = await questionsService.list({ bankId, difficulty: [d], pageSize: 1 })
          return [d, res.total] as [Difficulty, number]
        })
      )
        .then((entries) => {
          setBankDiffCounts((prev) => ({
            ...prev,
            [bankId]: Object.fromEntries(entries) as Record<Difficulty, number>,
          }))
        })
        .catch(() => {
          // Leave as empty — no cap will be enforced
        })
    }
    // selectedBankIdsKey is the stable dep; selectedBankIds is derived from it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBankIdsKey])

  // ── Populate form when editing ────────────────────────────────────────────
  useEffect(() => {
    if (!contest) return
    const toIdList = (items: unknown[] | undefined): string[] =>
      (items ?? [])
        .map((item) => normalizeId(item))
        .filter((id): id is string => Boolean(id))

    setName(contest.name)
    setDescription(contest.description ?? '')
    setMode(contest.mode)
    setScheduledAt(contest.scheduledAt ? contest.scheduledAt.slice(0, 16) : '')
    setJudgeIds(toIdList(contest.judgeIds))
    setParticipantIds(toIdList(contest.participants))
    setTeams(
      contest.teams.map((t) => ({
        name: t.name,
        color: t.color,
        memberIds: toIdList(t.memberIds),
        initialScore: t.initialScore,
        _key: normalizeId(t.id) || crypto.randomUUID(),
      }))
    )
    setRounds(contest.rounds.map(contestRoundToFormRound))
  }, [contest])

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (input: CreateContestInput) => {
      if (isEditing) return contestsService.update(contestId!, input)
      return contestsService.create(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] })
      toast.success(
        lang === 'zh'
          ? isEditing ? '竞赛已更新' : '竞赛已创建'
          : isEditing ? 'Contest updated' : 'Contest created'
      )
      navigate('/contests')
    },
    onError: () => {
      toast.error(lang === 'zh' ? '保存失败，请重试' : 'Save failed. Please try again.')
    },
  })

  // ── Validation & submit ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(lang === 'zh' ? '请输入竞赛名称' : 'Contest name is required')
      return
    }
    if (mode === 'team') {
      if (teams.length === 0) {
        toast.error(lang === 'zh' ? '团队模式至少需要 1 支队伍' : 'Team mode requires at least one team')
        return
      }
      if (teams.some((t) => !t.name.trim())) {
        toast.error(lang === 'zh' ? '请填写所有队伍名称' : 'Please fill in all team names')
        return
      }
      const memberOwner = new Map<string, string>()
      for (const team of teams) {
        const teamName = team.name.trim()
        for (const memberId of team.memberIds) {
          const owner = memberOwner.get(memberId)
          if (owner && owner !== teamName) {
            toast.error(
              lang === 'zh'
                ? '同一参赛者不能同时属于多支队伍'
                : 'A participant cannot belong to multiple teams'
            )
            return
          }
          memberOwner.set(memberId, teamName)
        }
      }
    }

    // Validate rounds
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i]
      const enabledSources = r.sources.filter(
        (s) => s.bankId && s.allocations.some((a) => a.enabled && a.count > 0)
      )
      if (enabledSources.length === 0) {
        toast.error(
          lang === 'zh'
            ? `第 ${i + 1} 环节需至少选择一个题库并分配题目`
            : `Round ${i + 1} must have at least one bank source with questions`
        )
        return
      }

      // Per-difficulty capacity check
      for (const source of enabledSources) {
        const counts = bankDiffCounts[source.bankId]
        const bankName = banks.find((b) => b.id === source.bankId)?.name ?? source.bankId
        for (const alloc of source.allocations.filter((a) => a.enabled && a.count > 0)) {
          const available = counts?.[alloc.difficulty]
          if (available !== undefined && alloc.count > available) {
            const diffLabel = DIFFICULTY_LABELS[alloc.difficulty]
            toast.error(
              lang === 'zh'
                ? `第 ${i + 1} 环节：题库「${bankName}」${diffLabel.zh}难度仅有 ${available} 题，超出了所需的 ${alloc.count} 题`
                : `Round ${i + 1}: bank "${bankName}" has only ${available} ${diffLabel.en} questions (need ${alloc.count})`
            )
            return
          }
          if (available === 0) {
            const diffLabel = DIFFICULTY_LABELS[alloc.difficulty]
            toast.error(
              lang === 'zh'
                ? `第 ${i + 1} 环节：题库「${bankName}」没有${diffLabel.zh}难度的题目`
                : `Round ${i + 1}: bank "${bankName}" has no ${diffLabel.en} questions`
            )
            return
          }
        }
      }

      const enabledDiffs = getEnabledDifficulties(r)
      for (const d of enabledDiffs) {
        const t = r.timings[d]
        if (!t || t < 10) {
          toast.error(
            lang === 'zh'
              ? `第 ${i + 1} 环节：每种难度必须设置计时（至少 10 秒）`
              : `Round ${i + 1}: each difficulty needs a timer (min 10s)`
          )
          return
        }
      }

      const total = getRoundTotalCount(r)
      if (r.questionsPerBatch > total) {
        toast.error(
          lang === 'zh'
            ? `第 ${i + 1} 环节：每批题数（${r.questionsPerBatch}）不能超过总题数（${total}）`
            : `Round ${i + 1}: questions per batch (${r.questionsPerBatch}) > total (${total})`
        )
        return
      }
    }

    const input: CreateContestInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      mode,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      judgeIds,
      participants: mode === 'individual' ? participantIds : [],
      teams: mode === 'team'
        ? teams.map((t, i) => ({
            id: `team-${i}`,
            name: t.name,
            color: t.color,
            memberIds: t.memberIds,
            initialScore: t.initialScore,
          }))
        : [],
      rounds: rounds.map((r, i) => formRoundToContestRound(r, i, lang)),
    }

    saveMutation.mutate(input)
  }

  // ── Team helpers ──────────────────────────────────────────────────────────
  const addTeam = () =>
    setTeams((prev) => [...prev, { ...defaultTeam(), _key: crypto.randomUUID() }])
  const removeTeam = (key: string) => setTeams((prev) => prev.filter((t) => t._key !== key))
  const updateTeam = (key: string, patch: Partial<Omit<Team, 'id'>>) =>
    setTeams((prev) => prev.map((t) => (t._key === key ? { ...t, ...patch } : t)))

  // ── Round helpers ─────────────────────────────────────────────────────────
  const addRound = () => setRounds((prev) => [...prev, defaultFormRound()])
  const removeRound = (key: string) => setRounds((prev) => prev.filter((r) => r._key !== key))
  const updateRound = (key: string, patch: Partial<FormRound>) =>
    setRounds((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)))

  // ── Judge helpers ─────────────────────────────────────────────────────────
  const toggleJudge = (id: string) =>
    setJudgeIds((prev) =>
      prev.includes(id) ? prev.filter((j) => j !== id) : [...prev, id]
    )

  // ── Participant helpers ───────────────────────────────────────────────────
  const toggleParticipant = (id: string) =>
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )

  const toggleTeamMember = (teamKey: string, userId: string) =>
    setTeams((prev) => {
      const target = prev.find((t) => t._key === teamKey)
      if (!target) return prev
      const selectedInTarget = target.memberIds.includes(userId)
      return prev.map((team) => {
        const memberIdsWithoutUser = team.memberIds.filter((id) => id !== userId)
        if (team._key !== teamKey) return { ...team, memberIds: memberIdsWithoutUser }
        return {
          ...team,
          memberIds: selectedInTarget ? memberIdsWithoutUser : [...memberIdsWithoutUser, userId],
        }
      })
    })

  if (isEditing && contestLoading) return <Loading fullPage />

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/contests')}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isEditing
              ? lang === 'zh' ? '编辑竞赛' : 'Edit Contest'
              : lang === 'zh' ? '创建竞赛' : 'Create Contest'}
          </h1>
          <p className="text-sm text-slate-500">
            {lang === 'zh' ? '填写以下信息以配置竞赛' : 'Fill in the details to configure your contest'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* ── Section 1: Basic Info ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <SectionHeader
            icon={<BookOpen className="w-4 h-4" />}
            title={lang === 'zh' ? '基本信息' : 'Basic Info'}
            subtitle={lang === 'zh' ? '竞赛名称、描述和模式' : 'Name, description, and mode'}
          />

          <div className="flex flex-col gap-4">
            <Input
              label={lang === 'zh' ? '竞赛名称 *' : 'Contest Name *'}
              placeholder={lang === 'zh' ? '例：2024年春季数学竞赛' : 'e.g. Spring Math Competition 2024'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'zh' ? '描述' : 'Description'}
              </label>
              <textarea
                rows={3}
                placeholder={lang === 'zh' ? '竞赛简介（可选）' : 'Brief description (optional)'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
              />
            </div>

            {/* Mode radio */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'zh' ? '竞赛模式' : 'Contest Mode'}
              </label>
              <div className="flex gap-3">
                {(['team', 'individual'] as ContestMode[]).map((m) => (
                  <label
                    key={m}
                    className={clsx(
                      'flex items-center gap-2.5 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150 flex-1',
                      mode === m
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="sr-only"
                    />
                    {m === 'team' ? <Users className="w-4 h-4 shrink-0" /> : <User className="w-4 h-4 shrink-0" />}
                    <div>
                      <div className="text-sm font-medium">
                        {m === 'team'
                          ? lang === 'zh' ? '团队模式' : 'Team'
                          : lang === 'zh' ? '个人模式' : 'Individual'}
                      </div>
                      <div className="text-xs opacity-70 mt-0.5">
                        {m === 'team'
                          ? lang === 'zh' ? '多支队伍同台竞技' : 'Multiple teams compete'
                          : lang === 'zh' ? '选手单独参赛' : 'Individual participants'}
                      </div>
                    </div>
                    {mode === m && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'zh' ? '预定开始时间（可选）' : 'Scheduled Start (optional)'}
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Teams (mode=team only) ──────────────────────────── */}
        {mode === 'team' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                icon={<Users className="w-4 h-4" />}
                title={lang === 'zh' ? '参赛队伍' : 'Teams'}
                subtitle={lang === 'zh' ? '添加并配置参赛队伍' : 'Add and configure competing teams'}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={addTeam}
              >
                {lang === 'zh' ? '添加队伍' : 'Add Team'}
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {teams.map((team, idx) => (
                <div
                  key={team._key}
                  className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="mt-2 text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label={lang === 'zh' ? `队伍 ${idx + 1} 名称 *` : `Team ${idx + 1} Name *`}
                      placeholder={lang === 'zh' ? '例：红队' : 'e.g. Red Team'}
                      value={team.name}
                      onChange={(e) => updateTeam(team._key, { name: e.target.value })}
                    />

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        {lang === 'zh' ? '队伍颜色' : 'Team Color'}
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {TEAM_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.label}
                            onClick={() => updateTeam(team._key, { color: c.hex })}
                            className={clsx(
                              'w-7 h-7 rounded-lg transition-all duration-150',
                              team.color === c.hex
                                ? 'ring-2 ring-offset-2 ring-teal-500 scale-110'
                                : 'hover:scale-105'
                            )}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        {lang === 'zh' ? '初始分数' : 'Initial Score'}
                      </label>
                      <input
                        type="number"
                        value={team.initialScore}
                        onChange={(e) =>
                          updateTeam(team._key, { initialScore: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>

                    {participantUsers.length > 0 && (
                      <div className="sm:col-span-3 flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          {lang === 'zh' ? '队伍成员' : 'Team Members'}
                        </label>
                        {team.memberIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {team.memberIds.map((uid) => {
                              const u = participantUsers.find((p) => p.id === uid)
                              if (!u) return null
                              return (
                                <span key={uid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                                  {u.displayName}
                                  <button type="button" onClick={() => toggleTeamMember(team._key, uid)} className="hover:text-violet-900">
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )
                            })}
                          </div>
                        )}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder={lang === 'zh' ? '搜索用户…' : 'Search users…'}
                            value={memberSearch[team._key] ?? ''}
                            onChange={(e) => setMemberSearch((prev) => ({ ...prev, [team._key]: e.target.value }))}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 border border-slate-200 rounded-lg p-1.5 bg-white">
                          {participantUsers
                            .filter((u) => {
                              const q = (memberSearch[team._key] ?? '').toLowerCase()
                              return !q || u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
                            })
                            .map((u) => {
                              const selected = team.memberIds.includes(u.id)
                              return (
                                <label key={u.id} className={clsx('flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs', selected ? 'bg-violet-50 text-violet-700' : 'hover:bg-slate-50 text-slate-700')}>
                                  <input type="checkbox" checked={selected} onChange={() => toggleTeamMember(team._key, u.id)} className="w-3 h-3 rounded text-violet-600 border-slate-300 focus:ring-violet-500" />
                                  <span className="font-medium">{u.displayName}</span>
                                  <span className="opacity-50">@{u.username}</span>
                                </label>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {teams.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTeam(team._key)}
                      className="mt-6 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 2b: Individual Participants ────────────────────────── */}
        {mode === 'individual' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <SectionHeader
              icon={<User className="w-4 h-4" />}
              title={lang === 'zh' ? '参赛选手' : 'Participants'}
              subtitle={lang === 'zh' ? '预先录入参赛选手账号' : 'Pre-register contestant accounts'}
            />

            {participantUsers.length === 0 ? (
              <p className="text-sm text-slate-400">
                {lang === 'zh' ? '暂无参赛者账号' : 'No participant accounts found'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {participantIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {participantIds.map((id) => {
                      const u = participantUsers.find((p) => p.id === id)
                      if (!u) return null
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-sm font-medium">
                          {u.displayName}
                          <button type="button" onClick={() => toggleParticipant(id)} className="hover:text-violet-900 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={lang === 'zh' ? '搜索用户…' : 'Search users…'}
                    value={memberSearch['__individual__'] ?? ''}
                    onChange={(e) => setMemberSearch((prev) => ({ ...prev, '__individual__': e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {participantUsers
                    .filter((u) => {
                      const q = (memberSearch['__individual__'] ?? '').toLowerCase()
                      return !q || u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
                    })
                    .map((u) => {
                      const selected = participantIds.includes(u.id)
                      return (
                        <label key={u.id} className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150', selected ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
                          <input type="checkbox" checked={selected} onChange={() => toggleParticipant(u.id)} className="w-4 h-4 rounded text-violet-600 border-slate-300 focus:ring-violet-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{u.displayName}</p>
                            <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                          </div>
                        </label>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section 3: Judges ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <SectionHeader
            icon={<Gavel className="w-4 h-4" />}
            title={lang === 'zh' ? '裁判员' : 'Judges'}
            subtitle={lang === 'zh' ? '选择负责计分的裁判员' : 'Select judges who will manage scoring'}
          />

          {judges.length === 0 ? (
            <p className="text-sm text-slate-400">
              {lang === 'zh' ? '暂无裁判员账号' : 'No judge accounts found'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {judgeIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {judgeIds.map((id) => {
                    const judge = judges.find((j) => j.id === id)
                    if (!judge) return null
                    return (
                      <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-medium">
                        {judge.displayName}
                        <button type="button" onClick={() => toggleJudge(id)} className="hover:text-teal-900 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {judges.map((judge) => {
                  const selected = judgeIds.includes(judge.id)
                  return (
                    <label
                      key={judge.id}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150',
                        selected ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleJudge(judge.id)}
                        className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{judge.displayName}</p>
                        <p className="text-xs text-slate-400 truncate">{judge.username}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Section 4: Rounds ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader
              icon={<Layers className="w-4 h-4" />}
              title={lang === 'zh' ? '竞赛环节' : 'Rounds'}
              subtitle={lang === 'zh' ? '配置题库来源、难度分配与计时规则' : 'Configure banks, difficulty allocation, and timers'}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={addRound}
            >
              {lang === 'zh' ? '添加环节' : 'Add Round'}
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {rounds.map((round, idx) => (
              <RoundCard
                key={round._key}
                round={round}
                idx={idx}
                banks={banks}
                bankDiffCounts={bankDiffCounts}
                allTags={allTags}
                canRemove={rounds.length > 1}
                lang={lang}
                onUpdate={(patch) => updateRound(round._key, patch)}
                onRemove={() => removeRound(round._key)}
              />
            ))}
          </div>
        </div>

        {/* ── Submit bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2 pb-8">
          <Button type="button" variant="ghost" onClick={() => navigate('/contests')}>
            {lang === 'zh' ? '取消' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saveMutation.isPending}
            size="lg"
          >
            {saveMutation.isPending
              ? lang === 'zh' ? '保存中…' : 'Saving…'
              : isEditing
              ? lang === 'zh' ? '保存修改' : 'Save Changes'
              : lang === 'zh' ? '创建竞赛' : 'Create Contest'}
          </Button>
        </div>
      </form>
    </div>
  )
}
