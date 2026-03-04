import '../helpers/test-env';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseImportPayload } from '../../src/utils/import-parser';
import { ApiError } from '../../src/utils/api-error';

describe('import-parser', () => {
  it('parses JSON payload correctly', () => {
    const json = JSON.stringify([
      {
        content: '题目',
        answer: '答案',
        type: 'short_answer',
        difficulty: 2,
        tags: ['函数'],
      },
    ]);

    const parsed = parseImportPayload('json', json);

    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].content, '题目');
    assert.equal(parsed[0].difficulty, 2);
  });

  it('throws IMPORT_VALIDATION_ERROR for invalid JSON', () => {
    assert.throws(() => parseImportPayload('json', '{invalid'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'IMPORT_VALIDATION_ERROR');
      return true;
    });
  });

  it('parses CSV payload with tags and choices', () => {
    const csv = [
      'content,answer,solution,type,difficulty,tags,choices,correctChoice,source',
      '"已知 $f(x)=x^2$","B","代入可得","multiple_choice",1,"函数;代入","A:$6$|B:$9$|C:$12$|D:$18$","B","练习"',
    ].join('\n');

    const parsed = parseImportPayload('csv', csv);

    assert.equal(parsed.length, 1);
    assert.deepEqual(parsed[0].tags, ['函数', '代入']);
    assert.equal(parsed[0].correctChoice, 'B');

    const choices = parsed[0].choices as Array<{ label: string; content: string }>;
    assert.equal(choices.length, 4);
    assert.deepEqual(choices[1], { label: 'B', content: '$9$' });
  });
});
