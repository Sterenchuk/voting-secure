import { Module } from '@nestjs/common';
import { VotingsService } from './votings.service';
import { VotingsController } from './votings.controller';
import { DatabaseModule } from 'src/database/database.module';
import { VoteGateway } from './vote.gateway';
@Module({
  imports: [DatabaseModule],
  providers: [VotingsService, VoteGateway],
  controllers: [VotingsController],
  exports: [VotingsService],
})
export class VotingsModule {}
