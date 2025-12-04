import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'root@system.local';
  const password = 'SuperStrongInitPassword123!';
  const hashed = await argon2.hash(password);

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log('⚠️  Admin already exists. Skipping creation.');
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: 'System Root Admin',
      role: 'ADMIN',
    },
  });

  console.log('✅ First admin created!');
  console.log(`Login with: ${email} / ${password}`);
}

main().finally(() => prisma.$disconnect());
