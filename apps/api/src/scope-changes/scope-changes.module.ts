import { Global, Module } from '@nestjs/common';
import { ScopeChangesController } from './scope-changes.controller.js';
import { ScopeChangesService } from './scope-changes.service.js';
import { ScopeChangeEvents } from './scope-change.events.js';

@Global()
@Module({
  controllers: [ScopeChangesController],
  providers: [ScopeChangesService, ScopeChangeEvents],
  exports: [ScopeChangeEvents],
})
export class ScopeChangesModule {}
