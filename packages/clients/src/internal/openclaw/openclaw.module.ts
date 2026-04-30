/**
 * OpenClaw 客户端模块
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DockerRuntimeModule } from '@dofe/infra-docker';
import { DockerExecService } from './docker-exec.service';
import { OpenClawClient } from './openclaw.client';
import { OpenClawGatewayClient } from './openclaw-gateway.client';
import { OpenClawCronClient } from './openclaw-cron.client';
import { OpenClawAgentCoordinationClient } from './openclaw-agent-coordination.client';
import { OpenClawSkillSyncClient } from './openclaw-skill-sync.client';
import { OpenClawContextStatusClient } from './openclaw-context-status.client';
import { SkillTranslationService } from './skill-translation.service';
import { OpenAIClientModule } from '@dofe/infra-clients';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 120000,
      maxRedirects: 5,
    }),
    DockerRuntimeModule,
    OpenAIClientModule,
  ],
  providers: [
    DockerExecService,
    OpenClawClient,
    OpenClawGatewayClient,
    OpenClawCronClient,
    OpenClawAgentCoordinationClient,
    OpenClawSkillSyncClient,
    OpenClawContextStatusClient,
    SkillTranslationService,
  ],
  exports: [
    DockerExecService,
    OpenClawClient,
    OpenClawGatewayClient,
    OpenClawCronClient,
    OpenClawAgentCoordinationClient,
    OpenClawSkillSyncClient,
    OpenClawContextStatusClient,
    SkillTranslationService,
  ],
})
export class OpenClawModule {}
