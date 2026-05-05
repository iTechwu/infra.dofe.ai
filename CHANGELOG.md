## [0.1.33] - 2026-05-06
- feat: 更新多个包的依赖版本至0.1.32，增强模块兼容性

## [0.1.32] - 2026-05-06

## [0.1.31] - 2026-05-06
- feat: 添加多个装饰器的导出，增强模块功能
- feat: 更新多个依赖项版本至0.1.30，确保一致性和兼容性

## [0.1.30] - 2026-05-06
- feat: 更新依赖项版本至0.1.29，确保一致性和兼容性

## [0.1.29] - 2026-05-06
- feat: 更新依赖项版本至0.1.28，确保一致性和兼容性

## [0.1.28] - 2026-05-06
- feat: 更新依赖项版本至0.1.26，确保一致性和兼容性
- Refactor code structure for improved readability and maintainability

## [0.1.26] - 2026-05-06
- feat: 更新各包的依赖项，使用具体版本替代工作区引用
- chore: 注释掉 npm 注册表配置
- Refactor code structure for improved readability and maintainability

## [0.1.25] - 2026-05-05

## [0.1.24] - 2026-05-05
- feat: 更新各包的 exports 字段，使用工作区引用替代具体版本
- feat: 更新各包的依赖项，升级到版本 0.1.22
- chore: bump package versions to 0.1.23 and update exports

## [0.1.22] - 2026-05-05
- feat: 更新各包的 exports 字段，支持多个默认导出配置
- feat: 更新各包的依赖项，使用具体版本替代工作区引用

## [0.1.21] - 2026-05-05
- feat: 更新 package.json 中的 exports 字段，支持多个默认导出配置；优化 utils/index.ts 中的导出方式

## [0.1.20] - 2026-05-05
- feat: 更新各包的 exports 字段，优化类型声明和默认导出配置
- feat: 更新 exports 字段，支持通配符类型和默认导出配置
- feat: 优化各包的 exports 字段，简化类型和默认导出配置
- feat: 更新各包的 exports 字段，支持目录索引解析并优化依赖声明

## [0.1.19] - 2026-05-05
- feat: add stub type declarations for dockerode, prisma-client, and missing third-party modules

## [0.1.18] - 2026-05-05
- feat: 添加缺失模块的声明文件，包括 form-data、@alicloud/dysmsapi20170525、@alicloud/openapi-client、tencentcloud-sdk-nodejs-sms、music-metadata、@nestjs/swagger、@nestjs/jwt、unleash-client 和 uuid
- feat: add Volcengine TTS service with DTOs and client implementation

## [0.1.17] - 2026-05-05
- feat: 添加对 file-cdn 模块的导出

## [0.1.16] - 2026-05-05
- feat: refactor guards to use DI tokens for services and update imports
- chore: 更新所有依赖项版本为 ^0.1.14

## [0.1.14] - 2026-05-05
- chore: 更新所有依赖项版本为 ^0.1.14

## [0.1.13] - 2026-05-05
- refactor: 更新 generateEnvironmentUrls 函数以支持选项参数，简化域名处理逻辑
- refactor: 更新导入路径以优化模块结构

## [0.1.12] - 2026-05-05
- refactor: 优化 generateEnvironmentUrls 函数，简化域名处理逻辑

## [0.1.11] - 2026-05-04
- chore: add ignoreDeprecations option to tsconfig.build-all.json

## [0.1.10] - 2026-05-03
- refactor: 更新导入路径以使用具体模块而非通用路径

## [0.1.9] - 2026-05-03
- refactor: 更新导入路径以使用具体模块而非通用路径

## [0.1.8] - 2026-05-02
- feat: add AgentX file client for file uploads and task management

## [0.1.7] - 2026-05-02
- feat(ip-info): 添加 IP 信息客户端模块及相关 DTO

## [0.1.6] - 2026-05-02
- feat(prisma): 添加 Prisma 配置模式和软删除中间件支持

## [0.1.5] - 2026-05-01

## [0.1.4] - 2026-05-01

## [0.1.3] - 2026-05-01
- fix(shared-services): 修复循环自引用导入，改用相对路径导入同级模块

