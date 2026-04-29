import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';
import { z } from 'zod';
import { getKeysConfig } from '@/config/configuration';
import type {
  LLMModelInfo,
  LLMCapabilityTag,
  LLMCompositeScenario,
  LLMRoutingResponse,
  RoutingGenerationOptions,
} from './interfaces/routing-llm.interface';
import { LLMRoutingResponseSchema } from './interfaces/routing-llm.interface';

/**
 * LLM Client for AI-powered routing suggestion
 * Uses gpt-5-pro model for intelligent routing rule generation
 */
@Injectable()
export class RoutingLLMClient implements OnModuleInit {
  private baseUrl: string = '';
  private apiKey: string = '';
  /** Fixed model as per requirements */
  private readonly model = 'gpt-5-pro';

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  onModuleInit() {
    const keysConfig = getKeysConfig();
    const openaiConfig = keysConfig?.openai;

    this.apiKey = openaiConfig?.apiKey || '';
    // Use configurable baseUrl or default to OpenAI
    this.baseUrl = openaiConfig?.baseUrl || 'https://api.openai.com/v1';

    if (!this.apiKey) {
      this.logger.warn('[RoutingLLM] OpenAI API Key not configured');
    }

    this.logger.info(`[RoutingLLM] Client initialized`, {
      model: this.model,
      baseUrl: this.baseUrl ? 'configured' : 'default',
    });
  }

