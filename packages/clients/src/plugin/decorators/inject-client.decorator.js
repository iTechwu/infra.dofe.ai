"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_TOKEN_PREFIX = void 0;
exports.getClientToken = getClientToken;
exports.InjectClient = InjectClient;
exports.Client = Client;
exports.getClientName = getClientName;
/**
 * Client Injection Decorators
 *
 * 用于简化客户端注入的装饰器
 */
const common_1 = require("@nestjs/common");
/**
 * 客户端注入令牌前缀
 */
exports.CLIENT_TOKEN_PREFIX = 'CLIENT_';
/**
 * 创建客户端注入令牌
 * @param clientName 客户端名称
 */
function getClientToken(clientName) {
    return `${exports.CLIENT_TOKEN_PREFIX}${clientName.toUpperCase()}`;
}
/**
 * 注入客户端装饰器
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *     constructor(
 *         @InjectClient('sms') private readonly smsClient: SmsClient,
 *     ) {}
 * }
 * ```
 */
function InjectClient(clientName) {
    return (0, common_1.Inject)(getClientToken(clientName));
}
/**
 * 标记为客户端类的装饰器
 *
 * @example
 * ```typescript
 * @Client('sms-aliyun')
 * export class SmsAliyunClient {
 *     // ...
 * }
 * ```
 */
function Client(name) {
    return (target) => {
        Reflect.defineMetadata('client:name', name, target);
    };
}
/**
 * 获取客户端名称
 */
function getClientName(target) {
    return Reflect.getMetadata('client:name', target);
}
//# sourceMappingURL=inject-client.decorator.js.map