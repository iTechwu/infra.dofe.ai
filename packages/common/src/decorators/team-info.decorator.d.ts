/**
 * Team Info Decorator
 * 团队信息装饰器 - 从请求上下文提取团队信息
 *
 * 使用方式：
 * ```typescript
 * @TsRestHandler(c.getTeamStatistics)
 * async getTeamStatistics(@TeamInfo() teamInfo: TeamContext) {
 *   // teamInfo 自动注入
 *   const result = await this.teamDomainService.getTeamStatistics(teamInfo.teamId, teamInfo.userId);
 *   return success(result);
 * }
 * ```
 */
import { FastifyRequest } from 'fastify';
/**
 * Team context extracted from request
 */
export interface TeamContext {
    /** Team ID (from API Key or user session) */
    teamId: string;
    /** User ID (from JWT or API Key) */
    userId: string;
    /** User's role in the team (if available) */
    role?: 'owner' | 'admin' | 'member';
    /** API Key ID (if using API Key authentication) */
    userApiKeyId?: string;
}
/**
 * @TeamInfo() decorator - 从请求上下文提取团队信息
 *
 * 自动从以下来源提取：
 * 1. API Gateway: API Key 验证后的 request.teamId
 * 2. Web App: JWT payload 或 request.teamId
 *
 * @example
 * // 在控制器方法中使用
 * async getTeamStats(@TeamInfo() teamInfo: TeamContext) {
 *   console.log(teamInfo.teamId, teamInfo.userId);
 * }
 */
export declare const TeamInfo: (...dataOrPipes: unknown[]) => ParameterDecorator;
/**
 * Get team ID from request context
 * 从请求上下文获取团队ID的辅助函数
 *
 * @param request - Fastify request object
 * @returns Team ID string
 */
export declare function getTeamId(request: FastifyRequest): string;
/**
 * Get team context from request
 * 从请求获取完整团队上下文的辅助函数
 *
 * @param request - Fastify request object
 * @returns TeamContext object
 */
export declare function getTeamContext(request: FastifyRequest): TeamContext;
