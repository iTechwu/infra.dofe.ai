import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { VikingDbClientService } from './vikingdb-client.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeBaseVikingdbClient } from './knowledge-base-vikingdb.client';

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