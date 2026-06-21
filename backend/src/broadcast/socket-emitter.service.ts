import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';

@Injectable()
export class SocketEmitterService implements OnModuleInit {
  private emitter: Emitter;
  private readonly logger = new Logger(SocketEmitterService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  onModuleInit() {
    this.emitter = new Emitter(this.redis);
    this.logger.log('Socket.io Redis Emitter initialized');
  }

  /**
   * Emit an event to a specific namespace and room.
   */
  emit(namespace: string, room: string, event: string, data: any) {
    this.logger.debug(`Emitting to ${namespace}/${room}: ${event}`);
    this.emitter.of(namespace).to(room).emit(event, data);
  }

  /**
   * Emit an event to a specific namespace (global broadcast in that namespace).
   */
  emitGlobal(namespace: string, event: string, data: any) {
    this.logger.debug(`Emitting global to ${namespace}: ${event}`);
    this.emitter.of(namespace).emit(event, data);
  }

  emitVotingResultsDirect(
    votingId: string,
    payload: {
      options: Array<{ id: string; text: string; voteCount: number }>;
      totalBallots: number;
      abstentionsCount?: number;
      otherTotal?: number;
      dynamicOptions?: Array<{ id: string; text: string; voteCount: number }>;
    },
  ) {
    this.logger.debug(`Direct emit voting results for ${votingId}`);
    this.emitter
      .of('/votings')
      .to(`voting:${votingId}`)
      .emit('voting:results', {
        votingId,
        results: payload,
      });
  }
}
