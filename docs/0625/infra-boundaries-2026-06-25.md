# infra.dofe.ai 包边界定义

> 创建日期：2026-06-25
> 目的：固化各包职责边界，防止能力继续无节制膨胀

## 原则

1. **每个包只做一件事，并把这件事做好。**
2. **新能力进入前，先说清楚它属于哪一层。**
3. **边界不清比代码烂更危险——烂代码只影响一个文件，边界不清会放大。**

---

## 包分层

```text
Layer 0: 无依赖叶包
  infra-contracts-base, infra-contracts, infra-i18n, infra-config,
  infra-module-registry, infra-prisma-crud-generator, sso-browser

Layer 1: 纯工具 / 跨项目通用运行时
  infra-utils          — 纯函数工具，无 NestJS 依赖
  infra-jwt            — JWT/JWKS 认证
  infra-docker         — Docker 管理
  infra-vector         — 向量存储

Layer 2: 基础设施适配层
  infra-common         — 跨项目通用 NestJS 能力（装饰器、守卫、拦截器、管道、过滤器）
  infra-redis          — Redis 缓存/分布式锁
  infra-prisma         — Prisma ORM 读写分离/指标
  infra-rabbitmq       — RabbitMQ 事件总线
  infra-shared-db      — 事务管理/UoW

Layer 3: 客户端层（纯第三方 SDK 封装）
  infra-clients        — 第三方服务客户端（AI、SMS、SSO、文件存储等）

Layer 4: 聚合服务层
  infra-shared-services — 依赖多个下层包的业务复合服务
  infra-web-runtime    — 浏览器运行时
```

---

## 各包边界规则

### `@dofe/infra-common`

**可以是：**
- NestJS 装饰器（`@Cacheable`、`@Transactional`、`@AuditLog` 等）
- 守卫（auth、permission、tenant-context、version）
- 拦截器（transform、audit、rate-limit）
- 过滤器（exception、api-exception、http-exception）
- 管道、中间件
- 通用配置服务（env、YAML、keys）
- ts-rest 类型安全路由
- 通用类型定义

**不能是：**
- 强领域化的业务逻辑（如：特定产品的计费规则）
- 第三方 SDK 的封装（应在 `clients`）
- 数据库 Schema 相关工具（应在 `prisma`）
- 消息队列逻辑（应在 `rabbitmq`）

**已知待治理项：**
- `common/src/utils/prisma-error.util.ts` — Prisma 特定工具，逻辑上属于 `@dofe/infra-prisma`。标记为待迁移，保留兼容导出。
- `common/src/enums/error-codes.ts` — 是 `@dofe/infra-contracts` 的桥接文件。标记为 `@deprecated`，计划迁移。

---

### `@dofe/infra-shared-services`

**可以是：**
- 依赖多个 infra 包（prisma + redis + rabbitmq）的复合服务
- 业务能力编排（如：文件上传 + CDN + 转码的完整流程）
- 需要状态管理的服务链路

**不能是：**
- 纯第三方 SDK 封装（应在 `clients`）
- 与具体产品强绑定的业务逻辑
- 可以独立作为客户端使用的原子能力

**已知待治理项：**
- `shared-services/src/agentx/` — 已改为兼容 re-export，canonical 实现位于 `@dofe/infra-clients/agentx`。
- `shared-services/src/transcode/` — 转码层与 `clients` 中的转码客户端有重叠，需要明确：clients 负责原子 SDK 调用，shared-services 负责编排。

---

### `@dofe/infra-clients`

**可以是：**
- 第三方服务 SDK 的封装（AgentX、MLflow、OpenClaw、SMS、文件存储等）
- 纯 HTTP/API 客户端
- 客户端配置和工厂

**不能是：**
- 服务编排逻辑（应在 `shared-services`）
- NestJS 模块级能力（应在 `common`）
- 数据库操作（应在 `prisma`）

**设计约束：**
- `clients/src/internal/` 前缀在源码中保留，但在 exports 中剥离（由 `generate-exports.mjs` 处理）
- 每个客户端应该是独立的，不依赖其他客户端

---

### `@dofe/infra-utils`

**职责：** 纯函数工具，零 NestJS 依赖。可被任何包安全依赖。

**可以是：** 字符串/数组/对象/JSON 操作，加密/哈希，文件系统，HTTP 客户端封装，环境变量读取，分页工具

**不能是：** NestJS 装饰器/模块，数据库操作，需要 DI 注入的服务

---

### `@dofe/infra-contracts` / `@dofe/infra-contracts-base`

**职责：** 跨项目共享的类型定义、DTO、错误码、ts-rest contracts。

**可以是：** Zod/ts-rest schema，错误码枚举，共享 DTO 类型，API contract 定义

