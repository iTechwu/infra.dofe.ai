/**
 * VikingDB Types
 * VikingDB 向量数据库相关类型定义
 */

// ============================================================================
// Volcengine VikingDB: Collection Schema Definition
// 火山云 VikingDB 集合字段定义（用于 schema 补齐和自检）
// ============================================================================

/** Volcengine 字段类型 */
export type VolcengineFieldType =
  | 'int64'
  | 'float32'
  | 'string'
  | 'bool'
  | 'list<string>'
  | 'list<int64>'
  | 'vector'
  | 'sparse_vector'
  | 'text';

/** Volcengine 字段定义（用于创建/校验集合 schema） */
export interface VolcengineFieldInfo {
  /** 字段名 */
  FieldName: string;
  /** 字段类型 */
  FieldType: VolcengineFieldType;
  /** 是否主键 */
  IsPrimary?: boolean;
  /** 默认值（scalar 字段） */
  DefaultValue?: unknown;
  /** 向量维度（仅 vector 字段） */
  Dim?: number;
  /** 文本处理 Pipeline（仅 text 字段） */
  PipelineName?: string;
}

/**
 * Volcengine 内存集合默认 schema 定义
 * 用于：
 * 1) 作为创建集合时的参考模板
 * 2) 连通性自检时与远程 schema 对比
 */
export const VOLCENGINE_MEMORY_COLLECTION_SCHEMA: VolcengineFieldInfo[] = [
  // 主键
  { FieldName: 'id', FieldType: 'string', IsPrimary: true },

  // 核心内容
  { FieldName: 'text', FieldType: 'text', PipelineName: 'default' },
  { FieldName: 'summary', FieldType: 'string' },
  { FieldName: 'embedding', FieldType: 'vector', Dim: 1536 },

  // 标签与分类
  { FieldName: 'tags', FieldType: 'list<string>' },
  { FieldName: 'taskType', FieldType: 'string' },

  // 扁平化 scope 字段（用于高性能过滤）
  { FieldName: 'tenantId', FieldType: 'string' },
  { FieldName: 'botId', FieldType: 'string' },
  { FieldName: 'scopeType', FieldType: 'string' },
  { FieldName: 'scopeId', FieldType: 'string' },

  // 元数据扩展字段
  { FieldName: 'sourceType', FieldType: 'string' },
  { FieldName: 'createdById', FieldType: 'string' },

  // 知识库关联的 bots 列表（用于过滤）
  { FieldName: 'bots', FieldType: 'list<string>' },

  // 时间戳
  { FieldName: 'createdAt', FieldType: 'string' },
  { FieldName: 'updatedAt', FieldType: 'string' },

  // 完整元数据 JSON（兜底）
  { FieldName: 'metadata', FieldType: 'string' },
];

/** VikingDB 配置 */
export interface VikingDbConfig {
  /** 客户端类型：默认 custom-http；使用火山云 VikingDB 时为 volcengine */
  provider?: 'custom-http' | 'volcengine';

  /** VikingDB 服务基础 URL（custom-http 模式使用） */
  baseUrl: string;
  /** 认证 Token（custom-http 模式使用） */
  authToken?: string;
  /** 数据库名称（custom-http 模式使用） */
  database: string;
  /** 集合名称（custom-http 模式使用） */
  collection: string;

  /** 火山云 AK（volcengine 模式使用） */
  ak?: string;
  /** 火山云 SK（volcengine 模式使用） */
  sk?: string;
  /** 火山云 region（volcengine 模式使用） */
  region?: string;
  /** 角色扮演临时凭证 sessionToken（volcengine 模式使用） */
  sessionToken?: string;

  /** 火山云 IndexName（volcengine 模式使用） */
  indexName?: string;
  /** 火山云 CollectionName（volcengine 模式使用） */
  collectionName?: string;
  /** 火山云 CollectionAlias（volcengine 模式使用） */
  collectionAlias?: string;

