import { PrismaClient } from '@prisma/client';
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
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateBallotHash(votingId: string, optionId: string): string {
  const clientNonce = crypto.randomBytes(16).toString('hex');
  return crypto
    .createHash('sha256')
    .update(votingId + optionId + clientNonce)
    .digest('hex');
}

async function main() {
  console.log('🌱 Starting database seed...');

  // 2. Create Users
  console.log('Creating users...');
  const hashedPassword = await argon2.hash('Password123!');
  for (const userData of USERS_DATA) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        password: hashedPassword,
        isEmailVerified: true,
      },
    });
  }

  // 3. Create Groups
  console.log('Creating groups...');
  for (const groupData of GROUPS_DATA) {
    const owner = await prisma.user.findUnique({
      where: { email: groupData.ownerEmail },
    });
    if (!owner) continue;

    await prisma.group.create({
      data: {
        name: groupData.name,
        creatorId: owner.id,
      },
    });
  }

  // 4. Create Memberships
  console.log('Assigning memberships...');
  for (const membership of MEMBERSHIPS) {
    const user = await prisma.user.findUnique({
      where: { email: membership.email },
    });
    const group = await prisma.group.findFirst({
      where: { name: membership.groupName },
    });
    if (!user || !group) continue;

    await prisma.userGroup.upsert({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
      update: { role: membership.role },
      create: {
        userId: user.id,
        groupId: group.id,
        role: membership.role,
      },
    });
  }

  // 5. Create Votings & Handle Finished ones
  console.log('Creating votings and simulating ballots...');
  for (const votingData of VOTINGS_DATA) {
    const creator = await prisma.user.findUnique({
      where: { email: votingData.creatorEmail },
    });
    const group = await prisma.group.findFirst({
      where: { name: votingData.groupName },
    });
    if (!creator || !group) continue;

    const { options, groupName, creatorEmail, ...votingFields } = votingData;

    const voting = await prisma.voting.create({
      data: {
        ...votingFields,
        creatorId: creator.id,
        groupId: group.id,
        options: {
          create: options.map((text) => ({ text })),
        },
      },
      include: { options: true },
    });

    if (voting.isFinalized || voting.title.includes('Completed')) {
      console.log(`Simulating ballots for: ${voting.title}`);

      const users = await prisma.user.findMany({ take: 5 });
      const optionIds = voting.options.map((o) => o.id);

      for (const user of users) {
        // Step 1: Record Participation (Who)
        await prisma.voteParticipation.create({
          data: { userId: user.id, votingId: voting.id },
        });

        // Step 2: Record Ballot (What - Anonymous)
        const randomOptionId =
          optionIds[Math.floor(Math.random() * optionIds.length)];
        await prisma.ballot.create({
          data: {
            votingId: voting.id,
            optionId: randomOptionId,
            ballotHash: generateBallotHash(voting.id, randomOptionId),
          },
        });
      }

      if (voting.title.includes('Retreat')) {
        await prisma.freeformBallot.createMany({
          data: [
            {
              votingId: voting.id,
              text: '1a',
              ballotHash: generateBallotHash(voting.id, 'OTHER_1A'),
            },
            {
              votingId: voting.id,
              text: '1b',
              ballotHash: generateBallotHash(voting.id, 'OTHER_1B'),
            },
          ],
        });
      }

      if (voting.isFinalized) {
        const ballotsCount = await prisma.ballot.count({
          where: { votingId: voting.id },
        });
        const freeformCount = await prisma.freeformBallot.count({
          where: { votingId: voting.id },
        });
        const total = ballotsCount + freeformCount;

        const tally = {
          options: {},
          other: freeformCount,
        };

        const tallyHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(tally) + total)
          .digest('hex');

        await prisma.votingResult.create({
          data: {
            votingId: voting.id,
            tally: tally as any,
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

  console.log('✅ Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
