import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, forwardRef, Logger, UseGuards } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { VotingsService } from './votings.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { wsAuthMiddleware } from '../auth/auth.ws.middleware';
import type { AuthenticatedSocket } from '../auth/authenticated-socket.interface';
import { OptionResponseDto } from './dto/option.response.dto';
import { WsThrottlerGuard } from '../common/guards/ws.throttler.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/voting',
})
@UseGuards(WsThrottlerGuard)
export class VoteGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoteGateway.name);

  constructor(
    @Inject(forwardRef(() => VotingsService))
    private readonly votingsService: VotingsService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  afterInit(server: Server) {
    server.use(wsAuthMiddleware(this.jwtService, this.usersService));
    this.logger.log('Vote WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    const authenticatedClient = client as AuthenticatedSocket;

    if (!authenticatedClient.user) {
      this.logger.warn(
        `Client ${authenticatedClient.id} connected without authentication. Disconnecting.`,
      );
      authenticatedClient.disconnect(true);
      return;
    }

    this.logger.log(
      `Client ${authenticatedClient.id} connected as User ID: ${authenticatedClient.user.id}`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe:voting')
  handleSubscribeVoting(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { votingId: string },
  ) {
    if (!data?.votingId) {
      client.emit('error', { message: 'Invalid votingId' });
      return { success: false };
    }

    const room = `voting:${data.votingId}`;
    client.join(room);
    this.logger.log(
      `User ${client.user.id} (socket ${client.id}) subscribed to voting:${data.votingId}`,
    );

    return { success: true, message: `Subscribed to voting ${data.votingId}` };
  }

  @SubscribeMessage('unsubscribe:voting')
  handleUnsubscribeVoting(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { votingId: string },
  ) {
    if (!data?.votingId) return { success: false };

    const room = `voting:${data.votingId}`;
    client.leave(room);
    this.logger.log(
      `User ${client.user?.id || 'unknown'} unsubscribed from voting:${data.votingId}`,
    );

    return {
      success: true,
      message: `Unsubscribed from voting ${data.votingId}`,
    };
  }

  emitVoteCast(payload: {
    votingId: string;
    optionId: string;
    userId: string;
  }) {
    const room = `voting:${payload.votingId}`;
    this.server.in(room).emit('vote.cast', payload);
    this.logger.verbose(
      `Vote cast emitted to room ${room}: option ${payload.optionId} by user ${payload.userId}`,
    );
  }

  emitVotingResults(votingId: string, results: any[]) {
    const room = `voting:${votingId}`;
    this.server.in(room).emit('voting.results', { votingId, results });
    this.logger.verbose(`Voting results emitted to room ${room}`);
  }

  emitSurveyResults(votingId: string, results: any) {
    const room = `voting:${votingId}`;
    this.server.in(room).emit('survey.results', { votingId, results });
    this.logger.verbose(`Survey results emitted to room ${room}`);
  }

  emitOptionAdded(votingId: string, option: OptionResponseDto) {
    const room = `voting:${votingId}`;
    this.server.in(room).emit('option.added', { votingId, option });
    this.logger.verbose(`Option added emitted: ${option.text}`);
  }

  // Emit when option is updated
  emitOptionUpdated(votingId: string, option: OptionResponseDto) {
    const room = `voting:${votingId}`;
    this.server.in(room).emit('option.updated', { votingId, option });
    this.logger.verbose(`Option updated emitted: ${option.text}`);
  }

  emitOptionDeleted(votingId: string, optionId: string) {
    const room = `voting:${votingId}`;
    this.server.in(room).emit('option.deleted', { votingId, optionId });
    this.logger.verbose(`Option deleted emitted: ${optionId}`);
  }

  emitVotingDeleted(votingId: string) {
    const room = `voting:${votingId}`;
    this.server.in(room).emit('voting.deleted', { votingId });
    this.logger.log(`Voting deleted notification sent to room ${room}`);
  }

  emitVotingStatusChanged(votingId: string, status: 'started' | 'ended') {
    const room = `voting:${votingId}`;
    this.server.in(room).emit('voting.status', { votingId, status });
    this.logger.verbose(`Voting status changed: ${status} for ${votingId}`);
  }
}
