import { Schema, model, type InferSchemaType } from 'mongoose';
import { ScoreOpType } from '../types/session.types';

const scoreLogSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ContestSession', required: true, index: true },
    contestId: { type: Schema.Types.ObjectId, ref: 'Contest', required: true, index: true },
    operatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    operationType: {
      type: String,
      enum: Object.values(ScoreOpType),
      required: true,
    },
    targetTeamId: { type: String, required: true },
    delta: { type: Number, required: true },
    scoreBefore: { type: Number, required: true },
    scoreAfter: { type: Number, required: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
    roundNumber: { type: Number },
    isReverted: { type: Boolean, default: false, index: true },
    revertedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    revertedAt: { type: Date },
    note: { type: String, trim: true, maxlength: 1024 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  },
);

scoreLogSchema.index({ sessionId: 1, createdAt: -1 });

export type ScoreLogDocument = InferSchemaType<typeof scoreLogSchema>;
export const ScoreLogModel = model<ScoreLogDocument>('ScoreLog', scoreLogSchema);
