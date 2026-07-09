# Volcengine Speech Implementation Log

## Loop 1: Request Options Contract

**审查待实施项**：`next-execution-plan.md` Step 2 要求 README 的 request
options 与 client 管理 header 的规则一致。代码已支持 `resourceId` 和
`sequence`，但 README 仍只描述 `requestId`、custom headers 和 timeout；
认证 helper 注释也仍写着旧头名 `X-Api-App-Id`。

**实施**：更新 README 的 Request Options，明确 `resourceId`、`sequence`、
`X-Api-Sequence` 和校验规则；同步修正 auth helper 注释为新版
`X-Api-App-Key`。

**标注文档**：Step 2 已完成文档契约修正，后续仍需补 client 级 mock 覆盖，证明
reserved headers 不能被绕过。

**验证**：待后续循环统一运行 `typecheck` 与 `verify:volcengine-speech`。
