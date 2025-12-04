import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { VotingsModule } from './votings/votings.module';
import { GroupsModule } from './groups/groups.module';

@Module({
  imports: [
    DatabaseModule, // Prisma service
    UsersModule, // User feature
    AuthModule, // Auth feature
    ConfigModule.forRoot({
      isGlobal: true,
    }), VotingsModule, GroupsModule,
  ],
})
export class AppModule {}
