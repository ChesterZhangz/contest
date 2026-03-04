import type { Socket } from 'socket.io';
import { SocketEvents } from '../../types/socket.events';
import * as sessionService from '../../services/session.service';
import { socketGateway } from '../socket.gateway';
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

export function registerHostHandlers(socket: AuthSocket): void {
  socket.on(SocketEvents.HOST_NEXT_QUESTION, async (payload: { skipTo?: number }) => {
    if (!socket.data.contestId) {
      return;
    }

    const sessionId = String(socket.handshake.query.sessionId ?? '');
    if (!sessionId) {
      return;
    }

    const data = await sessionService.nextQuestion(
      sessionId,
      { userId: socket.data.user.id, role: socket.data.user.role as UserRole },
      payload?.skipTo,
    );

    socketGateway.emitQuestionChanged(socket.data.contestId, data.questionMeta);
    socketGateway.emitQuestionDetail(socket.data.contestId, data.questionDetail);
  });

  socket.on(SocketEvents.HOST_TIMER_CONTROL, async (payload: { action: 'start' | 'pause' | 'reset' }) => {
    if (!socket.data.contestId) {
      return;
    }

    const sessionId = String(socket.handshake.query.sessionId ?? '');
    if (!sessionId) {
      return;
    }

    const data = await sessionService.controlTimer(sessionId, {
      userId: socket.data.user.id,
      role: socket.data.user.role as UserRole,
    }, payload.action);

    if (payload.action === 'start') {
      socketGateway.emitTimerStarted(socket.data.contestId, {
        totalSeconds: data.timer.totalSeconds,
        remainingSeconds: data.timer.remainingSeconds,
        startedAt: data.timer.startedAt,
      });
    }

    if (payload.action === 'pause') {
      socketGateway.emitTimerPaused(socket.data.contestId, {
        totalSeconds: data.timer.totalSeconds,
        remainingSeconds: data.timer.remainingSeconds,
      });
    }

    if (payload.action === 'reset') {
      socketGateway.emitTimerReset(socket.data.contestId, {
        totalSeconds: data.timer.totalSeconds,
      });
    }
  });

  socket.on(SocketEvents.HOST_REVEAL_ANSWER, async () => {
    if (!socket.data.contestId) {
      return;
    }

    const sessionId = String(socket.handshake.query.sessionId ?? '');
    if (!sessionId) {
      return;
    }

    const data = await sessionService.revealAnswer(sessionId, {
      userId: socket.data.user.id,
      role: socket.data.user.role as UserRole,
    });

    socketGateway.emitAnswerRevealed(socket.data.contestId, data);
  });
}
