import { Schema, model, type InferSchemaType } from 'mongoose';

const tagSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    color: {
      type: String,
      trim: true,
      maxlength: 16,
    },
    questionCount: {
      type: Number,
      default: 0,
      min: 0,
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

export type TagDocument = InferSchemaType<typeof tagSchema>;
export const TagModel = model<TagDocument>('Tag', tagSchema);
