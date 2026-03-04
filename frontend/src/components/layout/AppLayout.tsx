import { useEffect, useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastContainer } from '@/components/ui/Toast'
import { useUIStore } from '@/store/ui'
import { clsx } from 'clsx'
import { authService } from '@/services/auth'

export function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAuth = useAuthStore((s) => s.setAuth)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthReady(true)
      return
    }

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      setAuthReady(true)
      return
    }

    let cancelled = false
    void authService
      .refresh(refreshToken)
      .then((res) => {
        if (!cancelled) {
          // Keep JWT role in sync with latest server-side role assignments.
          setAuth(res.user, res.token, res.refreshToken)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, setAuth])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!authReady) return null

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar />

      {/* Main content — no margin on mobile (sidebar overlays), margin on desktop */}
      <div
        className={clsx(
          'flex-1 flex flex-col overflow-hidden transition-all duration-200 min-w-0',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        )}
      >
        <Header />
        <main className="flex-1 overflow-y-auto min-h-0">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
