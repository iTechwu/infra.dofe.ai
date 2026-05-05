# infra.dofe.ai 包架构重设计方案

> 日期：2026-05-05
> 目标：消除 `@dofe/infra-clients ↔ @dofe/infra-shared-services` 循环依赖，消费者可直接使用 `@dofe/infra-clients/sms` 形式引入子模块，无需 `/dist/xxx` 路径。

---

## 1. 问题分析

### 1.1 现状

当前 14 个 `@dofe/infra-*` 包中，唯一存在的循环依赖：

```
@dofe/infra-clients ←→ @dofe/infra-shared-services
```

**22 个源文件**参与循环（clients 侧 8 个，shared-services 侧 14 个）。

### 1.2 循环链路

```
shared-services barrel (index.js)
  → require("./file-cdn/file-cdn.module")
    → require("@dofe/infra-clients")        ← barrel 入口
      → require("./internal/openspeech")
        → require("@dofe/infra-shared-services")  ← 回到起点，循环！
```

Node.js `require()` 遇到循环时，**尚未执行完成的模块导出 `undefined`**。NestJS 的 `DependenciesScanner` 发现 provider 为 `undefined`，抛出 `CircularDependencyException`。

### 1.3 根本原因

`@dofe/infra-clients` 的定位是「纯 HTTP 客户端集合」，但其中 3 个子系统（openspeech、volcengine-tts、transcode）依赖了 `@dofe/infra-shared-services` 的 `FileStorageService`：

| clients 子系统 | 从 shared-services 导入的内容 |
|---|---|
| `openspeech` | `FileStorageService`, `FileStorageServiceModule` |
| `volcengine-tts` | `FileStorageService`, `FileStorageServiceModule` |
| `transcode/volcengine-tos` | `FileStorageService`, `FileStorageServiceModule`, `PardxUploader` |
| `transcode/aliyun-oss` | `FileStorageService`, `PardxUploader` |
| `transcode/aliyun-imm` | `PardxUploader` |

同时，`@dofe/infra-shared-services` 也从 `@dofe/infra-clients` 导入客户端类：
- `file-storage/*` → `FileS3Client`, `PardxUploader`, `FileStorageInterface` 等
- `file-cdn/*` → `CryptClient`, `CryptModule`
- `sms/*` → `SmsAliyunClient` 等短信客户端类
- `email/*` → `SendCloudClient`, `PardxEmailSender`
- `streaming-asr/*` → `StreamingAsrStatus` 等类型

### 1.4 当前的临时规避方式

消费者使用 `@dofe/infra-clients/dist/internal/file-storage` 形式绕过 barrel 循环。这暴露了内部路径，不友好且脆弱。

---

## 2. 设计原则

1. **单向依赖**：包之间必须是严格的 DAG（有向无环图），不允许任何循环
2. **清晰的包边界**：每个包有明确的职责定义
3. **友好的导入路径**：使用 `package.json exports` 定义子路径，消费者写 `@dofe/infra-clients/sms` 而非 `@dofe/infra-clients/dist/internal/sms`
4. **barrel 隔离**：barrel（`index.ts`）只 re-export 同包内的模块，不触发跨包循环加载

---

## 3. 依赖层级定义

```
Layer 0（无 infra 依赖）: contracts, i18n, redis, module-registry
Layer 1: utils
Layer 2: common
Layer 3: jwt, docker, prisma, rabbitmq, vector
Layer 4: shared-db
Layer 5: clients          ← 纯客户端，不依赖 shared-services
Layer 6: shared-services  ← 最顶层，可依赖 clients
```

**核心规则：`@dofe/infra-clients` 不得依赖 `@dofe/infra-shared-services`。**

---

## 4. 重设计方案

### 方案：将「依赖 shared-services 的 clients」提升为 shared-services 的子模块

将 `@dofe/infra-clients` 中依赖 `@dofe/infra-shared-services` 的 3 个子系统移动到 `@dofe/infra-shared-services` 中：

```
clients/src/internal/openspeech/   → shared-services/src/openspeech/
clients/src/internal/volcengine-tts/ → shared-services/src/volcengine-tts/
clients/src/internal/transcode/    → shared-services/src/transcode/
```

移动后，`@dofe/infra-clients` 不再依赖 `@dofe/infra-shared-services`，循环消失。

### 4.1 迁移清单

