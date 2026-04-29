/**
 * AI 模型定价参考数据
 * 价格单位：美元/百万 tokens (LLM) 或 美元/次 (图像/视频)
 * 数据来源：各 AI 服务商官方定价页面
 * 最后更新：2026-03-24
 *
 * ⚠️ 注意：此文件仅作为参考数据，用于：
 * 1. 新环境初始化时同步定价
 * 2. 通过 API 端点更新模型定价
 *
 * 数据结构说明：
 * - inputPrice/outputPrice: 对外销售价（客户支付价格）
 * - 成本价从 ModelAvailability 表获取
 *
 * 真实数据应以数据库 ModelCatalog 表为准。
 * 要迁移数据到新环境，请运行：
 *   npx ts-node scripts/export-model-catalog.ts
 */

export interface ModelCatalogReferenceData {
  model: string;
  alias?: string;
  vendor: string;
  /** 对外销售价-输入 (美元/百万 tokens) */
  inputPrice: number;
  /** 对外销售价-输出 (美元/百万 tokens) */
  outputPrice: number;
  displayName?: string;
  description?: string;
  notes?: string;
  cacheReadPrice?: number;
  cacheWritePrice?: number;
  thinkingPrice?: number;
  reasoningScore?: number;
  codingScore?: number;
  creativityScore?: number;
  speedScore?: number;
  contextLength?: number;
  supportsExtendedThinking?: boolean;
  supportsCacheControl?: boolean;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
  supportsStreaming?: boolean;
  modelType?: 'llm' | 'vlm' | 'image' | 'video' | 'audio' | 'embedding' | '3d';
  recommendedScenarios?: string[];
}

/**
 * 模型定价参考数据
 * 用于新环境初始化和定价同步
 *
 * 重要：数据已迁移到数据库 ModelCatalog 表
 * 此文件保留作为初始定价参考
 */
