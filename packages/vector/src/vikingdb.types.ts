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

export interface VolcengineFieldInfo {
  FieldName: string;
  FieldType: VolcengineFieldType;
  IsPrimary?: boolean;
  DefaultValue?: unknown;
  Dim?: number;
  PipelineName?: string;
}

export const VOLCENGINE_MEMORY_COLLECTION_SCHEMA: VolcengineFieldInfo[] = [
  { FieldName: 'id', FieldType: 'string', IsPrimary: true },
  { FieldName: 'text', FieldType: 'text', PipelineName: 'default' },
  { FieldName: 'summary', FieldType: 'string' },
  { FieldName: 'embedding', FieldType: 'vector', Dim: 1536 },
  { FieldName: 'tags', FieldType: 'list<string>' },
  { FieldName: 'taskType', FieldType: 'string' },
  { FieldName: 'tenantId', FieldType: 'string' },
  { FieldName: 'botId', FieldType: 'string' },
  { FieldName: 'scopeType', FieldType: 'string' },
  { FieldName: 'scopeId', FieldType: 'string' },
  { FieldName: 'sourceType', FieldType: 'string' },
  { FieldName: 'createdById', FieldType: 'string' },
  { FieldName: 'bots', FieldType: 'list<string>' },
  { FieldName: 'createdAt', FieldType: 'string' },
  { FieldName: 'updatedAt', FieldType: 'string' },
  { FieldName: 'metadata', FieldType: 'string' },
];

export interface VikingDbConfig {
  provider?: 'custom-http' | 'volcengine';
  baseUrl: string;
  authToken?: string;
  database: string;
  collection: string;
  ak?: string;
  sk?: string;
  region?: string;
  sessionToken?: string;
  indexName?: string;
  collectionName?: string;
  collectionAlias?: string;
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
  timeoutMs: number;
  vectorSearchPath: string;
  bm25SearchPath: string;
  upsertPath: string;
  deletePath: string;
  healthPath: string;
  headers: Record<string, string>;
}

export type ScopeMap = Record<string, string>;

export interface MemoryDocument {
  id?: string;
  text: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  scope?: ScopeMap;
  metadata?: Record<string, unknown>;
  tags?: string[];
  taskType?: string;
  role?: string;
  pinned?: boolean;
  embedding?: number[];
  chunkIndex?: number;
  contentHash?: string;
}

export interface RetrievedCandidate {
  id: string;
  text: string;
  summary?: string;
  scope: ScopeMap;
  metadata: Record<string, unknown>;
  tags: string[];
  taskType?: string;
  role?: string;
  pinned: boolean;
  createdAt?: string;
  updatedAt?: string;
  scoreVector: number;
  scoreBm25: number;
  scoreHybrid: number;
  scoreRerank?: number;
  scoreFinal: number;
  embedding?: number[];
}

export type SearchMode = 'adaptive' | 'vector' | 'bm25' | 'hybrid';

export interface SearchOptions {
  query: string;
  scope?: ScopeMap;
  taskType?: string;
  topK?: number;
  candidateK?: number;
  mode?: SearchMode;
  vectorWeight?: number;
  bm25Weight?: number;
  minScore?: number;
  enableRerank?: boolean;
  enableMMR?: boolean;
  now?: string;
}

export interface SearchResult {
  mode: SearchMode;
  candidates: RetrievedCandidate[];
  queryEmbedding?: number[];
}

export interface UpsertOptions {
  documents: MemoryDocument[];
  scope?: ScopeMap;
  taskType?: string;
}

export interface DeleteOptions {
  ids?: string[];
  id?: string;
  scope?: ScopeMap;
}

export interface VikingDbHealthStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
}

export interface EmbeddingConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  dimensions?: number;
  timeoutMs: number;
  queryPrefix: string;
  documentPrefix: string;
}

export interface RerankConfig {
  provider: 'none' | 'jina' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs: number;
}

export interface MemoryServiceConfig {
  enabled: boolean;
  vikingdb: VikingDbConfig;
  embedding: EmbeddingConfig;
  rerank: RerankConfig;
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

export enum MemoryScopeType {
  GLOBAL = 'GLOBAL',
  WORKSPACE = 'WORKSPACE',
  BOT = 'BOT',
  SESSION = 'SESSION',
  CONVERSATION = 'CONVERSATION',
  TEAM = 'TEAM',
  USER = 'USER',
}

export enum MemorySourceType {
  HUMAN = 'human',
  AGENT = 'agent',
  SYSTEM = 'system',
  IMPORT = 'import',
}

export enum MemoryCategory {
  PREFERENCE = 'preference',
  DECISION = 'decision',
  ENTITY = 'entity',
  FACT = 'fact',
  OTHER = 'other',
}