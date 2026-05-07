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
import { JwtConfig } from '../config/validation';
import stringUtil from '@dofe/infra-utils/string.util';
import enviromentUtil from '@dofe/infra-utils/environment.util';
import { featureConfig, isProduction } from '../config/env-config.service';
import { apiError } from '../filter/exception/api.exception';

/**
 * JWK (JSON Web Key) interface for JWKS response parsing
 */
interface Jwk {
  kty: string;
  kid?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

interface JwksResponse {
  keys: Jwk[];
}

/**
 * Simple JWKS client — fetches and caches public keys from the SSO JWKS endpoint.
 * Used to verify RS256-signed JWT tokens from the SSO OIDC provider.
 */
class JwksClient {
  private cache: { keys: Map<string, string>; expiresAt: number } | null = null;
  private cacheTtlMs = 3600 * 1000; // 1 hour (matches SSO Cache-Control: max-age=3600)

  constructor(private readonly jwksUri: string) {}

  /**
   * Get a PEM public key by key ID (kid).
   * Fetches JWKS on cache miss, caches for 1 hour.
   */
  async getPublicKey(kid: string): Promise<string | null> {
    await this.ensureCache();
    return this.cache?.keys.get(kid) ?? null;
  }

  private async ensureCache(): Promise<void> {
    if (this.cache && Date.now() < this.cache.expiresAt) return;

    try {
      const response = await fetch(this.jwksUri);
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status}`);
      }
      const jwks: JwksResponse = await response.json() as JwksResponse;
      const keys = new Map<string, string>();

      for (const jwk of jwks.keys) {
        if (jwk.kid) {
          keys.set(jwk.kid, this.jwkToPem(jwk));
        }
      }

      this.cache = { keys, expiresAt: Date.now() + this.cacheTtlMs };
    } catch (error) {
      // On fetch failure, keep stale cache if available
      if (!this.cache) {
        throw error;
      }
    }
  }

  /**
   * Convert a JWK RSA public key to PEM format.
   * Uses a minimal PEM encoder (no external dependencies).
   */
  private jwkToPem(jwk: Jwk): string {
    if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
      throw new Error(`Unsupported JWK key type: ${jwk.kty}`);
    }

    // Base64URL decode
    const base64UrlDecode = (str: string): Buffer => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      return Buffer.from(base64, 'base64');
    };

    const modulus = base64UrlDecode(jwk.n);
    const exponent = base64UrlDecode(jwk.e);

    // Build DER-encoded RSAPublicKey (PKCS#1)
    // SEQUENCE { INTEGER (modulus), INTEGER (exponent) }
    const modulusBytes = this.encodeAsn1Integer(modulus);
    const exponentBytes = this.encodeAsn1Integer(exponent);
    const sequence = this.encodeAsn1Sequence(Buffer.concat([modulusBytes, exponentBytes]));

    const base64Der = sequence.toString('base64');
    const lines = base64Der.match(/.{1,64}/g) ?? [base64Der];
    return `-----BEGIN RSA PUBLIC KEY-----\n${lines.join('\n')}\n-----END RSA PUBLIC KEY-----`;
  }

  private encodeAsn1Length(length: number): Buffer {
    if (length < 128) {
      return Buffer.from([length]);
    }
    const bytes: number[] = [];
    let len = length;
    while (len > 0) {
      bytes.unshift(len & 0xff);
      len >>= 8;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  }

  private encodeAsn1Integer(value: Buffer): Buffer {
    // Add leading 0x00 if high bit is set (to prevent negative encoding)
    const data = value[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), value]) : value;
    return Buffer.concat([Buffer.from([0x02]), this.encodeAsn1Length(data.length), data]);
  }

  private encodeAsn1Sequence(contents: Buffer): Buffer {
    return Buffer.concat([Buffer.from([0x30]), this.encodeAsn1Length(contents.length), contents]);
  }
}

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
        access = decodeURIComponent((request.query as Record<string, string>)['access_token']);
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

        // RS256+JWKS verification (OIDC mode)
        if (jwtConfig.oidcMode || jwtConfig.jwksUri) {
          // Decode token header to check algorithm and kid
          const decodedHeader = this.jwt.decode(access, { complete: true }) as
            { header?: { alg?: string; kid?: string } } | null;
          const alg = decodedHeader?.header?.alg;
          const kid = decodedHeader?.header?.kid;

          if (alg === 'RS256') {
            // RS256: verify via JWKS
            if (!jwtConfig.jwksUri) {
              this.logger.error('RS256 token received but jwksUri is not configured');
              throw apiError(CommonErrorCode.UnAuthorized);
            }

            const jwksClient = new JwksClient(jwtConfig.jwksUri);
            const publicKey = kid ? await jwksClient.getPublicKey(kid) : null;

            if (!publicKey) {
              this.logger.warn('JWKS key not found for kid', { kid });
              throw apiError(CommonErrorCode.UnAuthorized);
            }

            payload = await this.jwt.verifyAsync(access, {
              publicKey,
              algorithms: ['RS256'],
              issuer: jwtConfig.issuer,
            });
          } else {
            // Fall back to HS256 for non-RS256 tokens
            payload = await this.jwt.verifyAsync(access, {
              secret: jwtConfig.secret,
            });
          }
        } else {
          // HS256 only (legacy mode)
          payload = await this.jwt.verifyAsync(access, {
            secret: jwtConfig.secret,
          });
        }
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
