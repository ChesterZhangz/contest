import { Schema, model, type InferSchemaType } from 'mongoose';
import { SessionState } from '../types/session.types';

const sessionQuestionSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    roundNumber: { type: Number, required: true, min: 1 },
    orderInRound: { type: Number, required: true, min: 1 },
    globalOrder: { type: Number, required: true, min: 1 },
    isRevealed: { type: Boolean, default: false },
    revealedAt: { type: Date },
  },
  { _id: false },
);

const sessionScoreSchema = new Schema(
  {
    teamId: { type: String, required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false },
);

const contestSessionSchema = new Schema(
  {
    contestId: { type: Schema.Types.ObjectId, ref: 'Contest', required: true, unique: true, index: true },
    questionSequence: { type: [sessionQuestionSchema], default: [] },
    currentQuestionIndex: { type: Number, default: -1 },
    currentRoundIndex: { type: Number, default: 0 },
    state: {
      type: String,
      enum: Object.values(SessionState),
      default: SessionState.WAITING,
    },
    timer: {
      totalSeconds: { type: Number, default: 0, min: 0 },
      remainingSeconds: { type: Number, default: 0, min: 0 },
      startedAt: { type: Date },
      isPaused: { type: Boolean, default: true },
    },
    scores: { type: [sessionScoreSchema], default: [] },
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

export type ContestSessionDocument = InferSchemaType<typeof contestSessionSchema>;
export const ContestSessionModel = model<ContestSessionDocument>('ContestSession', contestSessionSchema);
