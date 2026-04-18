import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { DatabaseModule } from '../database/database.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [DatabaseModule, GroupsModule],
  providers: [SurveysService],
  controllers: [SurveysController],
})
export class SurveysModule {}
