import { QuestionModel } from '../models/Question.model';
import { TagModel } from '../models/Tag.model';

export async function listTags() {
  const tags = await TagModel.find().sort({ questionCount: -1, name: 1 }).lean();
  return { tags };
}

export async function createTag(payload: { name: string; category?: string; color?: string }) {
  const tag = await TagModel.findOneAndUpdate(
    { name: payload.name },
    {
      $setOnInsert: {
        name: payload.name,
        questionCount: 0,
      },
      $set: {
        ...(payload.category !== undefined ? { category: payload.category } : {}),
        ...(payload.color !== undefined ? { color: payload.color } : {}),
      },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  return tag;
}

export async function deleteTag(name: string): Promise<void> {
  await Promise.all([
    TagModel.deleteOne({ name }),
    QuestionModel.updateMany(
      { tags: name },
      {
        $pull: {
          tags: name,
        },
      },
    ),
  ]);
}
