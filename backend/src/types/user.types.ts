export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  HOST = 'host',
  JUDGE = 'judge',
  PARTICIPANT = 'participant',
  AUDIENCE = 'audience',
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  email?: string;
  ownedBankIds: string[];
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}
