import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.model';
import { UserRole, type AuthTokens } from '../types/user.types';
import { ApiError } from '../utils/api-error';
import { signAccessToken, signRefreshToken, verifyJwt } from '../utils/jwt';
import { sendMagicLinkEmail, sendRegistrationEmail } from './email.service';
import { getAllowedEmailDomains } from './settings.service';

function toPublicUser(user: {
  _id: unknown;
  username: string;
  displayName: string;
  role: UserRole;
  email?: string | null;
  ownedBankIds?: unknown[];
}) {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    ownedBankIds: (user.ownedBankIds ?? []).map((id) => String(id)),
  };
}

function buildTokens(user: { _id: unknown; role: UserRole }): AuthTokens {
  return {
    token: signAccessToken({ userId: String(user._id), role: user.role }),
    refreshToken: signRefreshToken({ userId: String(user._id), role: user.role }),
  };
}

export async function logout(): Promise<void> {
  // JWT stateless auth: logout handled on client by clearing tokens.
}

export async function me(userId: string) {
  const user = await UserModel.findOne({ _id: userId, isActive: true }).lean();
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
  }

  return toPublicUser(user);
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyJwt(refreshToken);
  } catch {
    throw new ApiError(401, 'AUTH_INVALID_TOKEN', '刷新令牌无效');
  }

  if (payload.tokenType !== 'refresh') {
    throw new ApiError(401, 'AUTH_INVALID_TOKEN', '刷新令牌类型错误');
  }

  const user = await UserModel.findOne({ _id: payload.userId, isActive: true }).lean();
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
  }

  const tokens = buildTokens({ _id: user._id, role: user.role });

  return {
    ...tokens,
    user: toPublicUser(user),
  };
}

export async function requestMagicLink(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await UserModel.findOne({ email: normalizedEmail, isActive: true }).select('+magicLinkToken').lean(false);

  // Always return success to avoid revealing whether the email exists
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  user.magicLinkToken = hashedToken;
  user.magicLinkTokenExpiresAt = expiresAt;
  await user.save();

  await sendMagicLinkEmail(normalizedEmail, rawToken, user.displayName);
}

export async function verifyMagicLink(token: string) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await UserModel.findOne({
    magicLinkToken: hashedToken,
    magicLinkTokenExpiresAt: { $gt: new Date() },
    isActive: true,
  }).select('+magicLinkToken').lean(false);

  if (!user) {
    throw new ApiError(401, 'AUTH_INVALID_TOKEN', '链接无效或已过期，请重新请求登录链接');
  }

  // Consume the token (one-time use)
  user.magicLinkToken = undefined as unknown as string;
  user.magicLinkTokenExpiresAt = undefined as unknown as Date;
  await user.save();

  const tokens = buildTokens({ _id: user._id, role: user.role });
  return { ...tokens, user: toPublicUser(user) };
}

/**
 * Unified magic-link endpoint: handles both login (existing user) and
 * registration (new user) in one flow.
 *
 * Returns:
 *   { isNewUser: false }              — existing user, login link sent
 *   { isNewUser: true, needsName: true } — new user, displayName required
 *   { isNewUser: true, needsName: false } — new user registered, link sent
 */
export async function magicLink(
  email: string,
  displayName?: string,
): Promise<{ isNewUser: boolean; needsName: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await UserModel.findOne({ email: normalizedEmail }).select('+magicLinkToken').lean(false);

  if (existing) {
    if (!existing.isActive) {
      throw new ApiError(403, 'AUTH_ACCOUNT_DISABLED', '该账号已被禁用，请联系管理员');
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    existing.magicLinkToken = hashedToken;
    existing.magicLinkTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await existing.save();
    await sendMagicLinkEmail(normalizedEmail, rawToken, existing.displayName);
    return { isNewUser: false, needsName: false };
  }

  // New user — need display name before proceeding
  if (!displayName) {
    return { isNewUser: true, needsName: true };
  }

  // Validate email domain whitelist (read from DB, fallback to env)
  const allowedDomains = await getAllowedEmailDomains();
  if (allowedDomains.length > 0) {
    const domain = normalizedEmail.split('@')[1] ?? '';
    if (!allowedDomains.includes(domain)) {
      throw new ApiError(
        400,
        'AUTH_EMAIL_DOMAIN_NOT_ALLOWED',
        `仅允许以下邮箱域名注册：${allowedDomains.join('、')}`,
      );
    }
  }

  // Generate unique username from email prefix
  const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 50);
  let username = baseUsername;
  let suffix = 1;
  while (await UserModel.exists({ username })) {
    username = `${baseUsername}_${suffix++}`;
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  const user = new UserModel({
    username,
    displayName: displayName.trim(),
    passwordHash,
    email: normalizedEmail,
    role: UserRole.PARTICIPANT,
    isActive: true,
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.magicLinkToken = hashedToken;
  user.magicLinkTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  await sendRegistrationEmail(normalizedEmail, rawToken, displayName.trim());
  return { isNewUser: true, needsName: false };
}

export async function register(email: string, displayName: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // Validate email domain whitelist (read from DB, fallback to env)
  const allowedDomainsReg = await getAllowedEmailDomains();
  if (allowedDomainsReg.length > 0) {
    const domain = normalizedEmail.split('@')[1] ?? '';
    if (!allowedDomainsReg.includes(domain)) {
      throw new ApiError(
        400,
        'AUTH_EMAIL_DOMAIN_NOT_ALLOWED',
        `仅允许以下邮箱域名注册：${allowedDomainsReg.join('、')}`,
      );
    }
  }

  // If email already exists and is active, send a magic link for login instead
  const existing = await UserModel.findOne({ email: normalizedEmail }).select('+magicLinkToken').lean(false);
  if (existing) {
    if (!existing.isActive) {
      throw new ApiError(403, 'AUTH_ACCOUNT_DISABLED', '该账号已被禁用，请联系管理员');
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    existing.magicLinkToken = hashedToken;
    existing.magicLinkTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await existing.save();
    await sendMagicLinkEmail(normalizedEmail, rawToken, existing.displayName);
    return;
  }

  // Generate a unique username from email prefix
  const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 50);
  let username = baseUsername;
  let suffix = 1;
  while (await UserModel.exists({ username })) {
    username = `${baseUsername}_${suffix++}`;
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  const user = new UserModel({
    username,
    displayName: displayName.trim(),
    passwordHash,
    email: normalizedEmail,
    role: UserRole.PARTICIPANT,
    isActive: true,
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.magicLinkToken = hashedToken;
  user.magicLinkTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  await sendRegistrationEmail(normalizedEmail, rawToken, displayName.trim());
}
