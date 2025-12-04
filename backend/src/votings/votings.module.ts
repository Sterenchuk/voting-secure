import { Module } from '@nestjs/common';
import { VotingsService } from './votings.service';
import { VotingsController } from './votings.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [VotingsService],
  controllers: [VotingsController],
  exports: [VotingsService],
})
export class VotingsModule {}
