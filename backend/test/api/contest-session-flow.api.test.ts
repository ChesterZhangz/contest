import '../helpers/test-env';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDatabase, clearDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createUser } from '../helpers/factories';
import { UserRole } from '../../src/types/user.types';
import { createApp } from '../../src/app';

const app = createApp();

async function login(username: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  return res.body.data.token as string;
}

describe('API contest + session flow', () => {
  before(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('runs core contest flow: start -> next question -> reveal -> score', async () => {
    const host = await createUser({ username: 'host-c', role: UserRole.HOST });
    const judge = await createUser({ username: 'judge-c', role: UserRole.JUDGE });

    const hostToken = await login('host-c', host.password);
    const judgeToken = await login('judge-c', judge.password);

    const bankRes = await request(app)
      .post('/api/v1/banks')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ name: 'Contest Bank', isPublic: false });

    const bankId = bankRes.body.data.id as string;

    const q1Res = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        bankId,
        content: '1+1=?',
        answer: '2',
        type: 'short_answer',
        difficulty: 1,
        tags: ['代数'],
      });

    const q2Res = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        bankId,
        content: '2+2=?',
        answer: '4',
        type: 'short_answer',
        difficulty: 1,
        tags: ['代数'],
      });

    const q1Id = q1Res.body.data.id as string;
    const q2Id = q2Res.body.data.id as string;

    const contestRes = await request(app)
      .post('/api/v1/contests')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        name: 'Test Contest',
        mode: 'team',
        judgeIds: [String(judge.user._id)],
        teams: [
          {
            id: 'team-A',
            name: '队伍A',
            color: '#FF0000',
            memberIds: [],
            initialScore: 0,
          },
        ],
        rounds: [
          {
            roundNumber: 1,
            name: '第一轮',
            questionCount: 2,
            timePerQuestion: 30,
            bankId,
            selectionMode: 'manual',
            questionIds: [q1Id, q2Id],
            scoring: {
              correctScore: 10,
              wrongScore: -5,
            },
          },
        ],
      });

    assert.equal(contestRes.status, 201);
    const contestId = contestRes.body.data.id as string;

    const startRes = await request(app).post(`/api/v1/contests/${contestId}/start`).set('Authorization', `Bearer ${hostToken}`);
    assert.equal(startRes.status, 200);

    const sessionId = startRes.body.data.sessionId as string;
    assert.ok(sessionId);

    const nextRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/next-question`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({});
    assert.equal(nextRes.status, 200);

    const timerStartRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/timer/start`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({});
    assert.equal(timerStartRes.status, 200);

    const revealRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/reveal-answer`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({});
    assert.equal(revealRes.status, 200);

    const scoreRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/score`)
      .set('Authorization', `Bearer ${judgeToken}`)
      .send({
        teamId: 'team-A',
        delta: 10,
        type: 'correct',
      });

    assert.equal(scoreRes.status, 200);

    const scoresRes = await request(app)
      .get(`/api/v1/sessions/${sessionId}/scores`)
      .set('Authorization', `Bearer ${judgeToken}`);

    assert.equal(scoresRes.status, 200);
    assert.equal(scoresRes.body.data.scores[0].score, 10);
  });
});
