import { Global, Module } from '@nestjs/common';
import { PlanLimits } from './plan-limits.js';

@Global()
@Module({ providers: [PlanLimits], exports: [PlanLimits] })
export class PlanLimitsModule {}
