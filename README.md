# dofe-infra

DofeAI 共享基础设施库。跨项目复用的 NestJS 基础设施层。

## 包结构

| 包 | 说明 |
|---|---|
| `@dofe/infra-utils` | 纯工具函数（crypto, string, array, bcrypt 等） |
| `@dofe/infra-i18n` | 国际化 JSON 资源（en, zh-CN） |
| `@dofe/infra-jwt` | JWT 签发/校验模块 |
| `@dofe/infra-common` | 装饰器、拦截器、配置、过滤器、守卫、管道、ts-rest |
| `@dofe/infra-prisma` | 数据库连接、读写分离、db-metrics、soft-delete |
| `@dofe/infra-redis` | Redis 缓存客户端 |
| `@dofe/infra-rabbitmq` | 消息队列 |
| `@dofe/infra-shared-db` | TransactionalServiceBase、UnitOfWork、事务管理 |
| `@dofe/infra-clients` | 第三方 API 客户端（SMS, Email, OCR, OSS, TTS 等） |
| `@dofe/infra-shared-services` | 通用业务服务（email, sms, file-storage, notification 等） |

## 依赖方向

```
项目 (src/modules/)  →  domain (libs/domain/)  →  @dofe/infra-*

infra 内部：
  utils, i18n, jwt        ← 无 infra 依赖
  common                  ← utils, i18n, redis (peer)
  prisma                  ← common, utils
  redis                   ← common
  rabbitmq                ← common
  shared-db               ← common, prisma
  clients                 ← common, utils, shared-services (peer)
  shared-services         ← clients, common, prisma, redis, utils

禁止：@dofe/infra-* → domain / 项目代码
```

## 消费方式

### 开发模式（推荐）

在项目 `pnpm-workspace.yaml` 中添加本地路径引用：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - '../infra.dofe.ai/packages/*'
```

然后在 `apps/api/package.json` 中：

```json
{
  "dependencies": {
    "@dofe/infra-common": "workspace:*",
    "@dofe/infra-clients": "workspace:*"
  }
}
```

pnpm 会创建 symlink，修改 infra 源码后 `nest --watch` 自动热重载。

### 生产/CI 模式

锁定 Git tag 版本：

```json
{
  "dependencies": {
    "@dofe/infra-common": "github:iTechwu/infra.dofe.ai#v0.1.0"
  }
}
```

## 版本规则

- 遵循 [Semantic Versioning](https://semver.org/)
- 每次 PR 合并到 main 后手动打 tag
- breaking change 必须更新 CHANGELOG 并通知所有项目组

## 准入标准

**可以** 放入 dofe-infra：
- 与具体业务无关的通用基础设施
- 第三方服务客户端（SMS、Email、OSS 等）
- 装饰器、拦截器、过滤器、守卫、管道
- 纯工具函数、通用配置

**不可以** 放入 dofe-infra：
- 与 Dofe 产品强相关的业务逻辑
- 特定业务实体的 DB Service
- 项目特有的配置
