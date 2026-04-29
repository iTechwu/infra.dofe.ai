import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, retry } from 'rxjs';
import type {
  VikingDbConfig,
  MemoryDocument,
  RetrievedCandidate,
  DeleteOptions,
  ScopeMap,
  VolcengineFieldInfo,
} from './vikingdb.types';
import { VOLCENGINE_MEMORY_COLLECTION_SCHEMA } from './vikingdb.types';

// Volcengine SDK type (optional import)
type VolcVikingdbService = any;

@Injectable()
export class VikingDbClientService implements OnModuleInit {
  private config: VikingDbConfig;
  private volcService?: VolcVikingdbService;
  private initialized = false;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Configure the client with custom settings (can be called before onModuleInit)
   * Useful when config comes from external sources (keys.json, etc.)
   */
  configure(customConfig: Partial<VikingDbConfig>): void {
    this.config = {
      ...this.config,
      ...customConfig,
    };
    this.initialized = true;
    this.logger.info('[VikingDB] Client configured with custom settings', {
      provider: this.config.provider,
      baseUrl: this.config.baseUrl,
    });
  }

  /**
   * Get current configuration (for inspection or debugging)
   */
  getConfig(): VikingDbConfig {
    return this.config;
  }

  onModuleInit() {
    // Skip if already configured via configure()
    if (this.initialized) {
      return;
    }

    const provider =
      (this.configService.get<string>('VIKINGDB_PROVIDER') as any) ?? 'custom-http';

    this.config = {
      provider,
      baseUrl: this.configService.get<string>('VIKINGDB_BASE_URL', ''),
      authToken: this.configService.get<string>('VIKINGDB_AUTH_TOKEN'),
      database: this.configService.get<string>('VIKINGDB_DATABASE', ''),
      collection: this.configService.get<string>('VIKINGDB_COLLECTION', ''),
      ak: this.configService.get<string>('VIKINGDB_VOLCENGINE_AK'),
      sk: this.configService.get<string>('VIKINGDB_VOLCENGINE_SK'),
      region: this.configService.get<string>(
        'VIKINGDB_VOLCENGINE_REGION',
        'cn-beijing',
      ),
      sessionToken: this.configService.get<string>(
        'VIKINGDB_VOLCENGINE_SESSION_TOKEN',
      ),
      indexName: this.configService.get<string>('VIKINGDB_VOLCENGINE_INDEX_NAME'),
      collectionName: this.configService.get<string>(
        'VIKINGDB_VOLCENGINE_COLLECTION_NAME',
      ),
      collectionAlias: this.configService.get<string>(
        'VIKINGDB_VOLCENGINE_COLLECTION_ALIAS',
      ),
      primaryKeyField:
        this.configService.get<string>('VIKINGDB_FIELD_PRIMARY_KEY', 'id'),
      textField: this.configService.get<string>('VIKINGDB_FIELD_TEXT', 'text'),
      vectorField:
        this.configService.get<string>('VIKINGDB_FIELD_VECTOR', 'embedding'),
      summaryField:
        this.configService.get<string>('VIKINGDB_FIELD_SUMMARY', 'summary'),
      metadataField:
        this.configService.get<string>('VIKINGDB_FIELD_METADATA', 'metadata'),
      tagsField: this.configService.get<string>('VIKINGDB_FIELD_TAGS', 'tags'),
      taskTypeField:
        this.configService.get<string>('VIKINGDB_FIELD_TASK_TYPE', 'taskType'),
      createdAtField:
        this.configService.get<string>('VIKINGDB_FIELD_CREATED_AT', 'createdAt'),
      updatedAtField:
        this.configService.get<string>('VIKINGDB_FIELD_UPDATED_AT', 'updatedAt'),
      tenantIdField:
        this.configService.get<string>('VIKINGDB_FIELD_TENANT_ID', 'tenantId'),
      botIdField:
        this.configService.get<string>('VIKINGDB_FIELD_BOT_ID', 'botId'),
      scopeTypeField:
        this.configService.get<string>('VIKINGDB_FIELD_SCOPE_TYPE', 'scopeType'),
      scopeIdField:
        this.configService.get<string>('VIKINGDB_FIELD_SCOPE_ID', 'scopeId'),
      sourceTypeField:
        this.configService.get<string>('VIKINGDB_FIELD_SOURCE_TYPE', 'sourceType'),
      createdByIdField:
        this.configService.get<string>('VIKINGDB_FIELD_CREATED_BY_ID', 'createdById'),
      timeoutMs: this.configService.get<number>('VIKINGDB_TIMEOUT_MS', 20000),
      vectorSearchPath:
        this.configService.get<string>('VIKINGDB_VECTOR_SEARCH_PATH', '/vector/search'),
      bm25SearchPath:
        this.configService.get<string>('VIKINGDB_BM25_SEARCH_PATH', '/bm25/search'),
      upsertPath:
        this.configService.get<string>('VIKINGDB_UPSERT_PATH', '/documents/upsert'),
      deletePath:
        this.configService.get<string>('VIKINGDB_DELETE_PATH', '/documents/delete'),
      healthPath:
        this.configService.get<string>('VIKINGDB_HEALTH_PATH', '/health'),
      headers: this.parseHeaders(
        this.configService.get<string>('VIKINGDB_HEADERS', '{}'),
      ),
    };

    this.initialized = true;
    this.logger.info('[VikingDB] Client initialized', {
      provider: this.config.provider,
      baseUrl: this.config.baseUrl,
      database: this.config.database,
      collection: this.config.collection,
    });
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.request('GET', this.config.healthPath);
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[VikingDB] Health check failed', {
        error: errorMessage,
      });
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  async vectorSearch(
    vector: number[],
    scope: ScopeMap,
    options: { topK?: number; taskType?: string } = {},
  ): Promise<RetrievedCandidate[]> {
    const response = await this.request<{ candidates?: RetrievedCandidate[] }>(
      'POST',
      this.config.vectorSearchPath,
      {
        vector,
        topK: options.topK ?? 50,
        scope,
        taskType: options.taskType,
      },
    );

    return this.normalizeCandidates(response);
  }

  async bm25Search(
    query: string,
    scope: ScopeMap,
    options: { topK?: number; taskType?: string } = {},
  ): Promise<RetrievedCandidate[]> {
    const response = await this.request<{ candidates?: RetrievedCandidate[] }>(
      'POST',
      this.config.bm25SearchPath,
      {
        query,
        topK: options.topK ?? 50,
        scope,
        taskType: options.taskType,
      },
    );

    return this.normalizeCandidates(response);
  }

  async hybridSearch(
    vector: number[],
    query: string,
    scope: ScopeMap,
    options: {
      topK?: number;
      candidateK?: number;
      taskType?: string;
      vectorWeight?: number;
      bm25Weight?: number;
    } = {},
  ): Promise<RetrievedCandidate[]> {
    const candidateK = options.candidateK ?? 50;

    const [vectorResults, bm25Results] = await Promise.all([
      this.vectorSearch(vector, scope, {
        topK: candidateK,
        taskType: options.taskType,
      }),
      this.bm25Search(query, scope, {
        topK: candidateK,
        taskType: options.taskType,
      }),
    ]);

    const fused = this.reciprocalRankFusion(
      vectorResults,
      bm25Results,
      options.vectorWeight ?? 0.7,
      options.bm25Weight ?? 0.3,
    );

    return fused.slice(0, options.topK ?? 10);
  }

  async upsert(documents: MemoryDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    await this.request('POST', this.config.upsertPath, {
      documents: documents.map((doc) => ({
        ...doc,
        timestamp: doc.timestamp ?? new Date().toISOString(),
        createdAt: doc.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    });

    this.logger.info('[VikingDB] Documents upserted', {
      count: documents.length,
    });
  }

  async update(
    documents: Array<{ id: string; [key: string]: unknown }>,
  ): Promise<void> {
    throw new Error(
      'Update operation is not supported for custom-http provider. Use upsert instead.',
    );
  }

  async delete(options: DeleteOptions): Promise<void> {
    const ids = options.ids ?? (options.id ? [options.id] : []);

    if (ids.length === 0 && !options.scope) {
      return;
    }

    await this.request('POST', this.config.deletePath, {
      ids: ids.length > 0 ? ids : undefined,
      scope: options.scope,
    });

    this.logger.info('[VikingDB] Documents deleted', {
      ids: ids.length,
      scope: options.scope,
    });
  }

  async deleteByScope(scope: ScopeMap): Promise<void> {
    await this.delete({ scope });
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = this.buildUrl(path);
    const headers = this.buildHeaders();

    this.logger.debug('[VikingDB] Making request', {
      method,
      url,
      hasBody: !!body,
    });

    try {
      const observable$ =
        method === 'GET'
          ? this.httpService.get<T>(url, { headers })
          : this.httpService.post<T>(url, body, { headers });

      const response = await firstValueFrom(
        observable$.pipe(
          timeout(this.config.timeoutMs),
          retry({
            count: 2,
            delay: 1000,
          }),
        ),
      );

      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[VikingDB] Request failed', {
        method,
        url,
        error: errorMessage,
      });
      throw new Error(`VikingDB request failed: ${errorMessage}`);
    }
  }

  private buildUrl(path: string): string {
    const baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    return headers;
  }

  private parseHeaders(headersJson: string): Record<string, string> {
    try {
      const parsed = JSON.parse(headersJson);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.fromEntries(
          Object.entries(parsed)
            .filter(([, v]) => typeof v === 'string')
            .map(([k, v]) => [k, String(v)]),
        );
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  }

  private normalizeCandidates(
    response: Record<string, unknown> | undefined,
  ): RetrievedCandidate[] {
    if (!response) {
      return [];
    }

    const candidates = response.candidates ?? response.results ?? response.data;
    if (!Array.isArray(candidates)) {
      return [];
    }

    return candidates.map((item: Record<string, unknown>, index: number) => ({
      id: String(item.id ?? `unknown-${index}`),
      text: String(item.text ?? ''),
      summary: item.summary ? String(item.summary) : undefined,
      scope: (item.scope as ScopeMap) ?? {},
      metadata: (item.metadata as Record<string, unknown>) ?? {},
      tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
      taskType: item.taskType ? String(item.taskType) : undefined,
      role: item.role ? String(item.role) : undefined,
      pinned: Boolean(item.pinned),
      createdAt: item.createdAt ? String(item.createdAt) : undefined,
      updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
      scoreVector:
        (item.scoreVector as number) ?? (item.score_vector as number) ?? 0,
      scoreBm25: (item.scoreBm25 as number) ?? (item.score_bm25 as number) ?? 0,
      scoreHybrid:
        (item.scoreHybrid as number) ?? (item.score_hybrid as number) ?? 0,
      scoreRerank: item.scoreRerank
        ? (item.scoreRerank as number)
        : item.score_rerank
          ? (item.score_rerank as number)
          : undefined,
      scoreFinal:
        (item.scoreFinal as number) ?? (item.score_final as number) ?? (item.score as number) ?? 0,
      embedding: Array.isArray(item.embedding)
        ? (item.embedding as number[])
        : undefined,
    }));
  }

  private reciprocalRankFusion(
    vectorResults: RetrievedCandidate[],
    bm25Results: RetrievedCandidate[],
    vectorWeight: number,
    bm25Weight: number,
    k: number = 60,
  ): RetrievedCandidate[] {
    const scoreMap = new Map<
      string,
      { candidate: RetrievedCandidate; score: number }
    >();

    vectorResults.forEach((candidate, index) => {
      const rrfScore = vectorWeight / (k + index + 1);
      const existing = scoreMap.get(candidate.id);
      if (existing) {
        existing.score += rrfScore;
        existing.candidate.scoreHybrid = existing.score;
      } else {
        scoreMap.set(candidate.id, {
          candidate: { ...candidate, scoreHybrid: rrfScore },
          score: rrfScore,
        });
      }
    });

    bm25Results.forEach((candidate, index) => {
      const rrfScore = bm25Weight / (k + index + 1);
      const existing = scoreMap.get(candidate.id);
      if (existing) {
        existing.score += rrfScore;
        existing.candidate.scoreHybrid = existing.score;
      } else {
        scoreMap.set(candidate.id, {
          candidate: { ...candidate, scoreHybrid: rrfScore },
          score: rrfScore,
        });
      }
    });

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        ...item.candidate,
        scoreFinal: item.candidate.scoreRerank ?? item.candidate.scoreHybrid,
      }));
  }
}