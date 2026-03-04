import { z } from 'zod';
import { Difficulty, QuestionType } from '../types/question.types';
import { parseImportPayload } from '../utils/import-parser';

const importQuestionSchema = z
  .object({
    content: z.string().trim().min(1),
    answer: z.string().trim().min(1),
    solution: z.string().trim().optional(),
    type: z.nativeEnum(QuestionType),
    difficulty: z.nativeEnum(Difficulty),
    tags: z.array(z.string().trim().min(1)).default([]),
    choices: z.array(z.object({ label: z.string().trim().min(1), content: z.string().trim().min(1) })).optional(),
    correctChoice: z.string().trim().optional(),
    source: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === QuestionType.MULTIPLE_CHOICE) {
      if (!data.choices || data.choices.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['choices'], message: '选择题必须至少包含 2 个选项' });
      }
      if (!data.correctChoice) {
        ctx.addIssue({ code: 'custom', path: ['correctChoice'], message: '选择题必须提供正确选项' });
      }
    }
  });

export interface ImportValidationError {
  index: number;
  field?: string;
  message: string;
}

export interface PreviewImportResult {
  total: number;
  valid: number;
  invalid: number;
  newTagsToCreate: string[];
  difficultyDistribution: Record<number, number>;
  tagDistribution: Record<string, number>;
  errors: ImportValidationError[];
  preview: Array<Record<string, unknown>>;
  normalized: Array<Record<string, unknown>>;
}

export function validateImportContent(format: 'json' | 'csv', content: string): PreviewImportResult {
  const raw = parseImportPayload(format, content);

  const difficultyDistribution: Record<number, number> = {};
  const tagDistribution: Record<string, number> = {};
  const normalized: Array<Record<string, unknown>> = [];
  const errors: ImportValidationError[] = [];
  const discoveredTags = new Set<string>();

  raw.forEach((item, idx) => {
    const parsed = importQuestionSchema.safeParse(item);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push({
        index: idx + 1,
        field: issue?.path.join('.') || undefined,
        message: issue?.message ?? '数据校验失败',
      });
      return;
    }

    const value = parsed.data;
    normalized.push(value as unknown as Record<string, unknown>);

    difficultyDistribution[value.difficulty] = (difficultyDistribution[value.difficulty] ?? 0) + 1;

    value.tags.forEach((tag) => {
      discoveredTags.add(tag);
      tagDistribution[tag] = (tagDistribution[tag] ?? 0) + 1;
    });
  });

  return {
    total: raw.length,
    valid: normalized.length,
    invalid: errors.length,
    newTagsToCreate: Array.from(discoveredTags),
    difficultyDistribution,
    tagDistribution,
    errors,
    preview: normalized.slice(0, 5),
    normalized,
  };
}
