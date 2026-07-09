import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineStreamingAsrRequest,
  VolcengineSpeechRequestOptions,
  VolcengineWebSocketCallbacks,
} from '../types';
import { VolcengineWebSocketSession } from '../protocol';
import { validateStreamingAsrRequest } from '../validation';

/**
 * 大模型流式语音识别（SAUC bigmodel）WebSocket 客户端。
 *
 * @description 对应火山引擎「大模型流式语音识别 API」
 * (https://www.volcengine.com/docs/6561/1354869)，通过共享 WebSocket session 复用
 * 二进制协议编解码、新版 `X-Api-Key` 鉴权头与 request options 透传。默认 endpoint 为
 * 双向流式 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`，调用方可通过
 * `endpoints.streamingAsr` 覆盖为 `_nostream`（流式输入）或 `_async`（双向流式优化版）。
 */
@Injectable()
export class VolcengineStreamingAsrClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async connect<TEvent = unknown>(
    initPayload: VolcengineStreamingAsrRequest,
    callbacks?: VolcengineWebSocketCallbacks<TEvent>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineWebSocketSession<TEvent>> {
    validateStreamingAsrRequest(initPayload);
    const session = new VolcengineWebSocketSession<TEvent>(this.transport, {
      url: this.transport.getConfig().endpoints.streamingAsr,
      initPayload,
      callbacks,
      requestOptions: options,
    });
    await session.connect();
    return session;
  }
}
