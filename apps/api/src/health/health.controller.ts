import { Controller, Get } from '@nestjs/common';
import { SystemPrismaService } from '../db/prisma.service.js';
import { Public } from '../auth/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: SystemPrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
