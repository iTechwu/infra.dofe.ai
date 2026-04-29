import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule as NestJwtModule, JwtService } from '@nestjs/jwt';

export interface JwtConfig {
  secret: string;
  expireIn?: number;
}

@Module({
  imports: [
    ConfigModule,
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtConfig = configService.get<JwtConfig>('jwt');
        const secret =
          jwtConfig?.secret ?? configService.get<string>('JWT_SECRET');
        const expireIn =
          jwtConfig?.expireIn ?? parseInt(configService.get<string>('JWT_EXPIRE_IN') || '3600', 10);

        if (!secret) {
          throw new Error(
            'JWT configuration is missing. Provide jwt.secret config or JWT_SECRET env.',
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
  exports: [NestJwtModule, JwtService],
})
export class JwtModule {}