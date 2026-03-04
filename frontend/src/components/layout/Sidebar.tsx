import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { AppLogo } from '@/components/ui/AppLogo'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import type { UserRole } from '@/types'

interface NavItem {
  key: string
  label: string
  icon: React.ElementType
  to: string
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'nav.dashboard',
    icon: LayoutDashboard,
    to: '/',
  },
  {
    key: 'banks',
    label: 'nav.banks',
    icon: BookOpen,
    to: '/banks',
    roles: ['super_admin', 'host', 'judge'],
  },
  {
    key: 'contests',
    label: 'nav.contests',
    icon: Trophy,
    to: '/contests',
  },
  {
    key: 'users',
    label: 'nav.users',
    icon: Users,
    to: '/users',
    roles: ['super_admin'],
  },
  {
    key: 'settings',
    label: 'nav.settings',
    icon: Settings,
    to: '/settings',
    roles: ['super_admin'],
  },
]

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-rose-100 text-rose-700',
  host: 'bg-teal-100 text-teal-700',
  judge: 'bg-amber-100 text-amber-700',
  participant: 'bg-emerald-100 text-emerald-700',
  audience: 'bg-slate-100 text-slate-600',
}

export function Sidebar() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  const userRole = user?.role ?? 'audience'

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full z-40 flex flex-col bg-white border-r border-slate-100',
        'shadow-lg shadow-slate-200/50 transition-all duration-200',
        // Mobile: slide in/out
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // Width: always 64 when open, icon-only when collapsed on desktop
        sidebarOpen ? 'w-64' : 'w-64 lg:w-16'
      )}
    >
      {/* Brand / Logo */}
      <div
        className={clsx(
          'flex items-center h-14 px-4 border-b border-slate-100 shrink-0',
          sidebarOpen ? 'justify-between' : 'lg:justify-center'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 shadow-sm">
            <AppLogo size={20} />
          </div>
          <div className={clsx('flex flex-col leading-tight min-w-0', !sidebarOpen && 'lg:hidden')}>
            <span className="text-sm font-bold text-slate-800 truncate">BusyBee</span>
          </div>
        </div>

        {/* Close button on mobile when open */}
        <div className={clsx('flex items-center gap-1', !sidebarOpen && 'lg:hidden')}>
          {/* Desktop: collapse button */}
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {/* Mobile: close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expand toggle when sidebar is collapsed on desktop */}
      {!sidebarOpen && (
        <div className="hidden lg:flex justify-center py-2 border-b border-slate-100">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              onClick={() => {
                // Close sidebar on mobile after navigation
                if (window.innerWidth < 1024) setSidebarOpen(false)
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                )
              }
              title={!sidebarOpen ? t(item.label) : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={clsx(
                      'w-5 h-5 shrink-0 transition-colors',
                      isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  <span className={clsx('truncate', !sidebarOpen && 'lg:hidden')}>
                    {t(item.label)}
                  </span>
                  {isActive && (
                    <span className={clsx('ml-auto w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0', !sidebarOpen && 'lg:hidden')} />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* User section at bottom */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className={clsx('flex items-center gap-3 min-w-0', !sidebarOpen && 'lg:justify-center')}>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-100 to-teal-200 text-teal-700 flex items-center justify-center text-sm font-bold shrink-0 select-none">
            {initials}
          </div>
          {/* Name + role */}
          <div className={clsx('flex flex-col min-w-0 flex-1', !sidebarOpen && 'lg:hidden')}>
            <span className="text-sm font-medium text-slate-800 truncate">
              {user?.displayName || user?.username || '—'}
            </span>
            <span
              className={clsx(
                'mt-0.5 inline-block self-start text-xs font-medium px-1.5 py-0.5 rounded-md',
                ROLE_BADGE_COLORS[userRole]
              )}
            >
              {t(`role.${userRole}`)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
