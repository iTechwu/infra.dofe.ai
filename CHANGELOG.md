# Changelog

## [0.1.0] - 2026-04-26

### Added
- 从 scaffold.dofe.ai 的 `libs/infra/` 抽取为独立仓库
- 10 个子包：utils, i18n, jwt, common, prisma, redis, rabbitmq, shared-db, clients, shared-services
- 所有内部 import 从 `@/` / `@app/` 别名改为 `@dofe/infra-*` 包引用
- `common/src/index.ts` 完整导出所有模块（~30+ 子目录）
- `peerDependencies` 策略：NestJS、Prisma 等由消费项目提供
- `@repo/*` 外部依赖声明为 `peerDependencies`
