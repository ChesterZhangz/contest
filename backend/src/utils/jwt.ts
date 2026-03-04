import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload, UserRole } from '../types/user.types';

interface SignTokenInput {
  userId: string;
  role: UserRole;
}

export function signAccessToken(input: SignTokenInput): string {
  return jwt.sign(
    {
      userId: input.userId,
      role: input.role,
      tokenType: 'access',
    },
    env.JWT_SECRET as jwt.Secret,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

export function signRefreshToken(input: SignTokenInput): string {
  return jwt.sign(
    {
      userId: input.userId,
      role: input.role,
      tokenType: 'refresh',
    },
    env.JWT_SECRET as jwt.Secret,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET as jwt.Secret) as JwtPayload;
}
