import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  Lock,
  Globe,
  Hash,
  Calendar,
  Library,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Loading } from '@/components/ui/Loading'
import { useToast } from '@/hooks/useToast'
import { banksService } from '@/services/banks'
import type { CreateBankInput } from '@/services/banks'
import { useAuthStore } from '@/store/auth'
import type { QuestionBank } from '@/types'

// ── Switch component ──────────────────────────────────────────────────────

interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}

function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-teal-600' : 'bg-slate-200'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  )
}

// ── Bank Card ─────────────────────────────────────────────────────────────

interface BankCardProps {
  bank: QuestionBank
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}

function BankCard({ bank, canManage, onEdit, onDelete }: BankCardProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const createdDate = new Date(bank.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className={clsx(
        'group bg-white rounded-2xl border border-slate-200 shadow-sm',
        'hover:shadow-md hover:border-teal-200 transition-all duration-200',
        'flex flex-col gap-3 p-5'
      )}
    >
      {/* Header: title + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 text-base leading-snug truncate">
            {bank.name}
          </h3>
          {bank.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {bank.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Question count */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
            <Hash className="w-3 h-3" />
            {bank.questionCount} {t('banks.questions', '题')}
          </span>
          {/* Public/Private badge */}
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
              bank.isPublic
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            )}
          >
            {bank.isPublic ? (
              <>
                <Globe className="w-3 h-3" />
                {t('banks.public', '公开')}
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                {t('banks.private', '私有')}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Tags */}
      {bank.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bank.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
            >
              {tag}
            </span>
          ))}
          {bank.tags.length > 5 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-xs">
              +{bank.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-auto">
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Calendar className="w-3 h-3" />
          {createdDate}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/banks/${bank.id}`)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
              'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
              'transition-colors duration-150 shadow-sm'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {t('banks.viewQuestions', '查看题目')}
          </button>
          {canManage && (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors duration-150"
                title={t('common.edit', '编辑')}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150"
                title={t('common.delete', '删除')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────

function EmptyBanks({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
        <Library className="w-8 h-8 text-teal-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        {t('banks.empty.title', '暂无题库')}
      </h3>
      <p className="text-sm text-slate-400 mb-5 max-w-xs">
        {t('banks.empty.desc', '创建你的第一个题库，开始添加数学竞赛题目')}
      </p>
      <Button onClick={onCreate} icon={<Plus className="w-4 h-4" />}>
        {t('banks.create', '创建题库')}
      </Button>
    </div>
  )
}

// ── Bank Form Modal ───────────────────────────────────────────────────────

interface BankFormValues {
  name: string
  description: string
  isPublic: boolean
}

interface BankFormModalProps {
  open: boolean
  onClose: () => void
  bank?: QuestionBank | null
}

function BankFormModal({ open, onClose, bank }: BankFormModalProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isEdit = !!bank

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<BankFormValues>({
    defaultValues: {
      name: bank?.name ?? '',
      description: bank?.description ?? '',
      isPublic: bank?.isPublic ?? false,
    },
  })

  // Reset form when modal opens or when editing target changes.
  useEffect(() => {
    if (!open) return
    reset({
      name: bank?.name ?? '',
      description: bank?.description ?? '',
      isPublic: bank?.isPublic ?? false,
    })
  }, [open, bank, reset])

  const createMutation = useMutation({
    mutationFn: (input: CreateBankInput) => banksService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] })
      toast.success(t('banks.created', '题库已创建'))
      onClose()
    },
    onError: () => toast.error(t('banks.createError', '创建失败，请重试')),
  })

  const updateMutation = useMutation({
    mutationFn: (input: Partial<CreateBankInput>) =>
      banksService.update(bank!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] })
      toast.success(t('banks.updated', '题库已更新'))
      onClose()
    },
    onError: () => toast.error(t('banks.updateError', '更新失败，请重试')),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: BankFormValues) => {
    const input: CreateBankInput = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      isPublic: values.isPublic,
    }
    if (isEdit) {
      updateMutation.mutate(input)
    } else {
      createMutation.mutate(input)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('banks.editBank', '编辑题库') : t('banks.createBank', '创建题库')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isPending}
          >
            {isEdit ? t('common.save', '保存') : t('banks.create', '创建')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={`${t('banks.name', '题库名称')} *`}
          placeholder={t('banks.namePlaceholder', '例如：2024年全国联赛题库')}
          error={errors.name?.message}
          {...register('name', {
            required: t('banks.nameRequired', '请输入题库名称'),
            minLength: { value: 2, message: t('banks.nameTooShort', '名称至少2个字符') },
          })}
        />
        <Textarea
          label={t('banks.description', '描述（可选）')}
          placeholder={t('banks.descPlaceholder', '简要描述这个题库的内容和适用场景…')}
          rows={3}
          {...register('description')}
        />
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {t('banks.publicLabel', '公开题库')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('banks.publicDesc', '公开后主持人和管理员可浏览此题库')}
            </p>
          </div>
          <Controller
            name="isPublic"
            control={control}
            render={({ field }) => (
              <Switch checked={field.value} onChange={field.onChange} />
            )}
          />
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

type Tab = 'my' | 'public'

export default function BanksPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const userRole = useAuthStore((s) => s.user?.role ?? 'audience')
  const canSeePublicBanks = userRole === 'super_admin' || userRole === 'host'

  const [tab, setTab] = useState<Tab>('my')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null)
  const [deletingBank, setDeletingBank] = useState<QuestionBank | null>(null)

  // Queries
  const myBanksQuery = useQuery({
    queryKey: ['banks', 'mine'],
    queryFn: () => banksService.list(),
  })

  const publicBanksQuery = useQuery({
    queryKey: ['banks', 'public'],
    queryFn: () => banksService.listPublic(),
    enabled: tab === 'public',
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => banksService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] })
      toast.success(t('banks.deleted', '题库已删除'))
      setDeletingBank(null)
    },
    onError: () => toast.error(t('banks.deleteError', '删除失败，请重试')),
  })

  const openCreate = () => {
    setEditingBank(null)
    setModalOpen(true)
  }

  const openEdit = (bank: QuestionBank) => {
    setEditingBank(bank)
    setModalOpen(true)
  }

  const activeData = tab === 'my' ? myBanksQuery : publicBanksQuery
  const banks = activeData.data ?? []
  const isLoading = activeData.isLoading

  // If user lost permission mid-session, fall back to 'my'
  useEffect(() => {
    if (tab === 'public' && !canSeePublicBanks) setTab('my')
  }, [tab, canSeePublicBanks])

  const tabs: { key: Tab; label: string; labelEn: string }[] = [
    { key: 'my', label: '我的题库', labelEn: 'My Banks' },
    ...(canSeePublicBanks
      ? [{ key: 'public' as Tab, label: '公开题库', labelEn: 'Public Banks' }]
      : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {t('banks.title', '题库管理')}
            <span className="ml-2 text-sm font-normal text-slate-400">Question Banks</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('banks.subtitle', '管理和组织你的数学竞赛题目集合')}
          </p>
        </div>
        <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
          {t('banks.create', '创建题库')}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 shrink-0">
        {tabs.map((tab_) => (
          <button
            key={tab_.key}
            onClick={() => setTab(tab_.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150',
              tab === tab_.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {tab_.label}
            <span
              className={clsx(
                'text-xs',
                tab === tab_.key ? 'text-teal-200' : 'text-slate-400'
              )}
            >
              {tab_.labelEn}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loading />
          </div>
        ) : banks.length === 0 ? (
          <EmptyBanks onCreate={openCreate} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {banks.map((bank) => (
              <BankCard
                key={bank.id}
                bank={bank}
                canManage={String(bank.ownerId) === String(userId)}
                onEdit={() => openEdit(bank)}
                onDelete={() => setDeletingBank(bank)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <BankFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingBank(null)
        }}
        bank={editingBank}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deletingBank}
        onClose={() => setDeletingBank(null)}
        onConfirm={() => deletingBank && deleteMutation.mutate(deletingBank.id)}
        title={t('banks.deleteTitle', '删除题库')}
        message={t(
          'banks.deleteConfirm',
          `确认删除题库「${deletingBank?.name}」？此操作将同时删除库内所有题目，且不可撤销。`
        )}
        confirmLabel={t('common.delete', '删除')}
        cancelLabel={t('common.cancel', '取消')}
        loading={deleteMutation.isPending}
        danger
      />
    </div>
  )
}
