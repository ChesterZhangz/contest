import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/auth'
import { useSessionStore } from '@/store/session'
import { sessionsService } from '@/services/sessions'
import type {
  SocketContestStartedPayload,
  SocketQuestionChangedPayload,
  SocketAnswerRevealedPayload,
  SocketScoresUpdatedPayload,
  SocketTimerPayload,
  TeamScore,
} from '@/types'

interface UseSocketOptions {
  contestId: string
  sessionId: string
  onContestStarted?: (payload: SocketContestStartedPayload) => void
  onTimerExpired?: () => void
  onContestFinished?: () => void
}

export function useSocket({
  contestId,
  sessionId,
  onContestStarted,
  onTimerExpired,
  onContestFinished,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const questionSyncSeqRef = useRef(0)
  const token = useAuthStore((s) => s.token)
  const {
    setSession,
    updateScores,
    setCurrentQuestion,
    setCurrentBatch,
    setCurrentAnswer,
    setConnected,
    setReconnecting,
    addScoreLog,
    session,
  } = useSessionStore()

  useEffect(() => {
    if (!token || !sessionId) return

    const socket = io('/contest', {
      auth: { token },
      query: {
        sessionId,
        ...(contestId ? { contestId } : {}),
      },
      // Prefer websocket for low-latency updates, keep polling fallback for dev/proxy edge cases.
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setReconnecting(false)
      socket.emit('sync:request_full_state', { sessionId })
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', () => {
      setReconnecting(true)
    })

    socket.on('sync:full_state', (data: Record<string, unknown>) => {
      // Backend sends session fields directly (not wrapped in { session: ... })
      const mapped = {
        id: String(data.id ?? data.sessionId ?? ''),
        contestId: String(data.contestId ?? ''),
        state: (data.state ?? 'waiting') as Parameters<typeof setSession>[0]['state'],
        currentQuestionIndex: Number(data.currentQuestionIndex ?? -1),
        currentRoundIndex: Number(data.currentRoundIndex ?? 0),
        timer: (data.timer ?? { totalSeconds: 0, remainingSeconds: 0, isPaused: true }) as Parameters<typeof setSession>[0]['timer'],
        scores: (data.scores ?? []) as Parameters<typeof setSession>[0]['scores'],
        questionSequence: (data.questionSequence ?? []) as Parameters<typeof setSession>[0]['questionSequence'],
        viewer: (data.viewer ?? undefined) as Parameters<typeof setSession>[0]['viewer'],
        createdAt: String(data.createdAt ?? ''),
        updatedAt: String(data.updatedAt ?? ''),
      }
      setSession(mapped)
      // Handle batch (new) or single question (legacy)
      if (Array.isArray(data.currentBatch) && (data.currentBatch as unknown[]).length > 0) {
        const batch = data.currentBatch as Parameters<typeof setCurrentBatch>[0]
        setCurrentBatch(batch)
        if (mapped.state === 'answer_revealed' && batch[0] && typeof batch[0].answer === 'string') {
          setCurrentAnswer({
            answer: batch[0].answer,
            solution: typeof batch[0].solution === 'string' ? batch[0].solution : undefined,
          })
        }
      } else if (data.currentQuestion) {
        const question = data.currentQuestion as Parameters<typeof setCurrentQuestion>[0]
        setCurrentBatch(question ? [question] : [])
        if (
          mapped.state === 'answer_revealed' &&
          question &&
          typeof question.answer === 'string'
        ) {
          setCurrentAnswer({
            answer: question.answer,
            solution: typeof question.solution === 'string' ? question.solution : undefined,
          })
        }
      } else {
        setCurrentBatch([])
        setCurrentQuestion(null)
      }
    })

    socket.on('contest:started', (payload: SocketContestStartedPayload) => {
      onContestStarted?.(payload)
    })

    socket.on('session:question_changed', async (payload: SocketQuestionChangedPayload & { questionId?: string }) => {
      setCurrentAnswer(null)
      setCurrentBatch([])

      const cur = useSessionStore.getState().session
      if (!cur) return
      setSession({
        ...cur,
        currentQuestionIndex: payload.questionIndex,
        currentRoundIndex: payload.roundIndex,
        state: 'question_active',
        timer: {
          totalSeconds: payload.timePerQuestion,
          remainingSeconds: payload.timePerQuestion,
          isPaused: true,
        },
      })

      // Keep question content in sync via session endpoint (works for judges/hosts and enrolled participants).
      const syncSeq = ++questionSyncSeqRef.current
      try {
        const latest = (await sessionsService.get(sessionId)) as typeof cur & {
          state?: typeof cur.state
          currentQuestion?: Parameters<typeof setCurrentQuestion>[0]
          currentBatch?: Parameters<typeof setCurrentBatch>[0]
        }

        if (questionSyncSeqRef.current !== syncSeq) return
        if (Array.isArray(latest.currentBatch) && latest.currentBatch.length > 0) {
          setCurrentBatch(latest.currentBatch)
          if (latest.state === 'answer_revealed' && typeof latest.currentBatch[0].answer === 'string') {
            setCurrentAnswer({
              answer: latest.currentBatch[0].answer,
              solution: typeof latest.currentBatch[0].solution === 'string' ? latest.currentBatch[0].solution : undefined,
            })
          }
        } else if (latest.currentQuestion) {
          setCurrentBatch([latest.currentQuestion])
          if (
            latest.state === 'answer_revealed' &&
            typeof latest.currentQuestion.answer === 'string'
          ) {
            setCurrentAnswer({
              answer: latest.currentQuestion.answer,
              solution:
                typeof latest.currentQuestion.solution === 'string'
                  ? latest.currentQuestion.solution
                  : undefined,
            })
          }
        }
      } catch {
        // If sync request fails, question_detail socket event can still update host/judge.
      }
    })

    socket.on('session:question_detail', (payload: { question: Parameters<typeof setCurrentQuestion>[0]; questions?: Parameters<typeof setCurrentBatch>[0] }) => {
      if (Array.isArray(payload.questions) && payload.questions.length > 0) {
        setCurrentBatch(payload.questions)
      } else if (payload.question) {
        const cur = useSessionStore.getState().currentBatch
        if (cur.length <= 1) setCurrentBatch([payload.question])
      }
    })

    socket.on('answer:revealed', (payload: SocketAnswerRevealedPayload) => {
      const cur = useSessionStore.getState().session
      if (cur) setSession({ ...cur, state: 'answer_revealed' })
      setCurrentAnswer({ answer: payload.answer, solution: payload.solution })
    })

    socket.on('scores:updated', (payload: SocketScoresUpdatedPayload) => {
      updateScores(payload.scores as TeamScore[])
    })

    socket.on('score:logged', (log: Parameters<typeof addScoreLog>[0]) => {
      addScoreLog(log)
    })

    socket.on('timer:started', (payload: SocketTimerPayload) => {
      const cur = useSessionStore.getState().session
      if (!cur) return
      setSession({
        ...cur,
        state: 'timer_running',
        timer: {
          totalSeconds: payload.totalSeconds ?? cur.timer.totalSeconds,
          remainingSeconds: payload.remainingSeconds ?? payload.totalSeconds ?? cur.timer.totalSeconds,
          startedAt: payload.startedAt,
          isPaused: false,
        },
      })
    })

    socket.on('timer:paused', (payload: SocketTimerPayload) => {
      const cur = useSessionStore.getState().session
      if (!cur) return
      setSession({
        ...cur,
        state: 'timer_paused',
        timer: {
          ...cur.timer,
          totalSeconds: payload.totalSeconds ?? cur.timer.totalSeconds,
          remainingSeconds: payload.remainingSeconds ?? cur.timer.remainingSeconds,
          isPaused: true,
        },
      })
    })

    socket.on('timer:reset', (payload: SocketTimerPayload) => {
      const cur = useSessionStore.getState().session
      if (!cur) return
      setSession({
        ...cur,
        state: 'question_active',
        timer: {
          totalSeconds: payload.totalSeconds ?? cur.timer.totalSeconds,
          remainingSeconds: payload.totalSeconds ?? cur.timer.totalSeconds,
          isPaused: true,
        },
      })
    })

    socket.on('timer:expired', () => {
      const cur = useSessionStore.getState().session
      if (cur) setSession({ ...cur, state: 'timer_expired' })
      onTimerExpired?.()
    })

    socket.on('contest:finished', () => {
      onContestFinished?.()
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [token, contestId, sessionId])

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data)
  }, [])

  return { socket: socketRef.current, emit }
}
