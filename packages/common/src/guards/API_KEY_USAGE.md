# API Key 守卫使用说明

## 概述

API Key 守卫允许内部服务使用预定义的 API Key 跳过部分验证（如用户认证、权限检查等），但仍然保持租户数据隔离。

## 环境变量配置

在 `.env` 文件中配置以下环境变量：

```bash
# API Key 列表（多个用逗号分隔，必填）
INTERNAL_API_KEYS=your-secret-key-1,your-secret-key-2

# 是否强制要求租户 Header（可选，默认 false）
INTERNAL_API_REQUIRE_TENANT=true
```

## 请求格式

### Headers

| Header | 说明 | 必填 |
|--------|------|------|
| `x-api-key` | API Key | 是 |
| `x-current-tenant` | 租户 ID | 可选（但强烈建议） |
| `x-service-name` | 服务名称（用于日志标识） | 可选 |

### 请求示例

```bash
# 查询技能列表
curl -X GET "http://api.example.com/skills?page=1&limit=20" \
  -H "x-api-key: your-secret-key-1" \
  -H "x-current-tenant: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-service-name: my-internal-service"

# 安装技能
curl -X POST "http://api.example.com/bot/550e8400-e29b-41d4-a716-446655440000/skills" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key-1" \
  -H "x-current-tenant: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "skillId": "123e4567-e89b-12d3-a456-426614174000",
    "config": {
      "PYTHON_PATH": "/usr/bin/python3"
    }
  }'
```

## 在控制器中使用

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { AllowApiKey } from '@/common/decorators/api-key';

@Controller()
@Auth()  // 保留正常认证
@UseGuards(ApiKeyGuard)  // 添加 API Key 守卫
export class MyController {

  @TsRestHandler(skillC.list)
  @AllowApiKey()  // 允许 API Key 访问
  @TenantScope()
  @RequirePermissions(PERMISSION.SKILL_READ)
  async listSkills() {
    // ...
  }
}
```

## 安全特性

### 1. API Key 验证
- API Key 必须预定义在环境变量中
- 支持多个 API Key（用逗号分隔）
- 无效 Key 会记录错误日志并拒绝请求

### 2. 日志审计
- 所有 API Key 调用都会记录日志
- 包含服务名称、IP、租户 ID 等信息
- 无效 Key 会记录警告日志

### 4. 租户隔离
- 仍然需要 `x-current-tenant` Header
- 可强制要求租户 Header（`INTERNAL_API_REQUIRE_TENANT=true`）
- 防止跨租户数据访问

## 跳过的验证

使用有效的 API Key 时，以下验证会被跳过：

| 验证项 | 状态 |
|--------|------|
| 用户认证 | 跳过 |
| 用户权限检查 | 跳过 |
| 租户成员验证 | 跳过 |
| 租户上下文解析 | 部分跳过（仍从 header 读取） |

**保留的验证：**

- 租户数据隔离（Service 层）
- 输入参数验证
- 业务逻辑验证

## 安全建议

### ⚠️ 生产环境

1. **定期更换 API Key**
   - 每季度至少更换一次
   - 有泄露风险时立即更换

2. **强制要求租户 Header**
   ```bash
   INTERNAL_API_REQUIRE_TENANT=true
   ```

3. **使用独立的服务认证机制**
   - 生产环境建议使用 mTLS
   - 或使用 Service Account JWT

4. **监控 API Key 使用情况**
   - 关注异常调用频率
   - 关注异常来源

### 🧪 开发环境

可以使用简化的配置：

```bash
INTERNAL_API_KEYS=dev-key-123
# 不强制租户 Header
```

## 故障排查

### API Key 无效

```
错误：API key 认证失败
原因：API Key 不在白名单中
解决：检查 INTERNAL_API_KEYS 环境变量配置
```

### 缺少租户 Header

```
错误：Tenant header (x-current-tenant) is required
原因：启用了 INTERNAL_API_REQUIRE_TENANT 但未提供
解决：在请求中添加 x-current-tenant Header
```

## 已开放 API Key 的接口

当前已配置的接口：

| 接口 | 路径 | 功能 |
|------|------|------|
| listSkills | GET /skills | 获取技能列表 |
| installSkill | POST /bot/:botId/skills | 安装技能 |
| batchInstallSkills | POST /bot/:botId/skills/batch | 批量安装技能 |

## 联系方式

如有问题，请联系基础设施团队或查看项目文档。
