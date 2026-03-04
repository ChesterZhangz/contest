import { api, extractData } from './api'
import type { AuthResponse, User } from '@/types'

export const authService = {
  magicLink: async (email: string, displayName?: string): Promise<{ isNewUser: boolean; needsName: boolean }> => {
    const res = await api.post('/auth/magic-link', { email, ...(displayName ? { displayName } : {}) })
    return extractData(res)
  },

  register: async (email: string, displayName: string): Promise<void> => {
    await api.post('/auth/register', { email, displayName })
  },

  requestMagicLink: async (email: string): Promise<void> => {
    await api.post('/auth/request-magic-link', { email })
  },

  verifyMagicLink: async (token: string): Promise<AuthResponse> => {
    const res = await api.post('/auth/verify-magic-link', { token })
    return extractData(res)
  },

  me: async (): Promise<User> => {
    const res = await api.get('/auth/me')
    return extractData(res)
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const res = await api.post('/auth/refresh', { refreshToken })
    return extractData(res)
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },
}
