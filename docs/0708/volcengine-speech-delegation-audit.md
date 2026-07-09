# Volcengine Speech Delegation Audit

日期：2026-07-08

## 结论

旧模块暂不强迁移。当前 `volcengine-speech` 已能承接新增能力和共享底座，但旧模块存在历史返回结构、TOS 落盘、任务状态映射和业务兼容假设。下一阶段只做“逐个方法委托”，每次委托都要补兼容验证。

## 可委托项

### `volcengine-tts`

- 可委托：鉴权头生成、显式配置解析、HTTP 请求重试、`X-Tt-Logid` 捕获。
- 可评估委托：非流式音频生成可逐步委托到 `audioGeneration.createAudio`。
- 暂不委托：现有 TOS 上传、音频元数据解析、历史返回 DTO 和声音列表 OpenAPI 签名路径。

### `openspeech`

- 可委托：WebSocket codec 的 header、gzip、sequence、错误帧解析。
- 可评估委托：火山流式 provider 的底层 frame 编解码可替换为 `protocol`。
- 暂不委托：现有 ASR 结果归一化、说话人分离字段映射、重连缓冲和会议相关 session 逻辑。

### `streaming-asr`

- 可委托：共享错误模型和 WebSocket session 状态枚举的一部分。
- 可评估委托：底层连接创建可在更细粒度测试后使用 `VolcengineWebSocketSession`。
- 暂不委托：SSE 事件、会话生命周期、音频保存和会议记录相关逻辑。

## 委托前置条件

- 每个旧方法保留原方法签名、返回字段和异常语义。
- 每个委托点至少有一个无真实密钥的兼容 smoke 验证。
- 委托只能依赖 `volcengine-speech` 的 `auth`、`errors`、`protocol` 或能力子 client，不能让统一 client 反向依赖旧模块。
- 任何涉及 TOS 落盘、数据库、会议记录或历史 DTO 的路径单独评估，不批量替换。

## 推荐顺序

1. 先将 `volcengine-tts` 的鉴权头和 retry 逻辑抽到 `volcengine-speech/auth` 与 transport。
2. 再将 `openspeech/providers/volcengine-streaming.provider.ts` 的 frame 编解码替换为 `protocol`，保留结果归一化逻辑。
3. 最后评估 `streaming-asr` 是否只复用错误模型，还是复用 WebSocket session。
