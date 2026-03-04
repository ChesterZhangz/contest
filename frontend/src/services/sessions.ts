import { api, extractData } from './api'
import type { ContestSession, TeamScore, ScoreLog, ScoreOpType } from '@/types'

export const sessionsService = {
  get: async (id: string): Promise<ContestSession> => {
    const res = await api.get(`/sessions/${id}`)
    return extractData(res)
  },

  getScores: async (id: string): Promise<TeamScore[]> => {
    const res = await api.get(`/sessions/${id}/scores`)
    return extractData(res)
  },

  nextQuestion: async (id: string, skipTo?: number): Promise<unknown> => {
    const res = await api.post(`/sessions/${id}/next-question`, skipTo !== undefined ? { skipTo } : {})
    return extractData(res)
  },

  timerControl: async (id: string, action: 'start' | 'pause' | 'reset'): Promise<unknown> => {
    const res = await api.post(`/sessions/${id}/timer/control`, { action })
    return extractData(res)
  },

  adjustTimer: async (
    id: string,
    deltaSeconds: number
  ): Promise<{
    deltaSeconds: number
    state: string
    timer: { totalSeconds: number; remainingSeconds: number; startedAt?: string; isPaused: boolean }
  }> => {
    const res = await api.post(`/sessions/${id}/timer/adjust`, { deltaSeconds })
    return extractData(res)
  },

  revealAnswer: async (id: string): Promise<unknown> => {
    const res = await api.post(`/sessions/${id}/reveal-answer`)
    return extractData(res)
  },

  score: async (
    id: string,
    input: {
      teamId: string
      delta: number
      type: ScoreOpType
      questionId?: string
      note?: string
    }
  ): Promise<{ session: ContestSession; log: ScoreLog }> => {
    const res = await api.post(`/sessions/${id}/score`, input)
    return extractData(res)
  },

  revertScore: async (
    sessionId: string,
    logId: string
  ): Promise<{ session: ContestSession; log: ScoreLog; revertLog: ScoreLog }> => {
    const res = await api.post(`/sessions/${sessionId}/score/revert/${logId}`)
    return extractData(res)
  },

  getScoreLogs: async (id: string): Promise<ScoreLog[]> => {
    const res = await api.get(`/sessions/${id}/score-logs`)
    return extractData(res)
  },

  finish: async (id: string): Promise<ContestSession> => {
    const res = await api.post(`/sessions/${id}/finish`)
    return extractData(res)
  },
}
