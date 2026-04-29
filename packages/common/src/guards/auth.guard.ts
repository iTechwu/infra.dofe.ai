import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FastifyRequest } from 'fastify';
import {
  AUTH_SERVICE_TOKEN,
  IAuthService,
  PUBLIC_ENDPOINT_KEY,
} from './guard-tokens';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_SERVICE_TOKEN)
    @Optional()
    private readonly auth: IAuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ENDPOINT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const access = this.auth?.extractTokenFromHeader(request);
    if (!access) {
      return false;
    }

    let payload;
    try {
      const jwtConfig = this.config.getOrThrow<{ secret: string }>('jwt');
      payload = await this.jwt.verifyAsync(access, {
        secret: jwtConfig.secret,
      });
    } catch (_error) {
      return false;
    }

    const userId = payload?.sub;
    const isAdmin = payload?.isAdmin;
    const isAnonymity = payload?.isAnonymity;

    if (!userId || isAnonymity) {
      return false;
    }

    (request as any).userId = userId;
    (request as any).isAdmin = isAdmin;
    (request as any).isAnonymity = isAnonymity;
    (request as any).userInfo = {
      id: userId,
      nickname: payload?.nickname,
      code: payload?.code,
      headerImg: payload?.headerImg,
      isAdmin,
      isAnonymity,
    };

    return true;
  }
}