export const MODEL_CATALOG_DATA: ModelCatalogReferenceData[] = [
  // ============================================================================
  // OpenAI Models - GPT-4o Series
  // ============================================================================
  {
    model: 'gpt-4o',
    alias: 'gpt-4o',
    vendor: 'openai',
    inputPrice: 2.5,
    outputPrice: 10,
    displayName: 'GPT-4o',
    reasoningScore: 90,
    codingScore: 92,
    creativityScore: 88,
    speedScore: 85,
    contextLength: 128,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['general-purpose', 'multimodal', 'coding'],
  },
  {
    model: 'gpt-4o-mini',
    alias: 'gpt-4o-mini',
    vendor: 'openai',
    inputPrice: 0.15,
    outputPrice: 0.6,
    displayName: 'GPT-4o Mini',
    reasoningScore: 75,
    codingScore: 78,
    creativityScore: 72,
    speedScore: 95,
    contextLength: 128,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['fast-response', 'cost-optimized'],
  },
  {
    model: 'gpt-4.1',
    alias: 'gpt-4.1',
    vendor: 'openai',
    inputPrice: 2,
    outputPrice: 8,
    displayName: 'GPT-4.1',
    reasoningScore: 92,
    codingScore: 94,
    creativityScore: 90,
    speedScore: 88,
    contextLength: 128,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['general-purpose', 'coding'],
  },
  {
    model: 'gpt-4.1-mini',
    alias: 'gpt-4.1-mini',
    vendor: 'openai',
    inputPrice: 0.4,
    outputPrice: 1.6,
    displayName: 'GPT-4.1 Mini',
    reasoningScore: 80,
    codingScore: 82,
    speedScore: 92,
    contextLength: 128,
    supportsFunctionCalling: true,
    supportsStreaming: true,
  },
  {
    model: 'gpt-4.1-nano',
    alias: 'gpt-4.1-nano',
    vendor: 'openai',
    inputPrice: 0.1,
    outputPrice: 0.4,
    displayName: 'GPT-4.1 Nano',
    speedScore: 98,
    contextLength: 32,
    supportsFunctionCalling: true,
    supportsStreaming: true,
  },
  {
    model: 'gpt-5',
    alias: 'gpt-5',
    vendor: 'openai',
    inputPrice: 5,
    outputPrice: 20,
    displayName: 'GPT-5',
    reasoningScore: 96,
    codingScore: 97,
    creativityScore: 94,
    speedScore: 80,
    contextLength: 256,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['deep-reasoning', 'complex-tasks'],
  },
  {
    model: 'gpt-5-mini',
    alias: 'gpt-5-mini',
    vendor: 'openai',
    inputPrice: 1,
    outputPrice: 4,
    displayName: 'GPT-5 Mini',
    reasoningScore: 88,
    codingScore: 90,
    speedScore: 90,
    contextLength: 128,
    supportsFunctionCalling: true,
    supportsStreaming: true,
  },
  {
    model: 'gpt-5-nano',
    alias: 'gpt-5-nano',
    vendor: 'openai',
    inputPrice: 0.25,
    outputPrice: 1,
    displayName: 'GPT-5 Nano',
    speedScore: 96,
    contextLength: 32,
    supportsFunctionCalling: true,
    supportsStreaming: true,
  },
  {
    model: 'gpt-5-pro',
    alias: 'gpt-5-pro',
    vendor: 'openai',
    inputPrice: 10,
    outputPrice: 40,
    displayName: 'GPT-5 Pro',
    reasoningScore: 98,
    codingScore: 98,
    creativityScore: 96,
    contextLength: 256,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
  },
  {
    model: 'gpt-5-codex',
    alias: 'gpt-5-codex',
    vendor: 'openai',
    inputPrice: 6,
    outputPrice: 24,
    displayName: 'GPT-5 Codex',
    codingScore: 99,
    recommendedScenarios: ['coding', 'code-generation'],
  },
  {
    model: 'gpt-5.2',
    alias: 'gpt-5.2',
    vendor: 'openai',
    inputPrice: 8,
    outputPrice: 32,
    displayName: 'GPT-5.2',
    reasoningScore: 98,
    codingScore: 99,
    creativityScore: 96,
    speedScore: 85,
    contextLength: 512,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
  },
  {
    model: 'gpt-5.2-pro',
    alias: 'gpt-5.2-pro',
    vendor: 'openai',
    inputPrice: 15,
    outputPrice: 60,
    displayName: 'GPT-5.2 Pro',
    reasoningScore: 99,
    codingScore: 100,
  },
  {
    model: 'o3',
    alias: 'o3',
    vendor: 'openai',
    inputPrice: 10,
    outputPrice: 40,
    displayName: 'o3',
    reasoningScore: 99,
    codingScore: 97,
    speedScore: 60,
    contextLength: 200,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['deep-reasoning', 'math', 'science'],
  },
  {
    model: 'o4-mini',
    alias: 'o4-mini',
    vendor: 'openai',
    inputPrice: 1.5,
    outputPrice: 6,
    displayName: 'o4 Mini',
    reasoningScore: 92,
    codingScore: 93,
    speedScore: 85,
    contextLength: 200,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['reasoning', 'cost-optimized'],
  },

  // ============================================================================
  // Anthropic Models - Claude Series
  // ============================================================================
  {
    model: 'claude-opus-4-5-20251101',
    alias: 'claude-opus-4.5',
    vendor: 'anthropic',
    inputPrice: 15,
    outputPrice: 75,
    cacheReadPrice: 1.5,
    cacheWritePrice: 18.75,
    thinkingPrice: 15,
    displayName: 'Claude Opus 4.5',
    reasoningScore: 100,
    codingScore: 99,
    creativityScore: 97,
    speedScore: 55,
    contextLength: 200,
    supportsExtendedThinking: true,
    supportsCacheControl: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['deep-reasoning', 'complex-analysis', 'research'],
  },
  {
    model: 'claude-opus-4-6',
    alias: 'claude-opus-4.6',
    vendor: 'anthropic',
    inputPrice: 18,
    outputPrice: 90,
    cacheReadPrice: 1.8,
    cacheWritePrice: 22.5,
    thinkingPrice: 18,
    displayName: 'Claude Opus 4.6',
    reasoningScore: 100,
    codingScore: 100,
    creativityScore: 98,
    speedScore: 50,
    contextLength: 200,
    supportsExtendedThinking: true,
    supportsCacheControl: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
  },
  {
    model: 'claude-sonnet-4-5-20250929',
    alias: 'claude-sonnet-4.5',
    vendor: 'anthropic',
    inputPrice: 3,
    outputPrice: 15,
    cacheReadPrice: 0.3,
    cacheWritePrice: 3.75,
    thinkingPrice: 3,
    displayName: 'Claude Sonnet 4.5',
    reasoningScore: 94,
    codingScore: 96,
    creativityScore: 92,
    speedScore: 78,
    contextLength: 200,
    supportsExtendedThinking: true,
    supportsCacheControl: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['coding', 'general-purpose'],
  },
  {
    model: 'claude-haiku-4-5',
    alias: 'claude-haiku-4.5',
    vendor: 'anthropic',
    inputPrice: 0.8,
    outputPrice: 4,
    displayName: 'Claude Haiku 4.5',
    reasoningScore: 75,
    codingScore: 78,
    speedScore: 95,
    contextLength: 200,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['fast-response', 'cost-optimized'],
  },

  // ============================================================================
  // DeepSeek Models
  // ============================================================================
  {
    model: 'deepseek-v3-2-251201',
    alias: 'deepseek-v3.2',
    vendor: 'deepseek',
    inputPrice: 0.27,
    outputPrice: 1.1,
    displayName: 'DeepSeek V3.2',
    reasoningScore: 90,
    codingScore: 92,
    speedScore: 80,
    contextLength: 64,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['cost-optimized', 'chinese-optimized'],
  },
  {
    model: 'deepseek-r1',
    alias: 'deepseek-r1',
    vendor: 'deepseek',
    inputPrice: 0.55,
    outputPrice: 2.19,
    displayName: 'DeepSeek R1',
    reasoningScore: 95,
    codingScore: 90,
    speedScore: 60,
    recommendedScenarios: ['deep-reasoning', 'cost-optimized'],
  },

  // ============================================================================
  // Gemini Models (Google)
  // ============================================================================
  {
    model: 'gemini-2.5-pro',
    alias: 'gemini-2.5-pro',
    vendor: 'google',
    inputPrice: 1.25,
    outputPrice: 10,
    displayName: 'Gemini 2.5 Pro',
    reasoningScore: 92,
    codingScore: 90,
    creativityScore: 88,
    speedScore: 75,
    contextLength: 1000,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['long-context', 'multimodal'],
  },
  {
    model: 'gemini-2.5-flash',
    alias: 'gemini-2.5-flash',
    vendor: 'google',
    inputPrice: 0.075,
    outputPrice: 0.3,
    displayName: 'Gemini 2.5 Flash',
    reasoningScore: 80,
    codingScore: 82,
    speedScore: 95,
    contextLength: 1000,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['fast-response', 'cost-optimized'],
  },

  // ============================================================================
  // Kimi Models (Moonshot)
  // ============================================================================
  {
    model: 'kimi-k2-250905',
    alias: 'kimi-k2',
    vendor: 'moonshot',
    inputPrice: 4,
    outputPrice: 8,
    displayName: 'Kimi K2',
    reasoningScore: 88,
    codingScore: 85,
    speedScore: 75,
    contextLength: 128,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['chinese-optimized', 'long-context'],
  },

  // ============================================================================
  // GLM Models (Zhipu AI)
  // ============================================================================
  {
    model: 'glm-4.7',
    alias: 'glm-4.7',
    vendor: 'zhipu',
    inputPrice: 4,
    outputPrice: 16,
    displayName: 'GLM-4.7',
    reasoningScore: 85,
    codingScore: 82,
    speedScore: 80,
    contextLength: 128,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['chinese-optimized'],
  },
  {
    model: 'glm-5',
    alias: 'glm-5',
    vendor: 'zhipu',
    inputPrice: 6,
    outputPrice: 22,
    displayName: 'GLM-5',
    reasoningScore: 92,
    codingScore: 90,
    creativityScore: 88,
    speedScore: 75,
    contextLength: 128,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['chinese-optimized', 'coding'],
  },

  // ============================================================================
  // Doubao Seed Models (ByteDance)
  // ============================================================================
  {
    model: 'doubao-seed-2-0-pro-260215',
    alias: 'seed-2.0-pro',
    vendor: 'doubao',
    inputPrice: 9.6,
    outputPrice: 48,
    displayName: 'Seed 2.0 Pro',
    reasoningScore: 90,
    codingScore: 88,
    speedScore: 70,
    contextLength: 128,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['chinese-optimized', 'cost-optimized'],
  },
  {
    model: 'doubao-seed-2-0-mini-260215',
    alias: 'seed-2.0-mini',
    vendor: 'doubao',
    inputPrice: 0.8,
    outputPrice: 8,
    displayName: 'Seed 2.0 Mini',
    reasoningScore: 75,
    codingScore: 72,
    speedScore: 90,
    contextLength: 128,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    recommendedScenarios: ['fast-response', 'cost-optimized'],
  },
];
