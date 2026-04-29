import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class TenantRedisService {
  constructor(private readonly redis: RedisService) {}

  async get(tenantId: string, key: string): Promise<any> {
    return this.redis.get(key);
  }

  async set(
    tenantId: string,
    key: string,
    value: string,
    ttl?: number,
  ): Promise<void> {
    await this.redis.set(key, value, ttl ? { EX: ttl } : undefined);
  }

  async del(tenantId: string, key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(tenantId: string, key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async expire(tenantId: string, key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds);
  }

  async getAgentSession(
    tenantId: string,
    conversationId: string,
  ): Promise<any | null> {
    const key = `agent:session:${conversationId}`;
    return this.get(tenantId, key);
  }

  async setAgentSession(
    tenantId: string,
    conversationId: string,
    session: any,
    ttl: number = 3600,
  ): Promise<void> {
    const key = `agent:session:${conversationId}`;
    await this.set(tenantId, key, JSON.stringify(session), ttl);
  }

  async deleteAgentSession(
    tenantId: string,
    conversationId: string,
  ): Promise<void> {
    const key = `agent:session:${conversationId}`;
    await this.del(tenantId, key);
  }

  async getAgentContext(tenantId: string, botId: string): Promise<any | null> {
    const key = `agent:context:${botId}`;
    return this.get(tenantId, key);
  }

  async setAgentContext(
    tenantId: string,
    botId: string,
    context: any,
    ttl: number = 7200,
  ): Promise<void> {
    const key = `agent:context:${botId}`;
    await this.set(tenantId, key, JSON.stringify(context), ttl);
  }
}
