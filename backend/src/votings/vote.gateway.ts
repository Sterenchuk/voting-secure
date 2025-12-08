import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { VotingsService } from './votings.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VoteGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly votingsService: VotingsService) {}

  // ----------------------------------------------
  // JOIN A VOTING ROOM
  // ----------------------------------------------
  @SubscribeMessage('joinVoting')
  async joinVoting(
    @MessageBody() data: { votingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.votingId);
    return { message: 'Joined voting room', votingId: data.votingId };
  }

  // ----------------------------------------------
  // USER CASTS A VOTE
  // ----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('castVote')
  async castVote(
    @MessageBody()
    data: { votingId: string; optionId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const vote = await this.votingsService.vote(
      data.votingId,
      data.optionId,
      data.userId,
    );

    // Emit event to all clients in the voting room
    this.server.to(data.votingId).emit('vote.cast', {
      votingId: data.votingId,
      optionId: data.optionId,
      userId: data.userId,
    });

    // Send updated results
    const updatedResults = await this.votingsService.getVotingResults(
      data.votingId,
    );

    this.server.to(data.votingId).emit('vote.updated', updatedResults);

    return vote;
  }

  // ----------------------------------------------
  // SEND FINAL RESULTS
  // ----------------------------------------------
  async broadcastVotingResults(votingId: string) {
    const results = await this.votingsService.getVotingResults(votingId);

    this.server.to(votingId).emit('voting.results', results);
  }
}
