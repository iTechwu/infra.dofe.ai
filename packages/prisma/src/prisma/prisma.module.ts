import { Module } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { PrismaWriteModule } from '@dofe/infra-prisma';
import { PrismaReadModule } from '@dofe/infra-prisma';
import { RedisModule } from '@dofe/infra-redis';
import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [PrismaWriteModule, PrismaReadModule, RedisModule, ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
