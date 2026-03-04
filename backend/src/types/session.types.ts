export enum SessionState {
  WAITING = 'waiting',
  QUESTION_ACTIVE = 'question_active',
  TIMER_RUNNING = 'timer_running',
  TIMER_PAUSED = 'timer_paused',
  TIMER_EXPIRED = 'timer_expired',
  ANSWER_REVEALED = 'answer_revealed',
  ROUND_BREAK = 'round_break',
  FINISHED = 'finished',
}

export enum ScoreOpType {
  CORRECT = 'correct',
  WRONG = 'wrong',
  BONUS = 'bonus',
  PENALTY = 'penalty',
  MANUAL = 'manual',
  REVERT = 'revert',
}
