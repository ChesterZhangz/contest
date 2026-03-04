import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { UserPlus, MoreVertical, Pencil, Trash2, ShieldCheck, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Loading } from '@/components/ui/Loading'
import { useToast } from '@/hooks/useToast'
import { usersService } from '@/services/users'
import type { User, UserRole } from '@/types'
import type { CreateUserInput, UpdateUserInput } from '@/services/users'

// ── Role badge variants ───────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  super_admin: 'error',
  host: 'purple',
  judge: 'info',
  participant: 'success',
  audience: 'default',
}

const ROLE_VALUES: UserRole[] = ['super_admin', 'host', 'judge', 'participant', 'audience']

// ── Form Types ────────────────────────────────────────────────────────────

interface UserFormValues {
  username: string
  displayName: string
  role: UserRole
  email: string
}

// ── Row actions dropdown ──────────────────────────────────────────────────

interface RowMenuProps {
  user: User
  onEdit: () => void
  onDelete: () => void
  onResendInvite: () => void
}

function RowMenu({ user, onEdit, onDelete, onResendInvite }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white border border-slate-100 rounded-xl shadow-float w-48 py-1 text-sm">
          <button
            onClick={() => { setOpen(false); onEdit() }}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t('users.edit')}
          </button>
          {user.email && (
            <button
              onClick={() => { setOpen(false); onResendInvite() }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700"
            >
              <Mail className="w-3.5 h-3.5" />
              {t('users.resendInvite')}
            </button>
          )}
          <div className="h-px bg-slate-100 mx-2 my-1" />
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('users.delete')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  // ── Data ────────────────────────────────────────────────────────────────

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.list,
  })

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => usersService.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(variables.email ? t('users.createSuccessWithEmail') : t('users.createSuccess'))
      setCreateOpen(false)
    },
    onError: (err: unknown) => {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : t('users.createError')
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      usersService.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('users.updateSuccess'))
      setEditUser(null)
    },
    onError: () => toast.error(t('users.updateError')),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersService.update(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: () => toast.error(t('users.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.disable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('users.disableSuccess'))
      setDeleteUser(null)
    },
    onError: () => toast.error(t('users.disableError')),
  })

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) => usersService.resendInvite(id),
    onSuccess: () => toast.success(t('users.inviteSent')),
    onError: () => toast.error(t('users.inviteError')),
  })

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t('users.title')}</h1>
            <p className="text-xs text-slate-500">User Management</p>
          </div>
        </div>
        <Button
          variant="primary"
          icon={<UserPlus className="w-4 h-4" />}
          onClick={() => setCreateOpen(true)}
        >
          {t('users.createUser')}
        </Button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <UserPlus className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">{t('users.noUsers')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                    {t('users.username')}
                  </th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                    {t('users.displayName')}
                  </th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                    {t('users.role')}
                  </th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                    {t('users.email')}
                  </th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                    {t('users.status')}
                  </th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {user.username}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{user.displayName}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={ROLE_VARIANT[user.role]}>
                        {t(`role.${user.role}`)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{user.email ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
                          user.isActive !== false ? 'bg-teal-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            user.isActive !== false ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <RowMenu
                        user={user}
                        onEdit={() => setEditUser(user)}
                        onDelete={() => setDeleteUser(user)}
                        onResendInvite={() => resendInviteMutation.mutate(user.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <UserFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        onSubmit={(values) => {
          createMutation.mutate({
            username: values.username,
            displayName: values.displayName,
            role: values.role,
            email: values.email || undefined,
          })
        }}
        loading={createMutation.isPending}
      />

      {/* Edit Modal */}
      {editUser && (
        <UserFormModal
          open={!!editUser}
          onClose={() => setEditUser(null)}
          mode="edit"
          defaultValues={{
            username: editUser.username,
            displayName: editUser.displayName,
            role: editUser.role,
            email: editUser.email ?? '',
          }}
          onSubmit={(values) => {
            updateMutation.mutate({
              id: editUser.id,
              input: {
                displayName: values.displayName,
                role: values.role,
                email: values.email || undefined,
              },
            })
          }}
          loading={updateMutation.isPending}
        />
      )}

      {/* Disable Confirm */}
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
        title={t('users.disableUser')}
        message={t('users.disableConfirm', { name: deleteUser?.username ?? '' })}
        confirmLabel={t('users.disable')}
        cancelLabel={t('common.cancel')}
        loading={deleteMutation.isPending}
        danger
      />
    </div>
  )
}

// ── User Form Modal ───────────────────────────────────────────────────────

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  defaultValues?: Partial<UserFormValues>
  onSubmit: (values: UserFormValues) => void
  loading: boolean
}

function UserFormModal({ open, onClose, mode, defaultValues, onSubmit, loading }: UserFormModalProps) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UserFormValues>({
    defaultValues: {
      username: '',
      displayName: '',
      role: 'participant',
      email: '',
      ...defaultValues,
    },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={mode === 'create' ? t('users.createUser') : t('users.editUser')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit(onSubmit)}>
            {mode === 'create' ? t('common.create') : t('common.save')}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Username — create only */}
        {mode === 'create' && (
          <Input
            label={t('users.username')}
            placeholder="e.g. john_doe"
            error={errors.username?.message}
            {...register('username', {
              required: t('users.usernameRequired'),
              minLength: { value: 3, message: t('users.usernameMin') },
              maxLength: { value: 64, message: t('users.usernameMax') },
            })}
          />
        )}

        <Input
          label={t('users.displayName')}
          placeholder="e.g. John Doe"
          error={errors.displayName?.message}
          {...register('displayName', {
            required: t('users.displayNameRequired'),
          })}
        />

        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">{t('users.role')}</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors appearance-none"
            {...register('role', { required: true })}
          >
            {ROLE_VALUES.map((role) => (
              <option key={role} value={role}>
                {t(`role.${role}`)}
              </option>
            ))}
          </select>
          {errors.role && (
            <p className="text-xs text-red-500">{t('users.roleRequired')}</p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Input
            label={`${t('users.email')} (${t('common.optional')})`}
            type="email"
            placeholder="email@example.com"
            error={errors.email?.message}
            {...register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t('users.emailInvalid'),
              },
            })}
          />
          {mode === 'create' && (
            <p className="text-xs text-indigo-500 flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3 h-3 shrink-0" />
              {t('users.emailWelcomeHint')}
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
