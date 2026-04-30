/**
 * Embedding Service
 * 文本嵌入服务，用于生成向量嵌入
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, retry } from 'rxjs';
import { getKeysConfig } from '@dofe/infra-common';
import type { EmbeddingKeysConfig } from '@dofe/infra-common';
import type { EmbeddingConfig } from './vikingdb.types';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private config: EmbeddingConfig;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    const keysConfig = getKeysConfig();
    const embeddingKeys = keysConfig?.embedding as
      | EmbeddingKeysConfig
      | undefined;

    // keys/config.json 优先，其次才 fallback env（兼容旧配置）
    this.config = {
      baseUrl:
        embeddingKeys?.baseUrl ??
        this.configService.get<string>(
          'EMBEDDING_BASE_URL',
          this.configService.get<string>(
            'OPENAI_API_BASE',
            'https://api.openai.com/v1',
          ),
        ),
      apiKey:
        embeddingKeys?.apiKey ??
        this.configService.get<string>(
          'EMBEDDING_API_KEY',
          this.configService.get<string>('OPENAI_API_KEY'),
        ),
      model:
        embeddingKeys?.model ??
        this.configService.get<string>(
          'EMBEDDING_MODEL',
          'text-embedding-3-small',
        ),
      dimensions:
        embeddingKeys?.dimensions ??
        this.configService.get<number>('EMBEDDING_DIMENSIONS'),
      timeoutMs:
        embeddingKeys?.timeoutMs ??
        this.configService.get<number>('EMBEDDING_TIMEOUT_MS', 20000),
      queryPrefix:
        embeddingKeys?.queryPrefix ??
        this.configService.get<string>('EMBEDDING_QUERY_PREFIX', 'query:'),
      documentPrefix:
        embeddingKeys?.documentPrefix ??
        this.configService.get<string>('EMBEDDING_DOCUMENT_PREFIX', 'passage:'),
    };

    this.logger.info('[Embedding] Service initialized', {
      baseUrl: this.config.baseUrl ? '[configured]' : '[not configured]',
      model: this.config.model,
      dimensions: this.config.dimensions,
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 生成单个文本的嵌入向量
   */
  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0] ?? [];
  }

  /**
   * 批量生成嵌入向量
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.config.baseUrl || !this.config.apiKey) {
      this.logger.warn(
        '[Embedding] Service not configured, returning empty embeddings',
      );
      return texts.map(() => []);
    }

    const url = this.buildUrl('/embeddings');
    const headers = this.buildHeaders();

    // 过滤空文本
    const validTexts = texts.filter((t) => t && t.trim().length > 0);
    if (validTexts.length === 0) {
      return texts.map(() => []);
    }

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<{
            data?: Array<{ embedding?: number[]; index?: number }>;
          }>(
            url,
            {
              model: this.config.model,
              input: validTexts,
              ...(this.config.dimensions
                ? { dimensions: this.config.dimensions }
                : {}),
            },
            { headers },
          )
          .pipe(
            timeout(this.config.timeoutMs),
            retry({
              count: 2,
              delay: 500,
            }),
          ),
      );

      const data = response.data?.data ?? [];

      // 按索引排序并提取嵌入
      const sortedEmbeddings = data
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => item.embedding ?? []);

      // 如果请求数量和返回数量不匹配，用空数组填充
      const result: number[][] = [];
      let dataIndex = 0;
      for (const text of texts) {
        if (text && text.trim().length > 0) {
          result.push(sortedEmbeddings[dataIndex] ?? []);
          dataIndex++;
        } else {
          result.push([]);
        }
      }

      this.logger.debug('[Embedding] Generated embeddings', {
        count: result.filter((e) => e.length > 0).length,
        total: texts.length,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[Embedding] Failed to generate embeddings', {
        error: errorMessage,
        textsCount: texts.length,
      });
      // 返回空嵌入而不是抛出错误
      return texts.map(() => []);
    }
  }

  /**
   * 为查询生成嵌入（带前缀）
   */
  async embedQuery(query: string): Promise<number[]> {
    const prefixedQuery = this.addPrefix(query, this.config.queryPrefix);
    return this.embed(prefixedQuery);
  }

  /**
   * 为文档生成嵌入（带前缀）
   */
  async embedDocument(document: string): Promise<number[]> {
    const prefixedDoc = this.addPrefix(document, this.config.documentPrefix);
    return this.embed(prefixedDoc);
  }

  /**
   * 批量为文档生成嵌入
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const prefixedDocs = documents.map((doc) =>
      this.addPrefix(doc, this.config.documentPrefix),
    );
    return this.embedBatch(prefixedDocs);
  }

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 计算 MMR（最大边际相关性）多样性
   */
  mmr(
    queryEmbedding: number[],
    candidates: Array<{ embedding?: number[]; id: string }>,
    options: { lambda?: number; topK?: number } = {},
  ): string[] {
    const { lambda = 0.7, topK = 10 } = options;

    if (candidates.length === 0) {
      return [];
    }

    const selected: string[] = [];
    const remaining = [...candidates];
    const selectedEmbeddings: number[][] = [];

    while (selected.length < topK && remaining.length > 0) {
      let bestScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        if (!candidate.embedding || candidate.embedding.length === 0) {
          continue;
        }

        // 与查询的相似度
        const querySimilarity = this.cosineSimilarity(
          queryEmbedding,
          candidate.embedding,
        );

        // 与已选择文档的最大相似度
        let maxSelectedSimilarity = 0;
        for (const selectedEmb of selectedEmbeddings) {
          const sim = this.cosineSimilarity(candidate.embedding, selectedEmb);
          maxSelectedSimilarity = Math.max(maxSelectedSimilarity, sim);
        }

        // MMR 分数
        const mmrScore =
          lambda * querySimilarity - (1 - lambda) * maxSelectedSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        const best = remaining.splice(bestIndex, 1)[0];
        selected.push(best.id);
        if (best.embedding) {
          selectedEmbeddings.push(best.embedding);
        }
      } else {
        break;
      }
    }

    return selected;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildUrl(path: string): string {
    const baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private addPrefix(text: string, prefix: string): string {
    if (!prefix || text.startsWith(prefix)) {
      return text;
    }
    return `${prefix}${text}`;
  }
}
