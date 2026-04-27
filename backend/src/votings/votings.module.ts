import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VotingsController } from './votings.controller';
import { VotingsService } from './votings.service';
import { VoteService } from './vote.service';
import { VoteGateway } from './vote.gateway';
import { VotingsRepository } from './votings.repository';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { GroupsModule } from '../groups/groups.module';
import { AuditModule } from '../audit/audit.module';
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    UsersModule,
    MailModule,
    JwtModule.register({}),
    GroupsModule,
    AuditModule,
  ],
  controllers: [VotingsController],
  providers: [VotingsService, VoteService, VoteGateway, VotingsRepository],
  exports: [VotingsService, VoteService],
})
export class VotingsModule {}