  /** 字段映射（volcengine 模式可选） */
  primaryKeyField?: string;
  textField?: string;
  vectorField?: string;
  summaryField?: string;
  metadataField?: string;
  tagsField?: string;
  taskTypeField?: string;
  tenantIdField?: string;
  botIdField?: string;
  scopeTypeField?: string;
  scopeIdField?: string;
  sourceTypeField?: string;
  createdByIdField?: string;
  createdAtField?: string;
  updatedAtField?: string;

  /** 请求超时时间（毫秒） */
  timeoutMs: number;

  /** 向量搜索路径（custom-http 模式使用） */
  vectorSearchPath: string;
  /** BM25 搜索路径（custom-http 模式使用） */
  bm25SearchPath: string;
  /** 文档更新路径（custom-http 模式使用） */
  upsertPath: string;
  /** 文档删除路径（custom-http 模式使用） */
  deletePath: string;
  /** 健康检查路径（custom-http 模式使用） */
  healthPath: string;

  /** 额外请求头（custom-http 模式使用） */
  headers: Record<string, string>;
}

/** 作用域映射 */
export type ScopeMap = Record<string, string>;

/** 记忆文档 */
export interface MemoryDocument {
  /** 文档 ID */
  id?: string;
  /** 文本内容 */
  text: string;
  /** 摘要 */
  summary?: string;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 时间戳 */
  timestamp?: string;
  /** 作用域 */
  scope?: ScopeMap;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 标签 */
  tags?: string[];
  /** 任务类型 */
  taskType?: string;
  /** 角色 */
  role?: string;
  /** 是否置顶 */
  pinned?: boolean;
  /** 向量嵌入 */
  embedding?: number[];
  /** 分块索引 */
  chunkIndex?: number;
  /** 内容哈希 */
  contentHash?: string;
}

/** 搜索候选结果 */
export interface RetrievedCandidate {
  /** 文档 ID */
  id: string;
  /** 文本内容 */
  text: string;
  /** 摘要 */
  summary?: string;
  /** 作用域 */
  scope: ScopeMap;
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 标签 */
  tags: string[];
  /** 任务类型 */
  taskType?: string;
  /** 角色 */
  role?: string;
  /** 是否置顶 */
  pinned: boolean;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 向量分数 */
  scoreVector: number;
  /** BM25 分数 */
  scoreBm25: number;
  /** 混合分数 */
  scoreHybrid: number;
  /** 重排分数 */
  scoreRerank?: number;
  /** 最终分数 */
  scoreFinal: number;
  /** 向量嵌入 */
  embedding?: number[];
}

/** 搜索模式 */
export type SearchMode = 'adaptive' | 'vector' | 'bm25' | 'hybrid';

/** 搜索选项 */
export interface SearchOptions {
  /** 搜索查询 */
  query: string;
  /** 作用域过滤 */
  scope?: ScopeMap;
  /** 任务类型 */
  taskType?: string;
  /** 返回数量 */
  topK?: number;
  /** 候选数量（用于重排） */
  candidateK?: number;
  /** 搜索模式 */
  mode?: SearchMode;
  /** 向量权重 */
  vectorWeight?: number;
  /** BM25 权重 */
  bm25Weight?: number;
  /** 最小分数 */
  minScore?: number;
  /** 是否启用重排 */
  enableRerank?: boolean;
  /** 是否启用 MMR */
  enableMMR?: boolean;
  /** 当前时间（用于时间衰减） */
  now?: string;
}

/** 搜索结果 */
export interface SearchResult {
  /** 搜索模式 */
  mode: SearchMode;
  /** 候选结果 */
  candidates: RetrievedCandidate[];
  /** 查询嵌入 */
  queryEmbedding?: number[];
}

/** Upsert 选项 */
export interface UpsertOptions {
  /** 文档列表 */
  documents: MemoryDocument[];
  /** 作用域 */
  scope?: ScopeMap;
  /** 任务类型 */
  taskType?: string;
}

/** 删除选项 */
export interface DeleteOptions {
  /** 文档 ID 列表 */
  ids?: string[];
  /** 单个文档 ID */
  id?: string;
  /** 作用域 */
  scope?: ScopeMap;
}

/** VikingDB 健康状态 */
export interface VikingDbHealthStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
}

