"use strict";
/**
 * Contract Adapters
 *
 * 用于在不同 Contract 版本间转换数据格式
 * 使旧版本 APP 能够继续使用最新的后端 API
 *
 * 使用方式:
 * 1. 为新 Contract 创建目录: adapters/contract-YYYY-MM/
 * 2. 实现特定模型的 Adapter
 * 3. 在 Service 中通过 AdapterFactory 获取对应 Adapter
 *
 * @example
 * ```typescript
 * // 在 Service 中使用
 * @Injectable()
 * class UserService {
 *   constructor(private readonly userAdapterFactory: UserAdapterFactory) {}
 *
 *   async getUser(userId: string, versionContext: VersionContext) {
 *     const user = await this.findUser(userId);
 *
 *     // Web 客户端直接返回最新格式
 *     if (versionContext.platform === 'web') {
 *       return user;
 *     }
 *
 *     // APP 客户端通过 Adapter 转换
 *     const adapter = this.userAdapterFactory.getAdapter(versionContext.contract);
 *     return adapter?.toResponse(user) ?? user;
 *   }
 * }
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./base.adapter"), exports);
// 未来添加更多 Adapter 时在此导出
// export * from './user.adapter';
//# sourceMappingURL=index.js.map