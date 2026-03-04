import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/User.model';
import { UserRole } from '../src/types/user.types';

async function createAdmin(): Promise<void> {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    throw new Error('Usage: npm run create-admin -- <username> <password>');
  }

  await connectDatabase();

  const exists = await UserModel.findOne({ username });
  if (exists) {
    throw new Error(`User ${username} already exists`);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await UserModel.create({
    username,
    displayName: username,
    role: UserRole.SUPER_ADMIN,
    passwordHash,
    ownedBankIds: [],
    isActive: true,
  });

  console.log(`Admin user ${username} created.`);
}

createAdmin()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
