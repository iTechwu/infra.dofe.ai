/**
 * Vector Module
 * 向量服务模块，包含 VikingDB 客户端和 Embedding 服务
 */
import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VikingDbClientService } from './vikingdb-client.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeBaseVikingdbClient } from './knowledge-base-vikingdb.client';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    VikingDbClientService,
    EmbeddingService,
    KnowledgeBaseVikingdbClient,
  ],
  exports: [
    VikingDbClientService,
    EmbeddingService,
    KnowledgeBaseVikingdbClient,
  ],
})
export class VectorModule {}
