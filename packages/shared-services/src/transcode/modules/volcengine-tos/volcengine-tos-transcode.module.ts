import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { WinstonModule } from 'nest-winston';
import { VolcengineTosTranscodeClient } from './volcengine-tos-transcode.client';
import { FileStorageServiceModule } from '../../../file-storage/file-storage.module';

@Module({
    imports: [
        ConfigModule,
        HttpModule,
        WinstonModule,
        FileStorageServiceModule,
    ],
    providers: [VolcengineTosTranscodeClient],
    exports: [VolcengineTosTranscodeClient],
})
export class VolcengineTosTranscodeModule {}
