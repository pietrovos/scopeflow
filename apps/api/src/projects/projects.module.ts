import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { PlanLimits } from './plan-limits.js';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, PlanLimits],
})
export class ProjectsModule {}
