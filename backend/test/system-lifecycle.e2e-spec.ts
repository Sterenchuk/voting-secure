import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext, Injectable, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { RedisVotingService } from '../src/redis/redis.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';

@Injectable()
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Simulate valid user payload as expected by decorators
    req.user = { sub: 'test-user-id', role: 'USER' };
    return true;
  }
}

@Injectable()
class MockRolesGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe('End-to-End System Lifecycle (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.MONGO_URI = 'mongodb://audit_app:HueFqc31Dm8OcEueKbOlJyxE6NQn73uFHKkqDFaQJe7sUjcxUT@localhost:27017/audit';

    const databaseServiceMock = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $transaction: jest.fn((cb) => cb(databaseServiceMock)),
        user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', email: 'test@example.com' }]) },
        group: {
          create: jest.fn().mockResolvedValue({ id: 'g1', name: 'E2E Test Group' }),
          findUnique: jest.fn().mockResolvedValue({ id: 'g1' }),
          update: jest.fn().mockResolvedValue({ id: 'g1' }),
        },
        voting: {
          create: jest.fn().mockResolvedValue({ 
              id: 'v1', 
              title: 'E2E Voting', 
              options: [{ id: 'opt1' }],
              _count: { participations: 0 }
          }),
          findUnique: jest.fn().mockResolvedValue({ id: 'v1' }),
          findFirst: jest.fn().mockResolvedValue({ id: 'v1' }),
          findMany: jest.fn().mockResolvedValue([{ 
              id: 'v1', 
              _count: { ballots: 0, participations: 0 },
              options: [],
              participations: []
          }]),
          update: jest.fn().mockResolvedValue({ id: 'v1' }),
        },
        option: { findMany: jest.fn().mockResolvedValue([]) },
        ballot: { create: jest.fn().mockResolvedValue({ id: 'b1' }), count: jest.fn().mockResolvedValue(1) },
        voteParticipation: { create: jest.fn().mockResolvedValue({ id: 'p1' }), findUnique: jest.fn().mockResolvedValue(null) },
        votingResult: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
        userGroup: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(databaseServiceMock)

      .overrideProvider(RedisVotingService)
      .useValue({
        nextGlobalSequence: jest.fn().mockImplementation(() => Promise.resolve(Date.now() + Math.random())),
        nextGroupSequence: jest.fn().mockImplementation(() => Promise.resolve(Date.now() + Math.random())),
        nextVotingSequence: jest.fn().mockImplementation(() => Promise.resolve(Date.now() + Math.random())),
        nextSurveySequence: jest.fn().mockImplementation(() => Promise.resolve(Date.now() + Math.random())),
        redis: { set: jest.fn().mockResolvedValue('OK') },
        updateActiveVotingsCount: jest.fn().mockResolvedValue(undefined),
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should execute full lifecycle: user -> group -> voting -> cast -> finalize', async () => {
    // 2. Create Group
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .send({ name: 'E2E Test Group', userEmails: ['test@example.com'] });
    
    if (groupRes.status !== 201) {
      console.log('Group creation failed:', groupRes.body);
    }
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.id;

    // 3. Create Voting
    const votingRes = await request(app.getHttpServer())
      .post('/votings')
      .send({ title: 'E2E Voting', groupId, options: ['Option A', 'Option B'] });
    
    if (votingRes.status !== 201) {
      console.log('Voting creation failed:', votingRes.body);
    }
    expect(votingRes.status).toBe(201);
    const votingId = votingRes.body.id;

    // 4. Cast Vote
    const voteRes = await request(app.getHttpServer())
      .post(`/votings/${votingId}/vote`)
      .send({ token: 'test-token', ballots: [{ optionId: 'opt1', isAbstention: false }] });
    
    if (voteRes.status !== 201) {
      console.log('Vote cast failed:', voteRes.body);
    }
    expect(voteRes.status).toBe(201);

    // 5. Finalize Voting
    const finalRes = await request(app.getHttpServer())
      .post(`/votings/${votingId}/finalize`);
    expect(finalRes.status).toBe(200);

    // 6. Verify Audit Chain
    const auditRes = await request(app.getHttpServer())
      .get(`/audit/verify`);
    expect(auditRes.status).toBe(200);
  });
});
