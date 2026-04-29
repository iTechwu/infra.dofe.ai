import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, retry } from 'rxjs';
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
    this.config = {
      baseUrl:
        this.configService.get<string>(
          'EMBEDDING_BASE_URL',
          this.configService.get<string>(
            'OPENAI_API_BASE',
            'https://api.openai.com/v1',
          ),
        ),
      apiKey:
        this.configService.get<string>(
          'EMBEDDING_API_KEY',
          this.configService.get<string>('OPENAI_API_KEY'),
        ),
      model:
        this.configService.get<string>(
          'EMBEDDING_MODEL',
          'text-embedding-3-small',
        ),
      dimensions: this.configService.get<number>('EMBEDDING_DIMENSIONS'),
      timeoutMs: this.configService.get<number>('EMBEDDING_TIMEOUT_MS', 20000),
      queryPrefix:
        this.configService.get<string>('EMBEDDING_QUERY_PREFIX', 'query:'),
      documentPrefix:
        this.configService.get<string>('EMBEDDING_DOCUMENT_PREFIX', 'passage:'),
    };

    this.logger.info('[Embedding] Service initialized', {
      baseUrl: this.config.baseUrl ? '[configured]' : '[not configured]',
      model: this.config.model,
      dimensions: this.config.dimensions,
    });
  }

  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0] ?? [];
  }

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

      const sortedEmbeddings = data
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => item.embedding ?? []);

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
      return texts.map(() => []);
    }
  }

  async embedQuery(query: string): Promise<number[]> {
    const prefixedQuery = this.addPrefix(query, this.config.queryPrefix);
    return this.embed(prefixedQuery);
  }

  async embedDocument(document: string): Promise<number[]> {
    const prefixedDoc = this.addPrefix(document, this.config.documentPrefix);
    return this.embed(prefixedDoc);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const prefixedDocs = documents.map((doc) =>
      this.addPrefix(doc, this.config.documentPrefix),
    );
    return this.embedBatch(prefixedDocs);
  }

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

        const querySimilarity = this.cosineSimilarity(
          queryEmbedding,
          candidate.embedding,
        );

        let maxSelectedSimilarity = 0;
        for (const selectedEmb of selectedEmbeddings) {
          const sim = this.cosineSimilarity(candidate.embedding, selectedEmb);
          maxSelectedSimilarity = Math.max(maxSelectedSimilarity, sim);
        }

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