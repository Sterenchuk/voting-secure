import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisVotingService } from './redis.service';

@Global()
@Module({
  providers: [
    RedisVotingService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'redis',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT', RedisVotingService],
})
export class RedisModule {}
