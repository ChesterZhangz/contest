import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { TagInput } from '@/components/ui/TagInput'
import { MathEditor } from '@/components/math/MathEditor'
import { QuestionRenderer } from '@/components/math/MathRenderer'
import { DifficultyBadge } from '@/components/question/DifficultyBadge'
import { questionsService } from '@/services/questions'
import type { CreateQuestionInput, UpdateQuestionInput } from '@/services/questions'
import type { Question, QuestionType, Difficulty, QuestionChoice } from '@/types'
import { DIFFICULTY_LABELS } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

interface ChoiceField {
  label: string
  content: string
}

interface FormValues {
  type: QuestionType
  difficulty: Difficulty
  content: string
  choices: ChoiceField[]
  correctChoice: string
  answer: string
  solution: string
  tags: string[]
  source: string
}

export interface QuestionFormModalProps {
  bankId: string
  question?: Question
  onSave: (q: Question) => void
  onClose: () => void
}

// ── Choice Editor ─────────────────────────────────────────────────────────

interface ChoiceEditorProps {
  label: string
  value: string
  onChange: (v: string) => void
  isCorrect: boolean
  onSetCorrect: () => void
  onRemove: () => void
  canRemove: boolean
}

function ChoiceEditor({
  label,
  value,
  onChange,
  isCorrect,
  onSetCorrect,
  onRemove,
  canRemove,
}: ChoiceEditorProps) {
  return (
    <div
      className={clsx(
        'flex items-start gap-2 p-3 rounded-xl border transition-colors duration-150',
        isCorrect
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      {/* Correct radio */}
      <button
        type="button"
        onClick={onSetCorrect}
        title="设为正确答案"
        className={clsx(
          'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150',
          isCorrect
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-slate-300 hover:border-emerald-400'
        )}
      >
        {isCorrect && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>

      {/* Label */}
      <span
        className={clsx(
          'mt-0.5 w-5 shrink-0 text-sm font-bold',
          isCorrect ? 'text-emerald-700' : 'text-slate-500'
        )}
      >
        {label}
      </span>

      {/* Content input (single-line with LaTeX support via textarea rows=1) */}
      <div className="flex-1 min-w-0">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          placeholder={`选项 ${label} 内容，支持 $LaTeX$`}
          className={clsx(
            'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5',
            'text-sm font-mono text-slate-800 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400',
            'transition-colors resize-none leading-relaxed'
          )}
        />
        {value && (
          <div className="mt-1 px-1 text-sm text-slate-600">
            <QuestionRenderer content={value} />
          </div>
        )}
      </div>

      {/* Remove */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-0.5 p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Live Preview Panel ─────────────────────────────────────────────────────

interface PreviewPanelProps {
  values: FormValues
}

function PreviewPanel({ values }: PreviewPanelProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en'

  const diffLabel = DIFFICULTY_LABELS[values.difficulty]
  const typeLabel =
    values.type === 'multiple_choice'
      ? t('questions.multiple_choice', '选择题')
      : t('questions.short_answer', '简答题')

  return (
    <div className="h-full flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {t('questions.preview', '预览')} · Preview
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
            {typeLabel}
          </span>
          <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', diffLabel.color)}>
            {diffLabel[lang]}
          </span>
          {values.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
            >
              {tag}
            </span>
          ))}
          {values.source && (
            <span className="text-xs text-slate-400">{values.source}</span>
          )}
        </div>

        {/* Question content */}
        {values.content ? (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <QuestionRenderer content={values.content} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 italic">
            {t('questions.contentPlaceholder', '题目内容将显示在这里…')}
          </div>
        )}

        {/* Choices */}
        {values.type === 'multiple_choice' && values.choices.length > 0 && (
          <div className="space-y-2">
            {values.choices.map((ch, i) => (
              <div
                key={i}
                className={clsx(
                  'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-sm',
                  ch.label === values.correctChoice
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white'
                )}
              >
                <span
                  className={clsx(
                    'font-bold shrink-0 w-5',
                    ch.label === values.correctChoice
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  )}
                >
                  {ch.label}.
                </span>
                <QuestionRenderer content={ch.content || `选项 ${ch.label}`} />
              </div>
            ))}
          </div>
        )}

        {/* Answer */}
        {values.answer && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              {t('questions.answer', '答案')}
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <QuestionRenderer content={values.answer} />
            </div>
          </div>
        )}

        {/* Solution */}
        {values.solution && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              {t('questions.solution', '解析')}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <QuestionRenderer content={values.solution} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────

export function QuestionFormModal({
  bankId,
  question,
  onSave,
  onClose,
}: QuestionFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!question

  const defaultChoices: ChoiceField[] = question?.choices?.map((c) => ({
    label: c.label,
    content: c.content,
  })) ?? [
    { label: 'A', content: '' },
    { label: 'B', content: '' },
    { label: 'C', content: '' },
    { label: 'D', content: '' },
  ]

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      type: question?.type ?? 'multiple_choice',
      difficulty: question?.difficulty ?? 3,
      content: question?.content ?? '',
      choices: defaultChoices,
      correctChoice: question?.correctChoice ?? 'A',
      answer: question?.answer ?? '',
      solution: question?.solution ?? '',
      tags: question?.tags ?? [],
      source: question?.source ?? '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'choices',
  })

  const watchedType = watch('type')
  const watchedCorrectChoice = watch('correctChoice')
  const watchedAll = watch()

  // When type changes to multiple_choice, auto-set answer from correctChoice
  const watchedChoices = watch('choices')
  useEffect(() => {
    if (watchedType === 'multiple_choice') {
      const correct = watchedChoices.find((c) => c.label === watchedCorrectChoice)
      if (correct) {
        setValue('answer', `${watchedCorrectChoice}. ${correct.content}`)
      }
    }
  }, [watchedCorrectChoice, watchedChoices, watchedType, setValue])

  const createMutation = useMutation({
    mutationFn: (input: CreateQuestionInput) => questionsService.create(input),
    onSuccess: (q) => onSave(q),
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateQuestionInput) =>
      questionsService.update(question!.id, input),
    onSuccess: (q) => onSave(q),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: FormValues) => {
    const choices: QuestionChoice[] =
      values.type === 'multiple_choice'
        ? values.choices.map((c) => ({ label: c.label, content: c.content }))
        : []

    const input = {
      bankId,
      content: values.content,
      answer: values.answer,
      solution: values.solution || undefined,
      type: values.type,
      difficulty: values.difficulty,
      tags: values.tags,
      choices: values.type === 'multiple_choice' ? choices : undefined,
      correctChoice:
        values.type === 'multiple_choice' ? values.correctChoice : undefined,
      source: values.source || undefined,
    }

    if (isEdit) {
      const { bankId: _b, ...updateInput } = input
      updateMutation.mutate(updateInput)
    } else {
      createMutation.mutate(input)
    }
  }

  const addChoice = () => {
    if (fields.length >= 6) return
    const nextLabel = CHOICE_LABELS[fields.length]
    append({ label: nextLabel, content: '' })
  }

  const removeChoice = (index: number) => {
    if (fields.length <= 2) return
    const prevCorrect = watchedCorrectChoice
    remove(index)
    // Re-label remaining
    const remaining = watchedChoices.filter((_, i) => i !== index)
    remaining.forEach((_, i) => {
      setValue(`choices.${i}.label`, CHOICE_LABELS[i])
    })

    const prevCorrectIndex = CHOICE_LABELS.indexOf(prevCorrect)
    if (prevCorrectIndex === -1) return

    if (prevCorrectIndex === index) {
      const fallbackIndex = Math.min(index, remaining.length - 1)
      setValue('correctChoice', CHOICE_LABELS[fallbackIndex])
      return
    }

    if (prevCorrectIndex > index) {
      setValue('correctChoice', CHOICE_LABELS[prevCorrectIndex - 1])
    }
  }

  const difficultyOptions = ([1, 2, 3, 4, 5] as Difficulty[]).map((d) => ({
    value: d,
    label: `${d} - ${DIFFICULTY_LABELS[d].zh} / ${DIFFICULTY_LABELS[d].en}`,
  }))

  const typeOptions = [
    { value: 'multiple_choice', label: `${t('questions.multiple_choice', '选择题')} Multiple Choice` },
    { value: 'short_answer', label: `${t('questions.short_answer', '简答题')} Short Answer` },
  ]

  const mutationError =
    (createMutation.error as Error)?.message ||
    (updateMutation.error as Error)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel – wide two-column layout */}
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {isEdit
                ? t('questions.editQuestion', '编辑题目')
                : t('questions.newQuestion', '新建题目')}
              <span className="ml-2 text-sm font-normal text-slate-400">
                {isEdit ? 'Edit Question' : 'New Question'}
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Form */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">
            {/* Row: type + difficulty */}
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t('questions.type', '题目类型')}
                    options={typeOptions}
                    value={field.value}
                    onChange={(v) => field.onChange(v as QuestionType)}
                  />
                )}
              />
              <Controller
                name="difficulty"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      {t('questions.difficulty', '难度')}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value) as Difficulty)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                      >
                        {difficultyOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <DifficultyBadge difficulty={field.value} />
                    </div>
                  </div>
                )}
              />
            </div>

            {/* Content */}
            <Controller
              name="content"
              control={control}
              rules={{ required: t('questions.contentRequired', '请输入题目内容') }}
              render={({ field }) => (
                <MathEditor
                  label={`${t('questions.content', '题目内容')} *`}
                  value={field.value}
                  onChange={field.onChange}
                  rows={6}
                  error={errors.content?.message}
                  placeholder="输入题目内容，支持 LaTeX 公式：$x^2 + y^2 = r^2$"
                />
              )}
            />

            {/* Multiple choice: choices */}
            {watchedType === 'multiple_choice' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {t('questions.choices', '选项')}
                  <span className="ml-1 text-xs text-slate-400">
                    {t('questions.correctChoiceHint', '点击圆圈设置正确答案')}
                  </span>
                </label>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <Controller
                      key={field.id}
                      name={`choices.${index}.content`}
                      control={control}
                      render={({ field: f }) => (
                        <ChoiceEditor
                          label={CHOICE_LABELS[index]}
                          value={f.value}
                          onChange={f.onChange}
                          isCorrect={watchedCorrectChoice === CHOICE_LABELS[index]}
                          onSetCorrect={() =>
                            setValue('correctChoice', CHOICE_LABELS[index])
                          }
                          onRemove={() => removeChoice(index)}
                          canRemove={fields.length > 2}
                        />
                      )}
                    />
                  ))}
                </div>
                {fields.length < 6 && (
                  <button
                    type="button"
                    onClick={addChoice}
                    className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('questions.addChoice', '添加选项')} (max 6)
                  </button>
                )}
              </div>
            )}

            {/* Answer */}
            <Controller
              name="answer"
              control={control}
              rules={{ required: t('questions.answerRequired', '请输入答案') }}
              render={({ field }) => (
                <MathEditor
                  label={`${t('questions.answer', '答案')} *`}
                  value={field.value}
                  onChange={field.onChange}
                  rows={watchedType === 'multiple_choice' ? 2 : 4}
                  error={errors.answer?.message}
                  placeholder={
                    watchedType === 'multiple_choice'
                      ? '选择题答案自动填充'
                      : '输入详细答案，支持 LaTeX'
                  }
                />
              )}
            />

            {/* Solution */}
            <Controller
              name="solution"
              control={control}
              render={({ field }) => (
                <MathEditor
                  label={t('questions.solution', '解析（可选）')}
                  value={field.value}
                  onChange={field.onChange}
                  rows={4}
                  placeholder="详细解题过程，支持 LaTeX 公式…"
                />
              )}
            />

            {/* Tags + source */}
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <TagInput
                    label={t('questions.tags', '标签')}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="代数、几何…"
                  />
                )}
              />
              <Input
                label={t('questions.source', '来源（可选）')}
                placeholder="例如：2023年全国联赛"
                {...register('source')}
              />
            </div>

            {/* Error */}
            {mutationError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                {mutationError}
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="w-96 shrink-0 border-l border-slate-100 p-4 overflow-hidden flex flex-col">
            <PreviewPanel values={watchedAll} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel', '取消')}
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isPending}>
            {isEdit ? t('common.save', '保存') : t('questions.create', '创建题目')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Default export as well for route usage
export default QuestionFormModal