#### 从 `@dofe/infra-clients` 迁移到 `@dofe/infra-shared-services`

| 原路径 | 目标路径 | 说明 |
|---|---|---|
| `clients/src/internal/openspeech/*` | `shared-services/src/openspeech/*` | 语音识别（依赖 FileStorageService 上传音频） |
| `clients/src/internal/volcengine-tts/*` | `shared-services/src/volcengine-tts/*` | TTS 语音合成（依赖 FileStorageService） |
| `clients/src/internal/transcode/*` | `shared-services/src/transcode/*` | 视频转码（依赖 FileStorageService + PardxUploader） |

#### 保留在 `@dofe/infra-clients` 中（纯客户端，不依赖 shared-services）

| 子系统 | 说明 |
|---|---|
| `file-storage/` | 纯 S3/OSS/TOS 等存储客户端类 + PardxUploader DTO |
| `crypt/` | 纯加密客户端 |
| `sms/` | 纯短信发送客户端 |
| `email/` | 纯邮件发送客户端 |
| `agentx/` | AgentX API 客户端 |
| `ai/` | AI API 客户端 |
| `ai-provider/` | AI Provider 客户端 |
| `exchange-rate/` | 汇率查询客户端 |
| `ip-info/` | IP 信息查询客户端 |
| `ocr/` | OCR 客户端 |
| `openai/` | OpenAI 客户端 |
| `sse/` | SSE 客户端 |
| `third-party-sse/` | 第三方 SSE 客户端 |
| `verify/` | 验证客户端 |
| `wechat/` | 微信客户端 |
| `plugin/` | 插件系统 |

### 4.2 `@dofe/infra-clients` package.json 变更

**移除** `shared-services` 依赖：

```diff
  "peerDependencies": {
-   "@dofe/infra-shared-services": "^0.1.14",
    // ... 其余保留
  }
```

### 4.3 `@dofe/infra-shared-services` barrel 更新

迁移后 `shared-services/src/index.ts` 增加：

```typescript
export * from './openspeech';
export * from './volcengine-tts';
export * from './transcode';
```

### 4.4 消费端变更

原来从 `@dofe/infra-clients` 导入 openspeech/volcengine-tts/transcode 的代码改为从 `@dofe/infra-shared-services` 导入：

```diff
- import { OpenspeechModule } from '@dofe/infra-clients';
+ import { OpenspeechModule } from '@dofe/infra-shared-services';
```

### 4.5 循环消除验证

迁移后的依赖图：

```
clients → common, contracts, redis, utils    （无 shared-services）
shared-services → clients, common, ..., utils （单向，无循环）
```

**完美的 DAG。**

---

## 5. 子路径导出（Sub-path Exports）

参考 `@dofe/infra-utils` 已有的模式，为 `@dofe/infra-clients` 和 `@dofe/infra-shared-services` 添加 `package.json exports` 字段，使消费者可以使用干净的导入路径。

### 5.1 `@dofe/infra-clients/package.json`

```jsonc
{
  "name": "@dofe/infra-clients",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./crypt": {
      "types": "./dist/internal/crypt/index.d.ts",
      "default": "./dist/internal/crypt/index.js"
    },
    "./sms": {
      "types": "./dist/internal/sms/index.d.ts",
      "default": "./dist/internal/sms/index.js"
    },
    "./email": {
      "types": "./dist/internal/email/index.d.ts",
      "default": "./dist/internal/email/index.js"
    },
    "./file-storage": {
      "types": "./dist/internal/file-storage/index.d.ts",
      "default": "./dist/internal/file-storage/index.js"
    },
    "./agentx": {
      "types": "./dist/internal/agentx/index.d.ts",
      "default": "./dist/internal/agentx/index.js"
    },
    "./ai": {
      "types": "./dist/internal/ai/index.d.ts",
      "default": "./dist/internal/ai/index.js"
    },
    "./ai-provider": {
      "types": "./dist/internal/ai-provider/index.d.ts",
      "default": "./dist/internal/ai-provider/index.js"
    },
    "./exchange-rate": {
      "types": "./dist/internal/exchange-rate/index.d.ts",
      "default": "./dist/internal/exchange-rate/index.js"
    },
    "./ip-info": {
      "types": "./dist/internal/ip-info/index.d.ts",
      "default": "./dist/internal/ip-info/index.js"
    },
    "./ocr": {
      "types": "./dist/internal/ocr/index.d.ts",
      "default": "./dist/internal/ocr/index.js"
    },
    "./openai": {
      "types": "./dist/internal/openai/index.d.ts",
      "default": "./dist/internal/openai/index.js"
    },
    "./sse": {
      "types": "./dist/internal/sse/index.d.ts",
      "default": "./dist/internal/sse/index.js"
    },
    "./verify": {
      "types": "./dist/internal/verify/index.d.ts",
      "default": "./dist/internal/verify/index.js"
    },
    "./wechat": {
      "types": "./dist/internal/wechat/index.d.ts",
      "default": "./dist/internal/wechat/index.js"
    }
  }
}
```

