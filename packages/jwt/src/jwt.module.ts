// new-jwt.module.ts
import { JwtConfig } from '@/config/validation';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule,
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const yamlJwtConfig = configService.get<JwtConfig>('jwt');
        const secret =
          yamlJwtConfig?.secret ?? configService.get<string>('JWT_SECRET');
        const expireIn =
          yamlJwtConfig?.expireIn ??
          Number(configService.get<string>('JWT_EXPIRE_IN') ?? 86400);

        if (!secret) {
          throw new Error(
            'JWT configuration is missing. Provide yaml jwt.secret or JWT_SECRET env.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: expireIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestJwtModule], // 如果你打算在其他模块中使用这个 JWT 模块，记得导出它
})
export class JwtModule {}
