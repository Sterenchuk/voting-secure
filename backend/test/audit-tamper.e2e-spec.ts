import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import { getModelToken } from '@nestjs/mongoose';
import { AuditChain } from '../src/audit/schemas/audit-chain.schema';
import { Model } from 'mongoose';

describe('Audit Integrity (Tamper Test)', () => {
  let app: INestApplication;
  let auditService: AuditService;
  let chainModel: Model<AuditChain>;

  beforeAll(async () => {
    // If running locally (not in docker), replace 'mongo' with 'localhost'
    if (process.env.MONGO_URI && process.env.MONGO_URI.includes('@mongo:')) {
      process.env.MONGO_URI = process.env.MONGO_URI.replace('@mongo:', '@localhost:');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    auditService = app.get<AuditService>(AuditService);
    chainModel = app.get<Model<AuditChain>>(getModelToken(AuditChain.name));
  }, 30000); // Increase timeout for app bootstrap

  afterAll(async () => {
    await app.close();
  });

  it('should detect tampering in the audit chain', async () => {
    // 1. Ensure we have at least one block
    let block = await chainModel.findOne().sort({ sequence: -1 });
    
    if (!block) {
      // Create a dummy block if none exists
      await auditService.appendChain({
        action: 'TEST_ACTION' as any,
        payload: { foo: 'bar' },
        userId: 'test-user',
      });
      block = await chainModel.findOne().sort({ sequence: -1 });
    }

    expect(block).toBeDefined();
    const sequence = block!.sequence;
    const originalPayload = block!.payload;

    // 2. Verify chain is initially valid (forceFull to ignore previous markers)
    const initialVerify = await auditService.verifyChain(null, true);
    expect(initialVerify.valid).toBe(true);

    // 3. TAMPER: Change the payload directly in MongoDB without updating the hash
    await chainModel.updateOne(
      { sequence },
      { $set: { 'payload.tampered': true } }
    );

    // 4. Verify chain detects the tampering
    const tamperedVerify = await auditService.verifyChain(null, true);
    
    console.log('Tampered Verification Result:', JSON.stringify(tamperedVerify, null, 2));

    expect(tamperedVerify.valid).toBe(false);
    expect(tamperedVerify.brokenAt).toBe(sequence);
    expect(tamperedVerify.reason).toContain('Hash mismatch');
    expect(tamperedVerify.tamperedBlock).toBeDefined();

    // 5. RESTORE: Fix the block for future consistency
    await chainModel.updateOne(
      { sequence },
      { $set: { 'payload': originalPayload } }
    );
    
    const restoredVerify = await auditService.verifyChain(null, true);
    expect(restoredVerify.valid).toBe(true);
  });
});
