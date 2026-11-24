# sso-browser 与 infra-common 修复发布

日期：2026-11-24。唯一发布源为 `https://registry.npmjs.org/`。

## 检查结论

| 包 | npmjs 发布前 | 未发布源码 | 处理 |
| --- | --- | --- | --- |
| `@dofe/sso-browser` | 0.1.106（2026-11-04） | `00c817e` 后继中央会话的登出不再要求清掉当前 Cookie，版本未随源码 bump | 发布 0.1.107 |
| `@dofe/infra-common` | 0.1.96 | `990bc0e` 去掉匿名请求的租户警告并只记录过慢的请求周期，版本未随源码 bump | 发布 0.1.97 |

redis / rabbitmq 0.1.97 已发布且本地无源码漂移；docker 仅注释措辞改动，
均不在本次发布范围。

## 验证

- sso-browser：`node --test test/session-v2.test.cjs test/session-v2-csrf.test.cjs`
  共 41 项通过；`tsc` 构建通过。
- common：`tenant-context.guard.spec.ts` 3 项通过；`tsc` 构建 +
  `generate-exports` 通过（93 项 exports 无变化）。
- `pnpm verify:package-exports` 验证 19 项模块子路径。
- `pnpm pack` 制品检查：包名版本正确，dependencies / peerDependencies /
  optionalDependencies 不含 `workspace:`、`file:`、`link:`。
- tarball 内确认含修复代码：`logout_cookie_confirmation_required` 位于
  `dist/session-v2.js`；`SLOW_REQUEST_MS` 位于
  `dist/middleware/request.middleware.js` 与 `dist/guards/tenant-context.guard.js`。

## 发布步骤

1. 版本 bump 中文提交并推送：`715e769`（直接在 main，沿用本仓发布提交先例）。
2. 用户手动完成 npmjs 网页认证（`npm login` Web 认证 + 每包一次
   `npmjs.com/auth/cli` 网页授权，全程不使用 OTP）。
3. 伪终端下执行 `pnpm publish --access public --no-git-checks
   --registry=https://registry.npmjs.org/`。
4. 回读 npmjs 精确版本、dist-tags，下载公开 tarball 做 SHA-256 与修复代码比对。

## npmjs 发布回执（2026-11-24）

两个包均已发布，`latest` 分别指向 0.1.107 与 0.1.97。匿名下载公开
tarball 后，完整 tarball SHA-256 与发布前本地 `pnpm pack` 制品一致，
包内修复代码验证通过。

源码提交：`00c817e`、`990bc0e`、`715e769`，均已推送至 main。

| 包 | npmjs 制品 | SHA-256 |
| --- | --- | --- |
| `@dofe/sso-browser@0.1.107` | [tarball](https://registry.npmjs.org/@dofe/sso-browser/-/sso-browser-0.1.107.tgz) | `e415cd97b38ce5acf50d70d6a5c6913ee447fc8e8a16e5b91244ef3717ef01fa` |
| `@dofe/infra-common@0.1.97` | [tarball](https://registry.npmjs.org/@dofe/infra-common/-/infra-common-0.1.97.tgz) | `127156e1b1fc826cb537dd32b80ca54f28e64b42e17a696a9c45e3c2bd386461` |

消费者（如 skill.dofe.ai web 仍用 `@dofe/sso-browser@0.1.106`、api 仍用
`@dofe/infra-common@0.1.96`）可按各自节奏升级依赖并重新生成 lockfile。
npmjs 发布不等于消费者依赖升级，也不等于 Jenkins 部署。
