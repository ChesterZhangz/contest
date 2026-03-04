import { create } from 'zustand'
import type { ContestSession, TeamScore, Question, ScoreLog } from '@/types'

interface SessionState {
  session: ContestSession | null
  currentQuestion: Question | null
  currentBatch: Question[]
  currentAnswer: { answer: string; solution?: string } | null
  scoreLogs: ScoreLog[]
  isConnected: boolean
  isReconnecting: boolean

  setSession: (session: ContestSession) => void
  updateScores: (scores: TeamScore[]) => void
  setCurrentQuestion: (q: Question | null) => void
  setCurrentBatch: (questions: Question[]) => void
  setCurrentAnswer: (a: { answer: string; solution?: string } | null) => void
  setConnected: (v: boolean) => void
  setReconnecting: (v: boolean) => void
  addScoreLog: (log: ScoreLog) => void
  setScoreLogs: (logs: ScoreLog[]) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  currentQuestion: null,
  currentBatch: [],
  currentAnswer: null,
  scoreLogs: [],
  isConnected: false,
  isReconnecting: false,

  setSession: (session) => set({ session }),
  updateScores: (scores) =>
    set((state) => ({
      session: state.session ? { ...state.session, scores } : null,
    })),
  setCurrentQuestion: (currentQuestion) =>
    set({ currentQuestion, currentAnswer: null }),
  setCurrentBatch: (currentBatch) =>
    set({ currentBatch, currentQuestion: currentBatch[0] ?? null, currentAnswer: null }),
  setCurrentAnswer: (currentAnswer) => set({ currentAnswer }),
  setConnected: (isConnected) => set({ isConnected }),
  setReconnecting: (isReconnecting) => set({ isReconnecting }),
  addScoreLog: (log) => set((state) => ({ scoreLogs: [log, ...state.scoreLogs] })),
  setScoreLogs: (scoreLogs) => set({ scoreLogs }),
  clearSession: () =>
    set({
      session: null,
      currentQuestion: null,
      currentBatch: [],
      currentAnswer: null,
      scoreLogs: [],
      isConnected: false,
      isReconnecting: false,
    }),
}))
