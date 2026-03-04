import { Schema, model, type InferSchemaType } from 'mongoose';

const questionBankSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1024,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    questionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: {
      type: [String],
      default: [],
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

questionBankSchema.index({ ownerId: 1, isDeleted: 1 });

export type QuestionBankDocument = InferSchemaType<typeof questionBankSchema>;
export const QuestionBankModel = model<QuestionBankDocument>('QuestionBank', questionBankSchema);
