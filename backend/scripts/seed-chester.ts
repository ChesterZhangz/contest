/**
 * Seed script: create or update the ChesterZhang super-admin account.
 * Usage:  npx tsx scripts/seed-chester.ts
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/User.model';
import { UserRole } from '../src/types/user.types';

const TARGET = {
  username: 'ChesterZhang',
  displayName: 'Chester Zhang',
  email: 'chester@viquard.com',
  role: UserRole.SUPER_ADMIN,
};

async function run(): Promise<void> {
  await connectDatabase();
  console.log('✔ Connected to MongoDB');

  const existing = await UserModel.findOne({
    $or: [{ username: TARGET.username }, { email: TARGET.email }],
  });

  if (existing) {
    // Idempotent: ensure the account has the correct role and is active
    existing.username = TARGET.username;
    existing.displayName = TARGET.displayName;
    existing.email = TARGET.email;
    existing.role = UserRole.SUPER_ADMIN;
    existing.isActive = true;
    await existing.save();
    console.log(`✔ Updated existing account → super_admin  (id: ${existing._id})`);
  } else {
    // Fresh account — random password hash (login only via magic link)
    const passwordHash = await bcrypt.hash(
      crypto.randomBytes(32).toString('hex'),
      10,
    );
    const user = await UserModel.create({
      username: TARGET.username,
      displayName: TARGET.displayName,
      email: TARGET.email,
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      ownedBankIds: [],
      isActive: true,
    });
    console.log(`✔ Created ChesterZhang as super_admin  (id: ${user._id})`);
  }

  console.log(`  username : ${TARGET.username}`);
  console.log(`  email    : ${TARGET.email}`);
  console.log(`  role     : ${TARGET.role}`);
  console.log('  Login via magic link — no password needed.');
}

run()
  .catch((err) => {
    console.error('✖ seed-chester failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