### 5.2 `@dofe/infra-shared-services/package.json`

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./file-storage": {
      "types": "./dist/file-storage/index.d.ts",
      "default": "./dist/file-storage/index.js"
    },
    "./file-cdn": {
      "types": "./dist/file-cdn/index.d.ts",
      "default": "./dist/file-cdn/index.js"
    },
    "./uploader": {
      "types": "./dist/uploader/index.d.ts",
      "default": "./dist/uploader/index.js"
    },
    "./email": {
      "types": "./dist/email/index.d.ts",
      "default": "./dist/email/index.js"
    },
    "./sms": {
      "types": "./dist/sms/index.d.ts",
      "default": "./dist/sms/index.js"
    },
    "/ip-geo": {
      "types": "./dist/ip-geo/index.d.ts",
      "default": "./dist/ip-geo/index.js"
    },
    "./ip-info": {
      "types": "./dist/ip-info/index.d.ts",
      "default": "./dist/ip-info/index.js"
    },
    "./ocr": {
      "types": "./dist/ocr/index.d.ts",
      "default": "./dist/ocr/index.js"
    },
    "./openspeech": {
      "types": "./dist/openspeech/index.d.ts",
      "default": "./dist/openspeech/index.js"
    },
    "./volcengine-tts": {
      "types": "./dist/volcengine-tts/index.d.ts",
      "default": "./dist/volcengine-tts/index.js"
    },
    "./transcode": {
      "types": "./dist/transcode/index.d.ts",
      "default": "./dist/transcode/index.js"
    },
    "./streaming-asr": {
      "types": "./dist/streaming-asr/index.d.ts",
      "default": "./dist/streaming-asr/index.js"
    },
    "./system-health": {
      "types": "./dist/system-health/index.d.ts",
      "default": "./dist/system-health/index.js"
    },
    "./notification": {
      "types": "./dist/notification/index.d.ts",
      "default": "./dist/notification/index.js"
    },
    "./agentx": {
      "types": "./dist/agentx/index.d.ts",
      "default": "./dist/agentx/index.js"
    }
  }
}
```

### 5.3 消费端导入示例

迁移后，消费者可以这样写：

```typescript
// ✅ 干净的导入路径
import { FileCdnModule, FileCdnClient } from '@dofe/infra-shared-services/file-cdn';
import { FileStorageServiceModule } from '@dofe/infra-shared-services/file-storage';
import { OpenspeechModule, OpenspeechClient } from '@dofe/infra-shared-services/openspeech';
import { CryptClient, CryptModule } from '@dofe/infra-clients/crypt';
import { SmsAliyunClient } from '@dofe/infra-clients/sms';
import { PardxUploader } from '@dofe/infra-clients/file-storage';

// ✅ barrel 导入仍然可用（但推荐按需导入）
import { FileStorageServiceModule, FileCdnModule } from '@dofe/infra-shared-services';

// ❌ 不再需要的 /dist/ 路径
// import { CryptClient } from '@dofe/infra-clients/dist/internal/crypt';
```

---

## 6. `@dofe/infra-shared-services` 内部导入修正

迁移后，`shared-services` 内部文件应使用**子路径导入**（而非 barrel），避免 barrel 加载全部模块：

### 6.1 规则

**在 `shared-services` 包内部文件中，从 `@dofe/infra-clients` 导入时必须使用子路径，不使用 barrel。**

```typescript
// ✅ 正确：子路径导入
import { PardxUploader, FileStorageInterface } from '@dofe/infra-clients/file-storage';
import { CryptClient, CryptModule } from '@dofe/infra-clients/crypt';
import { SmsAliyunClient } from '@dofe/infra-clients/sms';
import { SendCloudClient } from '@dofe/infra-clients/email';

