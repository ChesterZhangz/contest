import { ContestSessionModel } from '../models/ContestSession.model';
import { SessionState } from '../types/session.types';
import { socketGateway } from '../socket/socket.gateway';

let timerMonitor: NodeJS.Timeout | null = null;

function computeRemainingSeconds(timer: { remainingSeconds?: number; startedAt?: Date | null }): number {
  if (!timer.startedAt) {
    return Number(timer.remainingSeconds ?? 0);
  }

  const elapsed = Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000);
  return Math.max(0, Number(timer.remainingSeconds ?? 0) - elapsed);
}

export function startTimerMonitor(intervalMs = 500): void {
  if (timerMonitor) {
    return;
  }

  timerMonitor = setInterval(async () => {
    try {
      const runningSessions = await ContestSessionModel.find({
        state: SessionState.TIMER_RUNNING,
        'timer.startedAt': { $ne: null },
      })
        .select('_id contestId timer')
        .lean();

      for (const session of runningSessions) {
        const remaining = computeRemainingSeconds(session.timer ?? {});
        if (remaining > 0) {
          continue;
        }

        const updated = await ContestSessionModel.findOneAndUpdate(
          {
            _id: session._id,
            state: SessionState.TIMER_RUNNING,
          },
          {
            $set: {
              state: SessionState.TIMER_EXPIRED,
              timer: {
                totalSeconds: Number(session.timer?.totalSeconds ?? 0),
                remainingSeconds: 0,
                startedAt: undefined,
                isPaused: true,
              },
            },
          },
          { returnDocument: 'after' },
        );

        if (updated) {
          socketGateway.emitTimerExpired(String(updated.contestId), {});
        }
      }
    } catch (error) {
      console.error('Timer monitor tick failed', error);
    }
  }, intervalMs);
}
