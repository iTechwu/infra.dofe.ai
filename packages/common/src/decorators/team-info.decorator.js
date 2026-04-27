"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamInfo = void 0;
exports.getTeamId = getTeamId;
exports.getTeamContext = getTeamContext;
const common_1 = require("@nestjs/common");
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
exports.TeamInfo = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    // 优先从 API Key 验证结果获取（Gateway 场景）
    const teamId = request.teamId;
    const userId = request.userId;
    const userApiKeyId = request.userApiKeyId;
    // 如果没有 teamId，尝试从 userInfo 获取
    const userInfo = request.userInfo;
    const resolvedUserId = userId || userInfo?.id;
    if (!resolvedUserId) {
        throw new common_1.UnauthorizedException('User not authenticated');
    }
    // 如果没有 teamId，使用 userId 作为 fallback（用户默认团队）
    const resolvedTeamId = teamId || resolvedUserId;
    return {
        teamId: resolvedTeamId,
        userId: resolvedUserId,
        userApiKeyId,
        role: request.teamRole,
    };
});
/**
 * Get team ID from request context
 * 从请求上下文获取团队ID的辅助函数
 *
 * @param request - Fastify request object
 * @returns Team ID string
 */
function getTeamId(request) {
    // 优先使用 teamId（API Key 或 session 设置）
    const teamId = request.teamId;
    if (teamId)
        return teamId;
    // Fallback to userId（默认团队）
    const userId = request.userId || request.userInfo?.id;
    if (!userId) {
        throw new Error('getTeamId: neither teamId nor userId found in request');
    }
    return userId;
}
/**
 * Get team context from request
 * 从请求获取完整团队上下文的辅助函数
 *
 * @param request - Fastify request object
 * @returns TeamContext object
 */
function getTeamContext(request) {
    const teamId = request.teamId;
    const userId = request.userId || request.userInfo?.id;
    const userApiKeyId = request.userApiKeyId;
    if (!userId) {
        throw new Error('getTeamContext: userId not found in request');
    }
    return {
        teamId: teamId || userId, // Fallback to userId for default team
        userId,
        userApiKeyId,
        role: request.teamRole,
    };
}
//# sourceMappingURL=team-info.decorator.js.map