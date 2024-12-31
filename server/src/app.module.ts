import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { HostModule } from './host/host.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    HostModule,
    DatabaseModule,
  ],
})
export class AppModule {}
