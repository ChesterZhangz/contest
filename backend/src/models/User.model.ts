import { Schema, model, type InferSchemaType } from 'mongoose';
import { UserRole } from '../types/user.types';

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    ownedBankIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'QuestionBank' }],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    magicLinkToken: {
      type: String,
      select: false,
    },
    magicLinkTokenExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.magicLinkToken;
        delete ret.magicLinkTokenExpiresAt;
        ret.id = ret._id;
        delete ret._id;
      },
    },
  },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model<UserDocument>('User', userSchema);
