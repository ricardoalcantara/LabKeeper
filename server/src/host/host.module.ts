import { Module } from '@nestjs/common';
import { HostService } from './host.service';
import { HostController } from './host.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HostController],
  providers: [HostService],
})
export class HostModule {}
