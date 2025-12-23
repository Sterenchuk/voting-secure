import { Module } from '@nestjs/common';
import { VotingsService } from './votings.service';
import { VotingsController } from './votings.controller';
import { DatabaseModule } from 'src/database/database.module';
import { VoteGateway } from './vote.gateway';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [DatabaseModule, UsersModule, AuthModule, RedisModule],
  providers: [VotingsService, VoteGateway],
  controllers: [VotingsController],
  exports: [VotingsService],
})
export class VotingsModule {}
