import { z } from 'zod';
import { ContestMode, ContestStatus } from '../types/contest.types';
import { Difficulty, QuestionType } from '../types/question.types';
import { ScoreOpType } from '../types/session.types';
import { UserRole } from '../types/user.types';

const idString = z.string().min(1);

const choiceSchema = z.object({
  label: z.string().trim().min(1),
  content: z.string().trim().min(1),
});

const scoreSchema = z.object({
  correctScore: z.number().int(),
  wrongScore: z.number().int(),
  partialScore: z.number().int().optional(),
});

const difficultyDistributionSchema = z.object({
  difficulty: z.nativeEnum(Difficulty),
  count: z.number().int().positive(),
});

export const requestMagicLinkSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  displayName: z.string().trim().min(1, '请输入显示名称').max(128),
});

export const magicLinkSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  displayName: z.string().trim().min(1).max(128).optional(),
});

export const createBankSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(1024).optional(),
  isPublic: z.boolean().default(false),
});

export const updateBankSchema = createBankSchema.partial();

const questionBaseSchema = z.object({
  bankId: idString,
  content: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  solution: z.string().trim().optional(),
  type: z.nativeEnum(QuestionType),
  difficulty: z.nativeEnum(Difficulty),
  tags: z.array(z.string().trim().min(1)).default([]),
  choices: z.array(choiceSchema).optional(),
  correctChoice: z.string().trim().optional(),
  source: z.string().trim().optional(),
});

export const createQuestionSchema = questionBaseSchema.superRefine((data, ctx) => {
    if (data.type === QuestionType.MULTIPLE_CHOICE) {
      if (!data.choices || data.choices.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['choices'],
          message: '选择题必须至少包含 2 个选项',
        });
      }
      if (!data.correctChoice) {
        ctx.addIssue({
          code: 'custom',
          path: ['correctChoice'],
          message: '选择题必须提供正确选项',
        });
      }
    }
  });

export const updateQuestionSchema = questionBaseSchema.omit({ bankId: true }).partial();

const csvArrayField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.flatMap((entry) => entry.split(',')).map((entry) => entry.trim()).filter(Boolean);
    }
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  });

export const questionQuerySchema = z.object({
  bankId: idString,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().optional(),
  difficulty: csvArrayField,
  tags: csvArrayField,
  type: csvArrayField,
  sortBy: z.enum(['createdAt', 'difficulty', 'usageCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const batchQuestionsSchema = z.object({
  questions: z.array(questionBaseSchema.omit({ bankId: true })).min(1),
  bankId: idString,
});

export const importQuestionsSchema = z.object({
  bankId: idString,
  format: z.enum(['json', 'csv']),
  content: z.string().min(1),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(64),
  category: z.string().trim().max(64).optional(),
  color: z.string().trim().max(16).optional(),
});

const difficultyAllocationSchema = z.object({
  difficulty: z.nativeEnum(Difficulty),
  count: z.number().int().positive(),
});

const roundSourceSchema = z.object({
  bankId: idString,
  allocations: z.array(difficultyAllocationSchema).min(1),
});

const difficultyTimingSchema = z.object({
  difficulty: z.nativeEnum(Difficulty),
  timeSeconds: z.number().int().min(1),
});

const roundSchema = z.object({
  roundNumber: z.number().int().positive(),
  name: z.string().trim().min(1).max(128),
  questionsPerBatch: z.number().int().positive(),
  sources: z.array(roundSourceSchema).min(1),
  tagConstraints: z
    .object({
      required: z.array(z.string().trim().min(1)).optional(),
      forbidden: z.array(z.string().trim().min(1)).optional(),
      preferred: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
  timings: z.array(difficultyTimingSchema).min(1),
  scoring: scoreSchema,
});

const teamSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(128),
  color: z.string().trim().min(1).max(16),
  memberIds: z.array(idString).default([]),
  initialScore: z.number().default(0),
});

export const createContestSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(2048).optional(),
  judgeIds: z.array(idString).default([]),
  mode: z.nativeEnum(ContestMode),
  teams: z.array(teamSchema).default([]),
  participants: z.array(idString).default([]),
  rounds: z.array(roundSchema).min(1),
  status: z.nativeEnum(ContestStatus).optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const updateContestSchema = createContestSchema.partial();

export const scoreSchemaRequest = z.object({
  teamId: z.string().trim().min(1),
  delta: z.number(),
  type: z.nativeEnum(ScoreOpType),
  questionId: idString.optional(),
  note: z.string().trim().max(1024).optional(),
});

export const nextQuestionSchema = z.object({
  skipTo: z.number().int().positive().optional(),
});

export const timerControlSchema = z.object({
  action: z.enum(['start', 'pause', 'reset']),
});

export const timerAdjustSchema = z.object({
  deltaSeconds: z.number().int().refine((v) => v !== 0, { message: 'deltaSeconds 不能为 0' }),
});

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(64),
  displayName: z.string().trim().min(1).max(128),
  role: z.nativeEnum(UserRole),
  email: z.string().email().optional(),
});

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(128).optional(),
    role: z.nativeEnum(UserRole).optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '至少提供一个更新字段',
  });

export const updateSettingsSchema = z.object({
  allowedEmailDomains: z.array(z.string().trim().toLowerCase()).optional(),
  defaultBonusDelta: z.number().int().positive().optional(),
  defaultPenaltyDelta: z.number().int().negative().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少提供一个设置字段',
});
