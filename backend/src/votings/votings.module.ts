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
import { wsAuthMiddleware } from '../auth/auth.ws.middleware';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [DatabaseModule, RedisModule, UsersModule, JwtModule, GroupsModule],
  controllers: [VotingsController],
  providers: [VotingsService, VoteService, VoteGateway, VotingsRepository],
})
export class VotingsModule {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly voteGateway: VoteGateway,
  ) {}
}
