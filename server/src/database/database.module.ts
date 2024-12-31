import { Module } from '@nestjs/common';
import { repositoryProviders } from './repositories';
import { databaseProviders } from './database.providers';
import { SequelizeModule } from '@nestjs/sequelize';
import { Host } from './models/host.model';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, { IDatabaseConfig } from './database.config';
import { Service } from './models/service.model';
import { IpAddress } from './models/ip-address.model';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<IDatabaseConfig>('database');

        return {
          ...config,
          models: [Host, Service, IpAddress],
        };
      },
    }),
    SequelizeModule.forFeature([Host, Service, IpAddress]),
  ],
  providers: [...databaseProviders, ...repositoryProviders],
  exports: [SequelizeModule, ...databaseProviders, ...repositoryProviders],
})
export class DatabaseModule {}
