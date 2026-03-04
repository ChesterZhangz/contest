import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { authRouter } from './routes/auth.routes';
import { bankRouter } from './routes/bank.routes';
import { questionRouter } from './routes/question.routes';
import { contestRouter } from './routes/contest.routes';
import { sessionRouter } from './routes/session.routes';
import { userRouter } from './routes/user.routes';
import { tagRouter } from './routes/tag.routes';
import { settingsRouter } from './routes/settings.routes';
import { setupContestNamespace } from './socket/contest.namespace';
import { socketGateway } from './socket/socket.gateway';
import { startTimerMonitor } from './services/timer-monitor.service';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '4mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
      },
      message: '服务正常',
    });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/banks', bankRouter);
  app.use('/api/v1/questions', questionRouter);
  app.use('/api/v1/contests', contestRouter);
  app.use('/api/v1/sessions', sessionRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/tags', tagRouter);
  app.use('/api/v1/settings', settingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  });

  socketGateway.init(io);
  setupContestNamespace(io);
  startTimerMonitor();

  server.listen(env.PORT, () => {
    console.log(`Backend is running on http://localhost:${env.PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((error) => {
    console.error('Failed to bootstrap server', error);
    process.exit(1);
  });
}
