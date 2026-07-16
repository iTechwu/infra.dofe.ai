import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from './volcengine-speech.transport';
import { VolcengineSpeechResolvedConfig } from './types';
import { VolcengineAudioGenerationClient } from './audio-generation';
import { VolcengineTtsStreamingClient } from './tts-streaming';
import { VolcengineMemoClient } from './memo';
import { VolcengineVoiceClient } from './voice';
import { VolcengineRealtimeSpeechClient } from './realtime';
import { VolcenginePodcastClient } from './podcast';
import { VolcengineAsrClient } from './asr';
import { VolcengineInterpretationClient } from './interpretation';
import { VolcengineStreamingAsrClient } from './streaming-asr';
import { VolcengineTtsApiClient } from './tts';

@Injectable()
export class VolcengineSpeechClient {
  constructor(
    private readonly transport: VolcengineSpeechTransport,
    readonly audioGeneration: VolcengineAudioGenerationClient,
    readonly ttsStreaming: VolcengineTtsStreamingClient,
    readonly tts: VolcengineTtsApiClient,
    readonly asr: VolcengineAsrClient,
    readonly realtime: VolcengineRealtimeSpeechClient,
    readonly interpretation: VolcengineInterpretationClient,
    readonly streamingAsr: VolcengineStreamingAsrClient,
    readonly podcast: VolcenginePodcastClient,
    readonly memo: VolcengineMemoClient,
    readonly voice: VolcengineVoiceClient,
  ) {}

  getConfig(): VolcengineSpeechResolvedConfig {
    return this.transport.getConfig();
  }
}