// ❌ 错误：barrel 导入（虽然循环已消除，但 barrel 会加载不必要模块）
import { CryptClient } from '@dofe/infra-clients';
```

### 6.2 原因

即使循环依赖已消除，barrel 导入仍会导致 Node.js 加载整个 `@dofe/infra-clients` 模块图。使用子路径只加载需要的子模块，更高效。

---

## 7. 实施步骤

### Phase 1：迁移子系统（解决循环依赖）

1. **移动 openspeech**
   - `clients/src/internal/openspeech/` → `shared-services/src/openspeech/`
   - 更新 `shared-services/src/openspeech/` 中的导入路径：
     - `FileStorageService` 从 `../file-storage/file-storage.service`（同包内相对路径）
     - `FileStorageServiceModule` 从 `../file-storage/file-storage.module`（同包内相对路径）
   - 从 `clients/src/index.ts` 移除 `export * from './internal/openspeech'`
   - 在 `shared-services/src/index.ts` 添加 `export * from './openspeech'`

2. **移动 volcengine-tts**
   - 同上流程

3. **移动 transcode**
   - 同上流程
   - 注意：`transcode` 当前在 `tsconfig.build-all.json` 中被 exclude，需要从 exclude 中移除

4. **更新 `@dofe/infra-clients/package.json`**
   - 从 `peerDependencies` 移除 `@dofe/infra-shared-services`

5. **更新消费端（models.dofe.ai 等）**
   - 将从 `@dofe/infra-clients` 导入 openspeech/volcengine-tts/transcode 的代码改为从 `@dofe/infra-shared-services` 导入

### Phase 2：添加子路径导出（改善导入体验）

1. 为 `@dofe/infra-clients/package.json` 添加 `exports` 字段
2. 为 `@dofe/infra-shared-services/package.json` 添加 `exports` 字段
3. 更新消费端代码，将 `@dofe/infra-clients/dist/internal/xxx` 替换为 `@dofe/infra-clients/xxx`

### Phase 3：修正 shared-services 内部导入

1. 将 `shared-services/src/` 中所有 `from '@dofe/infra-clients'` 替换为具体的子路径导入
2. 确保 barrel (`index.ts`) 不被内部文件导入（全部使用相对路径）

### Phase 4：清理

1. 从 `main.ts` 移除循环依赖 workaround 代码（barrel 预加载逻辑）
2. 重新构建并验证无循环依赖

---

## 8. 验证方法

### 8.1 构建验证

```bash
cd infra.dofe.ai && bash scripts/build-all.sh
cd models.dofe.ai && pnpm build:api
```

### 8.2 运行时验证

```bash
cd models.dofe.ai && pnpm dev:api
```

确认日志中不再出现 `CircularDependencyException`。

### 8.3 依赖图验证

```bash
# 确认 clients 不再依赖 shared-services
grep -r "shared-services" infra.dofe.ai/packages/clients/src/ --include="*.ts"
# 预期：无结果

# 确认 shared-services 不使用 clients barrel
grep -r "from '@dofe/infra-cliants'" infra.dofe.ai/packages/shared-services/src/ --include="*.ts"
# 预期：无结果（全部使用子路径）
```

---

## 9. 风险与回退

| 风险 | 缓解措施 |
|---|---|
| 迁移后消费端 import 路径变更 | 逐一修改 + TypeScript 编译检查 |
| openspeech/transcode 内部可能有隐式依赖 | 逐文件审查 import |
| tsconfig.build-all.json exclude 变更影响构建 | 构建验证 |

回退方案：如有问题，可通过 git revert 回退所有变更。

---

## 10. 附录：迁移后的完整依赖图

```
Layer 0: contracts, i18n, redis, module-registry
    ↓
Layer 1: utils → contracts
    ↓
Layer 2: common → contracts, redis, utils
    ↓
Layer 3: jwt → common
         docker → common, utils
         prisma → common, redis, utils
         rabbitmq → common, utils
         vector → common
    ↓
Layer 4: shared-db → common, prisma, redis
    ↓
Layer 5: clients → common, contracts, redis, utils
    ↓
Layer 6: shared-services → clients, common, contracts, jwt,
                             prisma, rabbitmq, redis, shared-db, utils
```

**无循环。完美 DAG。**
