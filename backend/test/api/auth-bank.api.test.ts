import '../helpers/test-env';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDatabase, clearDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createUser } from '../helpers/factories';
import { UserRole } from '../../src/types/user.types';
import { createApp } from '../../src/app';

const app = createApp();

describe('API auth + bank', () => {
  before(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('logs in host and creates bank successfully', async () => {
    const { password } = await createUser({ username: 'host1', role: UserRole.HOST });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      username: 'host1',
      password,
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.success, true);
    const token = loginRes.body.data.token as string;
    assert.ok(token);

    const createBankRes = await request(app)
      .post('/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Host Bank',
        description: 'for test',
        isPublic: false,
      });

    assert.equal(createBankRes.status, 201);
    assert.equal(createBankRes.body.success, true);
    assert.equal(createBankRes.body.data.name, 'Host Bank');

    const listRes = await request(app).get('/api/v1/banks').set('Authorization', `Bearer ${token}`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.data.length, 1);
  });

  it('forbids participant from creating bank', async () => {
    const { password } = await createUser({ username: 'player1', role: UserRole.PARTICIPANT });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      username: 'player1',
      password,
    });

    const token = loginRes.body.data.token as string;

    const createBankRes = await request(app)
      .post('/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'No Permission',
      });

    assert.equal(createBankRes.status, 403);
    assert.equal(createBankRes.body.success, false);
    assert.equal(createBankRes.body.error.code, 'FORBIDDEN');
  });
});
