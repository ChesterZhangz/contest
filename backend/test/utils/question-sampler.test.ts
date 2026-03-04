import '../helpers/test-env';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { setupTestDatabase, clearDatabase, teardownTestDatabase } from '../helpers/test-db';
import { QuestionModel } from '../../src/models/Question.model';
import { generateQuestionSequence } from '../../src/utils/question-sampler';
import { SelectionMode } from '../../src/types/contest.types';
import { Difficulty, QuestionType } from '../../src/types/question.types';
import { ApiError } from '../../src/utils/api-error';

async function seedQuestions(bankId: Types.ObjectId, count: number): Promise<Types.ObjectId[]> {
  const docs = await QuestionModel.insertMany(
    Array.from({ length: count }).map((_, idx) => ({
      bankId,
      content: `Q${idx + 1}`,
      answer: `A${idx + 1}`,
      type: QuestionType.SHORT_ANSWER,
      difficulty: (idx % 5) + 1,
      tags: idx % 2 === 0 ? ['函数'] : ['数列'],
      authorId: new Types.ObjectId(),
      usageCount: 0,
      isDeleted: false,
    })),
  );

  return docs.map((doc) => doc._id as Types.ObjectId);
}

describe('question-sampler', () => {
  before(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('generates random sequence with constraints', async () => {
    const bankId = new Types.ObjectId();
    await seedQuestions(bankId, 12);

    const sequence = await generateQuestionSequence([
      {
        roundNumber: 1,
        questionCount: 4,
        bankId,
        selectionMode: SelectionMode.RANDOM,
        difficultyConstraint: { min: Difficulty.EASY, max: Difficulty.EXTREME },
        tagConstraints: { required: ['函数'] },
      },
    ]);

    assert.equal(sequence.length, 4);
    const uniqueIds = new Set(sequence.map((item) => String(item.questionId)));
    assert.equal(uniqueIds.size, 4);
    assert.deepEqual(sequence.map((item) => item.globalOrder), [1, 2, 3, 4]);
  });

  it('rejects manual sequence when same question reused', async () => {
    const bankId = new Types.ObjectId();
    const ids = await seedQuestions(bankId, 3);

    await assert.rejects(
      () =>
        generateQuestionSequence([
          {
            roundNumber: 1,
            questionCount: 2,
            bankId,
            selectionMode: SelectionMode.MANUAL,
            questionIds: [ids[0], ids[1]],
          },
          {
            roundNumber: 2,
            questionCount: 2,
            bankId,
            selectionMode: SelectionMode.MANUAL,
            questionIds: [ids[1], ids[2]],
          },
        ]),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, 'INSUFFICIENT_QUESTIONS');
        return true;
      },
    );
  });
});
