import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { HostModule } from './host/host.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    HostModule,
    DatabaseModule,
    UsersModule,
  ],
})
export class AppModule {}
