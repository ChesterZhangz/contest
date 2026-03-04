import { Schema, model, type InferSchemaType } from 'mongoose';
import { Difficulty, QuestionType } from '../types/question.types';

const choiceSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    bankId: {
      type: Schema.Types.ObjectId,
      ref: 'QuestionBank',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    contentRich: {
      type: String,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    solution: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(QuestionType),
      required: true,
      index: true,
    },
    difficulty: {
      type: Number,
      enum: Object.values(Difficulty).filter((value) => typeof value === 'number'),
      required: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    choices: {
      type: [choiceSchema],
      default: undefined,
    },
    correctChoice: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
      maxlength: 256,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  },
);

questionSchema.index({ bankId: 1, difficulty: 1, isDeleted: 1 });
questionSchema.index({ bankId: 1, tags: 1, isDeleted: 1 });
questionSchema.index({ content: 'text' });

export type QuestionDocument = InferSchemaType<typeof questionSchema>;
export const QuestionModel = model<QuestionDocument>('Question', questionSchema);