/** Embedding 配置 */
export interface EmbeddingConfig {
  /** 嵌入服务基础 URL */
  baseUrl: string;
  /** API Key */
  apiKey?: string;
  /** 模型名称 */
  model: string;
  /** 向量维度 */
  dimensions?: number;
  /** 请求超时时间（毫秒） */
  timeoutMs: number;
  /** 查询前缀 */
  queryPrefix: string;
  /** 文档前缀 */
  documentPrefix: string;
}

/** Rerank 配置 */
export interface RerankConfig {
  /** Rerank 提供者 */
  provider: 'none' | 'jina' | 'custom';
  /** 基础 URL */
  baseUrl?: string;
  /** API Key */
  apiKey?: string;
  /** 模型名称 */
  model?: string;
  /** 请求超时时间（毫秒） */
  timeoutMs: number;
}

/** 完整的 Memory 配置 */
export interface MemoryServiceConfig {
  /** 是否启用 */
  enabled: boolean;
  /** VikingDB 配置 */
  vikingdb: VikingDbConfig;
  /** Embedding 配置 */
  embedding: EmbeddingConfig;
  /** Rerank 配置 */
  rerank: RerankConfig;
  /** 检索配置 */
  retrieval: {
    defaultMode: SearchMode;
    topK: number;
    candidateK: number;
    vectorWeight: number;
    bm25Weight: number;
    rrfK: number;
    rerankTopK: number;
    minScore: number;
    adaptiveShortQueryTokens: number;
    recencyBoost: number;
    timeDecayHours: number;
    mmrLambda: number;
    mmrEnabled: boolean;
  };
}

/** 默认配置 */
export const DEFAULT_MEMORY_CONFIG: MemoryServiceConfig = {
  enabled: true,
  vikingdb: {
    baseUrl: '',
    database: '',
    collection: '',
    timeoutMs: 20000,
    vectorSearchPath: '/vector/search',
    bm25SearchPath: '/bm25/search',
    upsertPath: '/documents/upsert',
    deletePath: '/documents/delete',
    healthPath: '/health',
    headers: {},
  },
  embedding: {
    baseUrl: '',
    model: 'text-embedding-3-small',
    timeoutMs: 20000,
    queryPrefix: 'query:',
    documentPrefix: 'passage:',
  },
  rerank: {
    provider: 'none',
    timeoutMs: 10000,
  },
  retrieval: {
    defaultMode: 'hybrid',
    topK: 10,
    candidateK: 50,
    vectorWeight: 0.7,
    bm25Weight: 0.3,
    rrfK: 60,
    rerankTopK: 20,
    minScore: 0.1,
    adaptiveShortQueryTokens: 3,
    recencyBoost: 0.1,
    timeDecayHours: 168,
    mmrLambda: 0.7,
    mmrEnabled: false,
  },
};

// ============================================================================
// Memory Scope Types
// ============================================================================

/** Memory 作用域类型 */
export enum MemoryScopeType {
  /** 租户全局 */
  GLOBAL = 'GLOBAL',
  /** 工作空间 */
  WORKSPACE = 'WORKSPACE',
  /** Bot 级别 */
  BOT = 'BOT',
  /** 会话级别 */
  SESSION = 'SESSION',
  /** 对话级别 */
  CONVERSATION = 'CONVERSATION',
  /** 团队级别 */
  TEAM = 'TEAM',
  /** 用户级别 */
  USER = 'USER',
}

/** Memory 来源类型 */
export enum MemorySourceType {
  /** 人工输入 */
  HUMAN = 'human',
  /** AI 助手 */
  AGENT = 'agent',
  /** 系统生成 */
  SYSTEM = 'system',
  /** 外部导入 */
  IMPORT = 'import',
}

/** Memory 分类 */
export enum MemoryCategory {
  /** 偏好 */
  PREFERENCE = 'preference',
  /** 决策 */
  DECISION = 'decision',
  /** 实体 */
  ENTITY = 'entity',
  /** 事实 */
  FACT = 'fact',
  /** 其他 */
  OTHER = 'other',
}
