import type { Socket } from 'socket.io';
import { SocketEvents } from '../../types/socket.events';
import * as sessionService from '../../services/session.service';
import { socketGateway } from '../socket.gateway';
import { ScoreOpType } from '../../types/session.types';
import { UserRole } from '../../types/user.types';

interface AuthUser {
  id: string;
  role: string;
}

interface AuthSocket extends Socket {
  data: {
    user: AuthUser;
    contestId?: string;
  };
}

export function registerJudgeHandlers(socket: AuthSocket): void {
  socket.on(
    SocketEvents.JUDGE_SCORE,
    async (payload: { teamId: string; delta: number; type: ScoreOpType; questionId?: string; note?: string }) => {
      if (!socket.data.contestId) {
        return;
      }

      const sessionId = String(socket.handshake.query.sessionId ?? '');
      if (!sessionId) {
        return;
      }

      const result = await sessionService.scoreSession(sessionId, {
        userId: socket.data.user.id,
        role: socket.data.user.role as UserRole,
      }, payload);

      socketGateway.emitScoresUpdated(socket.data.contestId, {
        scores: result.session.scores,
        log: result.log,
      });

      const logData = result.log as Record<string, unknown>;
      socketGateway.emitScoreLogged(socket.data.contestId, {
        ...logData,
        id: String(logData.id ?? logData._id ?? ''),
      });
    },
  );

  socket.on(SocketEvents.JUDGE_REVERT_SCORE, async (payload: { logId: string }) => {
    if (!socket.data.contestId) {
      return;
    }

    const sessionId = String(socket.handshake.query.sessionId ?? '');
    if (!sessionId) {
      return;
    }

    const result = await sessionService.revertSessionScore(sessionId, {
      userId: socket.data.user.id,
      role: socket.data.user.role as UserRole,
    }, payload.logId);

    socketGateway.emitScoresUpdated(socket.data.contestId, {
      scores: result.session.scores,
      log: result.revertLog,
    });
  });
}
