# 消费端补丁回归上游与 npmjs 发布

日期：2026-11-02。唯一发布源为 `https://registry.npmjs.org/`。

## 检查结论

| 包 | 补丁消费者 | 源码归属 | 处理 |
| --- | --- | --- | --- |
| `@dofe/infra-redis@0.1.96` | datasource；datasource-session-contention 为同项目工作副本 | 本仓 `packages/redis` | `2a257eb` 已修复持续重连与单请求等待；npmjs 0.1.96 tarball 仍含十次后停止的旧代码，重新构建发布 0.1.97 |
| `@dofe/infra-rabbitmq@0.1.96` | models、knowledge、new-agents | 本仓 `packages/rabbitmq` | 合并三份等价的连接日志修复，并复用既有错误脱敏工具；发布 0.1.97 |
| `@dofe/sso-ui@0.1.61` | models | `sso.dofe.ai/packages/ui` | 初始状态固定为 false，挂载后读取视口；在 SSO 仓发布 0.1.62，不迁入 infra |

消费者在 npmjs 精确版本和 tarball 验证成功后才可升级、移除对应
`patchedDependencies`、补丁文件并重新生成 lockfile。npmjs 发布不等于消费者
依赖升级，也不等于 Jenkins 部署。

## 验证

- RabbitMQ：连接工厂日志回归测试在修复前失败，修复后连同既有脱敏测试共 5 项通过。
- Redis：5 项 smoke 测试通过；真实临时 Redis 进程停止超过十次重试后仍能恢复，离线命令及时失败。
- 两包分别执行 `tsc -p packages/<包>/tsconfig.json --strict false`，与全仓构建的 strict 设置一致；使用已发布版本对应的现有 peer 依赖编译。
- `verify-package-exports.mjs` 验证两包模块子路径。
- `pnpm pack` 后检查包名、版本、npmjs registry、依赖声明和实际构建代码；不得含 `workspace:`、`file:`、`link:` 运行依赖。
- Redis tarball 运行代码仅重连模块改变；另有 `saveQiniuUploadAuthKey` 的推断返回声明由 string 变为 any（现有依赖类型推断差异），没有运行代码变化。
- RabbitMQ tarball 运行代码仅连接模块改变。
- 全仓 `pnpm build` 在当前 main 基线上失败：`common/src/types/index.ts` 引用未跟踪的 `express.d.ts`，并缺少 FastifyRequest 扩展。此次不改动或发布 common，不能将定向编译描述为全仓构建通过。

## 发布步骤

1. 审阅暂存差异，中文提交并推送源码及版本。
2. 用户手动完成 npmjs Web 认证；凭据、OTP 不进入文档或聊天。
3. 发布已经验证的 tarball，显式指定 `--registry=https://registry.npmjs.org/ --access=public`。
4. 回读 npmjs 精确版本、dist-tags 与完整性摘要，下载公开 tarball 确认仍含修复。

## npmjs 发布回执（2026-11-02）

用户手动完成 npmjs 登录及发布网页验证后，以下两个版本已发布，`latest`
均指向 0.1.97。匿名读取精确版本、下载 npmjs tarball 后，SHA-512 integrity
和完整 tarball SHA-256 均与发布前验证的制品一致，包内修复代码验证通过。

源码提交：`ae92ad9`，已推送至 `codex/upstream-consumer-patches`。

| 包 | npmjs 制品 | SHA-256 |
| --- | --- | --- |
| `@dofe/infra-redis@0.1.97` | [tarball](https://registry.npmjs.org/@dofe/infra-redis/-/infra-redis-0.1.97.tgz) | `e348b751e509feca7876cf572d16e3bc5a5d3927c3f466913c398da9d227b90f` |
| `@dofe/infra-rabbitmq@0.1.97` | [tarball](https://registry.npmjs.org/@dofe/infra-rabbitmq/-/infra-rabbitmq-0.1.97.tgz) | `fee9aae6824ca61c659d0f975b6218342f74a98403a72f415c5df4a639f92783` |

SSO UI 的发布回执由 SSO 仓库单独记录。消费者仍保持原依赖与 patch；
尚未进行消费者升级或服务部署。
