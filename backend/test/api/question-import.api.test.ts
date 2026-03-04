import '../helpers/test-env';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDatabase, clearDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createUser } from '../helpers/factories';
import { UserRole } from '../../src/types/user.types';
import { createApp } from '../../src/app';

const app = createApp();

async function loginAsHost() {
  const { password } = await createUser({ username: 'host-q', role: UserRole.HOST });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ username: 'host-q', password });
  return loginRes.body.data.token as string;
}

describe('API questions + import', () => {
  before(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('creates, queries, previews and imports questions', async () => {
    const token = await loginAsHost();

    const bankRes = await request(app)
      .post('/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Q Bank', isPublic: false });

    const bankId = bankRes.body.data.id as string;
    assert.ok(bankId);

    const createQuestionRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bankId,
        content: '设 $f(x)=x^2$，求 $f(2)$',
        answer: '$4$',
        type: 'short_answer',
        difficulty: 1,
        tags: ['函数'],
      });

    assert.equal(createQuestionRes.status, 201);

    const listRes = await request(app)
      .get('/api/v1/questions')
      .set('Authorization', `Bearer ${token}`)
      .query({ bankId, page: 1, pageSize: 20 });

    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.data.items.length, 1);

    const csv = [
      'content,answer,solution,type,difficulty,tags,choices,correctChoice,source',
      '"已知 $1+1=$?","B","显然","multiple_choice",1,"代数","A:$1$|B:$2$|C:$3$|D:$4$","B","练习"',
    ].join('\n');

    const previewRes = await request(app)
      .post('/api/v1/questions/preview-import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bankId, format: 'csv', content: csv });

    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.body.data.valid, 1);

    const importRes = await request(app)
      .post('/api/v1/questions/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bankId, format: 'csv', content: csv });

    assert.equal(importRes.status, 200);
    assert.equal(importRes.body.data.success, 1);

    const finalListRes = await request(app)
      .get('/api/v1/questions')
      .set('Authorization', `Bearer ${token}`)
      .query({ bankId, page: 1, pageSize: 20 });

    assert.equal(finalListRes.body.data.items.length, 2);
  });
});