## [0.1.2] - 2026-05-01
- feat(prisma): 添加 Prisma 适配器和客户端的类型声明文件
- feat(notification): implement notification module and service
- feat: 添加发布所有基础设施包的脚本
- feat: 添加 @dofe/infra-docker 依赖并更新相关配置；调整多个包的发布配置和类型
- feat: add core types and utility for sensitive data masking
- fix: 修复类型推断和参数转换问题
- fix: infra build 脚本改为 no-op（源码直引模式）
- fix: 源码直引模式 - package.json main/types 指向 src/
- fix: resolve self-imports, complete barrel exports, add docs
- fix: use correct ts-rest rc version range
- fix: use workspace:* for @repo/* peerDependencies
- refactor: 更新依赖项导入方式，统一使用命名导入格式；更新 tsconfig.json 以支持新的路径映射
- refactor: update import paths to use new infra packages
- refactor: remove prisma-error utility and integrate its functionality into common utils
- chore: 移除不再使用的模型目录数据文件
- chore: clean up empty code change sections in the changes log
- chore: bump all packages to 0.1.1
- Add TypeScript declaration maps for validation and exception handling
- 更新 db-metrics 的 package.json，修正主入口和类型定义路径；在 redis 中添加 redis-version-check 模块以验证 Redis 版本；新增 db-metrics 的索引文件以导出 src 内容。
- 移除不必要的依赖项：从 package.json 中删除 @dofe/infra-shared-services 和 @dofe/infra-clients
- 删除 data-visibility 装饰器并更新环境工具的导出方式
- Enhance type safety in HttpExceptionFilter and AuthService interface
- Fix type assertion in AuthGuard for WeChat Mini Program detection
- Implement fileDownloader method in FileQiniuClient and enhance error handling in FileS3Client
- Refactor S3 File Storage Client for improved code organization and readability
- Refactor client implementations for improved readability and error handling
- Refactor client implementations and enhance type safety across various modules
- Refactor logging in DbMetricsService and BucketResolver for improved clarity
- Enhance module dependencies and update TypeScript configurations for improved maintainability
- Remove data visibility decorators and related index file to streamline the codebase. This cleanup enhances maintainability by eliminating unused components and ensuring a more focused module structure.
- Refactor client and service exports for enhanced clarity and maintainability
- Remove deprecated CommonModule and EncryptionService along with related exports to streamline the codebase. This cleanup enhances maintainability by eliminating unused components and ensuring a more focused module structure.
- Refactor shared services and client exports for improved clarity and consistency
- Refactor Docker services and enhance TypeScript configuration for improved functionality
- Enhance Docker and Utils module exports, and improve VikingDbClientService configuration handling
- Update TypeScript configuration and refactor client exports for improved clarity
- Update TypeScript configuration and enhance DTOs for backward compatibility
- Refactor Prisma and Redis services to enhance logging and configuration handling
- Enhance module exports and update utility functions for improved functionality
- Rename ExchangeRateModule to ExchangeRateClientModule for clarity and consistency in module naming.
- Enhance README and module exports for improved functionality and clarity
- Update README and client exports for enhanced documentation and functionality
- Refactor IP Info and Volcengine TTS clients to enhance configuration handling
- Refactor PrismaRead and PrismaWrite services to use connection configuration objects
- Enhance module imports by adding Reflector to multiple decorators
- Refactor import paths for consistency and clarity
- Refactor Crypt and IP Info clients to use updated configuration handling
- Refactor Prisma client imports and clean up RabbitMQ module exports
- Refactor environment variable imports and update tsconfig paths
- Remove @dofe/infra-clients dep from utils (breaks cycle), clean dead deps
- Clean up build artifacts and switch to source-referencing mode
- Update package configurations and add Zod dependency
- Clean up duplicate util files and fix index exports
- Fix source-referencing mode for scaffold.dofe.ai webpack build
- Add ai-provider and exchange-rate clients, fix jwt module import

# Changelog

## [0.1.0] - 2026-04-26

### Added
- 从 scaffold.dofe.ai 的 `libs/infra/` 抽取为独立仓库
- 10 个子包：utils, i18n, jwt, common, prisma, redis, rabbitmq, shared-db, clients, shared-services
- 所有内部 import 从 `@/` / `@app/` 别名改为 `@dofe/infra-*` 包引用
- `common/src/index.ts` 完整导出所有模块（~30+ 子目录）
- `peerDependencies` 策略：NestJS、Prisma 等由消费项目提供
- `@repo/*` 外部依赖声明为 `peerDependencies`
