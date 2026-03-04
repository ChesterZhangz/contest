import bcrypt from 'bcryptjs';
import { UserModel } from '../../src/models/User.model';
import { UserRole } from '../../src/types/user.types';

export async function createUser(input: {
  username: string;
  password?: string;
  role?: UserRole;
  displayName?: string;
}) {
  const password = input.password ?? 'Test123456';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.create({
    username: input.username,
    displayName: input.displayName ?? input.username,
    passwordHash,
    role: input.role ?? UserRole.HOST,
    ownedBankIds: [],
    isActive: true,
  });

  return {
    user,
    password,
  };
}
