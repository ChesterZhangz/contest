import type { Server } from 'socket.io';
import { verifyJwt } from '../utils/jwt';
import { ApiError } from '../utils/api-error';
import { socketGateway } from './socket.gateway';
import { registerHostHandlers } from './handlers/host.handlers';
import { registerJudgeHandlers } from './handlers/judge.handlers';
import { SocketEvents } from '../types/socket.events';
import * as sessionService from '../services/session.service';
import { UserRole } from '../types/user.types';

export function setupContestNamespace(io: Server): void {
  const nsp = io.of('/contest');

  nsp.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      if (!token) {
        throw new ApiError(401, 'AUTH_REQUIRED', '缺少 token');
      }

      const payload = verifyJwt(token);
      if (payload.tokenType !== 'access') {
        throw new ApiError(401, 'AUTH_INVALID_TOKEN', 'token 类型错误');
      }

      socket.data.user = {
        id: payload.userId,
        role: payload.role,
      };
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  nsp.on('connection', (socket) => {
    const contestId = typeof socket.handshake.query.contestId === 'string' ? socket.handshake.query.contestId : undefined;
    socket.data.contestId = contestId;

    if (contestId) {
      socketGateway.joinContestRooms(socket.id, contestId, socket.data.user.role);
    }

    registerHostHandlers(socket as never);
    registerJudgeHandlers(socket as never);

    socket.on(SocketEvents.SYNC_REQUEST, async (payload: { sessionId: string }) => {
      if (!payload?.sessionId) {
        return;
      }

      const data = await sessionService.getSession(payload.sessionId, {
        userId: socket.data.user.id,
        role: socket.data.user.role as UserRole,
      });

      // Recover from missing/stale contestId query params by joining room from authoritative session data.
      const resolvedContestId = typeof data.contestId === 'string' ? data.contestId : '';
      if (resolvedContestId) {
        socket.data.contestId = resolvedContestId;
        socketGateway.joinContestRooms(socket.id, resolvedContestId, socket.data.user.role);
      }

      socketGateway.emitFullSync(socket.id, data);
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });
  });
}
