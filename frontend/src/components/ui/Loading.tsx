import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface LoadingProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  fullPage?: boolean
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export function Loading({ className, size = 'md', fullPage }: LoadingProps) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }
  return (
    <div className={clsx('flex items-center justify-center py-12', className)}>
      <Loader2 className={clsx('animate-spin text-primary-600', sizes[size])} />
    </div>
  )
}

export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-2xl z-10">
      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
    </div>
  )
}
