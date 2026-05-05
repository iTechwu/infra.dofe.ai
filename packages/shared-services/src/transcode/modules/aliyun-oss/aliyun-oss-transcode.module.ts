import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AliyunOssTranscodeClient } from './aliyun-oss-transcode.client';
import { AliyunImmModule } from '../aliyun-imm/aliyun-imm.module';

@Module({
    imports: [ConfigModule, HttpModule, AliyunImmModule],
    providers: [AliyunOssTranscodeClient],
    exports: [AliyunOssTranscodeClient],
})
export class AliyunOssTranscodeModule {}
