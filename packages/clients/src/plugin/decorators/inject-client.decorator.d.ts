/**
 * 客户端注入令牌前缀
 */
export declare const CLIENT_TOKEN_PREFIX = "CLIENT_";
/**
 * 创建客户端注入令牌
 * @param clientName 客户端名称
 */
export declare function getClientToken(clientName: string): string;
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
export declare function InjectClient(clientName: string): ParameterDecorator;
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
export declare function Client(name: string): ClassDecorator;
/**
 * 获取客户端名称
 */
export declare function getClientName(target: Function): string | undefined;
