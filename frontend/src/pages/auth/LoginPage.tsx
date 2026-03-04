import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, AlertCircle, CheckCircle, ArrowRight, Loader2, User, ChevronLeft } from 'lucide-react'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'
import { AppLogo } from '@/components/ui/AppLogo'

function isDomainAllowed(email: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return allowedDomains.includes(domain)
}

// Three steps:
//   email  — user enters email
//   name   — new user, needs display name before we can register
//   sent   — link sent, check inbox
type Step = 'email' | 'name' | 'sent'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])

  const isZh = i18n.language?.startsWith('zh')

  useEffect(() => {
    settingsService.getPublic().then((s) => setAllowedDomains(s.allowedEmailDomains)).catch(() => {})
  }, [])

  const toggleLang = () => i18n.changeLanguage(isZh ? 'en' : 'zh')

  // ── Step 1: submit email ──────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) { setError(t('auth.emailRequired')); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError(t('auth.emailInvalid')); return }
    if (!isDomainAllowed(trimmed, allowedDomains)) {
      setError(
        allowedDomains.length
          ? `${t('auth.emailDomainNotAllowed')} ${allowedDomains.map(d => `@${d}`).join('、')}`
          : t('auth.emailInvalid'),
      )
      return
    }
    setError(null)
    setLoading(true)
    try {
      const result = await authService.magicLink(trimmed)
      // Existing user → link sent immediately
      // New user without name → show name step
      if (result.isNewUser && result.needsName) {
        setStep('name')
      } else {
        setStep('sent')
      }
    } catch (err: unknown) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('auth.sendError'),
      )
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: submit display name (new user) ────────────────────
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = displayName.trim()
    if (!trimmedName) { setError(t('auth.displayNameRequired')); return }
    setError(null)
    setLoading(true)
    try {
      await authService.magicLink(email.trim(), trimmedName)
      setStep('sent')
    } catch (err: unknown) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('auth.sendError'),
      )
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep('email')
    setEmail('')
    setDisplayName('')
    setError(null)
  }

  return (
    <div className="w-full max-w-sm mx-auto">

      {/* ── Brand ── */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
          <AppLogo size={34} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BusyBee</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isZh
            ? '输入邮箱登录，新用户自动注册'
            : 'Enter your email to sign in — new users are registered automatically'}
        </p>
      </div>

      {/* ── Card ── */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">

        {/* Step: email */}
        {step === 'email' && (
          <div className="p-8">
            <h2 className="text-base font-semibold text-slate-800 mb-1">
              {isZh ? '欢迎使用 BusyBee' : 'Welcome to BusyBee'}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {isZh
                ? '输入您的邮箱地址，我们将发送一条登录链接'
                : 'Enter your email and we\'ll send you a sign-in link'}
            </p>

            {/* Allowed-domain hint */}
            {allowedDomains.length > 0 && (
              <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-5">
                <Mail className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-600 leading-relaxed">
                  {t('auth.allowedDomainsHint')}{' '}
                  <span className="font-semibold">{allowedDomains.map(d => `@${d}`).join('  ')}</span>
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  {t('auth.email')}
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null) }}
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pl-9 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white py-2.5 px-4 rounded-xl font-semibold text-sm shadow-sm shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t('auth.sending')}</>
                ) : (
                  <>{t('auth.continueBtn')}<ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step: name (new user only) */}
        {step === 'name' && (
          <div className="p-8">
            {/* Email chip */}
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-6 max-w-full">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-sm text-indigo-700 font-medium truncate">{email}</span>
            </div>

            <h2 className="text-base font-semibold text-slate-800 mb-1">
              {t('auth.newUserTitle')}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {t('auth.newUserDesc')}
            </p>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="displayName" className="text-sm font-medium text-slate-700">
                  {t('auth.displayName')}
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="displayName"
                    type="text"
                    autoComplete="name"
                    autoFocus
                    placeholder={t('auth.displayNamePlaceholder')}
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setError(null) }}
                    disabled={loading}
                    maxLength={64}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pl-9 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white py-2.5 px-4 rounded-xl font-semibold text-sm shadow-sm shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t('auth.sending')}</>
                ) : (
                  <>{t('auth.completeBtn')}<ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={() => { setStep('email'); setError(null) }}
              className="mt-5 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('auth.backToEmail')}
            </button>
          </div>
        )}

        {/* Step: sent */}
        {step === 'sent' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              {t('auth.checkEmail')}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-2">
              {t('auth.linkSentTo')}
            </p>
            <p className="text-sm font-semibold text-indigo-600 mb-6 break-all">{email}</p>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {t('auth.linkExpiry')}
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              {t('auth.backToStart')}
            </button>
          </div>
        )}
      </div>

      {/* Language switcher */}
      <div className="flex items-center justify-center gap-2 mt-6">
        <span className="text-xs text-slate-400">{t('auth.language')}</span>
        <button
          type="button"
          onClick={toggleLang}
          className="text-xs font-medium px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
        >
          {isZh ? 'EN' : '中文'}
        </button>
      </div>
    </div>
  )
}
