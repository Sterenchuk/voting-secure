import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { VotingsModule } from './votings/votings.module';
import { GroupsModule } from './groups/groups.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailModule } from './mail/mail.module';
import { SurveysModule } from './surveys/surveys.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    AuthModule,
    MailModule,
    ConfigModule.forRoot({ isGlobal: true }),
    VotingsModule,
    GroupsModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    SurveysModule,
  ],
})
export class AppModule {}
