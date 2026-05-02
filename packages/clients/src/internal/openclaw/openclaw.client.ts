/**
 * OpenClaw 客户端
 *
 * 职责：
 * - 与 OpenClaw Gateway 通信
 * - 发送消息到 OpenClaw 并获取 AI 响应
 * - 使用 WebSocket 进行实时通信
 */
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import WsClient from 'ws';
import { randomUUID } from 'crypto';
import * as path from 'path';
import type { ContainerSkillItem } from '@dofe/infra-contracts';
import { getEnvWithDefault } from '@dofe/infra-common/dist/config/env-config.service';
import { DockerExecService } from './docker-exec.service';

const DEFAULT_OPENCLAW_HOME = '/home/node/.openclaw';

function resolveOpenClawHomeFromEnv(envHome?: string | null): string {
  const trimmed = envHome?.trim();
  return trimmed || DEFAULT_OPENCLAW_HOME;
}

function buildOpenClawPath(
  envHome: string | null | undefined,
  ...segments: string[]
): string {
  const base = resolveOpenClawHomeFromEnv(envHome).replace(/\/+$/, '');
  const normalizedSegments = segments.map((segment) =>
    segment.replace(/^\/+|\/+$/g, ''),
  );

  return [base, ...normalizedSegments].filter(Boolean).join('/');
}

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenClawContentPart[];
}

/**
 * OpenClaw 多模态内容部分
 * 支持文本、图片和文件
 */
export interface OpenClawContentPart {
  type: 'text' | 'image' | 'file';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
  file_url?: {
    url: string;
    name?: string;
  };
}

export interface OpenClawChatRequest {
  messages: OpenClawMessage[];
  stream?: boolean;
  model?: string;
}

export interface OpenClawChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenClaw 聊天选项
 */
export interface OpenClawChatOptions {
  /** 上下文消息 */
  context?: OpenClawMessage[];
  /** 指定模型（用于路由后的模型切换） */
  model?: string;
  /** 路由提示（用于功能路由匹配） */
  routingHint?: string;
  /** 容器 ID（用于模型切换时执行 Docker exec） */
  containerId?: string;
  /**
   * Session Key - 用于隔离不同会话的对话历史
   * 不同 sessionKey 的对话历史是独立的
   * 默认值: 'main'
   * 推荐使用: userId、conversationId 或 `${botId}-${userId}` 格式
   */
  sessionKey?: string;
  /**
   * Agent ID - 用于多 Agent 模式下指定目标 Agent
   * 在 Gateway Pool 架构中，单个 Gateway 可管理多个 Agent
   * 每个 Agent 有独立的 Persona、Workspace 和 Memory
   * 默认值: undefined（使用 Gateway 默认 Agent）
   * 推荐使用: botId 或自定义 Agent 标识
   */
  agentId?: string;
}

/**
 * 直接通过 Proxy 发送多模态消息的选项
 * 绕过 OpenClaw Gateway，直接调用 Keyring Proxy HTTP 端点
 */
export interface ProxyVisionChatOptions {
  /** Docker 容器 ID（用于读取 proxy token） */
  containerId: string;
  /** Proxy 基础 URL（如 http://127.0.0.1:3200/api） */
  proxyBaseUrl: string;
  /** 视觉模型名称 */
  visionModel: string;
  /** 多模态消息内容 */
  content: OpenClawContentPart[];
}

/**
 * MCP Server 配置（用于 openclaw.json mcpServers）
 * 支持 stdio 和 http 两种类型
 */
export interface McpServerConfig {
  // stdio 类型字段
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http 类型字段
  type?: 'http' | 'streamableHttp' | 'sse';
  url?: string;
  headers?: Record<string, string>;
}

export type OpenClawToolsProfile = 'minimal' | 'messaging' | 'coding' | 'full';

export interface OpenClawRuntimePluginToolAccessAgentRule {
  agentId: string;
  allow?: string[];
  deny?: string[];
}

export interface OpenClawRuntimePluginToolAccess {
  profile?: OpenClawToolsProfile;
  allow?: string[];
  deny?: string[];
  agents: OpenClawRuntimePluginToolAccessAgentRule[];
}

export interface OpenClawRuntimePluginItem {
  id: string;
  enabled: boolean;
  sourceType?: 'npm' | 'path' | 'bundled' | null;
  installSpec?: string | null;
  hasConfig: boolean;
  config?: Record<string, unknown> | null;
}

