import { ArgumentsHost, Catch, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Turns database errors into HTTP responses. Row-level-security and cross-tenant
 * foreign-key violations become 404 so they reveal nothing about other orgs.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(err: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, error, message] = this.map(err);
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(err);
    res.status(status).json({ statusCode: status, error, message });
  }

  private map(err: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError) {
    const code = 'code' in err ? err.code : undefined;
    if (code === 'P2025') return [HttpStatus.NOT_FOUND, 'not_found', 'Not found'] as const;
    if (code === 'P2002') return [HttpStatus.CONFLICT, 'conflict', 'That already exists'] as const;
    if (code === 'P2003' || /row-level security|does not belong to org/.test(err.message)) {
      return [HttpStatus.NOT_FOUND, 'not_found', 'Not found'] as const;
    }
    return [HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Something went wrong'] as const;
  }
}
