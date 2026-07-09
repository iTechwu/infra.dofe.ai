import { Injectable } from '@nestjs/common';
import { getKeysConfig, FeatureNotConfiguredError } from '@dofe/infra-common';
import {
  VolcengineSpeechConfig,
  VolcengineSpeechResolvedConfig,
} from '../types';
import {
  resolveVolcengineSpeechConfig,
  defaultVolcengineSpeechConfig,
  defaultVolcengineSpeechEndpoints,
} from './volcengine-speech.defaults';

type VolcengineSpeechConfigSource = Record<string, unknown> & {
  volcengineSpeech?: VolcengineSpeechConfig;
  speech?: {
    volcengine?: VolcengineSpeechConfig;
  };
  tts?: {
    volcengine?: VolcengineSpeechConfig;
  };
};

@Injectable()
export class VolcengineSpeechConfigService {
  static resolveConfig(
    explicitConfig?: VolcengineSpeechConfig,
  ): VolcengineSpeechResolvedConfig {
    const keys = explicitConfig
      ? undefined
      : (getKeysConfig() as VolcengineSpeechConfigSource | undefined);
    const speechConfig =
      explicitConfig ??
      keys?.volcengineSpeech ??
      keys?.speech?.volcengine ??
      keys?.tts?.volcengine;

    if (!speechConfig) {
      throw new FeatureNotConfiguredError(
        'volcengine-speech',
        'keys.volcengineSpeech',
      );
    }

    const resolved: VolcengineSpeechResolvedConfig =
      resolveVolcengineSpeechConfig({
        ...speechConfig,
        appId: speechConfig.appId ?? speechConfig.appKey,
        accessKey: speechConfig.accessKey ?? speechConfig.appAccessKey,
      });

    if (resolved.authMode === 'api-key' && !resolved.apiKey) {
      throw new FeatureNotConfiguredError(
        'volcengine-speech',
        'keys.volcengineSpeech.apiKey',
      );
    }

    if (
      resolved.authMode === 'legacy' &&
      (!resolved.appId || !resolved.accessKey)
    ) {
      throw new FeatureNotConfiguredError(
        'volcengine-speech',
        'keys.volcengineSpeech.appId/accessKey',
      );
    }

    return resolved;
  }

  getConfig(): VolcengineSpeechResolvedConfig {
    return VolcengineSpeechConfigService.resolveConfig();
  }
}
