import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.model';
import { ApiError } from '../utils/api-error';
import { toObjectId } from '../utils/object-id';
import { sendAdminCreatedUserEmail } from './email.service';

export async function listUsers() {
  const users = await UserModel.find().sort({ createdAt: -1 });
  return users.map((u) => u.toJSON());
}

export async function createUser(payload: {
  username: string;
  displayName: string;
  role: string;
  email?: string;
}) {
  const exists = await UserModel.findOne({ username: payload.username }).lean();
  if (exists) {
    throw new ApiError(409, 'USER_ALREADY_EXISTS', '用户名已存在');
  }

  // Generate a random internal password hash — users never set or see a password
  const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

  // If email provided, pre-generate a 24-hour magic link for the welcome email
  const rawToken = payload.email ? crypto.randomBytes(32).toString('hex') : null;
  const hashedToken = rawToken ? crypto.createHash('sha256').update(rawToken).digest('hex') : null;

  const user = await UserModel.create({
    username: payload.username,
    displayName: payload.displayName,
    passwordHash,
    role: payload.role,
    email: payload.email,
    ownedBankIds: [],
    isActive: true,
    ...(hashedToken ? {
      magicLinkToken: hashedToken,
      magicLinkTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    } : {}),
  });

  // Send welcome email (fire-and-forget — don't block or fail the response)
  if (rawToken && payload.email) {
    sendAdminCreatedUserEmail(payload.email, rawToken, payload.displayName, payload.username).catch(
      (err: unknown) => console.error('[email] Failed to send welcome email:', err),
    );
  }

  return user.toJSON();
}

export async function updateUser(
  userId: string,
  payload: {
    displayName?: string;
    role?: string;
    email?: string;
    isActive?: boolean;
  },
) {
  const user = await UserModel.findByIdAndUpdate(
    toObjectId(userId, 'userId'),
    {
      ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
      ...(payload.role !== undefined ? { role: payload.role } : {}),
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    { returnDocument: 'after' },
  );

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
  }

  return user.toJSON();
}

export async function disableUser(userId: string): Promise<void> {
  const result = await UserModel.updateOne({ _id: toObjectId(userId, 'userId') }, { $set: { isActive: false } });
  if (!result.matchedCount) {
    throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
  }
}

export async function resendInvite(userId: string): Promise<void> {
  const user = await UserModel.findById(toObjectId(userId, 'userId'));
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
  }
  if (!user.email) {
    throw new ApiError(400, 'USER_NO_EMAIL', '该用户没有绑定邮箱，无法发送邀请');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.magicLinkToken = hashedToken;
  user.magicLinkTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  await sendAdminCreatedUserEmail(user.email, rawToken, user.displayName, user.username);
}
