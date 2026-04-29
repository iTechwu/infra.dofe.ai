import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaWriteModule } from '../prisma-write/prisma-write.module';
import { PrismaReadModule } from '../prisma-read/prisma-read.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaWriteModule, PrismaReadModule, ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}