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
import { VolcengineAsrClient } from './asr';
import { VolcengineInterpretationClient } from './interpretation';
import { VolcengineStreamingAsrClient } from './streaming-asr';
import { VolcengineTtsApiClient, VolcengineTtsHttpClient } from './tts';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    VolcengineSpeechConfigService,
    VolcengineSpeechTransport,
    VolcengineAudioGenerationClient,
    VolcengineTtsStreamingClient,
    VolcengineTtsHttpClient,
    VolcengineTtsApiClient,
    VolcengineAsrClient,
    VolcengineInterpretationClient,
    VolcengineStreamingAsrClient,
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
    VolcengineTtsHttpClient,
    VolcengineTtsApiClient,
    VolcengineAsrClient,
    VolcengineInterpretationClient,
    VolcengineStreamingAsrClient,
    VolcengineMemoClient,
    VolcengineVoiceClient,
    VolcengineRealtimeSpeechClient,
    VolcenginePodcastClient,
  ],
})
export class VolcengineSpeechModule {}
