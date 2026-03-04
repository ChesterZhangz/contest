import { Types } from 'mongoose';
import { QuestionModel } from '../models/Question.model';
import { ApiError } from './api-error';

interface SamplerSource {
  bankId: Types.ObjectId;
  allocations: Array<{ difficulty: number; count: number }>;
}

interface SamplerRound {
  roundNumber: number;
  questionsPerBatch: number;
  sources: SamplerSource[];
  tagConstraints?: {
    required?: string[];
    forbidden?: string[];
    preferred?: string[];
  };
}

export interface GeneratedSessionQuestion {
  questionId: Types.ObjectId;
  roundNumber: number;
  orderInRound: number;
  globalOrder: number;
  isRevealed: boolean;
}

export async function generateQuestionSequence(rounds: SamplerRound[]): Promise<GeneratedSessionQuestion[]> {
  const sequence: GeneratedSessionQuestion[] = [];
  let globalOrder = 0;
  const usedQuestionIds = new Set<string>();

  for (const round of rounds) {
    const selectedIds: Types.ObjectId[] = [];

    for (const source of round.sources) {
      for (const allocation of source.allocations) {
        const matchStage: Record<string, unknown> = {
          bankId: source.bankId,
          difficulty: allocation.difficulty,
          isDeleted: false,
          _id: { $nin: Array.from(usedQuestionIds).map((id) => new Types.ObjectId(id)) },
        };

        if (round.tagConstraints?.required?.length) {
          matchStage.tags = { $all: round.tagConstraints.required };
        }

        if (round.tagConstraints?.forbidden?.length) {
          matchStage.tags = {
            ...(matchStage.tags as Record<string, unknown>),
            $nin: round.tagConstraints.forbidden,
          };
        }

        const sampled = (await QuestionModel.aggregate([
          { $match: matchStage },
          { $sample: { size: allocation.count } },
          { $project: { _id: 1 } },
        ])) as Array<{ _id: Types.ObjectId }>;

        if (sampled.length < allocation.count) {
          throw new ApiError(
            422,
            'INSUFFICIENT_QUESTIONS',
            `第 ${round.roundNumber} 轮题库不足：难度 ${allocation.difficulty} 需要 ${allocation.count} 题，但只有 ${sampled.length} 题可用`,
          );
        }

        for (const item of sampled) {
          selectedIds.push(item._id);
          usedQuestionIds.add(item._id.toString());
        }
      }
    }

    selectedIds.forEach((questionId, index) => {
      sequence.push({
        questionId,
        roundNumber: round.roundNumber,
        orderInRound: index + 1,
        globalOrder: ++globalOrder,
        isRevealed: false,
      });
    });
  }

  return sequence;
}
