import { api, extractData } from './api'
import type { Contest, ContestMode, ContestStatus, Team, ContestRound } from '@/types'

export interface CreateContestInput {
  name: string
  description?: string
  mode: ContestMode
  judgeIds?: string[]
  participants?: string[]
  teams?: Team[]
  rounds?: ContestRound[]
  status?: ContestStatus
  scheduledAt?: string
}

export const contestsService = {
  list: async (): Promise<Contest[]> => {
    const res = await api.get('/contests')
    return extractData(res)
  },

  get: async (id: string): Promise<Contest> => {
    const res = await api.get(`/contests/${id}`)
    return extractData(res)
  },

  create: async (input: CreateContestInput): Promise<Contest> => {
    const res = await api.post('/contests', input)
    return extractData(res)
  },

  update: async (id: string, input: Partial<CreateContestInput>): Promise<Contest> => {
    const res = await api.patch(`/contests/${id}`, input)
    return extractData(res)
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/contests/${id}`)
  },

  start: async (id: string): Promise<{ sessionId: string }> => {
    const res = await api.post(`/contests/${id}/start`)
    return extractData(res)
  },

  getSession: async (id: string): Promise<{ sessionId: string }> => {
    const res = await api.get(`/contests/${id}/session`)
    return extractData(res)
  },

  previewQuestions: async (id: string): Promise<unknown[]> => {
    const res = await api.post(`/contests/${id}/preview-questions`)
    return extractData(res)
  },

  join: async (joinCode: string, teamId?: string): Promise<Contest> => {
    const res = await api.post('/contests/join', { joinCode, teamId })
    return extractData(res)
  },

  getJoinCode: async (id: string): Promise<{ joinCode: string }> => {
    const res = await api.get(`/contests/${id}/join-code`)
    return extractData(res)
  },
}
