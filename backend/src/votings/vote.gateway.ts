import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VoteGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  afterInit() {
    console.log('✅ Vote WebSocket Gateway Initialized');
  }

  emitVoteCast(payload: {
    votingId: string;
    optionId: string;
    userId: string;
  }) {
    this.server.emit('vote.cast', payload);
  }

  emitVotingResults(votingId: string, results: any) {
    this.server.emit('voting.results', {
      votingId,
      results,
    });
  }
}
