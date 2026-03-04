import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { authService } from '@/services/auth'
import { useAuthStore } from '@/store/auth'
import { AppLogo } from '@/components/ui/AppLogo'

type Status = 'verifying' | 'error'

export default function VerifyPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [status, setStatus] = useState<Status>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setErrorMsg('链接无效，缺少验证令牌')
      return
    }

    let cancelled = false

    authService.verifyMagicLink(token)
      .then((res) => {
        if (cancelled) return
        setAuth(res.user, res.token, res.refreshToken)
        navigate('/dashboard', { replace: true })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: string }).message)
            : '链接无效或已过期，请重新请求登录链接'
        setErrorMsg(msg)
        setStatus('error')
      })

    return () => { cancelled = true }
  }, [searchParams, navigate, setAuth])

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
          <AppLogo size={34} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BusyBee</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 text-center">
        {status === 'verifying' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-7 h-7 text-teal-500 animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">正在验证身份</h2>
            <p className="text-sm text-slate-500">请稍候，正在验证您的登录链接…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">链接已失效</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">{errorMsg}</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white py-2.5 px-6 rounded-xl font-semibold text-sm shadow-sm shadow-teal-200 hover:from-teal-700 hover:to-teal-600 transition-all"
            >
              重新请求登录链接
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
