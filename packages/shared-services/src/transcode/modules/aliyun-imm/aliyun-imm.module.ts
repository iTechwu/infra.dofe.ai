import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AliyunImmClient } from './aliyun-imm.client';

@Module({
    imports: [ConfigModule],
    providers: [AliyunImmClient],
    exports: [AliyunImmClient],
})
export class AliyunImmModule {}
