import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { JWKS, JwtVerifier, remoteJwks } from './jwt-verifier.service.js';
import { UsersService } from './users.service.js';
import { AuthGuard } from './auth.guard.js';

@Global()
@Module({
  providers: [
    { provide: JWKS, inject: [ENV], useFactory: (env: Env) => remoteJwks(env) },
    JwtVerifier,
    UsersService,
    AuthGuard,
  ],
  exports: [JwtVerifier, UsersService, AuthGuard],
})
export class AuthModule {}
