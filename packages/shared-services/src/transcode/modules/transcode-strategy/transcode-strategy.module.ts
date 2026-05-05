import { Module } from '@nestjs/common';
import { TranscodeStrategyClient } from './transcode-strategy.client';
import { AliyunOssTranscodeModule } from '../aliyun-oss/aliyun-oss-transcode.module';
import { AliyunImmModule } from '../aliyun-imm/aliyun-imm.module';
import { VolcengineTosTranscodeModule } from '../volcengine-tos/volcengine-tos-transcode.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        ConfigModule,
        HttpModule,
        AliyunImmModule,
        AliyunOssTranscodeModule,
        VolcengineTosTranscodeModule,
    ],
    providers: [TranscodeStrategyClient],
    exports: [TranscodeStrategyClient],
})
export class TranscodeStrategyModule {}
