import { Injectable } from '@nestjs/common';
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

interface InfraCommonConfigApi {
  getKeysConfig: () => unknown;
  FeatureNotConfiguredError: new (feature: string, configPath: string) => Error;
}

function loadInfraCommonConfigApi(): InfraCommonConfigApi {
  return require('@dofe/infra-common') as InfraCommonConfigApi;
}

@Injectable()
export class VolcengineSpeechConfigService {
  static resolveConfig(
    explicitConfig?: VolcengineSpeechConfig,
  ): VolcengineSpeechResolvedConfig {
    const keys = explicitConfig
      ? undefined
      : (loadInfraCommonConfigApi().getKeysConfig() as
          | VolcengineSpeechConfigSource
          | undefined);
    const speechConfig =
      explicitConfig ??
      keys?.volcengineSpeech ??
      keys?.speech?.volcengine ??
      keys?.tts?.volcengine;

    if (!speechConfig) {
      const { FeatureNotConfiguredError } = loadInfraCommonConfigApi();
      throw new FeatureNotConfiguredError(
        'volcengine-speech',
        'keys.volcengineSpeech',
      );
    }

    const resolved: VolcengineSpeechResolvedConfig =
      resolveVolcengineSpeechConfig(speechConfig);

    if (!resolved.apiKey) {
      const { FeatureNotConfiguredError } = loadInfraCommonConfigApi();
      throw new FeatureNotConfiguredError(
        'volcengine-speech',
        'keys.volcengineSpeech.apiKey',
      );
    }

    return resolved;
  }

  getConfig(): VolcengineSpeechResolvedConfig {
    return VolcengineSpeechConfigService.resolveConfig();
  }
}
