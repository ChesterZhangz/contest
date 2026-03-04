import { Schema, model, type InferSchemaType } from 'mongoose';
import { ContestMode, ContestStatus } from '../types/contest.types';
import { Difficulty } from '../types/question.types';

const teamSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    color: { type: String, required: true, trim: true, maxlength: 16 },
    memberIds: { type: [Schema.Types.ObjectId], default: [] },
    initialScore: { type: Number, default: 0 },
  },
  { _id: false },
);

const difficultyValues = Object.values(Difficulty).filter((v) => typeof v === 'number');

const difficultyAllocationSchema = new Schema(
  {
    difficulty: { type: Number, enum: difficultyValues, required: true },
    count: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const roundSourceSchema = new Schema(
  {
    bankId: { type: Schema.Types.ObjectId, ref: 'QuestionBank', required: true },
    allocations: { type: [difficultyAllocationSchema], required: true },
  },
  { _id: false },
);

const difficultyTimingSchema = new Schema(
  {
    difficulty: { type: Number, enum: difficultyValues, required: true },
    timeSeconds: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const roundSchema = new Schema(
  {
    roundNumber: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    questionsPerBatch: { type: Number, required: true, min: 1 },
    sources: { type: [roundSourceSchema], required: true },
    tagConstraints: {
      required: { type: [String], default: undefined },
      forbidden: { type: [String], default: undefined },
      preferred: { type: [String], default: undefined },
    },
    timings: { type: [difficultyTimingSchema], required: true },
    scoring: {
      correctScore: { type: Number, required: true },
      wrongScore: { type: Number, required: true },
      partialScore: { type: Number, default: undefined },
    },
  },
  { _id: false },
);

const contestSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 128 },
    description: { type: String, trim: true, maxlength: 2048 },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    judgeIds: { type: [Schema.Types.ObjectId], default: [] },
    mode: {
      type: String,
      enum: Object.values(ContestMode),
      required: true,
    },
    teams: { type: [teamSchema], default: [] },
    participants: { type: [Schema.Types.ObjectId], default: [] },
    rounds: { type: [roundSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(ContestStatus),
      default: ContestStatus.DRAFT,
      index: true,
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    finishedAt: { type: Date },
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

contestSchema.index({ hostId: 1, status: 1 });

export type ContestDocument = InferSchemaType<typeof contestSchema>;
export const ContestModel = model<ContestDocument>('Contest', contestSchema);
