import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl } = requestProps;
    const client = context.switchToWs().getClient();

    const ip = client.conn.remoteAddress;
    const key = this.generateKey(context, ip, 'short');

    const { totalHits } = await this.storageService.increment(
      key,
      ttl,
      limit,
      0,
      'short',
    );

    if (totalHits > limit) {
      throw new WsException('Rate limit exceeded');
    }

    return true;
  }
}
