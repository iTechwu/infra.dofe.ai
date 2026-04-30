/**
 * ts-rest Utilities Export
 * ts-rest 工具导出
 *
 * 提供标准化的响应辅助函数：
 *
 * 成功响应：
 * - success(data) - 成功响应 (200)
 * - created(data) - 创建成功响应 (201)
 * - deleted() - 删除成功响应 (200)
 * - deletedWithData(data) - 删除成功并返回数据 (200)
 * - paginated(list, total, page, limit) - 分页响应 (200)
 *
 * 错误响应（ts-rest）：
 * - error(errorCode, errorData?) - 从错误码创建错误响应
 * - errorResponse(errorCode, errorData?) - error() 的别名，语义更清晰
 * - notFound(errorData?) - 404 响应
 * - badRequest(errorData?) - 400 响应
 * - unauthorized(errorData?) - 401 响应
 * - forbidden(errorData?) - 403 响应
 * - conflict(errorData?) - 409 响应
 * - internalError(errorData?) - 500 响应
 * - errorFromType(type, code, status, data?) - 从错误类型创建响应
 * - errorSimple(code, msg, status?) - 简单错误响应
 *
 * 普通 NestJS 控制器（不使用 ts-rest）：
 * - successBody(data) - 成功响应体
 * - paginatedBody(list, total, page, limit) - 分页响应体
 * - deletedBody() - 删除成功响应体
 * - errorBody(errorCode, errorData?) - 错误响应体
 *
 * 工具函数：
 * - serializeDates(obj) - 递归转换 Date 为 ISO 字符串
 */

export {
  // 成功响应
  success,
  created,
  deleted,
  deletedWithData,
  paginated,
  // 错误响应
  error,
  errorResponse,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  internalError,
  errorFromType,
  errorSimple,
  // 工具函数
  fetchOrNull,
  // 普通 NestJS 控制器
  successBody,
  paginatedBody,
  deletedBody,
  errorBody,
  // 工具函数
  serializeDates,
  // 类型
  type TsRestResponse,
  type TsRestSuccessResponse,
  type SuccessBody,
  type ErrorBody,
} from './response.helper';
