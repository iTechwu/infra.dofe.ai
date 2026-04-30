/**
 * VikingDB Client Service
 * VikingDB 向量数据库客户端服务
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, retry } from 'rxjs';
import { getKeysConfig } from '@dofe/infra-common';
import type { VikingDbKeysConfig } from '@dofe/infra-common';
import type {
  VikingDbConfig,
  MemoryDocument,
  RetrievedCandidate,
  DeleteOptions,
  ScopeMap,
  VolcengineFieldInfo,
} from './vikingdb.types';
import { VOLCENGINE_MEMORY_COLLECTION_SCHEMA } from './vikingdb.types';
import { vikingdb as volcVikingdb } from '@volcengine/openapi';

@Injectable()
export class VikingDbClientService implements OnModuleInit {
  private config: VikingDbConfig;
  private volcService?: InstanceType<typeof volcVikingdb.VikingdbService>;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    const keysConfig = getKeysConfig();
    const vikingKeys = keysConfig?.vikingdb as VikingDbKeysConfig | undefined;

    // keys/config.json 优先，其次才 fallback env（兼容旧配置）
    const provider =
      vikingKeys?.provider ??
      (this.configService.get<string>('VIKINGDB_PROVIDER') as any) ??
      'custom-http';

    this.config = {
      provider,

      baseUrl:
        vikingKeys?.baseUrl ??
        this.configService.get<string>('VIKINGDB_BASE_URL', ''),
      authToken:
        vikingKeys?.authToken ??
        this.configService.get<string>('VIKINGDB_AUTH_TOKEN'),
      database:
        vikingKeys?.database ??
        this.configService.get<string>('VIKINGDB_DATABASE', ''),
      collection:
        vikingKeys?.collection ??
        this.configService.get<string>('VIKINGDB_COLLECTION', ''),

      ak:
        vikingKeys?.volcengine?.ak ??
        this.configService.get<string>('VIKINGDB_VOLCENGINE_AK'),
      sk:
        vikingKeys?.volcengine?.sk ??
        this.configService.get<string>('VIKINGDB_VOLCENGINE_SK'),
      region:
        vikingKeys?.volcengine?.region ??
        this.configService.get<string>(
          'VIKINGDB_VOLCENGINE_REGION',
          'cn-beijing',
        ),
      sessionToken:
        vikingKeys?.volcengine?.sessionToken ??
        this.configService.get<string>('VIKINGDB_VOLCENGINE_SESSION_TOKEN'),
      indexName:
        vikingKeys?.volcengine?.indexName ??
        this.configService.get<string>('VIKINGDB_VOLCENGINE_INDEX_NAME'),
      collectionName:
        vikingKeys?.volcengine?.collectionName ??
        this.configService.get<string>('VIKINGDB_VOLCENGINE_COLLECTION_NAME'),
      collectionAlias:
        vikingKeys?.volcengine?.collectionAlias ??
        this.configService.get<string>('VIKINGDB_VOLCENGINE_COLLECTION_ALIAS'),

      primaryKeyField:
        vikingKeys?.fields?.primaryKey ??
        this.configService.get<string>('VIKINGDB_FIELD_PRIMARY_KEY', 'id'),
      textField:
        vikingKeys?.fields?.text ??
        this.configService.get<string>('VIKINGDB_FIELD_TEXT', 'text'),
      vectorField:
        vikingKeys?.fields?.vector ??
        this.configService.get<string>('VIKINGDB_FIELD_VECTOR', 'embedding'),
      summaryField:
        vikingKeys?.fields?.summary ??
        this.configService.get<string>('VIKINGDB_FIELD_SUMMARY', 'summary'),
      metadataField:
        vikingKeys?.fields?.metadata ??
        this.configService.get<string>('VIKINGDB_FIELD_METADATA', 'metadata'),
      tagsField:
        vikingKeys?.fields?.tags ??
        this.configService.get<string>('VIKINGDB_FIELD_TAGS', 'tags'),
      taskTypeField:
        vikingKeys?.fields?.taskType ??
        this.configService.get<string>('VIKINGDB_FIELD_TASK_TYPE', 'taskType'),
      createdAtField:
        vikingKeys?.fields?.createdAt ??
        this.configService.get<string>(
          'VIKINGDB_FIELD_CREATED_AT',
          'createdAt',
        ),
      updatedAtField:
        vikingKeys?.fields?.updatedAt ??
        this.configService.get<string>(
          'VIKINGDB_FIELD_UPDATED_AT',
          'updatedAt',
        ),

      // scope/source 字段映射（Volcengine 建议使用扁平化字段做过滤）
      tenantIdField:
        vikingKeys?.fields?.tenantId ??
        this.configService.get<string>('VIKINGDB_FIELD_TENANT_ID', 'tenantId'),
      botIdField:
        vikingKeys?.fields?.botId ??
        this.configService.get<string>('VIKINGDB_FIELD_BOT_ID', 'botId'),
      scopeTypeField:
        vikingKeys?.fields?.scopeType ??
        this.configService.get<string>(
          'VIKINGDB_FIELD_SCOPE_TYPE',
          'scopeType',
        ),
      scopeIdField:
        vikingKeys?.fields?.scopeId ??
        this.configService.get<string>('VIKINGDB_FIELD_SCOPE_ID', 'scopeId'),
      sourceTypeField:
        vikingKeys?.fields?.sourceType ??
        this.configService.get<string>(
          'VIKINGDB_FIELD_SOURCE_TYPE',
          'sourceType',
        ),
      createdByIdField:
        vikingKeys?.fields?.createdById ??
        this.configService.get<string>(
          'VIKINGDB_FIELD_CREATED_BY_ID',
          'createdById',
        ),

      timeoutMs:
        vikingKeys?.timeoutMs ??
        this.configService.get<number>('VIKINGDB_TIMEOUT_MS', 20000),
      vectorSearchPath:
        vikingKeys?.paths?.vectorSearch ??
        this.configService.get<string>(
          'VIKINGDB_VECTOR_SEARCH_PATH',
          '/vector/search',
        ),
      bm25SearchPath:
        vikingKeys?.paths?.bm25Search ??
        this.configService.get<string>(
          'VIKINGDB_BM25_SEARCH_PATH',
          '/bm25/search',
        ),
      upsertPath:
        vikingKeys?.paths?.upsert ??
        this.configService.get<string>(
          'VIKINGDB_UPSERT_PATH',
          '/documents/upsert',
        ),
      deletePath:
        vikingKeys?.paths?.delete ??
        this.configService.get<string>(
          'VIKINGDB_DELETE_PATH',
          '/documents/delete',
        ),
      healthPath:
        vikingKeys?.paths?.health ??
        this.configService.get<string>('VIKINGDB_HEALTH_PATH', '/health'),

      headers:
        vikingKeys?.headers ??
        this.parseHeaders(
          this.configService.get<string>('VIKINGDB_HEADERS', '{}'),
        ),
    };

    if (this.config.provider === 'volcengine') {
      if (this.config.ak && this.config.sk) {
        this.volcService = new volcVikingdb.VikingdbService({
          ak: this.config.ak,
          sk: this.config.sk,
          region: this.config.region as any,
          sessionToken: this.config.sessionToken,
        });
      }

      this.logger.info('[VikingDB] Volcengine client initialized', {
        region: this.config.region,
        indexName: this.config.indexName,
        collectionName: this.config.collectionName,
        collectionAlias: this.config.collectionAlias,
      });

      return;
    }

    this.logger.info('[VikingDB] Client initialized', {
      baseUrl: this.config.baseUrl,
      database: this.config.database,
      collection: this.config.collection,
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Volcengine: 获取 collection schema（字段列表）
   */
  async getVolcengineCollectionSchema(): Promise<{
    collectionName: string;
    fields: Array<{ FieldName: string; FieldType: string; Dim?: number }>;
    indexNames: string[];
  } | null> {
    if (this.config.provider !== 'volcengine') {
      return null;
    }

    if (!this.volcService) {
      throw new Error(
        'Volcengine VikingDB client not configured (missing AK/SK)',
      );
    }

    const collectionName = this.resolveCollectionName();
    const resp = await this.volcService.collection.GetCollectionInfo({
      CollectionName: collectionName,
    });

    const info = (resp as any)?.CollectionInfo;
    const fields = Array.isArray(info?.Fields) ? info.Fields : [];

    return {
      collectionName,
      fields: fields.map((f: any) => ({
        FieldName: f.FieldName,
        FieldType: f.FieldType,
        ...(f.Dim !== undefined ? { Dim: f.Dim } : {}),
      })),
      indexNames: Array.isArray(info?.IndexNames) ? info.IndexNames : [],
    };
  }

  /**
   * Volcengine: 连通性自检（不写入数据）
   */
  async volcengineSelfCheck(): Promise<{
    ok: boolean;
    provider: 'volcengine';
    region?: string;
    collectionName?: string;
    indexName?: string;
    latencyMs: number;
    checks: {
      collectionInfo: boolean;
      indexInfo: boolean;
      sampleSearch: boolean;
    };
    warnings: string[];
    error?: string;
  } | null> {
    if (this.config.provider !== 'volcengine') {
      return null;
    }

    const start = Date.now();
    const warnings: string[] = [];

    try {
      if (!this.volcService) {
        throw new Error(
          'Volcengine VikingDB client not configured (missing AK/SK)',
        );
      }

      const collectionName = this.resolveCollectionName();
      const indexName = this.resolveIndexName();

      // 1) CollectionInfo
      const collectionResp =
        await this.volcService.collection.GetCollectionInfo({
          CollectionName: collectionName,
        });
      const info = (collectionResp as any)?.CollectionInfo;
      const indexNames = Array.isArray(info?.IndexNames) ? info.IndexNames : [];
      if (indexNames.length > 0 && !indexNames.includes(indexName)) {
        warnings.push(
          `IndexName not found in collection.IndexNames: ${indexName} (available: ${indexNames.join(', ')})`,
        );
      }

      // 2) IndexInfo
      await this.volcService.index.GetIndexInfo({
        CollectionName: collectionName,
        IndexName: indexName,
      });

      // 3) Sample search (empty filter, tiny limit)
      // 用 SearchByText 做一次最轻量的 API 可用性验证
      await this.volcService.search.SearchByText<Record<string, unknown>>({
        IndexName: indexName,
        Limit: 1,
        Text: 'ping',
        OutputFields: [this.config.primaryKeyField ?? 'id'],
        ...this.resolveCollectionNameOrAlias(),
      });

      return {
        ok: true,
        provider: 'volcengine',
        region: this.config.region,
        collectionName,
        indexName,
        latencyMs: Date.now() - start,
        checks: {
          collectionInfo: true,
          indexInfo: true,
          sampleSearch: true,
        },
        warnings,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        provider: 'volcengine',
        region: this.config.region,
        collectionName: this.config.collectionName,
        indexName: this.config.indexName,
        latencyMs: Date.now() - start,
        checks: {
          collectionInfo: false,
          indexInfo: false,
          sampleSearch: false,
        },
        warnings,
        error: msg,
      };
    }
  }

  /**
   * Volcengine: 校验远程 collection schema 是否匹配预期
   * 返回缺失字段/类型不匹配的警告列表
   */
  async validateVolcengineSchema(): Promise<{
    ok: boolean;
    collectionName: string;
    warnings: string[];
    errors: string[];
    remoteFields?: Array<{
      FieldName: string;
      FieldType: string;
      Dim?: number;
    }>;
    expectedFields: VolcengineFieldInfo[];
  } | null> {
    if (this.config.provider !== 'volcengine') {
      return null;
    }

    const warnings: string[] = [];
    const errors: string[] = [];

    const schema = await this.getVolcengineCollectionSchema();
    if (!schema) {
      return null;
    }

    const remoteFieldMap = new Map(schema.fields.map((f) => [f.FieldName, f]));

    // 检查期望字段是否存在、类型是否匹配
    for (const expected of VOLCENGINE_MEMORY_COLLECTION_SCHEMA) {
      const remote = remoteFieldMap.get(expected.FieldName);

      if (!remote) {
        warnings.push(
          `Missing expected field: ${expected.FieldName} (type: ${expected.FieldType})`,
        );
        continue;
      }

      // 类型兼容校验（允许一定灵活性）
      if (remote.FieldType !== expected.FieldType) {
        // 特殊情况：string/text 可视为兼容
        const isTextStringCompat =
          (expected.FieldType === 'text' && remote.FieldType === 'string') ||
          (expected.FieldType === 'string' && remote.FieldType === 'text');

        if (!isTextStringCompat) {
          warnings.push(
            `Field type mismatch: ${expected.FieldName} expected ${expected.FieldType}, got ${remote.FieldType}`,
          );
        }
      }

      // 向量维度检查
      if (expected.FieldType === 'vector' && expected.Dim) {
        if (remote.Dim && remote.Dim !== expected.Dim) {
          warnings.push(
            `Vector dimension mismatch: ${expected.FieldName} expected ${expected.Dim}, got ${remote.Dim}`,
          );
        }
      }
    }

    // 列出未知字段（不警告，只记录）
    const expectedNames = new Set(
      VOLCENGINE_MEMORY_COLLECTION_SCHEMA.map((f) => f.FieldName),
    );
    const extraFields = schema.fields
      .filter((f) => !expectedNames.has(f.FieldName))
      .map((f) => f.FieldName);
    if (extraFields.length > 0) {
      this.logger.debug('[VikingDB] Extra fields in collection', {
        extraFields,
      });
    }

    return {
      ok: errors.length === 0,
      collectionName: schema.collectionName,
      warnings,
      errors,
      remoteFields: schema.fields,
      expectedFields: VOLCENGINE_MEMORY_COLLECTION_SCHEMA,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      if (this.config.provider === 'volcengine') {
        if (!this.volcService) {
          throw new Error(
            'Volcengine VikingDB client not configured (missing AK/SK)',
          );
        }

        const collectionName = this.resolveCollectionName();
        // 轻量级检查：拉取 CollectionInfo
        await this.volcService.collection.GetCollectionInfo({
          CollectionName: collectionName,
        });

        return {
          healthy: true,
          latency: Date.now() - startTime,
        };
      }

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

  /**
   * 向量搜索
   */
  async vectorSearch(
    vector: number[],
    scope: ScopeMap,
    options: { topK?: number; taskType?: string } = {},
  ): Promise<RetrievedCandidate[]> {
    if (this.config.provider === 'volcengine') {
      if (!this.volcService) {
        throw new Error(
          'Volcengine VikingDB client not configured (missing AK/SK)',
        );
      }

      const indexName = this.resolveIndexName();
      const limit = options.topK ?? 50;
      const collectionNameOrAlias = this.resolveCollectionNameOrAlias();

      const volcFilter = this.buildVolcFilter(scope, options.taskType);

      const response = await this.volcService.search.SearchByVector<
        Record<string, unknown>
      >({
        IndexName: indexName,
        Limit: limit,
        DenseVectors: [vector],
        Filter: volcFilter,
        OutputFields: [
          this.config.primaryKeyField ?? 'id',
          this.config.textField ?? 'text',
          this.config.summaryField ?? 'summary',
          this.config.metadataField ?? 'metadata',
          this.config.tagsField ?? 'tags',
          this.config.taskTypeField ?? 'taskType',
          this.config.createdAtField ?? 'createdAt',
          this.config.updatedAtField ?? 'updatedAt',
        ],
        ...collectionNameOrAlias,
      });

      return this.normalizeVolcSearchResponse(response, scope);
    }

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

  /**
   * BM25 搜索
   */
  async bm25Search(
    query: string,
    scope: ScopeMap,
    options: { topK?: number; taskType?: string } = {},
  ): Promise<RetrievedCandidate[]> {
    if (this.config.provider === 'volcengine') {
      if (!this.volcService) {
        throw new Error(
          'Volcengine VikingDB client not configured (missing AK/SK)',
        );
      }

      const indexName = this.resolveIndexName();
      const limit = options.topK ?? 50;
      const collectionNameOrAlias = this.resolveCollectionNameOrAlias();
      const volcFilter = this.buildVolcFilter(scope, options.taskType);

      const response = await this.volcService.search.SearchByText<
        Record<string, unknown>
      >({
        IndexName: indexName,
        Limit: limit,
        Text: query,
        Filter: volcFilter,
        OutputFields: [
          this.config.primaryKeyField ?? 'id',
          this.config.textField ?? 'text',
          this.config.summaryField ?? 'summary',
          this.config.metadataField ?? 'metadata',
          this.config.tagsField ?? 'tags',
          this.config.taskTypeField ?? 'taskType',
          this.config.createdAtField ?? 'createdAt',
          this.config.updatedAtField ?? 'updatedAt',
        ],
        ...collectionNameOrAlias,
      });

      return this.normalizeVolcSearchResponse(response, scope);
    }

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

  /**
   * 混合搜索（向量 + BM25）
   */
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

    // 并行执行向量搜索和 BM25 搜索
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

    // 使用 Reciprocal Rank Fusion 合并结果
    const fused = this.reciprocalRankFusion(
      vectorResults,
      bm25Results,
      options.vectorWeight ?? 0.7,
      options.bm25Weight ?? 0.3,
    );

    // 返回 topK 结果
    return fused.slice(0, options.topK ?? 10);
  }

  /**
   * Upsert 文档
   */
  async upsert(documents: MemoryDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    if (this.config.provider === 'volcengine') {
      if (!this.volcService) {
        throw new Error(
          'Volcengine VikingDB client not configured (missing AK/SK)',
        );
      }

      const { primaryKeys, fields } = this.buildVolcUpsertFields(documents);
      const collectionNameOrAlias = this.resolveCollectionNameOrAlias();

      await this.volcService.data.UpsertData({
        Fields: fields,
        ...collectionNameOrAlias,
      });

      this.logger.info('[VikingDB] Volcengine upserted', {
        count: primaryKeys.length,
      });
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

  /**
   * 更新文档（部分更新，仅更新指定字段）
   */
  async update(
    documents: Array<{ id: string; [key: string]: unknown }>,
  ): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    if (this.config.provider === 'volcengine') {
      if (!this.volcService) {
        throw new Error(
          'Volcengine VikingDB client not configured (missing AK/SK)',
        );
      }

      const pkField = this.config.primaryKeyField ?? 'id';
      const fields = documents.map((doc) => ({
        [pkField]: doc.id,
        ...doc,
      }));

      const collectionNameOrAlias = this.resolveCollectionNameOrAlias();

      await this.volcService.data.UpdateData({
        Fields: fields,
        ...collectionNameOrAlias,
      });

      this.logger.info('[VikingDB] Volcengine updated', {
        count: fields.length,
      });
      return;
    }

    // For custom-http provider, use a dedicated update endpoint if available
    // Otherwise, we need to fetch existing documents and merge updates
    throw new Error(
      'Update operation is not supported for custom-http provider. Use upsert instead.',
    );
  }

  /**
   * 删除文档
   */
  async delete(options: DeleteOptions): Promise<void> {
    const ids = options.ids ?? (options.id ? [options.id] : []);

    if (this.config.provider === 'volcengine') {
      if (!this.volcService) {
        throw new Error(
          'Volcengine VikingDB client not configured (missing AK/SK)',
        );
      }

      const collectionNameOrAlias = this.resolveCollectionNameOrAlias();

      if (options.scope) {
        // 火山云 SDK 仅支持按主键删除或全量删除；scope 删除需上层自行维护主键集合。
        throw new Error(
          'Volcengine VikingDB does not support delete by scope; delete by ids only',
        );
      }

      if (ids.length === 0) {
        return;
      }

      await this.volcService.data.DeleteData({
        PrimaryKeys: ids,
        ...collectionNameOrAlias,
      } as any);

      this.logger.info('[VikingDB] Volcengine deleted', {
        ids: ids.length,
      });

      return;
    }

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

  /**
   * 按作用域删除所有文档
   */
  async deleteByScope(scope: ScopeMap): Promise<void> {
    await this.delete({ scope });
  }

  // ============================================================================
  // Volcengine helpers
  // ============================================================================

  private resolveIndexName(): string {
    if (!this.config.indexName) {
      throw new Error(
        'VIKINGDB_VOLCENGINE_INDEX_NAME is required when VIKINGDB_PROVIDER=volcengine',
      );
    }
    return this.config.indexName;
  }

  private resolveCollectionName(): string {
    if (this.config.collectionName) {
      return this.config.collectionName;
    }
    if (this.config.collectionAlias) {
      // healthCheck 需要 CollectionName；这里给出更明确的错误
      throw new Error(
        'VIKINGDB_VOLCENGINE_COLLECTION_NAME is required (collectionAlias is not enough for this operation)',
      );
    }
    throw new Error(
      'VIKINGDB_VOLCENGINE_COLLECTION_NAME or VIKINGDB_VOLCENGINE_COLLECTION_ALIAS is required',
    );
  }

  private resolveCollectionNameOrAlias():
    | { CollectionName: string }
    | { CollectionAlias: string } {
    if (this.config.collectionName) {
      return { CollectionName: this.config.collectionName };
    }
    if (this.config.collectionAlias) {
      return { CollectionAlias: this.config.collectionAlias };
    }
    throw new Error(
      'VIKINGDB_VOLCENGINE_COLLECTION_NAME or VIKINGDB_VOLCENGINE_COLLECTION_ALIAS is required when VIKINGDB_PROVIDER=volcengine',
    );
  }

  private buildVolcFilter(scope: ScopeMap, taskType?: string) {
    const conditions: any[] = [];

    // Volcengine SDK 的 filter 依赖 scalar / list scalar 字段。
    // 因此这里优先使用扁平化字段（tenantId/botId/scopeType/scopeId）。
    const pushEq = (fieldName: string | undefined, value: unknown) => {
      if (!fieldName) return;
      if (value === undefined || value === null || String(value).length === 0)
        return;
      conditions.push({
        Operation: 'must',
        FieldName: fieldName,
        Conditions: [String(value)],
      });
    };

    pushEq(this.config.tenantIdField, scope.tenantId);
    pushEq(this.config.botIdField, scope.botId);
    pushEq(this.config.scopeTypeField, (scope as any).scopeType);
    pushEq(this.config.scopeIdField, (scope as any).scopeId);

    // 兜底：如果没有配置扁平化字段，则继续用 metadata.scope.xxx（需要 collection schema 支持）
    if (conditions.length === 0) {
      for (const [k, v] of Object.entries(scope ?? {})) {
        if (v === undefined || v === null || String(v).length === 0) continue;
        conditions.push({
          Operation: 'must',
          FieldName: `${this.config.metadataField ?? 'metadata'}.scope.${k}`,
          Conditions: [String(v)],
        });
      }
    }

    if (taskType) {
      conditions.push({
        Operation: 'must',
        FieldName: this.config.taskTypeField ?? 'taskType',
        Conditions: [String(taskType)],
      });
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];

    return {
      Operation: 'and',
      Conditions: conditions,
    };
  }

  private normalizeVolcSearchResponse(
    response: any,
    fallbackScope: ScopeMap,
  ): RetrievedCandidate[] {
    const data: any[][] = response?.Data ?? [];
    const rows = data[0] ?? [];

    return rows.map((row) => {
      const fields = row?.Fields ?? {};
      const id = String(
        fields[this.config.primaryKeyField ?? 'id'] ??
          row[this.config.primaryKeyField ?? 'id'] ??
          row?.Id ??
          row?.id ??
          '',
      );

      const text = String(fields[this.config.textField ?? 'text'] ?? '');
      const summary = fields[this.config.summaryField ?? 'summary'] as any;
      const metadataRaw = fields[
        this.config.metadataField ?? 'metadata'
      ] as any;
      // metadata 存储为 JSON 字符串，需要解析
      const metadata = this.parseMetadata(metadataRaw);
      const tags = (fields[this.config.tagsField ?? 'tags'] as any) ?? [];
      const taskType = fields[this.config.taskTypeField ?? 'taskType'] as any;
      const createdAt = fields[
        this.config.createdAtField ?? 'createdAt'
      ] as any;
      const updatedAt = fields[
        this.config.updatedAtField ?? 'updatedAt'
      ] as any;

      const scope = (metadata?.scope as ScopeMap) ?? fallbackScope ?? {};

      const scoreFinal = typeof row.Score === 'number' ? row.Score : 0;

      return {
        id: id || 'unknown',
        text,
        summary: summary ? String(summary) : undefined,
        scope,
        metadata: metadata ?? {},
        tags: Array.isArray(tags) ? tags.map(String) : [],
        taskType: taskType ? String(taskType) : undefined,
        role: undefined,
        pinned: false,
        createdAt: createdAt ? String(createdAt) : undefined,
        updatedAt: updatedAt ? String(updatedAt) : undefined,
        scoreVector: scoreFinal,
        scoreBm25: scoreFinal,
        scoreHybrid: scoreFinal,
        scoreRerank: undefined,
        scoreFinal,
      };
    });
  }

  private parseMetadata(raw: unknown): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return {};
  }

  private buildVolcUpsertFields(documents: MemoryDocument[]): {
    primaryKeys: string[];
    fields: Record<string, unknown>[];
  } {
    const pkField = this.config.primaryKeyField ?? 'id';

    const primaryKeys: string[] = [];
    const fields = documents.map((doc) => {
      const id = String(doc.id ?? '');
      if (!id) {
        throw new Error(
          `MemoryDocument.id is required for volcengine upsert (field: ${pkField})`,
        );
      }
      primaryKeys.push(id);

      const now = new Date().toISOString();

      // 过滤掉 null/undefined 值的 metadata
      const metadata = this.buildMetadata(doc.metadata, doc.scope);

      const scope = doc.scope ?? {};

      // 提取 bots 字段（如果在 metadata 中存在）
      const bots = (doc.metadata as any)?.bots ?? [];

      return {
        [pkField]: id,
        [this.config.textField ?? 'text']: doc.text,
        ...(doc.summary !== undefined
          ? { [this.config.summaryField ?? 'summary']: doc.summary }
          : {}),
        [this.config.vectorField ?? 'embedding']: doc.embedding ?? [],
        [this.config.tagsField ?? 'tags']: doc.tags ?? [],
        ...(doc.taskType !== undefined
          ? { [this.config.taskTypeField ?? 'taskType']: doc.taskType }
          : {}),

        // 扁平化 scope/source 字段（用于 Volcengine filter）
        ...(this.config.tenantIdField
          ? { [this.config.tenantIdField]: scope.tenantId }
          : {}),
        ...(this.config.botIdField
          ? { [this.config.botIdField]: scope.botId }
          : {}),
        ...(this.config.scopeTypeField
          ? { [this.config.scopeTypeField]: (scope as any).scopeType }
          : {}),
        ...(this.config.scopeIdField
          ? { [this.config.scopeIdField]: (scope as any).scopeId }
          : {}),
        ...(this.config.sourceTypeField
          ? { [this.config.sourceTypeField]: (doc.metadata as any)?.sourceType }
          : {}),
        ...(this.config.createdByIdField
          ? {
              [this.config.createdByIdField]: (doc.metadata as any)
                ?.createdById,
            }
          : {}),

        // bots 字段（知识库元数据使用）
        ...(bots.length > 0 ? { bots } : {}),

        [this.config.createdAtField ?? 'createdAt']: doc.createdAt ?? now,
        [this.config.updatedAtField ?? 'updatedAt']: doc.updatedAt ?? now,
        // metadata 字段为 string 类型，需要 JSON 序列化
        [this.config.metadataField ?? 'metadata']: JSON.stringify(metadata),
      };
    });

    return { primaryKeys, fields };
  }

  private buildMetadata(
    metadata?: Record<string, unknown>,
    scope?: ScopeMap,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // 添加 scope
    if (scope) {
      result.scope = scope;
    }

    // 过滤掉 null/undefined 值
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== null && value !== undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (this.config.provider === 'volcengine') {
      throw new Error(
        'request() is not supported for volcengine provider; use SDK methods',
      );
    }

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
        (item.scoreFinal as number) ??
        (item.score_final as number) ??
        (item.score as number) ??
        0,
      embedding: Array.isArray(item.embedding)
        ? (item.embedding as number[])
        : undefined,
    }));
  }

  /**
   * Reciprocal Rank Fusion 算法
   * 合并向量搜索和 BM25 搜索的结果
   */
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

    // 计算向量搜索的 RRF 分数
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

    // 计算 BM25 搜索的 RRF 分数
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

    // 按分数排序
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        ...item.candidate,
        scoreFinal: item.candidate.scoreRerank ?? item.candidate.scoreHybrid,
      }));
  }
}
