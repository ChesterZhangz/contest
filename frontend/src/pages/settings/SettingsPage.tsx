import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, X, Plus, Save, Loader2, Globe, AlertCircle, CheckCircle2 } from 'lucide-react'
import { settingsService } from '@/services/settings'
import { useToast } from '@/hooks/useToast'

export default function SettingsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Fetch current settings ──────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
  })

  // Local editable copy of domains
  const [domains, setDomains] = useState<string[]>([])
  const [defaultBonusDelta, setDefaultBonusDelta] = useState<number>(1)
  const [defaultPenaltyDelta, setDefaultPenaltyDelta] = useState<number>(-1)
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!data) return
    setDomains(data.allowedEmailDomains)
    setDefaultBonusDelta(data.defaultBonusDelta)
    setDefaultPenaltyDelta(data.defaultPenaltyDelta)
  }, [data])

  // ── Save mutation ────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () =>
      settingsService.update({
        allowedEmailDomains: domains,
        defaultBonusDelta,
        defaultPenaltyDelta,
      }),
    onSuccess: (updated) => {
      setDomains(updated.allowedEmailDomains)
      setDefaultBonusDelta(updated.defaultBonusDelta)
      setDefaultPenaltyDelta(updated.defaultPenaltyDelta)
      queryClient.setQueryData(['settings'], updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast.success(t('settings.savedSuccess', '设置已保存'))
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('settings.saveError', '保存失败，请重试')
      toast.error(msg)
    },
  })

  // ── Domain management helpers ────────────────────────────────────────────
  const addDomain = () => {
    const raw = inputValue.trim().toLowerCase().replace(/^@/, '')
    if (!raw) return

    // Basic domain validation
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(raw)) {
      setInputError(t('settings.invalidDomain', '请输入有效的域名，例如 school.edu'))
      return
    }
    if (domains.includes(raw)) {
      setInputError(t('settings.domainExists', '该域名已在列表中'))
      return
    }
    setDomains((prev) => [...prev, raw])
    setInputValue('')
    setInputError(null)
    inputRef.current?.focus()
  }

  const removeDomain = (domain: string) => {
    setDomains((prev) => prev.filter((d) => d !== domain))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addDomain()
    }
    if (e.key === 'Escape') {
      setInputValue('')
      setInputError(null)
    }
  }

  const isDirty =
    JSON.stringify(domains) !== JSON.stringify(data?.allowedEmailDomains ?? []) ||
    defaultBonusDelta !== (data?.defaultBonusDelta ?? 1) ||
    defaultPenaltyDelta !== (data?.defaultPenaltyDelta ?? -1)

  const handleSave = () => {
    if (!Number.isFinite(defaultBonusDelta) || defaultBonusDelta < 1) {
      toast.error(t('settings.invalidBonusDelta', '加分底分必须大于 0'))
      return
    }
    if (!Number.isFinite(defaultPenaltyDelta) || defaultPenaltyDelta > -1) {
      toast.error(t('settings.invalidPenaltyDelta', '扣分底分必须小于 0'))
      return
    }
    mutation.mutate()
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {t('settings.title', '系统设置')}
          </h1>
          <p className="text-xs text-slate-500">System Settings</p>
        </div>
      </div>

      {/* ── Email domain whitelist card ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {t('settings.allowedDomainsTitle', '注册邮箱域名白名单')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t(
                'settings.allowedDomainsDesc',
                '只有以下域名的邮箱才能自助注册账号。留空则允许所有邮箱域名。',
              )}
            </p>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Current domains */}
              <div className="mb-5">
                {domains.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 italic py-2">
                    <Globe className="w-4 h-4" />
                    {t('settings.noDomains', '暂无限制，所有邮箱域名均可注册')}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {domains.map((domain) => (
                      <span
                        key={domain}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium pl-3 pr-2 py-1.5 rounded-xl"
                      >
                        <span className="text-indigo-400 font-normal">@</span>
                        {domain}
                        <button
                          type="button"
                          onClick={() => removeDomain(domain)}
                          className="ml-0.5 p-0.5 rounded-md text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-colors"
                          aria-label={`Remove @${domain}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Add domain input */}
              <div className="flex gap-2 items-start">
                <div className="flex-1 flex flex-col gap-1">
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-400 text-sm select-none pointer-events-none">
                      @
                    </span>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={t('settings.domainPlaceholder', 'school.edu')}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value)
                        setInputError(null)
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                  {inputError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-500">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {inputError}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addDomain}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  {t('settings.addDomain', '添加')}
                </button>
              </div>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                {t(
                  'settings.domainHint',
                  '输入域名后按 Enter 或点击"添加"。支持多个域名，例如：school.edu、corp.com',
                )}
              </p>

              {/* Scoring defaults */}
              <div className="h-px bg-slate-100 my-6" />
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-1">
                  {t('settings.scoreDefaultsTitle', '计分默认值（裁判加减分）')}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  {t(
                    'settings.scoreDefaultsDesc',
                    '用于裁判面板的“加分/减分”快捷按钮，答对/答错仍使用每轮规则分值。',
                  )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-600 font-medium">
                      {t('settings.defaultBonusDelta', '默认加分')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={defaultBonusDelta}
                      onChange={(e) => setDefaultBonusDelta(Math.trunc(Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-600 font-medium">
                      {t('settings.defaultPenaltyDelta', '默认扣分')}
                    </label>
                    <input
                      type="number"
                      max={-1}
                      step={1}
                      value={defaultPenaltyDelta}
                      onChange={(e) => setDefaultPenaltyDelta(Math.trunc(Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-100 my-6" />

              {/* Save button */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {isDirty
                    ? t('settings.unsavedChanges', '有未保存的更改')
                    : saved
                      ? t('settings.upToDate', '所有设置已是最新')
                      : ''}
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={mutation.isPending || (!isDirty && !saved)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-sm shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  {mutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t('common.saving', '保存中…')}</>
                  ) : saved ? (
                    <><CheckCircle2 className="w-4 h-4" />{t('settings.saved', '已保存')}</>
                  ) : (
                    <><Save className="w-4 h-4" />{t('settings.save', '保存设置')}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
