import '../helpers/test-env';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { setupTestDatabase, clearDatabase, teardownTestDatabase } from '../helpers/test-db';
import { ContestSessionModel } from '../../src/models/ContestSession.model';
import { ScoreLogModel } from '../../src/models/ScoreLog.model';
import { applyScore, revertScore } from '../../src/services/scoring.service';
import { ScoreOpType, SessionState } from '../../src/types/session.types';

describe('scoring-service', () => {
  before(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('applies and reverts score with logs', async () => {
    const contestId = new Types.ObjectId();
    const session = await ContestSessionModel.create({
      contestId,
      questionSequence: [],
      currentQuestionIndex: -1,
      currentRoundIndex: 0,
      state: SessionState.WAITING,
      timer: { totalSeconds: 0, remainingSeconds: 0, isPaused: true },
      scores: [
        { teamId: 'team-A', score: 10 },
        { teamId: 'team-B', score: 0 },
      ],
    });

    const operatorId = new Types.ObjectId().toString();

    const scored = await applyScore(String(session._id), operatorId, {
      teamId: 'team-A',
      delta: 5,
      type: ScoreOpType.BONUS,
      note: 'test add',
    });

    assert.equal(scored.log.delta, 5);
    assert.equal(scored.log.scoreBefore, 10);
    assert.equal(scored.log.scoreAfter, 15);

    const scoreLogId = String((scored.log as { id?: string; _id?: unknown }).id ?? (scored.log as { _id?: unknown })._id);
    const reverted = await revertScore(String(session._id), scoreLogId, operatorId);

    const refreshed = await ContestSessionModel.findById(session._id).lean();
    const teamA = refreshed?.scores.find((item) => item.teamId === 'team-A');
    assert.equal(teamA?.score, 10);

    assert.equal(reverted.log.isReverted, true);

    const logs = await ScoreLogModel.find({ sessionId: session._id }).lean();
    assert.equal(logs.length, 2);
  });
});
