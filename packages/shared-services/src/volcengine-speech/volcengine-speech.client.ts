import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from './volcengine-speech.transport';
import { VolcengineSpeechResolvedConfig } from './types';
import { VolcengineAudioGenerationClient } from './audio-generation';
import { VolcengineTtsStreamingClient } from './tts-streaming';
import { VolcengineMemoClient } from './memo';
import { VolcengineVoiceClient } from './voice';
import { VolcengineRealtimeSpeechClient } from './realtime';
import { VolcenginePodcastClient } from './podcast';

@Injectable()
export class VolcengineSpeechClient {
  constructor(
    private readonly transport: VolcengineSpeechTransport,
    readonly audioGeneration: VolcengineAudioGenerationClient,
    readonly ttsStreaming: VolcengineTtsStreamingClient,
    readonly realtime: VolcengineRealtimeSpeechClient,
    readonly podcast: VolcenginePodcastClient,
    readonly memo: VolcengineMemoClient,
    readonly voice: VolcengineVoiceClient,
  ) {}

  getConfig(): VolcengineSpeechResolvedConfig {
    return this.transport.getConfig();
  }
}
