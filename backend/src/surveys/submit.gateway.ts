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
import { SubmitService } from './submit.service';
import { forwardRef, Inject, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { wsAuthMiddleware } from '../auth/auth.ws.middleware';
import type { AuthenticatedSocket } from '../auth/authenticated-socket.interface';
import { WsThrottlerGuard } from '../common/guards/ws.throttler.guard';
import { ISurveyResults } from './types/survey.types';
import { ConfigService } from '@nestjs/config';

export const WS_EVENTS = {
  SURVEY_RESULTS: 'survey:results',
  ERROR: 'error',

  JOIN_SURVEY: 'survey:join',
  LEAVE_SURVEY: 'survey:leave',
  GET_RESULTS: 'survey:get_results',
};

const surveyRoom = (surveyId: string) => `survey:${surveyId}`;

/**
 * SubmitGateway manages real-time communication for surveys.
 * It handles room subscription for live result updates and enforces
 * authentication for all socket connections.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/surveys',
})
@UseGuards(WsThrottlerGuard)
export class SubmitGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(SubmitGateway.name);

  constructor(
    @Inject(forwardRef(() => SubmitService))
    private readonly submitService: SubmitService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Extends the default connection logic with JWT authentication.
   */
  async handleConnection(client: Socket) {
    try {
      await wsAuthMiddleware(
        this.jwtService,
        this.usersService,
        this.configService,
      )(client, (err) => {
        if (err) {
          this.logger.warn(
            `Auth failed for client ${client.id}: ${err.message}`,
          );
          client.disconnect();
        } else {
          this.logger.log(
            `Client connected: ${client.id} (User: ${(client as any).user?.id})`,
          );
        }
      });
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Allows a user to join a survey room to receive real-time result broadcasts.
   */
  @SubscribeMessage(WS_EVENTS.JOIN_SURVEY)
  async handleJoinSurvey(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { surveyId: string },
  ) {
    if (!data.surveyId) return;
    client.join(surveyRoom(data.surveyId));
    this.logger.log(
      `User ${client.user.id} joined survey room: ${data.surveyId}`,
    );

    // Send initial results to the joining user
    try {
      const survey = await (this.submitService as any).repo.findSurveyById(
        data.surveyId,
      );
      if (survey) {
        const results = await this.submitService.getResults(
          data.surveyId,
          survey.questions.map((q) => q.id),
        );
        client.emit(WS_EVENTS.SURVEY_RESULTS, results);
      }
    } catch (e) {
      this.logger.error(`Error sending initial results: ${e}`);
    }
  }

  /**
   * Allows a user to leave a survey room.
   */
  @SubscribeMessage(WS_EVENTS.LEAVE_SURVEY)
  handleLeaveSurvey(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { surveyId: string },
  ) {
    if (!data.surveyId) return;
    client.leave(surveyRoom(data.surveyId));
    this.logger.log(
      `User ${client.user.id} left survey room: ${data.surveyId}`,
    );
  }

  /**
   * Broadcasts updated survey results to everyone in the survey room.
   */
  emitSurveyResults(surveyId: string, results: ISurveyResults) {
    this.server
      .to(surveyRoom(surveyId))
      .emit(WS_EVENTS.SURVEY_RESULTS, results);
  }
}
