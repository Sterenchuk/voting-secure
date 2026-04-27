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

// ─── Prisma Setup ─────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateBallotReceipt(votingId: string, optionId: string, tokenId: string): string {
  const secret = process.env.BALLOT_SECRET || 'dev-secret-do-not-use-in-prod';
  const data = `${votingId}:${optionId}:${tokenId}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

async function main() {
  console.log('🌱 Starting database seed (PostgreSQL only)...');

  // 1. Create Users
  console.log('Creating users...');
  const hashedPassword = await argon2.hash('Password123!');
  const userMap = new Map<string, string>();

  for (const userData of USERS_DATA) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        password: hashedPassword,
        isEmailVerified: true,
      },
    });
    userMap.set(userData.email, user.id);
  }

  // 2. Create Groups
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
      const participantEmails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
      const optionIds = voting.options.map((o) => o.id);

      for (const email of participantEmails) {
        const userId = userMap.get(email);
        if (!userId) continue;

        // 1. Issue Token
        const tokenId = crypto.randomUUID();
        const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
        
        await prisma.votingToken.create({
            data: {
                id: tokenId,
                userId,
                votingId: voting.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 3600000),
                used: true
            }
        });

        // 2. Record Participation
        await prisma.voteParticipation.create({
          data: { userId, votingId: voting.id },
        });

        // 3. Cast Ballot
        const randomOptionId = optionIds[Math.floor(Math.random() * optionIds.length)];
        const receipt = generateBallotReceipt(voting.id, randomOptionId, tokenId);

        await prisma.ballot.create({
          data: {
            votingId: voting.id,
            optionId: randomOptionId,
            ballotHash: receipt,
            tokenId: tokenId
          },
        });
      }

      if (voting.isFinalized) {
        const ballots = await prisma.ballot.findMany({
            where: { votingId: voting.id }
        });
        
        const tally: Record<string, number> = {};
        ballots.forEach(b => {
            tally[b.optionId] = (tally[b.optionId] || 0) + 1;
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
