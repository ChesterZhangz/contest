import { useTranslation } from 'react-i18next'
import { Menu, LogOut } from 'lucide-react'
import { AppLogo } from '@/components/ui/AppLogo'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'

const LANGUAGES = [
  { code: 'zh', label: 'ZH' },
  { code: 'en', label: 'EN' },
] as const

export function Header() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const currentLang = i18n.language?.startsWith('zh') ? 'zh' : 'en'

  const handleLogout = () => {
    clearAuth()
  }

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center px-3 sm:px-4 gap-3 shrink-0 shadow-sm">
      {/* Left: sidebar toggle (hamburger on mobile, icon-aware on desktop) */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile: show brand name */}
      <div className="flex items-center gap-1.5 lg:hidden">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
          <AppLogo size={14} />
        </div>
        <span className="text-sm font-bold text-slate-800">BusyBee</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: language switcher + user name + logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language switcher */}
        <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code)}
              className={clsx(
                'px-2.5 py-1.5 text-xs font-semibold transition-colors',
                currentLang === code
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )}
              aria-pressed={currentLang === code}
              aria-label={`Switch to ${label}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* User display name */}
        {user && (
          <span className="hidden sm:block text-sm font-medium text-slate-700 select-none max-w-[120px] truncate">
            {user.displayName || user.username}
          </span>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title={t('nav.logout')}
          aria-label={t('nav.logout')}
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{t('nav.logout')}</span>
        </button>
      </div>
    </header>
  )
}
