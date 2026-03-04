import { Types } from 'mongoose';
import { QuestionModel } from '../models/Question.model';
import { SelectionMode } from '../types/contest.types';
import { ApiError } from './api-error';

interface SamplerRound {
  roundNumber: number;
  questionCount: number;
  bankId: Types.ObjectId;
  selectionMode: SelectionMode;
  difficultyConstraint?: {
    min?: number;
    max?: number;
    distribution?: Array<{ difficulty: number; count: number }>;
  };
  tagConstraints?: {
    required?: string[];
    forbidden?: string[];
    preferred?: string[];
  };
  questionIds?: Types.ObjectId[];
}

export interface GeneratedSessionQuestion {
  questionId: Types.ObjectId;
  roundNumber: number;
  orderInRound: number;
  globalOrder: number;
  isRevealed: boolean;
}

function toObjectIdStringSet(ids: Types.ObjectId[]): Set<string> {
  return new Set(ids.map((id) => id.toString()));
}

export async function generateQuestionSequence(rounds: SamplerRound[]): Promise<GeneratedSessionQuestion[]> {
  const sequence: GeneratedSessionQuestion[] = [];
  let globalOrder = 0;
  const usedQuestionIds = new Set<string>();

  for (const round of rounds) {
    let selectedIds: Types.ObjectId[] = [];

    if (round.selectionMode === SelectionMode.MANUAL) {
      const manualIds = round.questionIds ?? [];
      if (manualIds.length < round.questionCount) {
        throw new ApiError(
          422,
          'INSUFFICIENT_QUESTIONS',
          `第 ${round.roundNumber} 轮手动题目不足，至少需要 ${round.questionCount} 题`,
        );
      }

      const existing = await QuestionModel.find({
        _id: { $in: manualIds },
        bankId: round.bankId,
        isDeleted: false,
      })
        .select('_id')
        .lean();

      const existingSet = new Set(existing.map((item) => String(item._id)));
      const deduped = manualIds.filter((id) => existingSet.has(String(id)) && !usedQuestionIds.has(String(id)));

      if (deduped.length < round.questionCount) {
        throw new ApiError(
          422,
          'INSUFFICIENT_QUESTIONS',
          `第 ${round.roundNumber} 轮手动题目不足（题目不存在、已删除或重复使用）`,
        );
      }

      selectedIds = deduped.slice(0, round.questionCount);
    } else {
      const match: Record<string, unknown> = {
        bankId: round.bankId,
        isDeleted: false,
        _id: {
          $nin: Array.from(usedQuestionIds).map((id) => new Types.ObjectId(id)),
        },
      };

      if (round.difficultyConstraint?.min && round.difficultyConstraint?.max) {
        match.difficulty = {
          $gte: round.difficultyConstraint.min,
          $lte: round.difficultyConstraint.max,
        };
      }

      if (round.tagConstraints?.required?.length) {
        match.tags = {
          ...(match.tags as Record<string, unknown>),
          $all: round.tagConstraints.required,
        };
      }

      if (round.tagConstraints?.forbidden?.length) {
        match.tags = {
          ...(match.tags as Record<string, unknown>),
          $nin: round.tagConstraints.forbidden,
        };
      }

      if (round.difficultyConstraint?.distribution?.length) {
        const aggregated: Types.ObjectId[] = [];

        for (const dist of round.difficultyConstraint.distribution) {
          const batch = (await QuestionModel.aggregate([
            {
              $match: {
                ...match,
                difficulty: dist.difficulty,
                _id: {
                  $nin: Array.from(toObjectIdStringSet(aggregated), (id) => new Types.ObjectId(id)).concat(
                    Array.from(usedQuestionIds, (id) => new Types.ObjectId(id)),
                  ),
                },
              },
            },
            { $sample: { size: dist.count } },
            { $project: { _id: 1 } },
          ])) as Array<{ _id: Types.ObjectId }>;

          aggregated.push(...batch.map((item) => item._id));
        }

        selectedIds = aggregated.slice(0, round.questionCount);
      } else {
        const sampled = (await QuestionModel.aggregate([
          { $match: match },
          { $sample: { size: round.questionCount } },
          { $project: { _id: 1 } },
        ])) as Array<{ _id: Types.ObjectId }>;

        selectedIds = sampled.map((item) => item._id);
      }

      if (selectedIds.length < round.questionCount) {
        throw new ApiError(
          422,
          'INSUFFICIENT_QUESTIONS',
          `第 ${round.roundNumber} 轮需要 ${round.questionCount} 题，但可用题目只有 ${selectedIds.length} 题`,
        );
      }
    }

    selectedIds.slice(0, round.questionCount).forEach((questionId, index) => {
      sequence.push({
        questionId,
        roundNumber: round.roundNumber,
        orderInRound: index + 1,
        globalOrder: ++globalOrder,
        isRevealed: false,
      });
      usedQuestionIds.add(questionId.toString());
    });
  }

  return sequence;
}
