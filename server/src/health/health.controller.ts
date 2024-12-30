import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, SequelizeHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: SequelizeHealthIndicator
  ) { }

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres')
    ]);
  }
}