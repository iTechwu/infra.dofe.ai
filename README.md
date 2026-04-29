# dofe-infra

DofeAI 共享基础设施库。基于 NestJS + Fastify + Prisma 7 的 monorepo，提供跨项目复用的基础设施层。

## 目录

- [包结构](#包结构)
- [依赖方向](#依赖方向)
- [快速开始](#快速开始)
- [构建与开发](#构建与开发)
- [环境变量](#环境变量)
- [使用方案](#使用方案)
  - [Prisma 数据库](#1-prisma-数据库读写分离)
  - [Redis 缓存](#2-redis-缓存)
  - [JWT 认证](#3-jwt-认证)
  - [事务管理](#4-事务管理shared-db)
  - [RabbitMQ 消息队列](#5-rabbitmq-消息队列)
  - [第三方客户端](#6-第三方客户端clients)
  - [媒体转码](#7-媒体转码transcode)
  - [通用业务服务](#8-通用业务服务shared-services)
  - [通用模块](#9-通用模块common)
  - [工具函数](#10-工具函数utils)
  - [国际化](#11-国际化i18n)
- [版本规则](#版本规则)
- [准入标准](#准入标准)

## 包结构

| 包 | 说明 |
|---|---|
| `@dofe/infra-utils` | 纯工具函数（crypto, string, array, bcrypt, bigint, ffmpeg, http-client 等） |
| `@dofe/infra-i18n` | 国际化 JSON 资源（en, zh-CN） |
| `@dofe/infra-jwt` | JWT 签发/校验模块，封装 `@nestjs/jwt` |
| `@dofe/infra-common` | 装饰器、拦截器、配置、过滤器、守卫、管道、ts-rest、加密服务 |
| `@dofe/infra-prisma` | 数据库连接、读写分离、db-metrics、soft-delete、tenant-isolation、Prometheus |
| `@dofe/infra-redis` | Redis 缓存客户端，支持 pipeline、分布式锁（RedisLockService）、租户 Redis（TenantRedisService） |
| `@dofe/infra-rabbitmq` | 消息队列（核心 + Events 双连接） |
| `@dofe/infra-shared-db` | TransactionalServiceBase、UnitOfWork、AsyncLocalStorage 事务管理 |
| `@dofe/infra-clients` | 第三方 API 客户端（SMS, Email, OCR, OSS, TTS, Transcode, WeChat 等 18 个） |
| `@dofe/infra-shared-services` | 通用业务服务（email, sms, file-storage, notification, ip-geo 等） |
| `@dofe/infra-docker` | Docker 容器管理（创建、启动、停止、端口分配） |
| `@dofe/infra-vector` | VikingDB 向量数据库客户端、Embedding 服务、知识库管理 |
| `@dofe/infra-module-registry` | 动态模块注册、依赖解析、自动扫描（@RegisterModule 装饰器） |

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

## 快速开始

### 1. 开发模式（推荐，本地 symlink）

在消费项目的 `pnpm-workspace.yaml` 中添加本地路径引用：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - '../infra.dofe.ai/packages/*'   # 指向 infra 仓库
```

在消费项目 `apps/api/package.json` 中声明依赖：

```json
{
  "dependencies": {
    "@dofe/infra-common": "workspace:*",
    "@dofe/infra-prisma": "workspace:*",
    "@dofe/infra-redis": "workspace:*"
  }
}
```

执行 `pnpm install`，pnpm 会创建 symlink。修改 infra 源码后 NestJS `--watch` 自动热重载。

### 2. 生产/CI 模式（Git tag）

锁定 Git tag 版本：

```json
{
  "dependencies": {
    "@dofe/infra-common": "github:iTechwu/infra.dofe.ai#v0.1.0"
  }
}
```

## 构建与开发

```bash
# 安装依赖
pnpm install

# 构建所有包（单次 tsc 编译，自动分发到各包 dist/）
pnpm build

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 清理所有构建产物
pnpm clean
```

构建原理：`scripts/build-all.sh` 执行单次 `tsc -p tsconfig.build-all.json`，然后将 `_dist_tmp/` 中的编译产物分发到各包的 `dist/` 目录。

## 环境变量

| 变量名 | 必需 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | PostgreSQL 主库连接字符串 |
| `READ_DATABASE_URL` | 否 | 只读副本连接，缺省回退到 `DATABASE_URL` |
| `REDIS_URL` | 是 | Redis 连接字符串 |
| `RABBITMQ_URL` | 否 | RabbitMQ 核心连接 |
| `RABBITMQ_EVENTS_URL` | 否 | RabbitMQ Events 连接（独立 vhost） |
| `JWT_SECRET` | 是 | JWT 签名密钥 |
| `JWT_EXPIRE_IN` | 否 | JWT 过期时间，默认 `3600`（秒） |

---

## 使用方案

### 1. Prisma 数据库（读写分离）

**模块：** `@dofe/infra-prisma`
**依赖：** Prisma 7.x + `@prisma/adapter-pg` + `pg`

#### 注册模块

```typescript
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [
    // PrismaModule 自动包含 Read + Write + DbMetrics
    // 无需 forRoot，通过 DATABASE_URL / READ_DATABASE_URL 环境变量配置
    PrismaModule,
  ],
  providers: [UserService],
})
export class UserModule {}
```

#### 使用读写分离

```typescript
import { PrismaService } from '@dofe/infra-prisma';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // 读操作 → 使用 READ_DATABASE_URL（只读副本）
  async findAll() {
    return this.prisma.read.gatewayUser.findMany();
  }

  // 写操作 → 使用 DATABASE_URL（主库）
  async create(data: CreateUserDto) {
    return this.prisma.write.gatewayUser.create({ data });
  }

  // 也可单独注入 Read 或 Write 服务
  // constructor(
  //   private readonly readService: PrismaReadService,
  //   private readonly writeService: PrismaWriteService,
  // ) {}
}
```

#### 特性

- **软删除过滤：** 查询自动附加 `isDeleted: false` 条件（通过 `$extends`）
- **BigInt 序列化：** 自动将 BigInt 转为 Number
- **慢查询监控：** 超过 1000ms 自动记录警告日志
- **Prometheus 指标：** 可选开启 `/metrics` 端点

### 2. Redis 缓存

**模块：** `@dofe/infra-redis`
**依赖：** ioredis

#### 注册模块

```typescript
import { RedisModule } from '@dofe/infra-redis';

@Module({
  imports: [RedisModule],
})
export class AppModule {}
```

#### RedisService 使用

```typescript
import { RedisService } from '@dofe/infra-redis';

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  // 基本 CRUD
  async setToken(userId: string, token: string) {
    await this.redis.saveData('userToken', userId, token, 3600);
  }

  async getToken(userId: string) {
    return this.redis.getData('userToken', userId);
  }

  // 分布式锁
  async withLock(key: string, ttl: number, callback: () => Promise<void>) {
    const acquired = await this.redis.setNX(`lock:${key}`, '1', { EX: ttl });
    if (!acquired) throw new Error('Resource locked');
    try {
      await callback();
    } finally {
      await this.redis.deleteData('lock', key);
    }
  }

  // Pipeline 批量操作
  async batchSet(items: Array<{ key: string; value: string }>) {
    await this.redis.pipelineSave(
      items.map((item) => ({ name: 'batch', key: item.key, data: item.value })),
    );
  }
}
```

#### CacheService 使用

```typescript
import { CacheService } from '@dofe/infra-redis';

@Injectable()
export class ConfigService {
  constructor(private readonly cache: CacheService) {}

  async getConfig(key: string) {
    const cached = await this.cache.get<string>(key);
    if (cached) return JSON.parse(cached);
    // ... fetch from DB ...
    await this.cache.set(key, JSON.stringify(data), 600);
    return data;
  }
}
```

### 3. JWT 认证

**模块：** `@dofe/infra-jwt`
**依赖：** `@nestjs/jwt`

#### 注册模块

```typescript
import { JwtModule } from '@dofe/infra-jwt';

@Module({
  imports: [JwtModule],
})
export class AuthModule {}
```

#### 使用

```typescript
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async signToken(payload: { userId: string; role: string }) {
    return this.jwtService.sign(payload);
  }

  async verifyToken(token: string) {
    return this.jwtService.verify(token);
  }
}
```

### 4. 事务管理（shared-db）

**模块：** `@dofe/infra-shared-db`
**依赖：** `@dofe/infra-prisma`

#### 注册模块

```typescript
import { TransactionModule } from '@dofe/infra-shared-db';

@Module({
  imports: [PrismaModule, TransactionModule],
})
export class OrderModule {}
```

#### UnitOfWork 事务

```typescript
import { UnitOfWorkService } from '@dofe/infra-shared-db';

@Injectable()
export class OrderService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly userService: UserService,
    private readonly orderRepo: OrderRepository,
  ) {}

  async createOrder(data: CreateOrderDto) {
    // uow.execute 内的所有写操作在同一事务中执行
    return this.uow.execute(async () => {
      const user = await this.userService.deductBalance(data.userId, data.amount);
      const order = await this.orderRepo.create(data);
      return { user, order };
    }, {
      maxWait: 5000,      // 等待事务开始的最长时间
      timeout: 10000,     // 事务超时
      isolationLevel: 'Serializable',
    });
  }
}
```

#### TransactionalServiceBase

所有需要事务支持的 DB Service 应继承此基类：

```typescript
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { PrismaService } from '@dofe/infra-prisma';

@Injectable()
export class UserRepository extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(data: CreateUserDto) {
    // writeClient 自动检测当前事务上下文
    // 在 uow.execute 中 → 使用事务客户端
    // 在普通调用中 → 使用普通写客户端
    return this.writeClient.gatewayUser.create({ data });
  }
}
```

#### @Transactional 装饰器

```typescript
import { Transactional } from '@dofe/infra-common';

@Injectable()
export class PaymentService {
  @Transactional()
  async processPayment(orderId: string) {
    // 此方法自动包裹在数据库事务中
  }
}
```

### 5. RabbitMQ 消息队列

**模块：** `@dofe/infra-rabbitmq`
**依赖：** amqplib

#### 注册模块

```typescript
import { RabbitmqModule, RabbitmqEventsModule } from '@dofe/infra-rabbitmq';

@Module({
  imports: [
    // 核心消息队列（RABBITMQ_URL）
    RabbitmqModule,
    // 事件驱动队列（RABBITMQ_EVENTS_URL），可选
    RabbitmqEventsModule,
  ],
})
export class AppModule {}
```

#### 发送与消费

```typescript
import { RabbitmqService } from '@dofe/infra-rabbitmq';

@Injectable()
export class NotificationDispatcher {
  constructor(private readonly rabbit: RabbitmqService) {}

  // 发送消息
  async sendNotification(userId: string, message: string) {
    await this.rabbit.sendMessageToRabbitMQ('notification-queue', {
      userId,
      message,
      timestamp: Date.now(),
    });
  }

  // 消费消息
  async onModuleInit() {
    await this.rabbit.consumeMessagesFromRabbitMQ(
      'notification-queue',
      async (msg) => {
        const content = JSON.parse(msg.content.toString());
        await this.processNotification(content);
      },
    );
  }

  // 健康检查
  async healthCheck() {
    return this.rabbit.healthCheck();
    // => { isConnected: boolean, channelReady: boolean }
  }
}
```

#### Events 模式（发布/订阅）

```typescript
import { RabbitmqEventsService } from '@dofe/infra-rabbitmq';

@Injectable()
export class EventPublisher {
  constructor(private readonly events: RabbitmqEventsService) {}

  async publishUserCreated(user: User) {
    await this.events.publishToExchange(
      'user-events',       // exchange
      'user.created',      // routing key
      { id: user.id, email: user.email },
      'topic',             // exchange type
    );
  }
}
```

### 6. 第三方客户端（clients）

**模块：** `@dofe/infra-clients`
**包含：** AI, AI-Provider, Crypt, Email, Exchange-Rate, File-CDN, File-Storage, IP-Info, OCR, OpenAI, OpenSpeech, SMS, SSE, Third-Party-SSE, Transcode, Verify, Volcengine-TTS, WeChat

#### 使用方式

```typescript
import { SmsModule, SmsService } from '@dofe/infra-clients';

@Module({
  imports: [SmsModule],
})
export class AuthModule {}

@Injectable()
export class AuthService {
  constructor(private readonly sms: SmsService) {}

  async sendVerificationCode(phone: string, code: string) {
    await this.sms.sendCode(phone, code);
  }
}
```

所有客户端遵循相同的 Module + Service 模式，按需引入对应模块即可。

### 7. 媒体转码（Transcode）

**模块：** `@dofe/infra-clients` 内的 `transcode` 子模块
**架构：** 策略模式，根据 `FileBucketVendor` 自动路由到对应云服务

#### 整体架构

```
TranscodeStrategyClient  ← 统一入口，策略路由
  ├── AliyunOssTranscodeClient  ← vendor='oss'（阿里云 OSS + IMM）
  │     └── AliyunImmClient     ← 阿里云 IMM 媒体处理
  └── VolcengineTosTranscodeClient  ← vendor='tos'（火山引擎 TOS + IMP）
```

#### 子模块一览

| 模块 | 说明 |
|---|---|
| `TranscodeStrategyModule` | 策略路由，根据 vendor 自动选择实现 |
| `AliyunOssTranscodeModule` | 阿里云 OSS 转码（雪碧图、截图、缩略图） |
| `AliyunImmModule` | 阿里云 IMM（媒体元信息检测、视频转码、音频提取） |
| `VolcengineTosTranscodeModule` | 火山引擎 TOS 转码（视频转码、任务管理） |

#### 注册模块

```typescript
import { TranscodeStrategyModule } from '@dofe/infra-clients';

@Module({
  imports: [TranscodeStrategyModule],
  providers: [VideoService],
})
export class VideoModule {}
```

#### 基本使用（通过策略路由）

```typescript
import { TranscodeStrategyClient } from '@dofe/infra-clients';

@Injectable()
export class VideoService {
  constructor(private readonly transcode: TranscodeStrategyClient) {}

  // 获取媒体元信息（自动路由到 OSS/IMM 或 TOS）
  async getVideoInfo(vendor: FileBucketVendor, bucket: string, key: string) {
    return this.transcode.getVideoInfo(vendor, bucket, key);
  }

  // 视频转码（支持多清晰度）
  async transcodeVideo(vendor: FileBucketVendor, bucket: string, key: string) {
    return this.transcode.transcodeVideo(vendor, bucket, key, [
      VideoQuality.VIDEO_1080P,
      VideoQuality.VIDEO_720P,
    ]);
  }

  // 生成雪碧图（仅 OSS 支持）
  async generateSprite(vendor: FileBucketVendor, bucket: string, key: string) {
    return this.transcode.generateSprite(vendor, bucket, key, {
      width: 160,
      height: 90,
      interval: 10,
      columns: 10,
      lines: 10,
    });
  }

  // 视频截图（仅 OSS 支持）
  async takeSnapshot(vendor: FileBucketVendor, bucket: string, key: string) {
    return this.transcode.takeSnapshot(vendor, bucket, key, {
      time: '00:00:01',
      format: 'jpg',
      quality: 90,
    });
  }

  // 获取视频首帧缩略图
  async getThumbnail(vendor: FileBucketVendor, bucket: string, key: string) {
    return this.transcode.getVideoThumbnail(vendor, bucket, key);
  }

  // 从视频中提取音频
  async extractAudio(vendor: FileBucketVendor, bucket: string, key: string) {
    return this.transcode.extractAudioFromVideo(vendor, bucket, key, {
      format: 'mp3',
      bitrate: 128000,
      sampleRate: 16000,
    });
  }

  // 查询转码任务状态
  async getTaskStatus(vendor: FileBucketVendor, bucket: string, taskId: string) {
    return this.transcode.getTranscodeTaskStatus(vendor, bucket, taskId);
    // => { status: string, progress?: number, result?: any, error?: string }
  }

  // 批量处理（获取信息 + 缩略图 + 雪碧图）
  async batchProcess(vendor: FileBucketVendor, bucket: string, key: string) {
    return this.transcode.batchProcessMedia(vendor, bucket, key, {
      generateThumbnail: true,
      generateSprite: true,
    });
  }
}
```

#### 单独使用阿里云 OSS 转码

```typescript
import { AliyunOssTranscodeClient } from '@dofe/infra-clients';

@Injectable()
export class OssVideoService {
  constructor(private readonly aliyunOss: AliyunOssTranscodeClient) {}

  // 标准雪碧图（10x10，每10秒一帧）
  async standardSprite(bucket: string, key: string) {
    return this.aliyunOss.generateStandardSprite('oss', bucket, key);
  }

  // 高密度雪碧图（15x15，每5秒一帧）
  async hdSprite(bucket: string, key: string) {
    return this.aliyunOss.generateHighDensitySprite('oss', bucket, key);
  }

  // 自定义时间范围截图
  async timeRangeSnapshots(bucket: string, key: string) {
    return this.aliyunOss.takeMultipleSnapshots('oss', bucket, key, {
      startTime: '00:00:05',
      endTime: '00:00:30',
      interval: 5,
      count: 5,
    });
  }
}
```

#### 单独使用火山引擎 TOS 转码

```typescript
import { VolcengineTosTranscodeClient } from '@dofe/infra-clients';

@Injectable()
export class TosVideoService {
  constructor(private readonly volcengine: VolcengineTosTranscodeClient) {}

  // 提交自定义工作流任务
  async submitCustomJob(bucket: string, key: string, templateId: string) {
    return this.volcengine.submitJob({
      Action: 'SubmitJob',
      Version: '2021-06-11',
      TemplateId: templateId,
      InputPath: {
        Type: 'TOS',
        TosBucket: bucket,
        FileId: key,
      },
    });
  }
}
```

#### 辅助工具

```typescript
import {
  FileValidator,        // 文件类型验证（视频/音频/图片）
  TranscodeHelper,      // 帧率计算、雪碧图数量、参数构建
  TranscodeConfigManager, // 区域配置管理
} from '@dofe/infra-clients';
```

### 8. 通用业务服务（shared-services）

**模块：** `@dofe/infra-shared-services`
**包含：** Email, File-Storage, IP-Geo, Notification, SMS, Streaming-ASR, System-Health, Uploader

```typescript
import { EmailServiceModule, EmailService } from '@dofe/infra-shared-services';

@Module({
  imports: [EmailServiceModule],
})
export class NotificationModule {}

@Injectable()
export class NotificationService {
  constructor(private readonly email: EmailService) {}

  async sendWelcome(to: string, name: string) {
    await this.email.sendMail({
      to,
      subject: 'Welcome',
      template: 'welcome',
      context: { name },
    });
  }
}
```

### 9. 通用模块（common）

**模块：** `@dofe/infra-common`

#### 常用装饰器

```typescript
import {
  DeviceInfo,       // 装饰器：提取设备信息
  TeamInfo,         // 装饰器：提取团队上下文
  Transactional,    // 装饰器：声明式事务
  TsRestController, // 装饰器：ts-rest 类型安全路由
} from '@dofe/infra-common';

@Controller('users')
export class UserController {
  @Post()
  @Transactional()
  async create(
    @Body() dto: CreateUserDto,
    @DeviceInfo() device: DeviceInfo,
    @TeamInfo() team: TeamContext,
  ) {
    return this.userService.create(dto, device, team);
  }
}
```

#### 加密服务

```typescript
import { EncryptionService } from '@dofe/infra-common';

@Injectable()
export class ApiKeyService {
  constructor(private readonly encryption: EncryptionService) {}

  async generateApiKey() {
    const raw = this.encryption.generateSecret();
    const hashed = await this.encryption.hash(raw);
    return { raw, hashed };
  }
}
```

#### 异常与响应

```typescript
import { apiError, ApiException } from '@dofe/infra-common';

// 抛出业务异常
throw apiError('USER_NOT_FOUND', { userId: id });

// 带状态码
throw new ApiException('Forbidden', HttpStatus.FORBIDDEN);
```

### 10. 工具函数（utils）

```typescript
import {
  bigintUtil,    // BigInt 序列化
  cryptoUtil,    // 加密/哈希/UUID
  stringUtil,    // 字符串处理
  arrayUtil,     // 数组操作（chunk, unique, flatten 等）
  bcryptUtil,    // 密码哈希/验证
  httpUtil,      // HTTP 请求封装
  timerUtil,     // 计时器/延迟
  validateUtil,  // 数据校验
  environment,   // 环境判断（isProduction, isDevelopment）
} from '@dofe/infra-utils';
```

### 11. 国际化（i18n）

```typescript
// 在 NestJS 中使用 nestjs-i18n 加载
import { I18nModule } from 'nestjs-i18n';
import * as path from 'path';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'zh-CN',
      loaderOptions: {
        path: path.join(__dirname, '../node_modules/@dofe/infra-i18n/'),
        watch: true,
      },
    }),
  ],
})
export class AppModule {}
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
