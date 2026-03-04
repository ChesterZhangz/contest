import type { Server } from 'socket.io';
import { SocketEvents } from '../types/socket.events';

function hostRoom(contestId: string): string {
  return `contest:${contestId}:host`;
}

function judgesRoom(contestId: string): string {
  return `contest:${contestId}:judges`;
}

function publicRoom(contestId: string): string {
  return `contest:${contestId}:public`;
}

class SocketGateway {
  private io: Server | null = null;

  init(io: Server): void {
    this.io = io;
  }

  joinContestRooms(socketId: string, contestId: string, role: string): void {
    if (!this.io) {
      return;
    }

    const socket = this.io.of('/contest').sockets.get(socketId);
    if (!socket) {
      return;
    }

    if (role === 'host' || role === 'super_admin') {
      socket.join(hostRoom(contestId));
      socket.join(judgesRoom(contestId));
      socket.join(publicRoom(contestId));
      return;
    }

    if (role === 'judge') {
      socket.join(judgesRoom(contestId));
      socket.join(publicRoom(contestId));
      return;
    }

    socket.join(publicRoom(contestId));
  }

  emitContestStarted(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.CONTEST_STARTED, payload);
  }

  emitQuestionChanged(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.QUESTION_CHANGED, payload);
  }

  emitQuestionDetail(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(hostRoom(contestId)).to(judgesRoom(contestId)).emit(SocketEvents.QUESTION_DETAIL, payload);
  }

  emitTimerStarted(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.TIMER_STARTED, payload);
  }

  emitTimerPaused(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.TIMER_PAUSED, payload);
  }

  emitTimerReset(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.TIMER_RESET, payload);
  }

  emitTimerExpired(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.TIMER_EXPIRED, payload);
  }

  emitAnswerRevealed(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.ANSWER_REVEALED, payload);
  }

  emitScoresUpdated(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.SCORES_UPDATED, payload);
  }

  emitScoreLogged(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(hostRoom(contestId)).to(judgesRoom(contestId)).emit(SocketEvents.SCORE_LOGGED, payload);
  }

  emitContestFinished(contestId: string, payload: unknown): void {
    this.io?.of('/contest').to(publicRoom(contestId)).emit(SocketEvents.CONTEST_FINISHED, payload);
  }

  emitFullSync(socketId: string, payload: unknown): void {
    const socket = this.io?.of('/contest').sockets.get(socketId);
    socket?.emit(SocketEvents.SYNC_FULL_STATE, payload);
  }
}

export const socketGateway = new SocketGateway();
