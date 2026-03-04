import { Schema, model, type InferSchemaType } from 'mongoose';
import { ContestMode, ContestStatus, SelectionMode } from '../types/contest.types';
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

const difficultyDistributionSchema = new Schema(
  {
    difficulty: {
      type: Number,
      enum: Object.values(Difficulty).filter((value) => typeof value === 'number'),
      required: true,
    },
    count: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const roundSchema = new Schema(
  {
    roundNumber: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    questionCount: { type: Number, required: true, min: 1 },
    timePerQuestion: { type: Number, required: true, min: 0 },
    bankId: { type: Schema.Types.ObjectId, ref: 'QuestionBank', required: true },
    selectionMode: {
      type: String,
      enum: Object.values(SelectionMode),
      required: true,
    },
    difficultyConstraint: {
      min: {
        type: Number,
        enum: Object.values(Difficulty).filter((value) => typeof value === 'number'),
      },
      max: {
        type: Number,
        enum: Object.values(Difficulty).filter((value) => typeof value === 'number'),
      },
      distribution: {
        type: [difficultyDistributionSchema],
        default: undefined,
      },
    },
    tagConstraints: {
      required: { type: [String], default: undefined },
      forbidden: { type: [String], default: undefined },
      preferred: { type: [String], default: undefined },
    },
    questionIds: {
      type: [Schema.Types.ObjectId],
      default: undefined,
    },
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
