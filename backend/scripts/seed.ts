import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/User.model';
import { UserRole } from '../src/types/user.types';

async function seed(): Promise<void> {
  await connectDatabase();

  const users = [
    { username: 'admin', displayName: '超级管理员', role: UserRole.SUPER_ADMIN, password: 'Admin123456' },
    { username: 'host', displayName: '主持人', role: UserRole.HOST, password: 'Host123456' },
    { username: 'judge', displayName: '裁判', role: UserRole.JUDGE, password: 'Judge123456' },
    { username: 'player', displayName: '参赛者', role: UserRole.PARTICIPANT, password: 'Player123456' },
  ];

  for (const user of users) {
    const existing = await UserModel.findOne({ username: user.username });
    if (existing) {
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 10);

    await UserModel.create({
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      passwordHash,
      ownedBankIds: [],
      isActive: true,
    });
  }

  console.log('Seed completed.');
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
