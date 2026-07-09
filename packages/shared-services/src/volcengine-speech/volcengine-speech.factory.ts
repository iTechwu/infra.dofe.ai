import { HttpService } from '@nestjs/axios';
import { VolcengineAudioGenerationClient } from './audio-generation';
import { VolcengineSpeechConfigService } from './config/volcengine-speech.config';
import { VolcengineMemoClient } from './memo';
import { VolcenginePodcastClient } from './podcast';
import { VolcengineRealtimeSpeechClient } from './realtime';
import { VolcengineTtsStreamingClient } from './tts-streaming';
import { VolcengineSpeechConfig } from './types';
import { VolcengineSpeechClient } from './volcengine-speech.client';
import { VolcengineSpeechTransport } from './volcengine-speech.transport';
import { VolcengineVoiceClient } from './voice';

export interface VolcengineSpeechClientDeps {
  httpService: HttpService;
}

export function createVolcengineSpeechClient(
  config: VolcengineSpeechConfig,
  deps: VolcengineSpeechClientDeps,
): VolcengineSpeechClient {
  const resolvedConfig = VolcengineSpeechConfigService.resolveConfig(config);
  const transport = VolcengineSpeechTransport.create(
    deps.httpService,
    resolvedConfig,
  );
  const audioGeneration = new VolcengineAudioGenerationClient(transport);
  const ttsStreaming = new VolcengineTtsStreamingClient(transport);
  const realtime = new VolcengineRealtimeSpeechClient(transport);
  const podcast = new VolcenginePodcastClient(transport);
  const memo = new VolcengineMemoClient(transport);
  const voice = new VolcengineVoiceClient(transport);

  return new VolcengineSpeechClient(
    transport,
    audioGeneration,
    ttsStreaming,
    realtime,
    podcast,
    memo,
    voice,
  );
}