@Injectable()
export class OpenClawClient {
  private readonly requestTimeout = 120000; // 2 分钟超时
  private readonly wsTimeout = 120000; // WebSocket 响应超时
  /** 缓存容器的 proxy token（containerId → token） */
  private readonly proxyTokenCache = new Map<string, string>();

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly dockerExec: DockerExecService,
  ) {}

  /**
   * 发送消息到 OpenClaw Gateway 并获取 AI 响应
   * 使用 WebSocket 进行通信
   * @param port OpenClaw Gateway 端口
   * @param token Gateway 认证 token
   * @param message 用户消息（字符串或多模态内容数组）
   * @param options 可选的聊天选项（上下文、模型、路由提示等）
   */
  async chat(
    port: number,
    token: string,
    message: string | OpenClawContentPart[],
    options?: OpenClawChatOptions,
  ): Promise<string> {
    const messageInfo =
      typeof message === 'string'
        ? { length: message.length, type: 'text' }
        : {
            length: message.length,
            type: 'multimodal',
            imageCount: message.filter((p) => p.type === 'image').length,
          };

    this.logger.info('OpenClawClient: 发送消息到 OpenClaw', {
      port,
      ...messageInfo,
      contextLength: options?.context?.length || 0,
      model: options?.model,
      routingHint: options?.routingHint,
      sessionKey: options?.sessionKey || 'main',
      agentId: options?.agentId,
    });

    try {
      // 如果指定了模型且提供了容器 ID，先切换模型
      if (options?.model && options?.containerId) {
        await this.switchModel(options.containerId, options.model);
      }

      const response = await this.sendMessageViaWebSocket(
        port,
        token,
        message,
        options?.context,
        options?.sessionKey,
        options?.agentId,
      );

      this.logger.info('OpenClawClient: 收到 AI 响应', {
        port,
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      this.logger.error('OpenClawClient: 通信失败', {
        port,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * 发送消息到 OpenClaw Gateway（兼容旧接口）
   * @deprecated 使用带 options 参数的 chat 方法
   */
  async chatLegacy(
    port: number,
    token: string,
    message: string | OpenClawContentPart[],
    context?: OpenClawMessage[],
  ): Promise<string> {
    return this.chat(port, token, message, { context });
  }

  /**
   * 通过 Docker exec 切换 OpenClaw 容器的模型
   * @param containerId Docker 容器 ID
   * @param model 目标模型名称
   */
  async switchModel(containerId: string, model: string): Promise<void> {
    this.logger.info('OpenClawClient: 切换模型', { containerId, model });

    const result = await this.dockerExec.executeCommand(
      containerId,
      ['node', '/app/openclaw.mjs', 'models', 'set', model],
      { timeout: 10000 },
    );

    if (result.success) {
      this.logger.info('OpenClawClient: 模型切换成功', {
        containerId,
        model,
        durationMs: result.durationMs,
      });
    } else {
      this.logger.warn('OpenClawClient: 模型切换失败', {
        containerId,
        model,
        stderr: result.stderr,
        durationMs: result.durationMs,
      });
      // 不抛出错误，允许继续使用当前模型
    }
  }

  /**
   * 从容器环境变量中读取 Proxy Token（带缓存）
   * @param containerId Docker 容器 ID
   * @returns Proxy Token 字符串，失败返回 null
   */
  async getContainerProxyToken(containerId: string): Promise<string | null> {
    // 检查缓存
    const cached = this.proxyTokenCache.get(containerId);
    if (cached) return cached;

    const result = await this.dockerExec.executeCommand(
      containerId,
      ['printenv', 'PROXY_TOKEN'],
      { timeout: 5000 },
    );

    if (result.success && result.stdout.trim()) {
      const token = result.stdout.trim();
      this.proxyTokenCache.set(containerId, token);
      return token;
    }

    this.logger.warn('OpenClawClient: 无法读取容器 Proxy Token', {
      containerId,
      stderr: result.stderr,
    });
    return null;
  }

  /**
   * 通过 Keyring Proxy 直接发送多模态消息（绕过 OpenClaw Gateway）
   *
   * 用于包含图片的视觉请求，因为 OpenClaw Gateway 的 chat.send
   * WebSocket 协议不支持多模态内容数组。
   *
   * 流程：
   * 1. 从容器读取 Proxy Token
   * 2. 构建 OpenAI 兼容的 chat/completions 请求
   * 3. 直接调用 Keyring Proxy HTTP 端点
   * 4. 收集并返回响应文本
   */
  async chatViaProxy(options: ProxyVisionChatOptions): Promise<string> {
    const { containerId, proxyBaseUrl, visionModel, content } = options;

    this.logger.info('OpenClawClient: 通过 Proxy 发送视觉请求', {
      containerId,
      visionModel,
      contentParts: content.length,
      imageCount: content.filter((p) => p.type === 'image').length,
      fileCount: content.filter((p) => p.type === 'file').length,
    });

    // 1. 获取 Proxy Token
    const proxyToken = await this.getContainerProxyToken(containerId);
    if (!proxyToken) {
      throw new Error('无法获取 Proxy Token，无法发送视觉请求');
    }

    // 2. 过滤并转换有效的内容部分
    const validContentParts = content
      .filter((part) => {
        // 过滤空文本
        if (part.type === 'text') {
          return part.text && part.text.trim().length > 0;
        }
        // 过滤无效的图片 URL
        if (part.type === 'image') {
          return part.image_url && part.image_url.url;
        }
        // 过滤无效的文件 URL
        if (part.type === 'file') {
          return part.file_url && part.file_url.url;
        }
        return false;
      })
      .map((part) => {
        if (part.type === 'text') {
          return { type: 'text' as const, text: part.text! };
        }
        if (part.type === 'file' && part.file_url) {
          return {
            type: 'file_url' as const,
            file_url: part.file_url,
          };
        }
        // 图片文件
        return {
          type: 'image_url' as const,
          image_url: part.image_url!,
        };
      });

    // 验证是否有有效内容
    if (validContentParts.length === 0) {
      throw new Error('没有有效的多模态内容可发送');
    }

    this.logger.info('OpenClawClient: 有效内容部分', {
      totalParts: content.length,
      validParts: validContentParts.length,
      textParts: validContentParts.filter((p) => p.type === 'text').length,
      imageParts: validContentParts.filter((p) => p.type === 'image_url')
        .length,
      fileParts: validContentParts.filter((p) => p.type === 'file_url').length,
    });

    // 3. 构建 OpenAI 兼容请求体
    const requestBody = {
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: validContentParts,
        },
      ],
      stream: false,
      max_tokens: 4096,
    };

    // 4. 调用 Proxy HTTP 端点
    // 使用 openai-compatible vendor 触发自动路由
    const url = `${proxyBaseUrl}/v1/openai-compatible/chat/completions`;

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(url, requestBody, {
            headers: {
              Authorization: `Bearer ${proxyToken}`,
              'Content-Type': 'application/json',
            },
            timeout: this.requestTimeout,
          })
          .pipe(
            catchError((error) => {
              this.logger.error('OpenClawClient: Proxy 视觉请求失败', {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
                  ? JSON.stringify(error.response.data).substring(0, 500)
                  : undefined,
              });
              throw error;
            }),
          ),
      );

      // 5. 提取响应文本
      const data = response.data;
      const responseText = data?.choices?.[0]?.message?.content || '';

      this.logger.info('OpenClawClient: Proxy 视觉请求成功', {
        visionModel,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200),
      });

      return responseText;
    } catch (error) {
      this.logger.error('OpenClawClient: Proxy 视觉请求异常', {
        containerId,
        visionModel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * 在容器内执行技能脚本
   * 仅允许执行白名单中的脚本（如 init.sh）
   */
  async execSkillScript(
    containerId: string,
    skillName: string,
    scriptName: string = 'init.sh',
  ): Promise<{ stdout: string; success: boolean } | null> {
    // 使用 DockerExecService 的安全验证
    if (
      !this.dockerExec.isValidName(skillName) ||
      !this.dockerExec.isValidName(scriptName)
    ) {
      this.logger.warn('OpenClawClient: 非法技能名或脚本名', {
        skillName,
        scriptName,
      });
      return null;
    }

    const openclawHome = await this.resolveOpenClawHome(containerId);
    const scriptPath = buildOpenClawPath(
      openclawHome,
      'skills',
      skillName,
      'scripts',
      scriptName,
    );
    this.logger.info('OpenClawClient: 执行技能脚本', {
      containerId,
      skillName,
      scriptPath,
    });

    const result = await this.dockerExec.executeCommand(
      containerId,
      ['sh', scriptPath],
      { user: 'node', timeout: 30000 },
    );

    if (result.success) {
      this.logger.info('OpenClawClient: 脚本执行完成', {
        containerId,
        skillName,
        outputLength: result.stdout.length,
        durationMs: result.durationMs,
      });
    } else {
      this.logger.error('OpenClawClient: 脚本执行失败', {
        containerId,
        skillName,
        stderr: result.stderr,
        durationMs: result.durationMs,
      });
    }

    return { stdout: result.stdout, success: result.success };
  }

  /**
   * 通过 WebSocket 发送消息并获取响应
   * 使用 OpenClaw Gateway 协议：
   * 1. 连接后发送 connect 请求进行认证
   * 2. 收到 hello-ok 后发送 chat.send 请求
   * 3. 监听 chat 事件获取响应
   * @param sessionKey 会话标识，用于隔离不同会话的对话历史，默认 'main'
   * @param agentId Agent 标识，用于多 Agent 模式下指定目标 Agent
   */
  private sendMessageViaWebSocket(
    port: number,
    token: string,
    message: string | OpenClawContentPart[],
    _context?: OpenClawMessage[],
    sessionKey: string = 'main',
    agentId?: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // OpenClaw gateway WebSocket 端点（使用 GATEWAY_HOST 环境变量）
      const host = getEnvWithDefault('GATEWAY_HOST', 'localhost');
      const wsUrl = `ws://${host}:${port}`;

      this.logger.info('OpenClawClient: 建立 WebSocket 连接', {
        port,
        host,
        url: wsUrl,
      });

      // OpenClaw gateway 需要 Origin 和 User-Agent 头
      const ws = new WsClient(wsUrl, {
        origin: `http://${host}:${port}`,
        headers: {
          'User-Agent': 'ClawbotManager/1.0',
        },
      });

      let responseText = '';
      let isResolved = false;
      let isConnected = false;
      let requestId = 0;
      let connectRequestId = '';
      let chatRequestId = '';

      const generateId = () => `req-${++requestId}-${randomUUID().slice(0, 8)}`;

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          ws.close();
          reject(new Error('WebSocket 响应超时'));
        }
      }, this.wsTimeout);

      // 发送请求帧
      const sendRequest = (method: string, params: unknown) => {
        const frame = {
          type: 'req',
          id: generateId(),
          method,
          params,
        };
        this.logger.info('OpenClawClient: 发送请求', { method, id: frame.id });
        ws.send(JSON.stringify(frame));
        return frame.id;
      };

      ws.on('open', () => {
        this.logger.info('OpenClawClient: WebSocket 连接已建立', { port });

        // 第一步：发送 connect 请求进行认证
        connectRequestId = sendRequest('connect', {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'gateway-client',
            version: '1.0.0',
            platform: 'node',
            mode: 'backend',
          },
          auth: {
            token: token,
          },
        });
      });

      ws.on('message', (data: WsClient.Data) => {
        try {
          const frame = JSON.parse(data.toString());
          this.logger.info('OpenClawClient: 收到消息', {
            type: frame.type,
            event: frame.event,
            ok: frame.ok,
            id: frame.id,
            payload: frame.payload
              ? JSON.stringify(frame.payload).substring(0, 500)
              : undefined,
          });

          // 处理 hello-ok 响应（connect 成功 - 旧协议）
          if (frame.type === 'hello-ok') {
            isConnected = true;
            this.logger.info('OpenClawClient: 认证成功 (hello-ok)', { port });

            // 第二步：发送聊天消息
            const chatParams: Record<string, unknown> = {
              sessionKey: sessionKey,
              message: message,
              idempotencyKey: randomUUID(),
            };
            // 多 Agent 模式：指定目标 Agent
            if (agentId) {
              chatParams.agentId = agentId;
            }
            chatRequestId = sendRequest('chat.send', chatParams);
            return;
          }

          // 处理响应帧
          if (frame.type === 'res') {
            // connect 请求成功响应
            if (frame.id === connectRequestId && frame.ok && !isConnected) {
              isConnected = true;
              this.logger.info('OpenClawClient: 认证成功 (res)', { port });

              // 第二步：发送聊天消息
              const chatParams: Record<string, unknown> = {
                sessionKey: sessionKey,
                message: message,
                idempotencyKey: randomUUID(),
              };
              // 多 Agent 模式：指定目标 Agent
              if (agentId) {
                chatParams.agentId = agentId;
              }
              chatRequestId = sendRequest('chat.send', chatParams);
              return;
            }

            // chat.send 请求成功响应
            if (frame.id === chatRequestId && frame.ok) {
              this.logger.info('OpenClawClient: chat.send 请求成功', { port });
              // 等待 chat 事件返回响应
              return;
            }

            // 错误响应
            if (!frame.ok && frame.error) {
              this.logger.error('OpenClawClient: 请求失败', {
                error: frame.error,
              });
              if (!isResolved) {
                isResolved = true;
                clearTimeout(timeoutId);
                ws.close();
                reject(new Error(frame.error.message || 'Request failed'));
              }
            }
            return;
          }

          // 处理事件帧（聊天响应）
          if (frame.type === 'event') {
            const { event } = frame;
            // payload 可能是 JSON 字符串，需要解析
            let payload: Record<string, unknown> | undefined;
            try {
              payload =
                typeof frame.payload === 'string'
                  ? JSON.parse(frame.payload)
                  : frame.payload;
            } catch {
              this.logger.warn('OpenClawClient: 解析 payload 失败', {
                payload: String(frame.payload).slice(0, 200),
              });
              payload = undefined;
            }

            // 处理 agent 事件（流式文本）
            // 格式: { stream: 'assistant', data: { text: '...' } }
            if (event === 'agent' && payload?.stream === 'assistant') {
              const data = payload.data as { text?: string } | undefined;
              if (data?.text) {
                // 流式文本累积 - 但 agent 事件发送的是累积文本，不是增量
                // 所以我们只保存最新的完整文本
                responseText = data.text;
                this.logger.debug('OpenClawClient: 收到 agent 流式文本', {
                  textLength: responseText.length,
                });
              }
              return;
            }

            // 处理 agent lifecycle 事件（结束信号）
            // 格式: { stream: 'lifecycle', data: { phase: 'end' } }
            if (event === 'agent' && payload?.stream === 'lifecycle') {
              const data = payload.data as { phase?: string } | undefined;
              if (data?.phase === 'end') {
                this.logger.info('OpenClawClient: agent 生命周期结束', {
                  responseLength: responseText.length,
                });
              }
              // 不在这里 resolve，等待 chat 事件的 final 状态
              return;
            }

            // 处理 chat 事件（最终结果）
            // 格式: { state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: '...' }] } }
            if (event === 'chat') {
              const chatEvent = payload as Record<string, unknown> | undefined;
              this.logger.info('OpenClawClient: 处理 chat 事件', {
                state: chatEvent?.state,
                hasMessage: !!chatEvent?.message,
                currentResponseLength: responseText.length,
              });

              // 处理 final 状态
              if (chatEvent?.state === 'final') {
                // 尝试从 message.content 提取最终文本
                const message = chatEvent?.message as
                  | { content?: Array<{ type: string; text?: string }> }
                  | undefined;
                if (message?.content && Array.isArray(message.content)) {
                  let finalText = '';
                  for (const item of message.content) {
                    if (item.type === 'text' && item.text) {
                      finalText += item.text;
                    }
                  }
                  if (finalText) {
                    responseText = finalText;
                  }
                }

                this.logger.info('OpenClawClient: 聊天完成 (final)', {
                  finalResponseLength: responseText.length,
                  responsePreview: responseText.substring(0, 200),
                });

                // 无论是否有 message，final 状态都应该 resolve
                if (!isResolved) {
                  isResolved = true;
                  clearTimeout(timeoutId);
                  ws.close();
                  resolve(responseText);
                }
                return;
              }

              // 兼容旧格式: payload.type === 'text' / 'result' / 'error'
              if (chatEvent?.type === 'text' && chatEvent?.text) {
                const text = String(chatEvent.text);
                responseText += text;
                this.logger.debug('OpenClawClient: 累积响应文本 (旧格式)', {
                  addedLength: text.length,
                  totalLength: responseText.length,
                });
              } else if (chatEvent?.type === 'result') {
                this.logger.info('OpenClawClient: 聊天完成 (result)', {
                  finalResponseLength: responseText.length,
                  responsePreview: responseText.substring(0, 200),
                });
                if (!isResolved) {
                  isResolved = true;
                  clearTimeout(timeoutId);
                  ws.close();
                  resolve(responseText);
                }
              } else if (chatEvent?.type === 'error') {
                const errorMessage = String(chatEvent.message || 'Chat error');
                this.logger.error('OpenClawClient: 聊天错误', {
                  errorMessage,
                });
                if (!isResolved) {
                  isResolved = true;
                  clearTimeout(timeoutId);
                  ws.close();
                  reject(new Error(errorMessage));
                }
              }
            }
            return;
          }
        } catch (e) {
          this.logger.warn('OpenClawClient: 解析消息失败', {
            error: e instanceof Error ? e.message : 'Unknown error',
            data: data.toString().slice(0, 200),
          });
        }
      });

      ws.on('error', (error: Error) => {
        this.logger.error('OpenClawClient: WebSocket 错误', {
          port,
          error: error.message,
        });
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        this.logger.debug('OpenClawClient: WebSocket 连接关闭', {
          port,
          code,
          reason: reason.toString(),
          isConnected,
        });

        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);

          // 如果有响应文本，返回它
          if (responseText) {
            resolve(responseText);
          } else if (code === 1008) {
            // 1008 = Policy Violation (unauthorized)
            reject(
              new Error(
                `WebSocket 认证失败: ${reason.toString() || 'gateway token missing'}`,
              ),
            );
          } else {
            reject(
              new Error(
                `WebSocket 连接意外关闭: code=${code}, reason=${reason.toString()}`,
              ),
            );
          }
        }
      });
    });
  }

  /**
   * 检查 OpenClaw Gateway 健康状态
   * 使用 GATEWAY_HOST（默认 localhost）；Docker 部署时需设为 host.docker.internal 以便 API 容器访问宿主机上的 Gateway 端口
   */
  async checkHealth(port: number): Promise<boolean> {
    const host = getEnvWithDefault('GATEWAY_HOST', 'localhost');
    const url = `http://${host}:${port}/health`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(
          timeout(5000),
          catchError(() => {
            return Promise.resolve({ status: 500 });
          }),
        ),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 通过 Docker exec 获取容器内安装的技能列表
   * 优先使用 `openclaw skills list --json`，失败则 fallback 到读取配置文件
   * 获取技能列表后，还会尝试读取每个技能的 SKILL.md 内容
   * @param containerId Docker 容器 ID
   * @returns 技能列表或 null（exec 失败时）
   */
  async listContainerSkills(
    containerId: string,
  ): Promise<ContainerSkillItem[] | null> {
    this.logger.info('OpenClawClient: 获取容器内置技能', { containerId });

    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

    // 尝试 CLI 命令
    const cliOutput = await this.execInContainer(containerId, [
      'node',
      '/app/openclaw.mjs',
      'skills',
      'list',
      '--json',
    ]);

    let skills: ContainerSkillItem[] | null = null;

    if (cliOutput) {
      try {
        // CLI 可能在 JSON 前输出 Doctor warnings 等非 JSON 内容，尝试提取 JSON 部分
        const jsonStart = cliOutput.search(/[[]{]/);
        const jsonStr = jsonStart >= 0 ? cliOutput.slice(jsonStart) : cliOutput;
        const parsed = JSON.parse(jsonStr);
        skills = this.normalizeSkillsList(parsed);
      } catch {
        // CLI 可能只输出 Doctor warnings 而无 JSON（正常情况），fallback 到配置文件
        this.logger.debug(
          'OpenClawClient: CLI 输出无有效 JSON，尝试读取配置文件',
          {
            containerId,
            outputPreview: cliOutput.substring(0, 200),
          },
        );
      }
    }

    // Fallback 1: 读取容器内的 openclaw.json 配置
    if (!skills) {
      const configOutput = await this.execInContainer(containerId, [
        'cat',
        configPath,
      ]);

      if (configOutput) {
        try {
          const config = JSON.parse(configOutput);
          const parsed = this.parseSkillsFromConfig(config);
          // 只有解析到真实技能列表时才使用（排除 nativeSkills:auto 的占位符）
          if (parsed.length > 0 && parsed[0].name !== 'native-skills') {
            skills = parsed;
          }
        } catch {
          this.logger.warn('OpenClawClient: 配置文件解析失败', { containerId });
        }
      }
    }

    // Fallback 2: 直接列举 /app/skills/ 目录（处理 nativeSkills:auto 场景）
    if (!skills) {
      const lsOutput = await this.execInContainer(containerId, [
        'sh',
        '-c',
        'ls /app/skills/ 2>/dev/null',
      ]);
      if (lsOutput) {
        const names = lsOutput
          .trim()
          .split('\n')
          .map((n) => n.trim())
          .filter(Boolean);
        if (names.length > 0) {
          skills = names.map((name) => ({
            name,
            enabled: true,
            description: null,
            version: null,
            content: null,
          }));
          this.logger.info('OpenClawClient: 从 /app/skills/ 获取内置技能列表', {
            containerId,
            count: skills.length,
          });
        }
      }
    }

    if (!skills) return null;

    // 批量读取每个技能的 SKILL.md 内容
    await this.enrichSkillsWithContent(containerId, skills);

    return skills;
  }

  /**
   * 在容器内执行命令并返回 stdout 输出
   * 使用 DockerExecService 统一处理
   */
  private async execInContainer(
    containerId: string,
    cmd: string[],
  ): Promise<string | null> {
    const result = await this.dockerExec.executeCommand(containerId, cmd, {
      timeout: 15000,
    });
    return result.success ? result.stdout : null;
  }

  private async resolveOpenClawHome(containerId: string): Promise<string> {
    // OpenClaw 在 $OPENCLAW_HOME/.openclaw/ 下读写配置，
    // 所以需要拼接 /.openclaw 后缀得到实际配置目录
    const result = await this.dockerExec.executeCommand(containerId, [
      'sh',
      '-lc',
      'printf %s "${OPENCLAW_HOME:-/home/node}/.openclaw"',
    ]);

    return resolveOpenClawHomeFromEnv(result.stdout);
  }

  /**
   * 标准化技能列表输出
   * 处理不同格式：数组、{ skills: [] }、{ builtin: {} } 等
   */
  private normalizeSkillsList(parsed: unknown): ContainerSkillItem[] {
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        name: String(item.name || item.slug || 'unknown'),
        enabled: item.enabled !== false,
        description: item.description || null,
        version: item.version || null,
        content: null,
      }));
    }

    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;

      // { skills: [...] }
      if (Array.isArray(obj.skills)) {
        return this.normalizeSkillsList(obj.skills);
      }

      // { builtin: { skill_name: true/false, ... } }
      if (obj.builtin && typeof obj.builtin === 'object') {
        return Object.entries(obj.builtin as Record<string, boolean>).map(
          ([name, enabled]) => ({
            name,
            enabled: enabled !== false,
            description: null,
            version: null,
            content: null,
          }),
        );
      }
    }

    return [];
  }

  /**
   * 从 openclaw.json 配置中解析技能信息
   */
  private parseSkillsFromConfig(config: unknown): ContainerSkillItem[] {
    if (!config || typeof config !== 'object') return [];
    const cfg = config as Record<string, unknown>;

    // 尝试 skills.builtin 路径
    const skills = cfg.skills as Record<string, unknown> | undefined;
    if (skills?.builtin && typeof skills.builtin === 'object') {
      return Object.entries(skills.builtin as Record<string, boolean>).map(
        ([name, enabled]) => ({
          name,
          enabled: enabled !== false,
          description: null,
          version: null,
          content: null,
        }),
      );
    }

    // 尝试 commands.nativeSkills 路径
    const commands = cfg.commands as Record<string, unknown> | undefined;
    if (commands?.nativeSkills && commands.nativeSkills !== 'auto') {
      if (
        typeof commands.nativeSkills === 'object' &&
        !Array.isArray(commands.nativeSkills)
      ) {
        return Object.entries(
          commands.nativeSkills as Record<string, boolean>,
        ).map(([name, enabled]) => ({
          name,
          enabled: enabled !== false,
          description: null,
          version: null,
          content: null,
        }));
      }
    }

    // nativeSkills: "auto" 表示全部启用，但无法获取具体列表
    if (commands?.nativeSkills === 'auto') {
      return [
        {
          name: 'native-skills',
          enabled: true,
          description: 'All native skills enabled (auto mode)',
          version: null,
          content: null,
        },
      ];
    }

    return [];
  }

  /**
   * 注入 MCP Server 配置到 OpenClaw 容器的 openclaw.json
   * 在插件安装后，将 mcpConfig 实际注入到容器的配置文件中
   * @param containerId Docker 容器 ID
   * @param mcpServers Record<string, McpServerConfig>
   *   McpServerConfig 格式：{ "plugin-slug": { "command": "npx", "args": [...], "env": {...} }
   *   注意：这会合并（而非覆盖）openclaw.json 中的 mcpServers 配置
   */
  async injectMcpConfig(
    containerId: string,
    mcpServers: Record<string, McpServerConfig>,
  ): Promise<void> {
    this.logger.info('OpenClawClient: 注入 MCP 配置', { containerId });

    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

    // P0-3: 使用 Base64 编码传递数据，彻底消除 JSON 注入风险
    const encoded = Buffer.from(JSON.stringify(mcpServers)).toString('base64');

    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.mcpServers = config.mcpServers || {};
      const newServers = JSON.parse(Buffer.from("${encoded}", "base64").toString("utf8"));
      for (const [name, server] of Object.entries(newServers)) {
        config.mcpServers[name] = server;
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
      console.log(JSON.stringify({ success: true }));
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      { timeout: 15000, throwOnError: true },
    );

    this.logger.info('OpenClawClient: MCP 配置注入完成', {
      containerId,
      plugins: Object.keys(mcpServers),
      output: result.stdout,
      durationMs: result.durationMs,
    });
  }

  /**
   * 移除指定 MCP Server 配置
   * @param containerId Docker 容器 ID
   * @param serverName MCP Server plugin slug（如 "mcp-server-slack"）
   */
  async removeMcpConfig(
    containerId: string,
    serverName: string,
  ): Promise<void> {
    this.logger.info('OpenClawClient: 移除 MCP 配置', {
      containerId,
      serverName,
    });

    // 安全校验：只允许合法字符（防止 shell 注入）
    if (!this.dockerExec.isValidName(serverName)) {
      throw new Error(`Invalid server name: ${serverName}`);
    }

    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

    // 构建 node 脚本：读取 openclaw.json，删除指定 mcpServers，写回文件
    // 使用引号包裹属性名，避免注入风险
    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.mcpServers) {
        delete config.mcpServers["${serverName}"];
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
        console.log(JSON.stringify({ success: true, removed: "${serverName}" }));
      } else {
        console.log(JSON.stringify({ success: true, message: "No mcpServers found" }));
      }
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      { timeout: 10000, throwOnError: true },
    );

    this.logger.info('OpenClawClient: MCP 配置移除完成', {
      containerId,
      serverName,
      output: result.stdout,
      durationMs: result.durationMs,
    });
  }

  // ============================================================================
  // Agent 管理（Gateway Pool 模式）
  // ============================================================================

  /**
   * 向 Gateway 注册一个 Agent
   * 通过 HTTP POST /agents 接口注册
   * @param port Gateway 端口
   * @param token Gateway 认证 token
   * @param agentConfig Agent 配置
   */
  async registerAgent(
    port: number,
    token: string,
    agentConfig: {
      agentId: string;
      name: string;
      persona?: string;
      workspaceDir?: string;
    },
  ): Promise<{
    success: boolean;
    error?: string;
    httpStatus?: number;
    errorCategory?: string;
    attemptedEndpoint?: string;
    fallbackUsed?: boolean;
    compatibilityMode?: 'registration-not-supported';
  }> {
    const primaryUrl = `http://localhost:${port}/agents`;
    const fallbackUrl = `http://localhost:${port}/agents/${agentConfig.agentId}`;

    const classifyErrorCategory = (status?: number, code?: string): string => {
      if (status === 404 || status === 405) return 'HTTP_4XX_PROTOCOL';
      if (status === 401 || status === 403) return 'HTTP_4XX_AUTH';
      if (status === 409) return 'HTTP_4XX_CONFLICT';
      if (status !== undefined && status >= 400 && status < 500) {
        return 'HTTP_4XX_OTHER';
      }
      if (status !== undefined && status >= 500) return 'HTTP_5XX';
      if (code === 'ECONNABORTED') return 'NETWORK_TIMEOUT';
      if (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH'].includes(code || '')) {
        return 'NETWORK_UNREACHABLE';
      }
      if (code === 'ECONNRESET') return 'NETWORK_RESET';
      return 'UNKNOWN';
    };

    const extractError = (
      error: any,
    ): {
      status?: number;
      code?: string;
      message: string;
      category: string;
    } => {
      const status = error?.response?.status as number | undefined;
      const code = error?.code as string | undefined;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status,
        code,
        message,
        category: classifyErrorCategory(status, code),
      };
    };

    this.logger.info('OpenClawClient: 注册 Agent', {
      port,
      agentId: agentConfig.agentId,
      endpoint: 'POST /agents',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(primaryUrl, agentConfig, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }),
      );
      return {
        success:
          response.status === 200 ||
          response.status === 201 ||
          response.status === 204,
        httpStatus: response.status,
        attemptedEndpoint: 'POST /agents',
      };
    } catch (primaryError) {
      const primary = extractError(primaryError);
      this.logger.warn('OpenClawClient: 注册 Agent 失败', {
        stage: 'primary',
        port,
        agentId: agentConfig.agentId,
        status: primary.status,
        code: primary.code,
        errorCategory: primary.category,
        error: primary.message,
        endpoint: 'POST /agents',
      });

      if (primary.status === 409) {
        this.logger.info('OpenClawClient: Agent 已存在，按幂等成功处理', {
          port,
          agentId: agentConfig.agentId,
          endpoint: 'POST /agents',
        });
        return {
          success: true,
          httpStatus: 409,
          errorCategory: 'HTTP_4XX_CONFLICT',
          attemptedEndpoint: 'POST /agents',
          fallbackUsed: false,
        };
      }

      if (primary.status !== 404 && primary.status !== 405) {
        return {
          success: false,
          error: primary.message,
          httpStatus: primary.status,
          errorCategory: primary.category,
          attemptedEndpoint: 'POST /agents',
          fallbackUsed: false,
        };
      }

      this.logger.info('OpenClawClient: register.fallback.start', {
        port,
        agentId: agentConfig.agentId,
        reasonStatus: primary.status,
        fromEndpoint: 'POST /agents',
        toEndpoint: 'PUT /agents/:agentId',
      });

      try {
        const response = await firstValueFrom(
          this.httpService.put(
            fallbackUrl,
            {
              name: agentConfig.name,
              persona: agentConfig.persona,
              workspaceDir: agentConfig.workspaceDir,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            },
          ),
        );

        this.logger.info('OpenClawClient: register.fallback.success', {
          port,
          agentId: agentConfig.agentId,
          status: response.status,
          endpoint: 'PUT /agents/:agentId',
        });

        return {
          success:
            response.status === 200 ||
            response.status === 201 ||
            response.status === 204,
          httpStatus: response.status,
          attemptedEndpoint: 'PUT /agents/:agentId',
          fallbackUsed: true,
        };
      } catch (fallbackError) {
        const fallback = extractError(fallbackError);
        this.logger.warn('OpenClawClient: 注册 Agent 失败', {
          stage: 'fallback',
          port,
          agentId: agentConfig.agentId,
          status: fallback.status,
          code: fallback.code,
          errorCategory: fallback.category,
          error: fallback.message,
          endpoint: 'PUT /agents/:agentId',
        });

        if (fallback.status === 409) {
          this.logger.info(
            'OpenClawClient: Agent 已存在，回退路径按幂等成功处理',
            {
              port,
              agentId: agentConfig.agentId,
              endpoint: 'PUT /agents/:agentId',
            },
          );
          return {
            success: true,
            httpStatus: 409,
            errorCategory: 'HTTP_4XX_CONFLICT',
            attemptedEndpoint: 'PUT /agents/:agentId',
            fallbackUsed: true,
          };
        }

        // 兼容模式：当回退也返回 405/404 时，视为网关不支持 Agent 注册 API（单 Agent 模式，Agent 已就绪）
        if (fallback.status === 405 || fallback.status === 404) {
          this.logger.info('OpenClawClient: 注册 Agent 返回兼容模式', {
            port,
            agentId: agentConfig.agentId,
            compatibilityMode: 'registration-not-supported',
            primaryStatus: primary.status,
            fallbackStatus: fallback.status,
            note: '该网关版本不支持 Agent 注册 API，按已就绪处理',
          });
          return {
            success: true,
            httpStatus: fallback.status,
            errorCategory: 'HTTP_4XX_PROTOCOL',
            attemptedEndpoint: 'PUT /agents/:agentId',
            fallbackUsed: true,
            compatibilityMode: 'registration-not-supported',
          };
        }

        return {
          success: false,
          error: fallback.message,
          httpStatus: fallback.status,
          errorCategory: fallback.category,
          attemptedEndpoint: 'PUT /agents/:agentId',
          fallbackUsed: true,
        };
      }
    }
  }

  /**
   * 通过 CLI 命令注册 Agent（用于 Pool 模式）
   * 使用 docker exec 执行 openclaw agents add 命令
   * @param containerId Gateway 容器 ID
   * @param agentConfig Agent 配置
   */
  async registerAgentViaCli(
    containerId: string,
    agentConfig: {
      agentId: string;
      name: string;
      persona?: string;
      workspaceDir?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info('OpenClawClient: 通过 CLI 注册 Agent', {
      containerId,
      agentId: agentConfig.agentId,
    });

    try {
      // 构建 openclaw agents add 命令
      const args = [
        'agents',
        'add',
        agentConfig.name,
        '--non-interactive',
        '--json',
      ];

      if (agentConfig.workspaceDir) {
        args.push('--workspace', agentConfig.workspaceDir);
      }

      // 执行命令（增加超时时间到 60 秒，因为 agent 注册可能需要创建 workspace）
      // 指定 user: 'node' 确保创建的 workspace 目录权限正确
      const result = await this.dockerExec.executeCommand(
        containerId,
        ['openclaw', ...args],
        { timeout: 60000, user: 'node' },
      );

      const { stdout, stderr, success } = result;

      // 检查执行是否成功
      if (!success) {
        this.logger.warn('OpenClawClient: Agent 注册失败（命令执行失败）', {
          containerId,
          agentId: agentConfig.agentId,
          stderr,
        });
        return { success: false, error: stderr || 'Command execution failed' };
      }

      // 解析 JSON 输出
      try {
        const parsed = JSON.parse(stdout);
        this.logger.info('OpenClawClient: Agent 注册成功', {
          containerId,
          agentId: agentConfig.agentId,
          result: parsed,
        });
        return { success: true };
      } catch {
        // 如果不是 JSON，检查 stderr 是否包含真正的错误
        // OpenClaw 会将配置更新信息输出到 stderr，这不是错误
        const isRealError =
          stderr &&
          (stderr.includes('Error:') ||
            stderr.includes('error:') ||
            stderr.includes('failed') ||
            stderr.includes('Failed'));

        if (isRealError) {
          this.logger.warn('OpenClawClient: Agent 注册失败', {
            containerId,
            agentId: agentConfig.agentId,
            stderr,
          });
          return { success: false, error: stderr };
        }

        // 没有真正的错误，认为成功
        this.logger.info('OpenClawClient: Agent 注册成功（无 JSON 输出）', {
          containerId,
          agentId: agentConfig.agentId,
          stderr: stderr ? '有配置更新信息' : '无',
        });
        return { success: true };
      }
    } catch (error) {
      this.logger.error('OpenClawClient: Agent 注册失败', {
        containerId,
        agentId: agentConfig.agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 通过 HTTP PUT /agents/:agentId 向运行中的 Gateway 发送 Agent 配置更新请求（best-effort）
   *
   * 说明：
   * - 该方法仅转发增量更新请求
   * - 是否被运行中 Gateway 接受并立即生效，取决于 OpenClaw 当前版本能力
   * - 调用方不应依赖此方法替代 DB 驱动的配置产物重建与生命周期链路
   *
   * @param port Gateway 端口
   * @param token Gateway 认证 token
   * @param agentId Agent ID
   * @param updates 需要更新的配置字段
   */
  async hotReloadAgent(
    port: number,
    token: string,
    agentId: string,
    updates: {
      persona?: string;
      workspaceDir?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const url = `http://localhost:${port}/agents/${agentId}`;
    this.logger.info('OpenClawClient: sending Agent update request', {
      port,
      agentId,
    });

    try {
      const response = await firstValueFrom(
        this.httpService
          .put(url, updates, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          })
          .pipe(
            catchError((error) => {
              this.logger.warn('OpenClawClient: Agent update request failed', {
                port,
                agentId,
                error: error.message,
              });
              throw error;
            }),
          ),
      );
      return { success: response.status === 200 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 从 Gateway 注销 Agent
   * 通过 HTTP DELETE /agents/:agentId 接口注销
   * @deprecated 推荐使用 unregisterAgentViaCli 以避免 404 错误
   * @param port Gateway 端口
   * @param token Gateway 认证 token
   * @param agentId Agent ID
   */
  async unregisterAgent(
    port: number,
    token: string,
    agentId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const url = `http://localhost:${port}/agents/${agentId}`;
    this.logger.info('OpenClawClient: 注销 Agent', { port, agentId });

    try {
      const response = await firstValueFrom(
        this.httpService
          .delete(url, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          })
          .pipe(
            catchError((error) => {
              this.logger.warn('OpenClawClient: 注销 Agent 失败', {
                port,
                agentId,
                error: error.message,
              });
              throw error;
            }),
          ),
      );
      return { success: response.status === 200 || response.status === 204 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 通过 CLI 命令注销 Agent（用于 Pool 模式）
   * 使用 docker exec 执行 openclaw agents delete 命令
   * 相比 HTTP DELETE 方式，CLI 方式对"agent 不存在"的情况处理更优雅，不会产生 404 错误
   * @param containerId Gateway 容器 ID
   * @param agentId Agent ID
   */
  async unregisterAgentViaCli(
    containerId: string,
    agentId: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info('OpenClawClient: 通过 CLI 注销 Agent', {
      containerId,
      agentId,
    });

    try {
      // 构建 openclaw agents delete 命令
      const args = ['agents', 'delete', agentId, '--force', '--json'];

      // 执行命令
      const result = await this.dockerExec.executeCommand(containerId, [
        'openclaw',
        ...args,
      ]);

      const { stdout, stderr, success } = result;

      // 检查执行是否成功
      if (!success) {
        // 检查是否是 "agent not found" 错误
        const isNotFoundError =
          stderr &&
          (stderr.includes('not found') ||
            stderr.includes('does not exist') ||
            stderr.includes('No agent'));

        if (isNotFoundError) {
          // Agent 不存在，视为成功（幂等性）
          this.logger.info('OpenClawClient: Agent 已不存在，无需注销', {
            containerId,
            agentId,
          });
          return { success: true };
        }

        this.logger.warn('OpenClawClient: Agent 注销失败（命令执行失败）', {
          containerId,
          agentId,
          stderr,
        });
        return { success: false, error: stderr || 'Command execution failed' };
      }

      // 解析 JSON 输出
      try {
        const parsed = JSON.parse(stdout);
        this.logger.info('OpenClawClient: Agent 注销成功', {
          containerId,
          agentId,
          result: parsed,
        });
        return { success: true };
      } catch {
        // 如果不是 JSON，检查 stderr 是否包含真正的错误
        const isRealError =
          stderr &&
          (stderr.includes('Error:') ||
            stderr.includes('error:') ||
            stderr.includes('failed') ||
            stderr.includes('Failed'));

        if (isRealError) {
          this.logger.warn('OpenClawClient: Agent 注销失败', {
            containerId,
            agentId,
            stderr,
          });
          return { success: false, error: stderr };
        }

        // 没有真正的错误，认为成功
        this.logger.info('OpenClawClient: Agent 注销成功（无 JSON 输出）', {
          containerId,
          agentId,
        });
        return { success: true };
      }
    } catch (error) {
      this.logger.error('OpenClawClient: Agent 注销失败', {
        containerId,
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取 Gateway 中的所有 Agent 列表
   * @param port Gateway 端口
   * @param token Gateway 认证 token
   */
  async listAgents(
    port: number,
    token: string,
  ): Promise<{
    success: boolean;
    agents?: Array<{
      id: string;
      name?: string;
      model?: string;
      workspace?: string;
      routingRules?: number;
    }>;
    error?: string;
  }> {
    this.logger.info('OpenClawClient: 获取 Agent 列表 (从配置文件)', {
      port,
      hasToken: Boolean(token),
    });

    try {
      // OpenClaw Gateway 的 /agents 端点返回 HTML 页面,不是 JSON API
      // 因此我们需要从容器内的配置文件读取 agent 信息
      // 注意: 这个方法需要 containerId,但当前签名只有 port
      // 作为临时方案,我们返回空列表,让调用方从 DB 获取信息

      // TODO: 重构此方法,接受 containerId 参数,然后从容器内读取配置文件
      // 或者使用 WebSocket 协议与 Gateway 通信获取 agent 状态

      this.logger.warn(
        'OpenClawClient: listAgents 方法需要重构以支持从配置文件读取',
        { port },
      );

      return {
        success: false,
        error:
          'listAgents API endpoint not available, use config-based approach',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 从容器内的配置文件读取 Agent 列表
   * 这是 listAgents 的替代方法,直接从配置文件读取而不是调用 HTTP API
   *
   * 会合并两个来源的 agent:
   * 1. openclaw.json 的 agents.list
   * 2. preload/agents-config/ 目录下的 per-agent 配置文件
   */
  async listAgentsFromConfig(containerId: string): Promise<{
    success: boolean;
    agents?: Array<{
      id: string;
      name?: string;
      model?: string | { primary?: string; fallbacks?: string[] };
      workspace?: string;
      routingRules?: number;
    }>;
    error?: string;
  }> {
    this.logger.info('OpenClawClient: 从配置文件读取 Agent 列表', {
      containerId,
    });

    try {
      const openclawHome = await this.resolveOpenClawHome(containerId);
      const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');
      const result = await this.dockerExec.executeCommand(containerId, [
        'cat',
        configPath,
      ]);

      if (!result.stdout) {
        return {
          success: false,
          error: 'Gateway config read failed: openclaw.json not found or empty',
        };
      }

      const config = JSON.parse(result.stdout);
      const agentsList = config.agents?.list || [];
      const bindings = config.bindings || [];
      const agentsFromMainConfig = new Set<string>();

      // 构建 agent 信息（从主配置）
      const agents = agentsList.map((agent: any) => {
        agentsFromMainConfig.add(agent.id);
        // 统计该 agent 的路由规则数量
        const routingRules = bindings.filter(
          (b: any) => b.agentId === agent.id,
        ).length;

        return {
          id: agent.id,
          name: agent.name,
          model: agent.model?.primary || config.agents?.defaults?.model,
          workspace: agent.workspace || config.agents?.defaults?.workspace,
          routingRules,
        };
      });

      // Pool 模式：读取 preload/agents-config/ 目录下的 per-agent 配置文件
      const agentsConfigDir = buildOpenClawPath(
        openclawHome,
        'preload/agents-config',
      );
      const listDirResult = await this.dockerExec.executeCommand(containerId, [
        'ls',
        '-1',
        agentsConfigDir,
      ]);

      if (listDirResult.stdout && listDirResult.success) {
        const agentConfigFiles = listDirResult.stdout
          .split('\n')
          .filter((f) => f.endsWith('.json'));

        for (const configFile of agentConfigFiles) {
          const agentKey = configFile.replace('.json', '');
          // 如果已经在主配置中，跳过
          if (agentsFromMainConfig.has(agentKey)) continue;

          // 读取 per-agent 配置文件
          const agentConfigPath = `${agentsConfigDir}/${configFile}`;
          const agentConfigResult = await this.dockerExec.executeCommand(
            containerId,
            ['cat', agentConfigPath],
          );

          if (agentConfigResult.stdout && agentConfigResult.success) {
            try {
              const agentConfig = JSON.parse(agentConfigResult.stdout);
              // 从 per-agent 配置中提取 model 信息
              const primaryModel = agentConfig.agents?.defaults?.model?.primary;
              agents.push({
                id: agentKey,
                name: agentKey,
                model: primaryModel,
                workspace: `/app/workspace/${agentKey}`,
                routingRules: 0,
              });
              this.logger.debug('OpenClawClient: 从 per-agent 配置读取 agent', {
                containerId,
                agentKey,
                primaryModel,
              });
            } catch {
              this.logger.warn('OpenClawClient: 无法解析 per-agent 配置文件', {
                containerId,
                configFile,
              });
            }
          }
        }
      }

      this.logger.info('OpenClawClient: 成功读取 Agent 列表', {
        containerId,
        agentCount: agents.length,
        fromMainConfig: agentsFromMainConfig.size,
        fromPerAgentConfig: agents.length - agentsFromMainConfig.size,
      });

      return {
        success: true,
        agents,
      };
    } catch (error) {
      this.logger.error('OpenClawClient: 读取 Agent 列表失败', {
        containerId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? `Gateway agents list failed: ${error.message}`
            : 'Gateway agents list failed',
      };
    }
  }

  /**
   * 读取容器内 openclaw.json
   */
  async readGatewayConfig(
    containerId: string,
  ): Promise<Record<string, unknown>> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      if (!fs.existsSync(configPath)) {
        console.log(JSON.stringify({}));
        process.exit(0);
      }
      const raw = fs.readFileSync(configPath, "utf8");
      if (!raw) {
        console.log(JSON.stringify({}));
        process.exit(0);
      }
      const parsed = JSON.parse(raw);
      console.log(JSON.stringify(parsed && typeof parsed === "object" ? parsed : {}));
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      {
        timeout: 15000,
        throwOnError: true,
      },
    );

    const parsed = JSON.parse(result.stdout || '{}');
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  }

  /**
   * 写入容器内 openclaw.json
   */
  async writeGatewayConfig(
    containerId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');
    const payload = Buffer.from(JSON.stringify(config)).toString('base64');

    const nodeScript = `
      const fs = require("fs");
      const path = require("path");
      const configPath = ${JSON.stringify(configPath)};
      const dirPath = path.dirname(configPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      const parsed = JSON.parse(Buffer.from("${payload}", "base64").toString("utf8"));
      fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), "utf8");
      console.log("ok");
    `;

    await this.dockerExec.executeNodeScript(containerId, nodeScript, {
      timeout: 15000,
      throwOnError: true,
    });
  }

  /**
   * 运行 openclaw devices list
   */
  async listGatewayDevices(containerId: string): Promise<string> {
    const result = await this.dockerExec.executeCommand(
      containerId,
      ['openclaw', 'devices', 'list'],
      {
        timeout: 30000,
        throwOnError: true,
      },
    );

    return (result.stdout || '').trim();
  }

  /**
   * 运行 openclaw devices approve <requestId>
   */
  async approveGatewayDevice(
    containerId: string,
    requestId: string,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const result = await this.dockerExec.executeCommand(
      containerId,
      ['openclaw', 'devices', 'approve', requestId],
      {
        timeout: 30000,
      },
    );

    if (!result.success) {
      return {
        success: false,
        error: result.stderr || 'openclaw devices approve failed',
      };
    }

    return {
      success: true,
      output: result.stdout,
    };
  }

  /**
   * 运行 openclaw devices reject <requestId>
   */
  async rejectGatewayDevice(
    containerId: string,
    requestId: string,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const result = await this.dockerExec.executeCommand(
      containerId,
      ['openclaw', 'devices', 'reject', requestId],
      {
        timeout: 30000,
      },
    );

    if (!result.success) {
      return {
        success: false,
        error: result.stderr || 'openclaw devices reject failed',
      };
    }

    return {
      success: true,
      output: result.stdout,
    };
  }

  /**
   * 读取 openclaw.json 配置文件
   * 用于检查配置状态和比对配置变化
   */
  async readOpenclawConfig(
    containerId: string,
  ): Promise<Record<string, unknown> | null> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      if (!fs.existsSync(configPath)) {
        console.log(JSON.stringify(null));
        process.exit(0);
      }
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      console.log(JSON.stringify(config));
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      {
        timeout: 15000,
        throwOnError: true,
      },
    );

    return JSON.parse(result.stdout || 'null') as Record<
      string,
      unknown
    > | null;
  }

  /**
   * 读取 Gateway 运行态插件列表（plugins.entries）
   */
  async listRuntimePlugins(
    containerId: string,
  ): Promise<OpenClawRuntimePluginItem[]> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      if (!fs.existsSync(configPath)) {
        console.log(JSON.stringify([]));
        process.exit(0);
      }
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const entries = config?.plugins?.entries || {};
      const list = Object.entries(entries).map(([id, raw]) => {
        const entry = raw && typeof raw === "object" ? raw : {};
        return {
          id,
          enabled: entry.enabled !== false,
          sourceType: entry.sourceType ?? null,
          installSpec: entry.installSpec ?? null,
          hasConfig: !!(entry.config && typeof entry.config === "object"),
          config:
            entry.config && typeof entry.config === "object" ? entry.config : null,
        };
      });
      console.log(JSON.stringify(list));
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      {
        timeout: 15000,
        throwOnError: true,
      },
    );

    const parsed = JSON.parse(result.stdout || '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => ({
      id: String(item.id || ''),
      enabled: item.enabled !== false,
      sourceType:
        item.sourceType === 'npm' ||
        item.sourceType === 'path' ||
        item.sourceType === 'bundled'
          ? item.sourceType
          : null,
      installSpec:
        typeof item.installSpec === 'string' ? item.installSpec : null,
      hasConfig: item.hasConfig === true,
      config:
        item.config && typeof item.config === 'object'
          ? (item.config as Record<string, unknown>)
          : null,
    }));
  }

  /**
   * 在容器内执行 openclaw plugins install
   * 支持 npm 和 path 两种安装方式
   *
   * @param containerId 容器 ID
   * @param spec 安装规格 (npm 包名或本地路径)
   * @param sourceType 安装类型 ('npm' | 'path')
   */
  async installRuntimePlugin(
    containerId: string,
    spec: string,
    sourceType?: 'npm' | 'path',
    pluginId?: string,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    // 在安装前清理旧的插件文件
    if (pluginId) {
      await this.cleanOldPluginFiles(containerId, pluginId);
    }

    // 如果是 path 类型安装，先拷贝目录到容器
    if (sourceType === 'path') {
      const copyResult = await this.copyLocalPluginToContainer(
        containerId,
        spec,
      );
      if (!copyResult.success) {
        return {
          success: false,
          error: copyResult.error || 'Failed to copy plugin to container',
        };
      }
      // 使用容器内的路径执行安装
      spec = copyResult.containerPath!;

      // 验证文件已拷贝到容器
      const verifyResult = await this.dockerExec.executeCommand(
        containerId,
        ['ls', '-la', spec],
        { timeout: 10000, waitForReady: true },
      );
      this.logger.info('[OpenClaw] Verifying plugin files in container', {
        containerId: containerId.substring(0, 12),
        containerPath: spec,
        lsOutput: verifyResult.stdout,
        lsError: verifyResult.stderr,
      });
    }

    this.logger.info('[OpenClaw] Running openclaw plugins install', {
      containerId: containerId.substring(0, 12),
      spec,
      sourceType,
    });

    // 对于本地插件安装，添加 --dangerously-force-unsafe-install 参数
    // 以绕过安全检测的误判（如 Playwright 的 $eval API）
    // 参考: https://docs.openclaw.ai/gateway/security
    const installArgs = ['openclaw', 'plugins', 'install', spec];
    if (sourceType === 'path') {
      installArgs.push('--dangerously-force-unsafe-install');
    }

    const result = await this.dockerExec.executeCommand(
      containerId,
      installArgs,
      {
        timeout: 120000,
        waitForReady: true,
      },
    );

    this.logger.info('[OpenClaw] openclaw plugins install result', {
      containerId: containerId.substring(0, 12),
      spec,
      success: result.success,
      stdout: result.stdout?.substring(0, 1000),
      stderr: result.stderr?.substring(0, 1000),
    });

    // 检查是否有下载失败的错误（即使命令返回 success，npm 下载可能失败）
    // openclaw plugins install 可能返回 success 但 stderr 包含下载失败信息
    const stderrLower = (result.stderr || '').toLowerCase();
    const downloadFailedPatterns = [
      'download failed',
      'rate limit exceeded',
      '429',
      '404',
      'network error',
      'connection refused',
      'timeout',
      'package not found',
      'cannot find package',
      'npm err',
      'fetch failed',
    ];

    const hasDownloadError = downloadFailedPatterns.some((pattern) =>
      stderrLower.includes(pattern),
    );

    if (hasDownloadError) {
      this.logger.error(
        '[OpenClaw] npm package download failed (detected in stderr)',
        {
          containerId: containerId.substring(0, 12),
          spec,
          stderr: result.stderr,
          detectedPatterns: downloadFailedPatterns.filter((p) =>
            stderrLower.includes(p),
          ),
        },
      );

      // 即使命令返回 success，npm 下载失败应该视为安装失败
      if (sourceType === 'npm') {
        return {
          success: false,
          error: `npm package download failed: ${result.stderr || 'Rate limit exceeded or network error'}`,
        };
      }
    }

    if (!result.success) {
      return {
        success: false,
        error: result.stderr || 'openclaw plugins install failed',
      };
    }

    // 验证目标插件是否真正被安装（检查 stdout 是否包含插件注册信息）
    // 对于 npm 安装，需要确认插件确实被加载
    if (sourceType === 'npm' && pluginId) {
      const stdoutLower = (result.stdout || '').toLowerCase();
      const stderrLower = (result.stderr || '').toLowerCase();

      // 检查是否有插件注册成功的迹象
      const pluginIdLower = pluginId.toLowerCase();
      const pluginRegisteredPatterns = [
        `registered`,
        `initialized`,
        `plugin registered`,
        `plugin loaded`,
      ];

      const hasPluginInOutput =
        stdoutLower.includes(pluginIdLower) ||
        stderrLower.includes(pluginIdLower);
      const hasRegistrationSuccess = pluginRegisteredPatterns.some(
        (p) => stdoutLower.includes(p) && stdoutLower.includes(pluginIdLower),
      );

      // 如果插件名称不在输出中，可能安装未成功
      if (!hasPluginInOutput && !hasRegistrationSuccess) {
        this.logger.warn(
          '[OpenClaw] Plugin may not have been installed successfully',
          {
            containerId: containerId.substring(0, 12),
            spec,
            pluginId,
            stdoutPreview: result.stdout?.substring(0, 200),
            stderrPreview: result.stderr?.substring(0, 200),
          },
        );

        // 不立即返回失败，但记录警告，后续的 configVerify 会进一步验证
      }
    }

    // === 诊断：验证安装结果 ===
    // 检查 openclaw.json 是否更新了 plugins.entries
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

    const verifyConfigScript = `
      const fs = require('fs');
      const configPath = '${configPath}';
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const entries = config?.plugins?.entries || {};
        console.log(JSON.stringify({
          configExists: true,
          pluginCount: Object.keys(entries).length,
          plugins: Object.keys(entries),
          entriesDetail: entries
        }));
      } catch (e) {
        console.log(JSON.stringify({ configExists: false, error: e.message }));
      }
    `;

    const configVerifyResult = await this.dockerExec.executeCommand(
      containerId,
      ['node', '-e', verifyConfigScript],
      { timeout: 10000 },
    );

    this.logger.info('[OpenClaw] Post-install config verification', {
      containerId: containerId.substring(0, 12),
      spec,
      sourceType,
      configVerify: configVerifyResult.stdout,
      configVerifyError: configVerifyResult.stderr,
    });

    // 验证目标插件是否被添加到 plugins.entries
    if (configVerifyResult.success && configVerifyResult.stdout) {
      try {
        const verifyParsed = JSON.parse(configVerifyResult.stdout.trim());
        const installedPlugins = verifyParsed.plugins || [];

        // 检查目标插件是否在列表中
        // pluginId 已作为参数传入，直接使用
        if (pluginId && !installedPlugins.includes(pluginId)) {
          this.logger.error(
            '[OpenClaw] Plugin not found in plugins.entries after install',
            {
              containerId: containerId.substring(0, 12),
              spec,
              sourceType,
              pluginId,
              installedPlugins,
            },
          );

          // 插件未添加到配置，视为安装失败
          return {
            success: false,
            error: `Plugin ${pluginId} was not added to plugins.entries. The npm package may have failed to download or install.`,
          };
        }
      } catch (parseError) {
        this.logger.warn(
          '[OpenClaw] Failed to parse config verification result',
          {
            containerId: containerId.substring(0, 12),
            parseError,
          },
        );
      }
    }

    // 扫描可能安装位置的文件结构
    const scanPathsScript = `
      const fs = require('fs');
      const path = require('path');
      
      const basePaths = [
        '${openclawHome}/plugins',
        '${openclawHome}/node_modules',
        '/app/plugins',
        '/app/node_modules'
      ];
      
      const results = {};
      for (const basePath of basePaths) {
        try {
          if (fs.existsSync(basePath)) {
            const items = fs.readdirSync(basePath, { withFileTypes: true });
            results[basePath] = items.map(i => ({
              name: i.name,
              isDir: i.isDirectory()
            }));
          } else {
            results[basePath] = { exists: false };
          }
        } catch (e) {
          results[basePath] = { error: e.message };
        }
      }
      
      console.log(JSON.stringify(results));
    `;

    const scanResult = await this.dockerExec.executeCommand(
      containerId,
      ['node', '-e', scanPathsScript],
      { timeout: 10000 },
    );

    return {
      success: true,
      output: result.stdout,
    };
  }

  /**
   * 读取已安装插件的 manifest 文件 (openclaw.plugin.json)
   * 用于获取 configSchema 和 uiHints 等元数据
   *
   * @param containerId 容器 ID
   * @param pluginId 插件 ID
   * @returns 插件 manifest 信息，包含 configSchema、uiHints、name、description、version 等
   */
  async getPluginManifest(
    containerId: string,
    pluginId: string,
  ): Promise<{
    configSchema?: Record<string, unknown>;
    uiHints?: Record<string, unknown>;
    name?: string;
    description?: string;
    version?: string;
    kind?: string;
  } | null> {
    const openclawHome = await this.resolveOpenClawHome(containerId);

    // 尝试多个可能的路径来查找 manifest 文件
    // npm 安装的插件可能在不同的位置
    const possiblePaths = [
      // npm 安装的插件路径（openclaw home 下的 plugins 目录）
      `${openclawHome}/plugins/${pluginId}/openclaw.plugin.json`,
      `${openclawHome}/plugins/node_modules/${pluginId}/openclaw.plugin.json`,
      // 另一种可能的 npm 路径（openclaw home 下的 node_modules）
      `${openclawHome}/node_modules/${pluginId}/openclaw.plugin.json`,
      // /app 目录下的路径（Docker 容器内）
      `/app/plugins/${pluginId}/openclaw.plugin.json`,
      `/app/node_modules/${pluginId}/openclaw.plugin.json`,
      // extensions 目录下的插件（开发模式）
      `${openclawHome}/../../extensions/${pluginId}/openclaw.plugin.json`,
      // 用户主目录下的路径
      `/home/node/.openclaw/plugins/${pluginId}/openclaw.plugin.json`,
      `/home/node/.openclaw/plugins/node_modules/${pluginId}/openclaw.plugin.json`,
      `/home/node/.openclaw/node_modules/${pluginId}/openclaw.plugin.json`,
    ];

    this.logger.info('[OpenClaw] Searching for plugin manifest', {
      containerId: containerId.substring(0, 12),
      pluginId,
      openclawHome,
      searchPaths: possiblePaths,
    });

    const nodeScript = `
      const fs = require('fs');
      const paths = ${JSON.stringify(possiblePaths)};
      const searchResults = [];
      for (const path of paths) {
        const exists = fs.existsSync(path);
        searchResults.push({ path, exists });
        if (exists) {
          try {
            const content = fs.readFileSync(path, 'utf8');
            const manifest = JSON.parse(content);
            console.log(JSON.stringify({
              found: true,
              path: path,
              manifest: manifest,
              searchResults: searchResults
            }));
            process.exit(0);
          } catch (e) {
            searchResults[searchResults.length - 1].parseError = e.message;
          }
        }
      }
      console.log(JSON.stringify({ found: false, searchResults: searchResults }));
    `;

    try {
      const result = await this.dockerExec.executeCommand(
        containerId,
        ['node', '-e', nodeScript],
        { timeout: 10000 },
      );

      if (result.success && result.stdout) {
        const parsed = JSON.parse(result.stdout.trim()) as {
          found: boolean;
          manifest?: Record<string, unknown>;
          searchResults?: Array<{
            path: string;
            exists: boolean;
            parseError?: string;
          }>;
        };

        if (parsed.found && parsed.manifest) {
          return {
            configSchema: parsed.manifest.configSchema as
              | Record<string, unknown>
              | undefined,
            uiHints: parsed.manifest.uiHints as
              | Record<string, unknown>
              | undefined,
            name: parsed.manifest.name as string | undefined,
            description: parsed.manifest.description as string | undefined,
            version: parsed.manifest.version as string | undefined,
            kind: parsed.manifest.kind as string | undefined,
          };
        }
      }
    } catch (error) {
      this.logger.warn('[OpenClaw] Failed to read plugin manifest', {
        containerId: containerId.substring(0, 12),
        pluginId,
        error,
      });
    }

    return null;
  }

  /**
   * 诊断 npm 插件安装位置
   * 用于调试 npm 安装后插件文件的实际位置
   *
   * @param containerId 容器 ID
   * @param pluginId 插件 ID（可选，如果不提供则扫描所有可能位置）
   * @returns 所有找到的 openclaw.plugin.json 文件及其路径
   */
  async diagnosePluginLocations(
    containerId: string,
    pluginId?: string,
  ): Promise<{
    openclawHome: string;
    searchPaths: Record<
      string,
      { exists: boolean; items?: string[]; manifest?: Record<string, unknown> }
    >;
    foundManifests: Array<{
      path: string;
      pluginId: string;
      manifest: Record<string, unknown>;
    }>;
  }> {
    const openclawHome = await this.resolveOpenClawHome(containerId);

    // 构建搜索脚本 - 扫描所有可能的插件目录
    const diagnoseScript = `
      const fs = require('fs');
      const path = require('path');
      
      const openclawHome = '${openclawHome}';
      const targetPluginId = ${pluginId ? `'${pluginId}'` : 'null'};
      
      const basePaths = [
        openclawHome + '/plugins',
        openclawHome + '/plugins/node_modules',
        openclawHome + '/node_modules',
        '/app/plugins',
        '/app/node_modules',
        '/home/node/.openclaw/plugins',
        '/home/node/.openclaw/plugins/node_modules',
        '/home/node/.openclaw/node_modules',
      ];
      
      const searchPaths = {};
      const foundManifests = [];
      
      // 递归查找 openclaw.plugin.json 文件
      function findManifests(dir, depth = 0) {
        if (depth > 3) return; // 限制递归深度
        try {
          if (!fs.existsSync(dir)) return;
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              // 检查是否有 openclaw.plugin.json
              const manifestPath = path.join(fullPath, 'openclaw.plugin.json');
              if (fs.existsSync(manifestPath)) {
                try {
                  const content = fs.readFileSync(manifestPath, 'utf8');
                  const manifest = JSON.parse(content);
                  const foundId = manifest.id || item.name;
                  if (!targetPluginId || foundId === targetPluginId || item.name === targetPluginId) {
                    foundManifests.push({
                      path: manifestPath,
                      pluginId: foundId,
                      manifest: manifest
                    });
                  }
                } catch (e) {}
              }
              // 继续递归（针对 node_modules 子目录）
              if (item.name === 'node_modules' || depth < 2) {
                findManifests(fullPath, depth + 1);
              }
            }
          }
        } catch (e) {}
      }
      
      // 检查每个基础路径
      for (const basePath of basePaths) {
        try {
          if (fs.existsSync(basePath)) {
            const items = fs.readdirSync(basePath, { withFileTypes: true }).map(i => i.name);
            searchPaths[basePath] = { exists: true, items };
            findManifests(basePath);
          } else {
            searchPaths[basePath] = { exists: false };
          }
        } catch (e) {
          searchPaths[basePath] = { exists: false, error: e.message };
        }
      }
      
      console.log(JSON.stringify({ openclawHome, searchPaths, foundManifests }));
    `;

    try {
      const result = await this.dockerExec.executeCommand(
        containerId,
        ['node', '-e', diagnoseScript],
        { timeout: 30000 },
      );

      if (result.success && result.stdout) {
        const parsed = JSON.parse(result.stdout.trim());
        this.logger.info('[OpenClaw] Plugin location diagnosis result', {
          containerId: containerId.substring(0, 12),
          targetPluginId: pluginId,
          openclawHome: parsed.openclawHome,
          foundManifestsCount: parsed.foundManifests?.length || 0,
          foundManifests: parsed.foundManifests?.map((m) => ({
            path: m.path,
            pluginId: m.pluginId,
          })),
        });
        return parsed;
      }
    } catch (error) {
      this.logger.error('[OpenClaw] Plugin location diagnosis failed', {
        containerId: containerId.substring(0, 12),
        pluginId,
        error,
      });
    }

    return {
      openclawHome,
      searchPaths: {},
      foundManifests: [],
    };
  }

  /**
   * 清理旧的插件文件
   * 在安装/更新插件前调用，确保旧文件被完全清理
   */
  private async cleanOldPluginFiles(
    containerId: string,
    pluginId: string,
  ): Promise<void> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const extensionsDir = buildOpenClawPath(
      openclawHome,
      'extensions',
      pluginId,
    );
    const appPluginsDir = `/app/plugins/${pluginId}`;

    const nodeScript = `
      const fs = require('fs');
      const path = require('path');

      const dirs = [
        '${extensionsDir}',
        '${appPluginsDir}'
      ];

      for (const dir of dirs) {
        if (fs.existsSync(dir)) {
          try {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log('Cleaned: ' + dir);
          } catch (e) {
            console.log('Failed to clean ' + dir + ': ' + e.message);
          }
        }
      }
    `;

    try {
      await this.dockerExec.executeNodeScript(containerId, nodeScript, {
        timeout: 15000,
        throwOnError: false,
      });
      this.logger.info('[OpenClaw] Cleaned old plugin files before install', {
        containerId: containerId.substring(0, 12),
        pluginId,
        extensionsDir,
        appPluginsDir,
      });
    } catch (error) {
      // 不阻断安装流程，仅记录警告
      this.logger.warn('[OpenClaw] Failed to clean old plugin files', {
        containerId: containerId.substring(0, 12),
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 将本地插件目录拷贝到容器
   *
   * @param containerId 容器 ID
   * @param localPath 本地插件路径
   * @returns 拷贝结果和容器内路径
   */
  private async copyLocalPluginToContainer(
    containerId: string,
    localPath: string,
  ): Promise<{ success: boolean; containerPath?: string; error?: string }> {
    try {
      // 解析本地路径
      // spec 可能是 ./extensions/plugin-name 或 extensions/plugin-name
      const normalizedPath = localPath.replace(/^\.\//, '');

      let sourceDir: string;

      if (path.isAbsolute(normalizedPath)) {
        // 绝对路径直接使用
        sourceDir = normalizedPath;
      } else if (normalizedPath.startsWith('extensions/')) {
        // extensions/ 路径相对于项目根目录 (PROJECT_ROOT 是 apps/api，需要向上两级)
        const projectRoot = process.env.PROJECT_ROOT || process.cwd();
        sourceDir = path.join(projectRoot, '../../', normalizedPath);
      } else {
        // 其他相对路径
        const projectRoot = process.env.PROJECT_ROOT || process.cwd();
        sourceDir = path.join(projectRoot, normalizedPath);
      }

      // 获取插件名称
      const pluginName = path.basename(sourceDir);

      // 容器内目标路径 - 使用 plugins 目录安装本地插件
      const containerPluginDir = '/app/plugins';
      const containerPath = `${containerPluginDir}/${pluginName}`;

      this.logger.info('[OpenClaw] Copying local plugin to container', {
        containerId: containerId.substring(0, 12),
        sourceDir,
        containerPath,
      });

      // 删除已存在的插件目录（确保使用最新版本）
      const rmResult = await this.dockerExec.executeCommand(
        containerId,
        ['rm', '-rf', containerPath],
        { timeout: 10000, waitForReady: true },
      );

      // 确保 /app/plugins 目录存在
      const mkdirResult = await this.dockerExec.executeCommand(
        containerId,
        ['mkdir', '-p', containerPluginDir],
        { timeout: 10000, waitForReady: true },
      );

      if (!mkdirResult.success) {
        this.logger.warn(
          '[OpenClaw] Failed to create plugins directory, attempting copy anyway',
          {
            containerId: containerId.substring(0, 12),
            containerPluginDir,
            error: mkdirResult.stderr,
          },
        );
      }

      // 拷贝目录到容器
      await this.dockerExec.copyDirectoryToContainer(
        containerId,
        sourceDir,
        containerPluginDir,
      );

      this.logger.info(
        '[OpenClaw] Local plugin copied to container successfully',
        {
          containerId: containerId.substring(0, 12),
          containerPath,
        },
      );

      return {
        success: true,
        containerPath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClaw] Failed to copy local plugin to container', {
        containerId: containerId.substring(0, 12),
        localPath,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 更新 plugins.entries.<pluginId> 配置并写回 openclaw.json
   *
   * 注意：plugins.entries 只接受 enabled 和 config 字段
   * sourceType 和 installSpec 不应写入，否则会导致 OpenClaw 校验失败
   */
  async upsertRuntimePluginEntry(
    containerId: string,
    params: {
      pluginId: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      sourceType?: 'npm' | 'path' | 'bundled';
      installSpec?: string;
    },
  ): Promise<OpenClawRuntimePluginItem> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');
    const payload = Buffer.from(JSON.stringify(params)).toString('base64');

    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      const payload = JSON.parse(Buffer.from("${payload}", "base64").toString("utf8"));

      const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, "utf8"))
        : {};

      config.plugins = config.plugins || {};
      config.plugins.entries = config.plugins.entries || {};

      const current = config.plugins.entries[payload.pluginId] || {};

      // 只写入 plugins.entries 允许的字段：enabled 和 config
      // 注意：sourceType 和 installSpec 不能写入 plugins.entries，会导致 OpenClaw 校验失败
      if (payload.enabled !== undefined) {
        current.enabled = payload.enabled;
      }
      if (payload.config !== undefined) {
        current.config = payload.config;
      }

      config.plugins.entries[payload.pluginId] = current;

      // 同步维护 plugins.allow 列表
      config.plugins.allow = config.plugins.allow || [];
      const isEnabled = current.enabled !== false;
      const idx = config.plugins.allow.indexOf(payload.pluginId);
      if (isEnabled && idx === -1) {
        config.plugins.allow.push(payload.pluginId);
      } else if (!isEnabled && idx !== -1) {
        config.plugins.allow.splice(idx, 1);
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

      console.log(JSON.stringify({
        id: payload.pluginId,
        enabled: current.enabled !== false,
        sourceType: payload.sourceType ?? null,
        installSpec: payload.installSpec ?? null,
        hasConfig: !!(current.config && typeof current.config === "object"),
        config: current.config && typeof current.config === "object" ? current.config : null,
      }));
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      {
        timeout: 15000,
        throwOnError: true,
      },
    );

    const parsed = JSON.parse(
      result.stdout || '{}',
    ) as OpenClawRuntimePluginItem;
    return {
      id: String(parsed.id || params.pluginId),
      enabled: parsed.enabled !== false,
      sourceType:
        parsed.sourceType === 'npm' ||
        parsed.sourceType === 'path' ||
        parsed.sourceType === 'bundled'
          ? parsed.sourceType
          : null,
      installSpec:
        typeof parsed.installSpec === 'string' ? parsed.installSpec : null,
      hasConfig: parsed.hasConfig === true,
      config:
        parsed.config && typeof parsed.config === 'object'
          ? parsed.config
          : null,
    };
  }

  /**
   * 卸载/移除 Gateway 运行态插件（从 plugins.entries 中删除）
   */
  async uninstallRuntimePlugin(
    containerId: string,
    pluginId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');
    const payload = Buffer.from(JSON.stringify({ pluginId })).toString(
      'base64',
    );

    const nodeScript = `
      const fs = require("fs");
      const path = require("path");
      const configPath = ${JSON.stringify(configPath)};
      const openclawHome = ${JSON.stringify(openclawHome)};
      const payload = JSON.parse(Buffer.from("${payload}", "base64").toString("utf8"));

      if (!fs.existsSync(configPath)) {
        console.log(JSON.stringify({ success: true, message: "Config file not found" }));
        process.exit(0);
      }

      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.plugins = config.plugins || {};
      config.plugins.entries = config.plugins.entries || {};

      if (!config.plugins.entries[payload.pluginId]) {
        console.log(JSON.stringify({ success: true, message: "Plugin not found in entries" }));
        process.exit(0);
      }

      // 1. 从 plugins.entries 删除
      delete config.plugins.entries[payload.pluginId];

      // 2. 从 plugins.allow 列表移除
      if (config.plugins.allow && Array.isArray(config.plugins.allow)) {
        const idx = config.plugins.allow.indexOf(payload.pluginId);
        if (idx !== -1) {
          config.plugins.allow.splice(idx, 1);
        }
      }

      // 写入配置
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

      // 3. 删除 /app/plugins/{pluginId} 目录（用户安装的插件）
      const appPluginsDir = "/app/plugins/" + payload.pluginId;
      if (fs.existsSync(appPluginsDir)) {
        fs.rmSync(appPluginsDir, { recursive: true, force: true });
        console.log("Deleted: " + appPluginsDir);
      }

      // 4. 删除 {openclawHome}/extensions/{pluginId} 目录
      const extensionsDir = path.join(openclawHome, "extensions", payload.pluginId);
      if (fs.existsSync(extensionsDir)) {
        fs.rmSync(extensionsDir, { recursive: true, force: true });
        console.log("Deleted: " + extensionsDir);
      }

      console.log(JSON.stringify({ success: true, pluginId: payload.pluginId }));
    `;

    try {
      await this.dockerExec.executeNodeScript(containerId, nodeScript, {
        timeout: 15000,
        throwOnError: true,
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawClient] Failed to uninstall plugin', {
        containerId,
        pluginId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 读取插件 Tool Access（全局 tools + agents.list[].tools）
   */
  async getRuntimePluginToolAccess(
    containerId: string,
    pluginId: string,
  ): Promise<OpenClawRuntimePluginToolAccess> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');
    const payload = Buffer.from(JSON.stringify({ pluginId })).toString(
      'base64',
    );

    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      const payload = JSON.parse(Buffer.from("${payload}", "base64").toString("utf8"));

      const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, "utf8"))
        : {};

      const entries = config?.plugins?.entries || {};
      if (!entries[payload.pluginId]) {
        throw new Error("PLUGIN_NOT_FOUND:" + payload.pluginId);
      }

      const globalTools =
        config.tools && typeof config.tools === "object" ? config.tools : {};
      const agents = Array.isArray(config?.agents?.list) ? config.agents.list : [];

      const agentRules = agents
        .map((agent) => {
          if (!agent || typeof agent !== "object") {
            return null;
          }

          const id = typeof agent.id === "string" ? agent.id : null;
          if (!id) {
            return null;
          }

          const tools =
            agent.tools && typeof agent.tools === "object" ? agent.tools : null;

          return {
            agentId: id,
            allow: Array.isArray(tools?.allow)
              ? tools.allow.map(String)
              : undefined,
            deny: Array.isArray(tools?.deny)
              ? tools.deny.map(String)
              : undefined,
          };
        })
        .filter(Boolean);

      const output = {
        profile:
          typeof globalTools.profile === "string"
            ? globalTools.profile
            : undefined,
        allow: Array.isArray(globalTools.allow)
          ? globalTools.allow.map(String)
          : undefined,
        deny: Array.isArray(globalTools.deny)
          ? globalTools.deny.map(String)
          : undefined,
        agents: agentRules,
      };

      console.log(JSON.stringify(output));
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      {
        timeout: 15000,
        throwOnError: true,
      },
    );

    const parsed = JSON.parse(
      result.stdout || '{}',
    ) as OpenClawRuntimePluginToolAccess;
    return {
      profile:
        parsed.profile === 'minimal' ||
        parsed.profile === 'messaging' ||
        parsed.profile === 'coding' ||
        parsed.profile === 'full'
          ? parsed.profile
          : undefined,
      allow: Array.isArray(parsed.allow)
        ? parsed.allow.map((item) => String(item))
        : undefined,
      deny: Array.isArray(parsed.deny)
        ? parsed.deny.map((item) => String(item))
        : undefined,
      agents: Array.isArray(parsed.agents)
        ? parsed.agents
            .map((agent) => ({
              agentId: String(agent.agentId || ''),
              allow: Array.isArray(agent.allow)
                ? agent.allow.map((item) => String(item))
                : undefined,
              deny: Array.isArray(agent.deny)
                ? agent.deny.map((item) => String(item))
                : undefined,
            }))
            .filter((agent) => agent.agentId)
        : [],
    };
  }

  /**
   * 更新插件 Tool Access（全局 tools + agents.list[].tools）
   */
  async updateRuntimePluginToolAccess(
    containerId: string,
    params: {
      pluginId: string;
      profile?: OpenClawToolsProfile;
      allow?: string[];
      deny?: string[];
      agents?: OpenClawRuntimePluginToolAccessAgentRule[];
    },
  ): Promise<OpenClawRuntimePluginToolAccess> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');
    const payload = Buffer.from(JSON.stringify(params)).toString('base64');

    const nodeScript = `
      const fs = require("fs");
      const configPath = ${JSON.stringify(configPath)};
      const payload = JSON.parse(Buffer.from("${payload}", "base64").toString("utf8"));

      const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, "utf8"))
        : {};

      config.plugins = config.plugins || {};
      config.plugins.entries = config.plugins.entries || {};
      if (!config.plugins.entries[payload.pluginId]) {
        throw new Error("PLUGIN_NOT_FOUND:" + payload.pluginId);
      }

      config.tools = config.tools && typeof config.tools === "object" ? config.tools : {};

      if (payload.profile !== undefined) {
        config.tools.profile = payload.profile;
      }
      if (payload.allow !== undefined) {
        config.tools.allow = payload.allow;
      }
      if (payload.deny !== undefined) {
        config.tools.deny = payload.deny;
      }

      const agents = Array.isArray(config?.agents?.list) ? config.agents.list : [];

      if (Array.isArray(payload.agents)) {
        const ruleMap = new Map();
        payload.agents.forEach((rule) => {
          if (rule && typeof rule.agentId === "string" && rule.agentId) {
            ruleMap.set(rule.agentId, rule);
          }
        });

        for (const agent of agents) {
          if (!agent || typeof agent !== "object") {
            continue;
          }

          const agentId = typeof agent.id === "string" ? agent.id : null;
          if (!agentId || !ruleMap.has(agentId)) {
            continue;
          }

          const rule = ruleMap.get(agentId);
          agent.tools = agent.tools && typeof agent.tools === "object" ? agent.tools : {};

          if (rule.allow !== undefined) {
            agent.tools.allow = rule.allow;
          }
          if (rule.deny !== undefined) {
            agent.tools.deny = rule.deny;
          }
        }
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

      const outputAgents = agents
        .map((agent) => {
          if (!agent || typeof agent !== "object") {
            return null;
          }

          const id = typeof agent.id === "string" ? agent.id : null;
          if (!id) {
            return null;
          }

          const tools =
            agent.tools && typeof agent.tools === "object" ? agent.tools : null;

          return {
            agentId: id,
            allow: Array.isArray(tools?.allow)
              ? tools.allow.map(String)
              : undefined,
            deny: Array.isArray(tools?.deny)
              ? tools.deny.map(String)
              : undefined,
          };
        })
        .filter(Boolean);

      console.log(JSON.stringify({
        profile:
          typeof config.tools.profile === "string"
            ? config.tools.profile
            : undefined,
        allow: Array.isArray(config.tools.allow)
          ? config.tools.allow.map(String)
          : undefined,
        deny: Array.isArray(config.tools.deny)
          ? config.tools.deny.map(String)
          : undefined,
        agents: outputAgents,
      }));
    `;

    const result = await this.dockerExec.executeNodeScript(
      containerId,
      nodeScript,
      {
        timeout: 15000,
        throwOnError: true,
      },
    );

    const parsed = JSON.parse(
      result.stdout || '{}',
    ) as OpenClawRuntimePluginToolAccess;

    return {
      profile:
        parsed.profile === 'minimal' ||
        parsed.profile === 'messaging' ||
        parsed.profile === 'coding' ||
        parsed.profile === 'full'
          ? parsed.profile
          : undefined,
      allow: Array.isArray(parsed.allow)
        ? parsed.allow.map((item) => String(item))
        : undefined,
      deny: Array.isArray(parsed.deny)
        ? parsed.deny.map((item) => String(item))
        : undefined,
      agents: Array.isArray(parsed.agents)
        ? parsed.agents
            .map((agent) => ({
              agentId: String(agent.agentId || ''),
              allow: Array.isArray(agent.allow)
                ? agent.allow.map((item) => String(item))
                : undefined,
              deny: Array.isArray(agent.deny)
                ? agent.deny.map((item) => String(item))
                : undefined,
            }))
            .filter((agent) => agent.agentId)
        : [],
    };
  }

  /**
   * 运行态插件诊断（基于配置静态检查）
   */
  async doctorRuntimePlugin(
    containerId: string,
    pluginId: string,
  ): Promise<{
    pluginId: string;
    healthy: boolean;
    checks: Array<{
      code: string;
      level: 'info' | 'warn' | 'error';
      message: string;
    }>;
  }> {
    const plugins = await this.listRuntimePlugins(containerId);
    const plugin = plugins.find((item) => item.id === pluginId);

    if (!plugin) {
      return {
        pluginId,
        healthy: false,
        checks: [
          {
            code: 'PLUGIN_NOT_FOUND',
            level: 'error',
            message: `Plugin ${pluginId} not found in plugins.entries`,
          },
        ],
      };
    }

    const checks: Array<{
      code: string;
      level: 'info' | 'warn' | 'error';
      message: string;
    }> = [
      {
        code: 'PLUGIN_PRESENT',
        level: 'info',
        message: `Plugin ${pluginId} is present in plugins.entries`,
      },
    ];

    if (!plugin.enabled) {
      checks.push({
        code: 'PLUGIN_DISABLED',
        level: 'warn',
        message: `Plugin ${pluginId} is disabled`,
      });
    }

    if (!plugin.hasConfig) {
      checks.push({
        code: 'PLUGIN_CONFIG_EMPTY',
        level: 'warn',
        message: `Plugin ${pluginId} has no config object`,
      });
    }

    const healthy = !checks.some((check) => check.level === 'error');

    return {
      pluginId,
      healthy,
      checks,
    };
  }

  // ============================================================================
  // 运行中进程通知接口（best-effort，不作为主生效路径）
  // ============================================================================

  /**
   * 通知 OpenClaw 重新扫描 Skills 目录（best-effort）
   *
   * 说明：
   * - 当前实现主要用于记录通知动作
   * - OpenClaw 是否已通过文件系统 watch 自动感知变更，取决于运行时行为
   * - 调用方不应将此方法视为唯一或强保证的生效机制
   *
   * @param containerId Docker 容器 ID
   */
  async reloadSkills(containerId: string): Promise<void> {
    this.logger.info('OpenClawClient: notifying Skills rescan', {
      containerId,
    });

    // 通过 kill -SIGUSR1 通知 OpenClaw 主进程重新扫描技能
    try {
      await this.dockerExec.executeCommand(
        containerId,
        ['sh', '-c', 'kill -USR1 1 2>/dev/null || true'],
        { throwOnError: false },
      );
      this.logger.info(
        'OpenClawClient: SIGUSR1 sent to PID 1 for skill rescan',
        {
          containerId,
        },
      );
    } catch (error) {
      this.logger.warn(
        'OpenClawClient: Failed to send SIGUSR1, skills may need container restart',
        {
          containerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
    }
  }

  /**
   * 通知 OpenClaw 重新扫描 MCP Servers 配置（best-effort）
   *
   * @param containerId Docker 容器 ID
   */
  async reloadMcpServers(containerId: string): Promise<void> {
    this.logger.info('OpenClawClient: notifying MCP server rescan', {
      containerId,
    });

    // 当前实现仅记录通知动作；实际生效仍取决于 OpenClaw 运行时能力
    this.logger.info(
      'OpenClawClient: MCP server rescan notification recorded',
      {
        containerId,
        hint: 'Runtime may still rely on config watch or restart paths to apply changes',
      },
    );
  }

  /**
   * 检查 Skill 是否存在于容器内
   * @param containerId Docker 容器 ID
   * @param skillName 技能名称
   */
  async checkSkillExists(
    containerId: string,
    skillName: string,
  ): Promise<boolean> {
    // 安全校验
    if (!this.dockerExec.isValidName(skillName)) {
      return false;
    }

    const openclawHome = await this.resolveOpenClawHome(containerId);
    const skillPath = buildOpenClawPath(openclawHome, 'skills', skillName);
    const result = await this.dockerExec.executeCommand(containerId, [
      'test',
      '-d',
      skillPath,
    ]);

    return result.success;
  }

  /**
   * 批量列出容器内已安装的 Skill 目录名
   * 使用单次 exec 调用代替逐个 checkSkillExists，减少 Docker API 调用次数
   * @param containerId Docker 容器 ID
   * @returns 容器内 OPENCLAW_HOME/skills/ 下所有目录名的 Set
   */
  async listInstalledSkillDirs(containerId: string): Promise<Set<string>> {
    const openclawHome = await this.resolveOpenClawHome(containerId);
    const skillsDir = buildOpenClawPath(openclawHome, 'skills');
    const output = await this.execInContainer(containerId, [
      'sh',
      '-c',
      `ls -1 ${JSON.stringify(skillsDir)} 2>/dev/null`,
    ]);
    if (!output) return new Set();
    const dirs = output
      .trim()
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    return new Set(dirs);
  }

  /**
   * 列出容器内特定 Bot 的技能目录名
   * 兼容两种挂载模式（以 Gateway 为核心）：
   * - 本地开发模式: /app/workspace/skills/
   * - 容器化模式:   /data/bots/gateway-{gatewayId[:8]}/{hostname}/skills/
   * @param containerId Docker 容器 ID
   * @param isolationKey Bot 的 isolationKey（格式：gateway-{gatewayId[:8]}）
   * @param hostname Bot 的 hostname（保留参数，用于日志追踪）
   * @returns 容器内技能目录下所有目录名的 Set
   */
  async listBotSkillDirs(
    containerId: string,
    isolationKey: string,
    hostname: string,
  ): Promise<Set<string>> {
    // 安全校验：确保 isolationKey 和 hostname 是合法的路径组件
    if (
      !this.dockerExec.isValidName(isolationKey) ||
      !this.dockerExec.isValidName(hostname)
    ) {
      this.logger.warn('OpenClawClient: 无效的 isolationKey 或 hostname', {
        containerId,
        isolationKey,
        hostname,
      });
      return new Set();
    }

    // 优先使用本地开发模式路径（/app/workspace），fallback 到容器化模式路径（/data/bots）
    // 路径规范：以 Gateway 为核心，hostname 区分不同 Bot
    // /data/bots/gateway-{gatewayId[:8]}/{hostname}/skills/
    const primaryDir = `/app/workspace/${hostname}/skills`;
    const fallbackDir = `/data/bots/${isolationKey}/${hostname}/skills`;

    const output = await this.execInContainer(containerId, [
      'sh',
      '-c',
      `ls -1 ${JSON.stringify(primaryDir)} 2>/dev/null || ls -1 ${JSON.stringify(fallbackDir)} 2>/dev/null`,
    ]);
    if (!output) return new Set();
    const dirs = output
      .trim()
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    return new Set(dirs);
  }

  /**
   * 获取容器内特定 Bot 技能的 SKILL.md 内容
   * 兼容两种挂载模式（以 Gateway 为核心，hostname 区分不同 Bot）:
   * - 本地开发模式: /app/workspace/{hostname}/skills/{skillSlug}/SKILL.md
   * - 容器化模式:   /data/bots/gateway-{gatewayId[:8]}/{hostname}/skills/{skillSlug}/SKILL.md
   * @param containerId Docker 容器 ID
   * @param isolationKey Bot 的 isolationKey
   * @param hostname Bot 的 hostname
   * @param skillSlug 技能的 slug
   * @returns 技能内容或 null
   */
  async getBotSkillContent(
    containerId: string,
    isolationKey: string,
    hostname: string,
    skillSlug: string,
  ): Promise<string | null> {
    // 安全校验
    if (
      !this.dockerExec.isValidName(isolationKey) ||
      !this.dockerExec.isValidName(hostname) ||
      !this.dockerExec.isValidName(skillSlug)
    ) {
      return null;
    }

    // 优先使用本地开发模式路径，fallback 到容器化模式路径
    // 路径规范：以 Gateway 为核心，hostname 区分不同 Bot
    // /data/bots/gateway-{gatewayId[:8]}/{hostname}/skills/{skillSlug}/SKILL.md
    const primaryPath = `/app/workspace/${hostname}/skills/${skillSlug}/SKILL.md`;
    const fallbackPath = `/data/bots/${isolationKey}/${hostname}/skills/${skillSlug}/SKILL.md`;
    const output = await this.execInContainer(containerId, [
      'sh',
      '-c',
      `cat ${JSON.stringify(primaryPath)} 2>/dev/null || cat ${JSON.stringify(fallbackPath)} 2>/dev/null`,
    ]);
    return output || null;
  }

  /**
   * 批量获取容器内特定 Bot 所有技能的 SKILL.md 内容
   * @param containerId Docker 容器 ID
   * @param isolationKey Bot 的 isolationKey
   * @param hostname Bot 的 hostname
   * @param skillSlugs 技能 slug 列表
   * @returns Map<skillSlug, content>
   */
  async getBotSkillsContent(
    containerId: string,
    isolationKey: string,
    hostname: string,
    skillSlugs: string[],
  ): Promise<Map<string, string>> {
    const contentMap = new Map<string, string>();

    // 安全校验
    if (
      !this.dockerExec.isValidName(isolationKey) ||
      !this.dockerExec.isValidName(hostname)
    ) {
      return contentMap;
    }

    const safeSlugs = skillSlugs.filter((s) => this.dockerExec.isValidName(s));
    if (safeSlugs.length === 0) return contentMap;

    // 兼容两种挂载模式（以 Gateway 为核心，hostname 区分不同 Bot）:
    // - 本地开发模式: /app/workspace/{hostname}/skills/
    // - 容器化模式:   /data/bots/gateway-{gatewayId[:8]}/{hostname}/skills/
    const primarySkillsDir = `/app/workspace/${hostname}/skills`;
    const fallbackSkillsDir = `/data/bots/${isolationKey}/${hostname}/skills`;

    // 批量读取所有技能的 SKILL.md，优先读取本地开发模式路径，fallback 到容器化模式路径
    const output = await this.execInContainer(containerId, [
      'sh',
      '-c',
      `for slug in ${safeSlugs.map((s) => JSON.stringify(s)).join(' ')}; do echo "===START:$slug==="; cat ${primarySkillsDir}/$slug/SKILL.md 2>/dev/null || cat ${fallbackSkillsDir}/$slug/SKILL.md 2>/dev/null; echo "===END:$slug==="; done`,
    ]);

    if (!output) return contentMap;

    // 解析输出，提取每个技能的内容
    const startMarker = '===START:';
    const endMarker = '===END:';
    const lines = output.split('\n');
    let currentSlug = '';
    let currentContent: string[] = [];
    let inContent = false;

    for (const line of lines) {
      if (line.startsWith(startMarker)) {
        currentSlug = line.slice(startMarker.length).replace(/===$/, '');
        inContent = true;
        currentContent = [];
      } else if (line.startsWith(endMarker)) {
        inContent = false;
        if (currentSlug) {
          contentMap.set(currentSlug, currentContent.join('\n'));
        }
        currentSlug = '';
      } else if (inContent) {
        currentContent.push(line);
      }
    }

    return contentMap;
  }

  /**
   * 批量读取容器内每个技能的 SKILL.md 内容
   * 使用单次 exec 调用读取所有技能的 MD 文件，减少 Docker API 调用次数
   */
  private async enrichSkillsWithContent(
    containerId: string,
    skills: ContainerSkillItem[],
  ): Promise<void> {
    if (skills.length === 0) return;

    // 安全校验：只允许合法字符的技能名参与 shell 命令（防止注入）
    const safeSkills = skills.filter((s) =>
      this.dockerExec.isValidName(s.name),
    );

    if (safeSkills.length === 0) return;

    const openclawHome = await this.resolveOpenClawHome(containerId);
    const openclawSkillsDir = buildOpenClawPath(openclawHome, 'skills');

    // 构建 shell 命令：遍历已知技能名，尝试多个路径读取 SKILL.md
    const script = safeSkills
      .map(
        (s) =>
          `echo "===SKILL:${s.name}==="; cat ${JSON.stringify(buildOpenClawPath(openclawSkillsDir, s.name, 'SKILL.md'))} 2>/dev/null || cat ${JSON.stringify(`/app/skills/${s.name}/SKILL.md`)} 2>/dev/null || echo ""`,
      )
      .join('; ');

    const output = await this.execInContainer(containerId, [
      'sh',
      '-c',
      script,
    ]);

    if (!output) return;

    // 解析输出，按 ===SKILL:name=== 分隔符拆分
    const sections = output.split(/===SKILL:([^=]+)===/);
    // sections: ['', name1, content1, name2, content2, ...]
    for (let i = 1; i < sections.length; i += 2) {
      const name = sections[i].trim();
      const content = sections[i + 1]?.trim() || null;
      const skill = skills.find((s) => s.name === name);
      if (skill && content) {
        skill.content = content;
      }
    }
  }

  // ============================================================================
  // Cron Job Management
  // ============================================================================

  /**
   * 删除 Gateway 中的 Cron Job
   *
   * @param gatewayPort - Gateway 端口
   * @param jobId - Cron Job ID
   * @returns Promise<void>
   */
  async deleteCronJob(gatewayPort: number, jobId: string): Promise<void> {
    const gatewayHost = getEnvWithDefault('GATEWAY_HOST', '127.0.0.1');
    const url = `http://${gatewayHost}:${gatewayPort}/cron/${jobId}`;

    this.logger.info(
      `[OpenClawClient] Deleting cron job: ${jobId} from gateway port ${gatewayPort}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.delete(url).pipe(
          timeout(10000),
          catchError((error) => {
            this.logger.error(
              `[OpenClawClient] Failed to delete cron job ${jobId}:`,
              error.response?.data || error.message,
            );
            throw error;
          }),
        ),
      );

      this.logger.info(
        `[OpenClawClient] Successfully deleted cron job: ${jobId}`,
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(
          `[OpenClawClient] Cron job ${jobId} not found (already deleted)`,
        );
        return; // 任务不存在，视为删除成功
      }
      throw error;
    }
  }

  /**
   * 批量删除 Gateway 中的 Cron Jobs
   *
   * @param gatewayPort - Gateway 端口
   * @param jobIds - Cron Job ID 数组
   * @returns Promise<{ success: number; failed: number }>
   */
  async deleteCronJobs(
    gatewayPort: number,
    jobIds: string[],
  ): Promise<{ success: number; failed: number }> {
    this.logger.info(
      `[OpenClawClient] Batch deleting ${jobIds.length} cron jobs from gateway port ${gatewayPort}`,
    );

    let success = 0;
    let failed = 0;

    for (const jobId of jobIds) {
      try {
        await this.deleteCronJob(gatewayPort, jobId);
        success++;
      } catch (error) {
        this.logger.error(
          `[OpenClawClient] Failed to delete cron job ${jobId}:`,
          error instanceof Error ? error.message : String(error),
        );
        failed++;
      }
    }

    this.logger.info(
      `[OpenClawClient] Batch delete completed: ${success} succeeded, ${failed} failed`,
    );

    return { success, failed };
  }

  // ============================================================================
  // Agent Reload & Verification
  // ============================================================================

  /**
   * 通知 OpenClaw 重新扫描 Agents 配置（best-effort）
   *
   * 说明：
   * - OpenClaw 已有 chokidar 文件监听，通常会自动感知变更
   * - 此方法通过 touch 配置文件触发 chokidar 的 change 事件
   * - 调用方不应将此方法视为唯一或强保证的生效机制
   *
   * @param containerId Docker 容器 ID
   * @param agentKey 可选：指定的 agent key，仅用于日志
   */
  async reloadAgents(containerId: string, agentKey?: string): Promise<void> {
    this.logger.info('OpenClawClient: notifying Agents rescan', {
      containerId,
      agentKey,
    });

    // 通过 "touch" 配置文件，触发 chokidar 的 change 事件
    // 这是最安全的方式，利用 OpenClaw 已有的文件监听机制
    try {
      const openclawHome = await this.resolveOpenClawHome(containerId);
      const configPath = buildOpenClawPath(openclawHome, 'openclaw.json');

      await this.dockerExec.executeCommand(containerId, ['touch', configPath]);

      this.logger.info(
        'OpenClawClient: Agents rescan notification sent (touch config)',
        {
          containerId,
          configPath,
          hint: 'Gateway should detect config change via chokidar watch',
        },
      );
    } catch (error) {
      this.logger.warn(
        'OpenClawClient: Failed to touch config for agents rescan',
        {
          containerId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // 不抛出异常，这是 best-effort 通知
    }
  }

  /**
   * 验证 Agent 是否在 Gateway 中可见
   *
   * @param containerId Docker 容器 ID
   * @param agentKey Agent key
   * @returns Agent 是否可见
   */
  async verifyAgentVisible(
    containerId: string,
    agentKey: string,
  ): Promise<boolean> {
    try {
      // 使用 openclaw agents list 命令检查
      const result = await this.dockerExec.executeCommand(containerId, [
        'openclaw',
        'agents',
        'list',
        '--json',
      ]);

      if (!result.success) {
        this.logger.warn(
          'OpenClawClient: Failed to list agents for verification',
          {
            containerId,
            agentKey,
            stderr: result.stderr,
          },
        );
        return false;
      }

      try {
        const agents = JSON.parse(result.stdout);
        const found =
          Array.isArray(agents) &&
          agents.some((a: any) => a.id === agentKey || a.name === agentKey);

        this.logger.info('OpenClawClient: Agent visibility verification', {
          containerId,
          agentKey,
          visible: found,
        });

        return found;
      } catch {
        // 如果 JSON 解析失败，尝试简单的字符串匹配
        const found = result.stdout.includes(agentKey);
        this.logger.info(
          'OpenClawClient: Agent visibility verification (string match)',
          {
            containerId,
            agentKey,
            visible: found,
          },
        );
        return found;
      }
    } catch (error) {
      this.logger.warn('OpenClawClient: Failed to verify agent visibility', {
        containerId,
        agentKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
