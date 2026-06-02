import { PrismaClient, VotingType, GroupRole } from '@prisma/client';
import {
  USERS_DATA,
  GROUPS_DATA,
  MEMBERSHIPS,
  VOTINGS_DATA,
} from './seed-data';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { CryptoUtils } from '../src/common/utils/crypto-utils';

// ─── Prisma Setup ─────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateBallotReceipt(
  votingId: string,
  optionId: string,
  tokenId: string,
): string {
  const secret = process.env.BALLOT_SECRET || 'dev-secret-do-not-use-in-prod';
  const data = `${votingId}:${optionId}:${tokenId}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

async function main() {
  console.log('🌱 Starting database seed (PostgreSQL only)...');

  // 1. Create Users
  console.log('Creating users...');
  const hashedPassword = await argon2.hash('Password123!');

  // Seed standard users first
  const userMap = new Map<string, string>();
  for (const userData of USERS_DATA) {
    const encryptedEmail = CryptoUtils.encrypt(userData.email);
    const emailHash = CryptoUtils.getBlindIndex(userData.email);

    const user = await prisma.user.upsert({
      where: { emailHash: emailHash },
      update: { email: encryptedEmail },
      create: {
        ...userData,
        email: encryptedEmail,
        emailHash: emailHash,
        password: hashedPassword,
        isEmailVerified: true,
      },
    });
    userMap.set(userData.email, user.id);
  }

  // Seed 10,000 stress test users in batches
  console.log('Creating 10,000 stress test users...');
  const BATCH_SIZE = 500;
  for (let i = 0; i < 10000; i += BATCH_SIZE) {
    const usersBatch: {
      email: string;
      emailHash: string;
      name: string;
      password: string;
      isEmailVerified: boolean;
    }[] = [];
    for (let j = 0; j < BATCH_SIZE; j++) {
      const userNum = i + j;
      const email = `stress_user_${userNum}@demo.local`;
      const encryptedEmail = CryptoUtils.encrypt(email);
      const emailHash = CryptoUtils.getBlindIndex(email);

      usersBatch.push({
        email: encryptedEmail,
        emailHash: emailHash,
        name: `Stress User ${userNum}`,
        password: hashedPassword,
        isEmailVerified: true,
      });
    }
    await prisma.user.createMany({
      data: usersBatch,
      skipDuplicates: true,
    });
    console.log(`Processed ${i + BATCH_SIZE} stress users...`);
    }

    // Force set all users as verified
    console.log('Force verifying all users...');
    await prisma.$executeRaw`UPDATE "User" SET "isEmailVerified" = true;`;

    // 2. Create Alpha Group

  console.log('Creating groups...');
  const groupMap = new Map<string, string>();
  for (const groupData of GROUPS_DATA) {
    const ownerId = userMap.get(groupData.ownerEmail);
    if (!ownerId) continue;

    const group = await prisma.group.create({
      data: {
        name: groupData.name,
        creatorId: ownerId,
      },
    });
    groupMap.set(groupData.name, group.id);
  }

  // 3. Create Memberships
  console.log('Assigning memberships...');
  for (const membership of MEMBERSHIPS) {
    const userId = userMap.get(membership.email);
    const groupId = groupMap.get(membership.groupName);
    if (!userId || !groupId) continue;

    await prisma.userGroup.upsert({
      where: { userId_groupId: { userId: userId, groupId: groupId } },
      update: { role: membership.role },
      create: {
        userId: userId,
        groupId: groupId,
        role: membership.role,
      },
    });
  }

  // 4. Create Votings & Handle Finished ones
  console.log('Creating votings and simulating ballots...');
  for (const votingData of VOTINGS_DATA) {
    const creatorId = userMap.get(votingData.creatorEmail);
    const groupId = groupMap.get(votingData.groupName);
    if (!creatorId || !groupId) continue;

    const { options, groupName, creatorEmail, ...votingFields } = votingData;

    const voting = await prisma.voting.create({
      data: {
        ...votingFields,
        creatorId,
        groupId,
        options: {
          create: options.map((text) => ({ text })),
        },
      },
      include: { options: true },
    });

    if (voting.isFinalized || voting.title.includes('Completed')) {
      console.log(`Simulating ballots for: ${voting.title}`);

      // Simulate a few users voting
      const participantEmails = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ];
      const optionIds = voting.options.map((o) => o.id);

      for (const email of participantEmails) {
        const userId = userMap.get(email);
        if (!userId) continue;

        // 1. Issue Token
        const tokenId = crypto.randomUUID();

        // 2. Record Participation
        await prisma.voteParticipation.create({
          data: { userId, votingId: voting.id },
        });

        // 3. Cast Ballot
        const randomOptionId =
          optionIds[Math.floor(Math.random() * optionIds.length)];
        const receipt = generateBallotReceipt(
          voting.id,
          randomOptionId,
          tokenId,
        );

        await prisma.ballot.create({
          data: {
            votingId: voting.id,
            optionId: randomOptionId,
            ballotHash: receipt,
            tokenHashed: crypto
              .createHash('sha256')
              .update(tokenId)
              .digest('hex'),
          },
        });
      }

      if (voting.isFinalized) {
        const ballots = await prisma.ballot.findMany({
          where: { votingId: voting.id },
        });

        const tally: Record<string, number> = {};
        ballots.forEach((b) => {
          if (b.optionId) {
            tally[b.optionId] = (tally[b.optionId] || 0) + 1;
          }
        });

        const total = ballots.length;
        const tallyHash = crypto
          .createHash('sha256')
          .update(JSON.stringify({ options: tally }) + total)
          .digest('hex');

        await prisma.votingResult.create({
          data: {
            votingId: voting.id,
            tally: { options: tally } as any,
            totalBallots: total,
            tallyHash: tallyHash,
          },
        });

        await prisma.voting.update({
          where: { id: voting.id },
          data: { finalizedAt: new Date() },
        });
      }
    }
  }

  console.log('✅ Seeding completed (PostgreSQL only).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
