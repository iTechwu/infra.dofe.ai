import { ControllerOptions } from '@nestjs/common';
/**
 * TsRestController 装饰器 - 版本中立控制器
 *
 * **仅用于不需要版本控制的特殊端点**，如版本检查 API。
 * 设置 VERSION_NEUTRAL 让请求无需 x-api-version header 即可访问。
 *
 * **适用场景**:
 * - 版本检查 API (/api/version)
 * - 健康检查端点
 * - 其他需要无版本访问的公共端点
 *
 * **注意**: 普通 API 控制器应使用 `@Controller({ version: API_VERSION.V1 })`
 *
 * 支持多种用法：
 *
 * 1. 无参数:
 *    ```typescript
 *    @TsRestController()
 *    export class AppVersionController { }
 *    ```
 *
 * 2. 带路径前缀:
 *    ```typescript
 *    @TsRestController('version')
 *    export class AppVersionController { }
 *    ```
 *
 * 3. 带配置选项:
 *    ```typescript
 *    @TsRestController({ path: 'health' })
 *    export class HealthController { }
 *    ```
 */
export declare function TsRestController(): ClassDecorator;
export declare function TsRestController(prefix: string | string[]): ClassDecorator;
export declare function TsRestController(options: Omit<ControllerOptions, 'version'>): ClassDecorator;
