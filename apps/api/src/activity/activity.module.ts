import { Global, Module } from '@nestjs/common';
import { ActivityBus } from './activity.bus.js';
import { ActivityService } from './activity.service.js';
import { ActivityController } from './activity.controller.js';

@Global()
@Module({
  controllers: [ActivityController],
  providers: [ActivityBus, ActivityService],
  exports: [ActivityBus, ActivityService],
})
export class ActivityModule {}
