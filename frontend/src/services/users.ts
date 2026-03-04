import { api, extractData } from './api'
import type { User, UserRole } from '@/types'

export interface CreateUserInput {
  username: string
  displayName: string
  role: UserRole
  email?: string
}

export interface UpdateUserInput {
  displayName?: string
  role?: UserRole
  email?: string
  isActive?: boolean
}

export const usersService = {
  list: async (): Promise<User[]> => {
    const res = await api.get('/users')
    return extractData(res)
  },

  create: async (input: CreateUserInput): Promise<User> => {
    const res = await api.post('/users', input)
    return extractData(res)
  },

  update: async (id: string, input: UpdateUserInput): Promise<User> => {
    const res = await api.patch(`/users/${id}`, input)
    return extractData(res)
  },

  disable: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`)
  },

  resendInvite: async (id: string): Promise<void> => {
    await api.post(`/users/${id}/resend-invite`)
  },
}
