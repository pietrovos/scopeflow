import { ConflictException } from '@nestjs/common';

/**
 * Optimistic-lock failure. Carries the current server state so the client can show
 * what changed and let the user decide, instead of silently overwriting.
 */
export class VersionConflictException extends ConflictException {
  constructor(current: unknown, message = 'This item was changed by someone else.') {
    super({ statusCode: 409, error: 'version_conflict', message, current });
  }
}
