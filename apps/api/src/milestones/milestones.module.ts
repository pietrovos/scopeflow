import { Module } from '@nestjs/common';
import { MilestonesController } from './milestones.controller.js';
import { MilestonesService } from './milestones.service.js';

@Module({ controllers: [MilestonesController], providers: [MilestonesService] })
export class MilestonesModule {}
