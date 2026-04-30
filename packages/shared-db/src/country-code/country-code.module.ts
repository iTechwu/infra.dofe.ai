import { Module } from '@nestjs/common';
import { PrismaModule } from '@dofe/infra-prisma';
import { CountryCodeService } from './country-code.service';
import { RedisModule } from '@dofe/infra-redis';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, RedisModule, ConfigModule],
  providers: [CountryCodeService],
  exports: [CountryCodeService],
})
export class CountryCodeModule {}
