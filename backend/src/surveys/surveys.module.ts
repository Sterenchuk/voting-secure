import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { DatabaseModule } from '../database/database.module';
import { GroupsModule } from '../groups/groups.module';
import { SubmitService } from './submit.service';
import { SubmitGateway } from './submit.gateway';
import { SurveysRepository } from './surveys.repository';
import { RedisModule } from '../redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    DatabaseModule,
    GroupsModule,
    RedisModule,
    JwtModule,
    UsersModule,
  ],
  providers: [
    SurveysService,
    SubmitService,
    SubmitGateway,
    SurveysRepository,
  ],
  controllers: [SurveysController],
  exports: [SurveysService, SubmitService],
})
export class SurveysModule {}
