import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FastifyRequest, FastifyReply } from 'fastify';
import { CommonErrorCode } from '@dofe/infra-contracts';
import { MPTRAIL_HEADER, PUBLIC_ENDPOINT_KEY } from '@dofe/infra-contracts';
import { RedisService } from '@dofe/infra-redis';
import { UserInfoService } from '@app/db';
import { JwtConfig } from '@/config/validation';
import stringUtil from '@dofe/infra-utils/string.util';
import enviromentUtil from '@dofe/infra-utils/environment.util';
import { featureConfig, isProduction } from '@/config/env-config.service';
import { apiError } from '@/filter/exception/api.exception';

/**
 * Auth Guard Token - 用于注入 AuthService
 */
export const AUTH_SERVICE_TOKEN = 'AUTH_SERVICE';

/**
 * Auth Service Interface - 用于解耦 infra 和 domain
 */
export interface IAuthService {
  extractTokenFromHeader(request: { headers: Record<string, string | string[] | undefined> }): string | undefined;
}

/**
 * AuthGuard - 认证守卫
 *
 * 位于 infra 层，通过依赖注入接收 AuthService 实现
 * 避免直接依赖 domain 层
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly outOfAnonymityPathConfig;
  private readonly outOfUserPathConfig;

  constructor(
    @Inject(AUTH_SERVICE_TOKEN)
    private readonly auth: IAuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly user: UserInfoService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    // 这两个配置在早期版本的 YAML 中存在，但当前模板中是可选的
    // 为了在本地/开发环境下更好地降级，这里给出空对象默认值
    this.outOfAnonymityPathConfig =
      (this.config.get('outOfAnonymityPath') as
        | Record<string, string[]>
        | undefined) ?? {};
    this.outOfUserPathConfig =
      (this.config.get('outOfUserPath') as
        | Record<string, string[]>
        | undefined) ?? {};
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const _response = context.switchToHttp().getResponse<FastifyReply>();
    const requestMethod = request.method.toLowerCase();
    const requestPath = stringUtil.trimSlashes(
      stringUtil.splitString(request.url, '?')[0],
    );

    // 检查是否在白名单路径中
    if (
      this.outOfUserPathConfig[requestMethod]?.some((path) =>
        new RegExp(`^${path.replace(/:\w+/g, '[^/]+')}$`).test(
          requestPath.replace('api/', ''),
        ),
      )
    ) {
      return true;
    }

    // 检查是否标记为公开端点（@Public() 装饰器）
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ENDPOINT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    // 从方法处理器获取元数据
    let authTypes = this.reflector.get<string[]>('auths', context.getHandler());
    if (!authTypes) {
      authTypes = this.reflector.get<string[]>('auths', context.getClass());
    }

    const [authType = 'api', guardType = 'api'] = authTypes || ['api', 'api'];
    const isMpTest = request.headers[MPTRAIL_HEADER] === 'true';
    let userId,
      isAdmin = false,
      isAnonymity = false;

    if (!featureConfig.modeUserId) {
      let access;
      if (guardType === 'sse') {
        access = decodeURIComponent(request.query['access_token'] as string);
      } else {
        access = this.auth.extractTokenFromHeader(request);
        if (!access) {
          throw apiError(CommonErrorCode.UnAuthorized);
        }
      }
      if (!access) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      let payload;
      try {
        const jwtConfig = this.config.getOrThrow<JwtConfig>('jwt');
        payload = await this.jwt.verifyAsync(access, {
          secret: jwtConfig.secret,
        });
      } catch (_error) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      userId = payload?.sub;
      isAnonymity = payload?.isAnonymity;
      isAdmin = payload?.isAdmin;

      if (isAnonymity) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      // 将 JWT payload 中的用户信息设置到 request 中
      (request as any).userInfo = {
        id: userId,
        nickname: payload?.nickname,
        code: payload?.code,
        headerImg: payload?.headerImg,
        sex: payload?.sex,
        isAdmin: isAdmin,
        isAnonymity: isAnonymity,
      };
    } else {
      if (isProduction()) {
        this.logger.error(
          'CRITICAL SECURITY ERROR: MODE_USER_ID is set in prod environment!',
        );
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      this.logger.warn(
        'Auth Guard is running in insecure bypass mode. DO NOT USE IN PROD.',
      );
      this.logger.warn(
        `Bypass mode activated with userId: ${featureConfig.modeUserId}`,
      );

      userId = featureConfig.modeUserId;
      isAdmin = true;
      isAnonymity = false;
    }

    if (!userId) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    if (
      request.method.toLowerCase() === 'post' &&
      process.env?.PREVIEW_MODE === 'true' &&
      enviromentUtil.isWeChatMiniProgram(request) &&
      isMpTest &&
      process.env?.PREVIEW_USER_ID
    ) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    if (authType === 'admin' && !isAdmin) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    // 检查匿名用户访问限制
    if (
      this.outOfAnonymityPathConfig[requestMethod]?.some((path) =>
        new RegExp(`^${path.replace(/:\w+/g, '[^/]+')}$`).test(
          requestPath.replace('api/', ''),
        ),
      ) &&
      (request as any).isAnonymity
    ) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    // 将用户信息设置到request对象中
    (request as any).userId = userId;
    (request as any).isAnonymity = isAnonymity;
    (request as any).isAdmin = isAdmin;

    return true;
  }
}
