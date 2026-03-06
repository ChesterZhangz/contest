import { QuestionBankModel } from '../models/QuestionBank.model';
import { UserModel } from '../models/User.model';
import { ApiError } from '../utils/api-error';
import { toObjectId } from '../utils/object-id';

function withId<T extends { _id: unknown }>(doc: T) {
  return { ...doc, id: String(doc._id) };
}

export async function getMyBanks(userId: string) {
  const banks = await QuestionBankModel.find({ ownerId: toObjectId(userId, 'userId'), isDeleted: false })
    .sort({ updatedAt: -1 })
    .lean();
  return banks.map(withId);
}

export async function getPublicBanks() {
  const banks = await QuestionBankModel.find({ isPublic: true, isDeleted: false }).sort({ updatedAt: -1 }).lean();
  return banks.map(withId);
}

export async function getAllBanks() {
  const banks = await QuestionBankModel.find({ isDeleted: false }).sort({ updatedAt: -1 }).lean();
  return banks.map(withId);
}

export async function createBank(userId: string, data: { name: string; description?: string; isPublic?: boolean }) {
  const ownerId = toObjectId(userId, 'userId');
  const bank = await QuestionBankModel.create({
    name: data.name,
    description: data.description,
    isPublic: data.isPublic ?? false,
    ownerId,
    questionCount: 0,
    tags: [],
  });

  await UserModel.updateOne({ _id: ownerId }, { $addToSet: { ownedBankIds: bank._id } });
  return bank.toJSON();
}

export async function assertBankOwner(bankId: string, userId: string) {
  const bank = await QuestionBankModel.findOne({ _id: toObjectId(bankId, 'bankId'), isDeleted: false });
  if (!bank) {
    throw new ApiError(404, 'BANK_NOT_FOUND', '题库不存在');
  }

  if (String(bank.ownerId) !== userId) {
    throw new ApiError(403, 'FORBIDDEN', '仅题库所有者可操作');
  }

  return bank;
}

export async function getBankById(bankId: string, userId: string) {
  const bank = await QuestionBankModel.findOne({ _id: toObjectId(bankId, 'bankId'), isDeleted: false }).lean();
  if (!bank) {
    throw new ApiError(404, 'BANK_NOT_FOUND', '题库不存在');
  }

  if (String(bank.ownerId) !== userId && !bank.isPublic) {
    throw new ApiError(403, 'FORBIDDEN', '无权限访问该题库');
  }

  return withId(bank);
}

export async function updateBank(bankId: string, userId: string, data: { name?: string; description?: string; isPublic?: boolean }) {
  await assertBankOwner(bankId, userId);

  const updated = await QuestionBankModel.findByIdAndUpdate(
    toObjectId(bankId, 'bankId'),
    {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
    },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) {
    throw new ApiError(404, 'BANK_NOT_FOUND', '题库不存在');
  }

  return withId(updated);
}

export async function deleteBank(bankId: string, userId: string): Promise<void> {
  const bank = await assertBankOwner(bankId, userId);
  bank.isDeleted = true;
  await bank.save();
}

export async function refreshBankMeta(bankId: string): Promise<void> {
  const bankObjectId = toObjectId(bankId, 'bankId');
  const { QuestionModel } = await import('../models/Question.model');

  const [meta] = await QuestionModel.aggregate<{
    total: number;
    tags: string[];
  }>([
    {
      $match: {
        bankId: bankObjectId,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        tags: { $addToSet: '$tags' },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        tags: {
          $reduce: {
            input: '$tags',
            initialValue: [],
            in: { $setUnion: ['$$value', '$$this'] },
          },
        },
      },
    },
  ]);

  await QuestionBankModel.updateOne(
    { _id: bankObjectId },
    {
      $set: {
        questionCount: meta?.total ?? 0,
        tags: meta?.tags ?? [],
      },
    },
  );
}