**不能是：** 运行时实现，NestJS 模块，数据库 schema

---

### `@dofe/infra-prisma`

**职责：** Prisma ORM 封装（读写分离、连接管理、指标、中间件）。

**可以是：** PrismaService/PrismaReadService/PrismaWriteService，soft-delete 中间件，tenant-isolation，Prometheus 指标

**不能是：** 非 Prisma 的数据库操作，业务查询逻辑，第三方 API 调用

---

### `@dofe/infra-redis`

**职责：** Redis 缓存、分布式锁、租户级缓存隔离。

**可以是：** CacheService，RedisLockService，TenantRedisService，pipeline 操作，版本检查与 bootstrap 验证

**不能是：** 数据库 ORM 操作，业务数据序列化逻辑

---

### `@dofe/infra-rabbitmq`

**职责：** RabbitMQ 消息队列封装。

**可以是：** RabbitmqModule，RabbitmqEventsModule，消息发布/订阅

**不能是：** 业务消息处理逻辑，非 RabbitMQ 的消息系统

---

### `@dofe/infra-shared-db`

**职责：** 事务管理、UnitOfWork、AsyncLocalStorage 上下文传递。

**可以是：** TransactionalServiceBase，@Transactional 装饰器，事务传播

**不能是：** 具体数据库操作，ORM 封装（应在 prisma）

---

### `@dofe/infra-jwt`

**职责：** JWT 签发/校验、JWKS 客户端。

**可以是：** JwtModule，JwksClient，token 生成/验证

**不能是：** 用户认证业务逻辑，权限判定

---

### `@dofe/infra-docker`

**职责：** Docker 容器管理。

**可以是：** DockerService（创建/启动/停止容器），端口分配，孤儿清理，带观察期的孤儿清理策略

**不能是：** 业务容器编排，CI/CD pipeline 逻辑

**已知实现状态：**
- `packages/docker/src/docker-orphan-cleaner.service.ts` 已实现 `gracePeriodMs`，采用“首次发现后进入观察期”的清理策略。

---

### `@dofe/infra-vector`

**职责：** 向量数据库客户端。

**可以是：** VikingDB 客户端，Embedding 服务，知识库管理

**不能是：** 业务 RAG 逻辑，业务知识库组织

---

### `@dofe/infra-i18n`

**职责：** 国际化 JSON 资源文件。

**可以是：** en/zh-CN locale JSON，类型安全的 key 定义

**不能是：** 运行时翻译逻辑（应在 common）

---

### `@dofe/infra-config`

**职责：** 共享的 ESLint/Prettier/TypeScript/PostCSS/Tailwind 配置。

**可以是：** 所有 `packages/config/` 下的配置文件

**不能是：** 运行时代码（无 `src/` 目录，不编译）

---

### `@dofe/infra-module-registry`

**职责：** 动态模块注册与依赖解析。

**可以是：** @RegisterModule 装饰器，自动扫描，动态特性模块

**不能是：** 业务模块定义

---

### `@dofe/infra-prisma-crud-generator`

**职责：** Prisma schema → CRUD 代码生成 CLI 工具。

**可以是：** 代码生成逻辑，CLI 入口，模板引擎

**不能是：** 运行时 ORM 操作（应在 prisma），NestJS 模块

---

### `@dofe/sso-browser`

**职责：** 浏览器端 SSO 认证工具。

**可以是：** 浏览器 OAuth/OIDC 流程，token 管理

**不能是：** 服务端认证逻辑（应在 jwt）

---

### `@dofe/infra-web-runtime`

**职责：** 浏览器运行时能力。

**可以是：** fetch 封装，重连逻辑，版本检测，CN 环境适配

**不能是：** React 组件，业务状态管理

---

## 新能力归属检查清单

当有新功能需要加入 infra 时，按以下清单判断归属：

1. **是否只做纯计算/转换，无外部依赖？** → `utils`
2. **是否是 NestJS 的横切关注点（AOP）？** → `common`
3. **是否是第三方 API/SDK 的封装？** → `clients`
4. **是否涉及数据持久化？** → `prisma` / `shared-db`
5. **是否依赖多个 infra 包做编排？** → `shared-services`
6. **是否与具体产品/业务强相关？** → **不应进入 infra，应放在产品仓库**

---

## 执行规则

1. **新增文件前，先确认包边界符合本文档。**
2. **发现边界违规时，先标记（`@boundary-violation`），再计划迁移。**
3. **不要在 `common` 中新增领域特定代码。**
4. **不要在 `shared-services` 中新增原子客户端封装。**
5. **所有 `@deprecated` 的桥接文件需标注迁移截止日期。**
