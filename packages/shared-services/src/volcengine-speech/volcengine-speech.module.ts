import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { VolcengineSpeechConfigService } from './config/volcengine-speech.config';
import { VolcengineSpeechTransport } from './volcengine-speech.transport';
import { VolcengineSpeechClient } from './volcengine-speech.client';
import { VolcengineAudioGenerationClient } from './audio-generation';
import { VolcengineTtsStreamingClient } from './tts-streaming';
import { VolcengineMemoClient } from './memo';
import { VolcengineVoiceClient } from './voice';
import { VolcengineRealtimeSpeechClient } from './realtime';
import { VolcenginePodcastClient } from './podcast';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    VolcengineSpeechConfigService,
    VolcengineSpeechTransport,
    VolcengineAudioGenerationClient,
    VolcengineTtsStreamingClient,
    VolcengineMemoClient,
    VolcengineVoiceClient,
    VolcengineRealtimeSpeechClient,
    VolcenginePodcastClient,
    VolcengineSpeechClient,
  ],
  exports: [
    VolcengineSpeechClient,
    VolcengineSpeechConfigService,
    VolcengineAudioGenerationClient,
    VolcengineTtsStreamingClient,
    VolcengineMemoClient,
    VolcengineVoiceClient,
    VolcengineRealtimeSpeechClient,
    VolcenginePodcastClient,
  ],
})
export class VolcengineSpeechModule {}
