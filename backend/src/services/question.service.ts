import { Types } from 'mongoose';
import { QuestionBankModel } from '../models/QuestionBank.model';
import { QuestionModel } from '../models/Question.model';
import { TagModel } from '../models/Tag.model';
import { QuestionType, type CreateQuestionDto, type UpdateQuestionDto } from '../types/question.types';
import { ApiError } from '../utils/api-error';
import { validateImportContent } from './import.service';
import { assertBankOwner, refreshBankMeta } from './bank.service';
import { toObjectId } from '../utils/object-id';
import { validateLatexText } from '../utils/latex.utils';

function normalizeTags(tags: string[] = []): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function validateQuestionLatex(content: string, answer: string, solution?: string): void {
  if (!validateLatexText(content) || !validateLatexText(answer)) {
    throw new ApiError(422, 'VALIDATION_ERROR', '题干或答案 LaTeX 格式不合法');
  }

  if (solution !== undefined && solution.trim() && !validateLatexText(solution)) {
    throw new ApiError(422, 'VALIDATION_ERROR', '解析 LaTeX 格式不合法');
  }
}

async function ensureTagsExist(tags: string[]): Promise<void> {
  if (!tags.length) {
    return;
  }

  await Promise.all(
    tags.map((tag) =>
      TagModel.updateOne(
        { name: tag },
        {
          $setOnInsert: {
            name: tag,
            questionCount: 0,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function refreshTagStats(): Promise<void> {
  const result = await QuestionModel.aggregate<{ _id: string; count: number }>([
    { $match: { isDeleted: false } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
  ]);

  await TagModel.updateMany({}, { $set: { questionCount: 0 } });
  await Promise.all(
    result.map((item) => TagModel.updateOne({ name: item._id }, { $set: { questionCount: item.count } }, { upsert: true })),
  );
}

async function assertQuestionOwner(questionId: string, userId: string) {
  const question = await QuestionModel.findOne({ _id: toObjectId(questionId, 'questionId'), isDeleted: false });
  if (!question) {
    throw new ApiError(404, 'QUESTION_NOT_FOUND', '题目不存在');
  }

  const bank = await QuestionBankModel.findOne({ _id: question.bankId, isDeleted: false });
  if (!bank) {
    throw new ApiError(404, 'BANK_NOT_FOUND', '题库不存在');
  }

  if (String(bank.ownerId) !== userId) {
    throw new ApiError(403, 'FORBIDDEN', '无权限操作该题目');
  }

  return question;
}

export async function queryQuestions(userId: string, params: Record<string, unknown>) {
  const bankId = String(params.bankId ?? '');
  if (!bankId) {
    throw new ApiError(422, 'VALIDATION_ERROR', '缺少 bankId');
  }

  const bank = await QuestionBankModel.findOne({ _id: toObjectId(bankId, 'bankId'), isDeleted: false }).lean();
  if (!bank) {
    throw new ApiError(404, 'BANK_NOT_FOUND', '题库不存在');
  }
  if (String(bank.ownerId) !== userId && !bank.isPublic) {
    throw new ApiError(403, 'FORBIDDEN', '无权限访问该题库');
  }

  const query: Record<string, unknown> = {
    bankId: bank._id,
    isDeleted: false,
  };

  if (params.keyword) {
    query.$text = { $search: params.keyword };
  }

  const difficultyValues = (params.difficulty as unknown[] | undefined)
    ?.map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));

  if (difficultyValues?.length) {
    query.difficulty = { $in: difficultyValues };
  }

  const tags = (params.tags as string[] | undefined)?.map((item) => item.trim()).filter(Boolean);
  if (tags?.length) {
    query.tags = { $all: tags };
  }

  const types = (params.type as string[] | undefined)
    ?.map((item) => item.trim())
    .filter((item) => Object.values(QuestionType).includes(item as QuestionType));

  if (types?.length) {
    query.type = { $in: types };
  }

  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 20);
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    QuestionModel.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    QuestionModel.countDocuments(query),
  ]);

  return {
    items: items.map((q) => ({ ...q, id: String(q._id) })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function createQuestion(userId: string, payload: CreateQuestionDto) {
  const bank = await assertBankOwner(payload.bankId, userId);
  validateQuestionLatex(payload.content, payload.answer, payload.solution);

  const tags = normalizeTags(payload.tags);
  await ensureTagsExist(tags);

  const created = await QuestionModel.create({
    ...payload,
    tags,
    bankId: bank._id,
    authorId: toObjectId(userId, 'userId'),
  });

  await Promise.all([refreshBankMeta(payload.bankId), refreshTagStats()]);

  return created.toJSON();
}

export async function getQuestionById(userId: string, questionId: string) {
  const question = await QuestionModel.findOne({ _id: toObjectId(questionId, 'questionId'), isDeleted: false });
  if (!question) {
    throw new ApiError(404, 'QUESTION_NOT_FOUND', '题目不存在');
  }

  const bank = await QuestionBankModel.findOne({ _id: question.bankId, isDeleted: false }).lean();
  if (!bank) {
    throw new ApiError(404, 'BANK_NOT_FOUND', '题库不存在');
  }

  if (String(bank.ownerId) !== userId && !bank.isPublic) {
    throw new ApiError(403, 'FORBIDDEN', '无权限访问该题目');
  }

  return question.toJSON();
}

export async function updateQuestion(userId: string, questionId: string, payload: UpdateQuestionDto) {
  const question = await assertQuestionOwner(questionId, userId);

  if (payload.content || payload.answer || payload.solution) {
    validateQuestionLatex(
      payload.content ?? question.content,
      payload.answer ?? question.answer,
      payload.solution ?? question.solution ?? undefined,
    );
  }

  const normalizedTags = payload.tags ? normalizeTags(payload.tags) : undefined;
  if (normalizedTags) {
    await ensureTagsExist(normalizedTags);
  }

  Object.assign(question, {
    ...payload,
    ...(normalizedTags ? { tags: normalizedTags } : {}),
  });

  await question.save();

  await Promise.all([refreshBankMeta(String(question.bankId)), refreshTagStats()]);

  return question.toJSON();
}

export async function deleteQuestion(userId: string, questionId: string): Promise<void> {
  const question = await assertQuestionOwner(questionId, userId);
  question.isDeleted = true;
  await question.save();

  await Promise.all([refreshBankMeta(String(question.bankId)), refreshTagStats()]);
}

export async function batchCreateQuestions(
  userId: string,
  bankId: string,
  questions: Array<Omit<CreateQuestionDto, 'bankId'>>,
) {
  await assertBankOwner(bankId, userId);

  const ownerId = toObjectId(userId, 'userId');
  const bankObjectId = toObjectId(bankId, 'bankId');

  const docs = questions.map((question) => {
    validateQuestionLatex(question.content, question.answer, question.solution);
    return {
      ...question,
      bankId: bankObjectId,
      authorId: ownerId,
      tags: normalizeTags(question.tags),
    };
  });

  const uniqueTags = Array.from(new Set(docs.flatMap((doc) => doc.tags)));
  await ensureTagsExist(uniqueTags);

  const inserted = await QuestionModel.insertMany(docs, { ordered: true });
  await Promise.all([refreshBankMeta(bankId), refreshTagStats()]);

  return inserted.map((item) => item.toJSON());
}

export async function previewImportQuestions(userId: string, bankId: string, format: 'json' | 'csv', content: string) {
  await assertBankOwner(bankId, userId);

  const preview = validateImportContent(format, content);

  const existingTags = await TagModel.find({ name: { $in: preview.newTagsToCreate } }).select('name').lean();
  const existing = new Set(existingTags.map((tag) => tag.name));

  return {
    total: preview.total,
    valid: preview.valid,
    invalid: preview.invalid,
    newTagsToCreate: preview.newTagsToCreate.filter((tag) => !existing.has(tag)),
    difficultyDistribution: preview.difficultyDistribution,
    tagDistribution: preview.tagDistribution,
    errors: preview.errors,
    preview: preview.preview,
  };
}

export async function importQuestions(userId: string, bankId: string, format: 'json' | 'csv', content: string) {
  await assertBankOwner(bankId, userId);

  const preview = validateImportContent(format, content);
  const ownerId = toObjectId(userId, 'userId');
  const bankObjectId = toObjectId(bankId, 'bankId');

  const result = {
    total: preview.total,
    success: 0,
    failed: preview.invalid,
    errors: [...preview.errors],
  };

  if (!preview.normalized.length) {
    return result;
  }

  const validRows = preview.normalized as Array<Omit<CreateQuestionDto, 'bankId'> & Record<string, unknown>>;

  const uniqueTags = Array.from(new Set(validRows.flatMap((row) => (row.tags as string[]) ?? [])));
  await ensureTagsExist(uniqueTags);

  const docs = validRows.map((row) => ({
    ...row,
    bankId: bankObjectId,
    authorId: ownerId,
    tags: normalizeTags((row.tags as string[]) ?? []),
  }));

  try {
    const inserted = await QuestionModel.insertMany(docs, { ordered: false });
    result.success = inserted.length;
  } catch (error) {
    if (error && typeof error === 'object' && 'writeErrors' in error) {
      const writeErrors = (error as { writeErrors: Array<{ index: number; errmsg?: string }> }).writeErrors;
      result.failed += writeErrors.length;
      result.success = docs.length - writeErrors.length;
      writeErrors.forEach((item) => {
        result.errors.push({ index: item.index + 1, message: item.errmsg ?? '写入失败' });
      });
    } else {
      throw error;
    }
  }

  await Promise.all([refreshBankMeta(bankId), refreshTagStats()]);

  return result;
}

export async function exportQuestionsByBank(userId: string, bankId: string) {
  await assertBankOwner(bankId, userId);
  const questions = await QuestionModel.find({ bankId: toObjectId(bankId, 'bankId'), isDeleted: false })
    .sort({ createdAt: 1 })
    .lean();

  return questions.map((question) => ({
    id: String(question._id),
    content: question.content,
    answer: question.answer,
    solution: question.solution,
    type: question.type,
    difficulty: question.difficulty,
    tags: question.tags,
    choices: question.choices,
    correctChoice: question.correctChoice,
    source: question.source,
  }));
}

export async function incrementQuestionUsage(questionIds: Types.ObjectId[]): Promise<void> {
  if (!questionIds.length) {
    return;
  }

  await QuestionModel.updateMany(
    { _id: { $in: questionIds } },
    {
      $inc: { usageCount: 1 },
    },
  );
}
