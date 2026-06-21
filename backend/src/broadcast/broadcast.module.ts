import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BroadcastService } from './broadcast.service';
import { BroadcastProcessor } from './broadcast.processor';
import { SocketEmitterService } from './socket-emitter.service';
import { VotingsModule } from '../votings/votings.module';
import { SurveysModule } from '../surveys/surveys.module';
import { RedisModule } from '../redis/redis.module';
import { forwardRef } from '@nestjs/common';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'broadcast' }),
    RedisModule,
    forwardRef(() => VotingsModule),
    forwardRef(() => SurveysModule),
  ],
  providers: [BroadcastService, BroadcastProcessor, SocketEmitterService],
  exports: [BroadcastService, SocketEmitterService],
})
export class BroadcastModule {}

