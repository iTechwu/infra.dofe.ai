import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { VikingDbClientService } from './vikingdb-client.service';

export interface KnowledgeBaseVectorDocument {
  documentId: string;
  knowledgeBaseId: string;
  tenantId: string;
  title: string;
  content: string;
  summary?: string | null;
  sourceType: string;
  sourceUrl?: string | null;
  mimeType?: string | null;
  fileExtension?: string | null;
  embedding: number[];
}

@Injectable()
export class KnowledgeBaseVikingdbClient {
  constructor(
    @Inject(forwardRef(() => VikingDbClientService))
    private readonly vikingDbClientService: VikingDbClientService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async upsertDocument(document: KnowledgeBaseVectorDocument): Promise<void> {
    await this.vikingDbClientService.upsert([
      {
        id: document.documentId,
        text: document.content,
        summary: document.summary ?? undefined,
        tags: [document.sourceType],
        taskType: 'knowledge-base',
        embedding: document.embedding,
        scope: {
          tenantId: document.tenantId,
          scopeType: 'knowledge-base',
          scopeId: document.knowledgeBaseId,
        },
        metadata: {
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.documentId,
          title: document.title,
          sourceType: document.sourceType,
          sourceUrl: document.sourceUrl ?? null,
          mimeType: document.mimeType ?? null,
          fileExtension: document.fileExtension ?? null,
        },
      } as any,
    ]);
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.vikingDbClientService.delete({ ids: [documentId] });
  }

  /**
   * 批量更新知识库下所有文档的 bots 字段
   * @param documentIds 该知识库下所有文档的 ID 列表
   * @param bots 关联的员工 ID 数组
   */
  async updateKnowledgeBaseBots(
    documentIds: string[],
    bots: string[],
  ): Promise<void> {
    if (documentIds.length === 0) {
      this.logger.info('[KnowledgeBaseVikingdbClient] No documents to update');
      return;
    }

    this.logger.info(
      '[KnowledgeBaseVikingdbClient] Updating bots for documents',
      {
        documentCount: documentIds.length,
        bots,
      },
    );

    // 批量更新所有文档的 bots 字段
    const updateDocs = documentIds.map((docId) => ({
      id: docId,
      bots,
    }));

    await this.vikingDbClientService.update(updateDocs);

    this.logger.info(
      '[KnowledgeBaseVikingdbClient] Update completed for documents',
      { count: documentIds.length },
    );
  }
}
