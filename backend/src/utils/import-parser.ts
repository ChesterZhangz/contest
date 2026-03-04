import { parse } from 'csv-parse/sync';
import { ApiError } from './api-error';

type RawImportQuestion = Record<string, unknown>;

function parseChoices(raw: string): Array<{ label: string; content: string }> {
  return raw
    .split('|')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [label, ...rest] = chunk.split(':');
      return {
        label: (label ?? '').trim(),
        content: rest.join(':').trim(),
      };
    })
    .filter((choice) => choice.label && choice.content);
}

function normalizeCsvRecord(record: Record<string, string>): RawImportQuestion {
  const tags = (record.tags ?? '')
    .split(';')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const difficulty = Number(record.difficulty);

  const normalized: RawImportQuestion = {
    content: (record.content ?? '').trim(),
    answer: (record.answer ?? '').trim(),
    solution: (record.solution ?? '').trim() || undefined,
    type: (record.type ?? '').trim(),
    difficulty: Number.isFinite(difficulty) ? difficulty : record.difficulty,
    tags,
    correctChoice: (record.correctChoice ?? '').trim() || undefined,
    source: (record.source ?? '').trim() || undefined,
  };

  const choicesRaw = (record.choices ?? '').trim();
  if (choicesRaw) {
    normalized.choices = parseChoices(choicesRaw);
  }

  return normalized;
}

export function parseImportPayload(format: 'json' | 'csv', content: string): RawImportQuestion[] {
  if (!content.trim()) {
    throw new ApiError(400, 'IMPORT_VALIDATION_ERROR', '导入内容不能为空');
  }

  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ApiError(422, 'IMPORT_VALIDATION_ERROR', 'JSON 解析失败');
    }

    if (!Array.isArray(parsed)) {
      throw new ApiError(422, 'IMPORT_VALIDATION_ERROR', 'JSON 须为题目数组');
    }

    return parsed as RawImportQuestion[];
  }

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return records.map(normalizeCsvRecord);
}
