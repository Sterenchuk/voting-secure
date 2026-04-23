import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VoteService } from './vote.service';
import type { AuthenticatedSocket } from '../auth/authenticated-socket.interface';
import { IVotingResults, IVotingResultsEvent } from './types/voting.types';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { wsAuthMiddleware } from '../auth/auth.ws.middleware';
import { CastVoteDto } from './dto/cast.vote.dto';

// ─── Event names ──────────────────────────────────────────────────────────────

export const WS_EVENTS = {
  // Server → Client
  VOTING_RESULTS: 'voting:results',
  ERROR: 'voting:error',
  VOTE_SUCCESS: 'voting:vote_success',

  // Client → Server
  JOIN_VOTING: 'voting:join',
  LEAVE_VOTING: 'voting:leave',
  GET_RESULTS: 'voting:get_results',
  CAST_VOTE: 'voting:cast',
} as const;

// ─── Room helper ──────────────────────────────────────────────────────────────

const votingRoom = (votingId: string) => `voting:${votingId}`;

// ─── Gateway ──────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/votings',
})
export class VoteGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(VoteGateway.name);

  constructor(
    @Inject(forwardRef(() => VoteService))
    private readonly voteService: VoteService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    server.use(
      wsAuthMiddleware(this.jwtService, this.usersService, this.configService),
    );
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(
      `Client connected: ${client.id} — user: ${client.user?.id}`,
    );
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Client → Server ─────────────────────────────────────────────────────────

  @SubscribeMessage(WS_EVENTS.JOIN_VOTING)
  async handleJoin(
    @MessageBody() payload: { votingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    await client.join(votingRoom(payload.votingId));
    this.logger.log(
      `Client ${client.id} joined ${votingRoom(payload.votingId)}`,
    );

    try {
      const results = await this.voteService.getResults(payload.votingId);
      const event: IVotingResultsEvent = {
        votingId: payload.votingId,
        results,
      };
      client.emit(WS_EVENTS.VOTING_RESULTS, event);
    } catch {
      client.emit(WS_EVENTS.ERROR, { message: 'Failed to load results' });
    }
  }

  /**
   * Leave a voting room — stops receiving updates for that voting.
   *
   * Payload: { votingId: string }
   */
  @SubscribeMessage(WS_EVENTS.LEAVE_VOTING)
  async handleLeave(
    @MessageBody() payload: { votingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    await client.leave(votingRoom(payload.votingId));
    this.logger.log(`Client ${client.id} left ${votingRoom(payload.votingId)}`);
  }

  /**
   * Explicitly request latest results without rejoining the room.
   *
   * Payload: { votingId: string }
   */
  @SubscribeMessage(WS_EVENTS.GET_RESULTS)
  async handleGetResults(
    @MessageBody() payload: { votingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const results = await this.voteService.getResults(payload.votingId);
      const event: IVotingResultsEvent = {
        votingId: payload.votingId,
        results,
      };
      client.emit(WS_EVENTS.VOTING_RESULTS, event);
    } catch {
      client.emit(WS_EVENTS.ERROR, { message: 'Failed to fetch results' });
    }
  }

  /**
   * Cast a vote via WebSocket.
   *
   * Payload: CastVoteDto & { votingId: string }
   */
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage(WS_EVENTS.CAST_VOTE)
  async handleCastVote(
    @MessageBody() payload: CastVoteDto & { votingId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const result = await this.voteService.vote(
        payload.votingId,
        payload.ballots,
        client.user.id,
        payload.otherText,
        payload.freeformBallotHash,
      );

      const successPayload = {
        votingId: payload.votingId,
        ...result,
      };

      client.emit(WS_EVENTS.VOTE_SUCCESS, successPayload);
      return successPayload;
    } catch (err: any) {
      this.logger.error(`Vote failed for user ${client.user.id}: ${err.message}`);
      const errorPayload = {
        message: err.message || 'Failed to cast vote',
        votingId: payload.votingId,
        error: true,
      };
      client.emit(WS_EVENTS.ERROR, errorPayload);
      return errorPayload;
    }
  }

  // ─── Server → Client ─────────────────────────────────────────────────────────

  /**
   * Broadcast updated results to everyone watching this voting.
   * Called by VoteService after each successful vote submission.
   */
  emitVotingResults(votingId: string, results: IVotingResults) {
    const event: IVotingResultsEvent = { votingId, results };
    this.server.to(votingRoom(votingId)).emit(WS_EVENTS.VOTING_RESULTS, event);
  }
}