  private getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * Check if LLM service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/models`, {
          headers: this.getAuthHeaders(),
          timeout: 5000,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate routing rules using LLM
   */
  async generateRoutingRules(
    models: LLMModelInfo[],
    capabilityTags: LLMCapabilityTag[],
    compositeScenarios: LLMCompositeScenario[],
    options?: RoutingGenerationOptions,
  ): Promise<LLMRoutingResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(
      models,
      capabilityTags,
      compositeScenarios,
      options?.customInstructions,
    );

    try {
      this.logger.info('[RoutingLLM] Generating routing rules', {
        modelCount: models.length,
        tagCount: capabilityTags.length,
        scenarioCount: compositeScenarios.length,
      });

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3, // Lower temperature for more deterministic output
            response_format: { type: 'json_object' },
            max_tokens: 4096,
          },
          {
            headers: this.getAuthHeaders(),
            timeout: 120000, // 2 minutes timeout
          },
        ),
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      // Parse and validate JSON response
      const parsed = JSON.parse(content);
      const validated = LLMRoutingResponseSchema.parse(parsed);

      this.logger.info('[RoutingLLM] Routing rules generated successfully', {
        ruleCount: validated.rules.length,
        defaultModel: validated.defaultModel,
      });

      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('[RoutingLLM] Response validation failed', {
          errors: error.issues,
        });
        throw new Error(
          `LLM response validation failed: ${error.issues.map((e) => e.message).join(', ')}`,
        );
      }
      this.handleError('generateRoutingRules', error as AxiosError);
    }
  }

  private buildSystemPrompt(): string {
    return `You are an AI routing expert specialized in optimizing model selection for user requests.

Your task is to DEEPLY ANALYZE available models and their capabilities, then generate intelligent routing rules that match user intents to the most appropriate models.

## CRITICAL: Deep Analysis Required
Before generating any rules, you MUST:
1. **Thoroughly analyze each model's capabilities** - Cross-reference model capabilities with the provided capability tags and their required models list
2. **Identify capability overlaps and gaps** - Determine which models excel at which tasks based on the provided data
3. **Consider vendor diversity** - Avoid over-reliance on a single vendor when multiple options exist
4. **Evaluate cost-performance tradeoffs** - Balance capability requirements with efficient resource usage
5. **Review scenario patterns carefully** - Match common user scenarios to the most appropriate models

## Analysis Process
Step 1: Parse and index all available models with their full capability profiles
Step 2: Map each capability tag to its best-matched models (considering requiredModels priority)
Step 3: Analyze composite scenarios and determine optimal model assignments
Step 4: Identify the primary/default model and build fallback chains
Step 5: Generate routing rules with clear reasoning chains

## Output Format
You MUST respond with valid JSON matching this schema:
{
  "rules": [
    {
      "name": "string - rule name (e.g., 'Translation', 'Code Generation')",
      "description": "string - brief description",
      "pattern": "string - pipe-separated keywords or regex pattern",
      "matchType": "keyword | regex | intent",
      "targetModel": "string - model ID to route to",
      "targetProviderKeyId": "string - UUID of provider key",
      "confidence": "number 0-100",
      "reasoning": "string - why this model was selected"
    }
  ],
  "defaultModel": "string - model ID for unmatched requests",
  "defaultProviderKeyId": "string - UUID of default provider",
  "analysis": "string - overall analysis summary"
}

## Guidelines
1. Prioritize models with higher capability scores for each task type
2. Consider cost-effectiveness for general tasks
3. Use premium models only for complex tasks requiring their capabilities
4. Generate patterns that are specific enough to avoid false matches
5. Set confidence based on how well the model matches the task requirements
6. Always prefer the primary model for ambiguous cases
7. Each rule should target exactly one model
8. Include both Chinese and English keywords for international support
9. **Provide detailed reasoning** explaining the analysis process for each rule`;
  }

  private buildUserPrompt(
    models: LLMModelInfo[],
    capabilityTags: LLMCapabilityTag[],
    compositeScenarios: LLMCompositeScenario[],
    customInstructions?: string,
  ): string {
    const modelDescriptions = models
      .map((m) => {
        const caps = m.capabilities.join(', ') || 'none';
        const primary = m.isPrimary ? ' [PRIMARY]' : '';
        const health =
          m.healthScore !== undefined ? `, health=${m.healthScore}` : '';
        return `- ${m.modelId}${primary}: vendor=${m.vendor}, capabilities=[${caps}]${health}, providerKeyId=${m.providerKeyId}`;
      })
      .join('\n');

    const tagDescriptions = capabilityTags
      .filter(
        (t) => !['premium', 'general-purpose', 'embedding'].includes(t.tagId),
      )
      .map((t) => {
        const reqModels = t.requiredModels?.slice(0, 3).join(', ') ?? 'any';
        const desc = t.description ? ` - ${t.description}` : '';
        return `- ${t.name} (${t.tagId}): priority=${t.priority}, preferred=[${reqModels}]${desc}`;
      })
      .join('\n');

    const scenarioPatterns = compositeScenarios
      .map((s) => {
        const patterns = s.patterns.slice(0, 5).join(', ');
        const desc = s.description ? ` - ${s.description}` : '';
        return `- ${s.name}: patterns=[${patterns}]${desc}`;
      })
      .join('\n');

    return `## Available Models
${modelDescriptions}

## Capability Tags
${tagDescriptions}

## Common Scenarios
${scenarioPatterns}

## Custom Instructions
${customInstructions || 'None'}

## Task
Generate optimal routing rules for the available models.

**IMPORTANT: Follow this analysis process before generating rules:**

1. **Model Capability Analysis**: For each model, identify which capability tags it satisfies (either by being in requiredModels or having the capability)

2. **Best Match Determination**: For each capability tag, determine the best model based on:
   - Priority in requiredModels list (earlier = better)
   - Vendor diversity considerations
   - Health scores if available

3. **Scenario Mapping**: Match each composite scenario to the most appropriate model

4. **Rule Generation**: Create routing rules with:
   - Clear patterns that capture user intent
   - Appropriate confidence levels (80-95 for strong matches, 60-79 for moderate)
   - Detailed reasoning explaining the analysis

5. **Default Selection**: The PRIMARY model should be the default for unmatched requests

Provide your analysis in the "analysis" field with a summary of your decision-making process.`;
  }

  private handleError(operation: string, error: AxiosError): never {
    const statusCode = error.response?.status;
    const errorMessage = this.extractErrorMessage(error);

    this.logger.error(`[RoutingLLM] API error in ${operation}`, {
      statusCode,
      errorMessage,
    });

    if (statusCode === 401) {
      throw new Error('LLM API authentication failed');
    } else if (statusCode === 429) {
      throw new Error('LLM API rate limit exceeded');
    } else if (statusCode === 503) {
      throw new Error('LLM service unavailable');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to LLM server: ${this.baseUrl}`);
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`LLM request timeout: ${operation}`);
    } else {
      throw new Error(`LLM API error: ${errorMessage}`);
    }
  }

  private extractErrorMessage(error: AxiosError): string {
    if (error.response?.data) {
      const data = error.response.data as any;
      return (
        data.error?.message || data.message || data.error || 'Unknown error'
      );
    }
    return error.message || 'Unknown error';
  }
}
