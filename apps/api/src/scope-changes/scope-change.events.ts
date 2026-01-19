import { Injectable } from '@nestjs/common';
import type { DecideScopeChangeInput } from '@scopeflow/shared';
import type { TenantContext } from '../tenancy/tenant-context.js';
import type { ScopeChangeDetail } from './scope-changes.service.js';

/**
 * Hooks fired after a scope-change transaction commits. Notifications subscribe here so
 * the domain service does not know about email.
 */
@Injectable()
export class ScopeChangeEvents {
  private readonly submittedListeners: Array<
    (t: TenantContext, sc: ScopeChangeDetail, projectName: string, revisionNumber: number) => Promise<void> | void
  > = [];
  private readonly decidedListeners: Array<
    (t: TenantContext, sc: ScopeChangeDetail, input: DecideScopeChangeInput) => Promise<void> | void
  > = [];

  onSubmitted(fn: (typeof this.submittedListeners)[number]) {
    this.submittedListeners.push(fn);
  }

  onDecided(fn: (typeof this.decidedListeners)[number]) {
    this.decidedListeners.push(fn);
  }

  async submitted(t: TenantContext, sc: ScopeChangeDetail, projectName: string, revisionNumber: number) {
    await Promise.allSettled(this.submittedListeners.map(async (fn) => fn(t, sc, projectName, revisionNumber)));
  }

  async decided(t: TenantContext, sc: ScopeChangeDetail, input: DecideScopeChangeInput) {
    await Promise.allSettled(this.decidedListeners.map(async (fn) => fn(t, sc, input)));
  }
}
