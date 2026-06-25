/**
 * 飞书长连接测试脚本
 *
 * 使用方法：
 * 1. 设置环境变量 FEISHU_APP_ID 和 FEISHU_APP_SECRET
 * 2. 运行: npx ts-node libs/infra/clients/internal/feishu/test-connection.ts
 * 3. 等待看到 "WebSocket connected" 日志
 * 4. 然后在飞书开发者后台保存长连接配置
 *
 * 注意：必须先运行此脚本建立连接，然后才能在飞书后台保存长连接配置
 */
import * as lark from '@larksuiteoapi/node-sdk';

const appId = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;
const domain = process.env.FEISHU_DOMAIN || 'feishu'; // 'feishu' 或 'lark'

function emitLine(text = ''): void {
  console.log(text);
}

function emitBanner(title: string): void {
  emitLine('='.repeat(60));
  emitLine(title);
  emitLine('='.repeat(60));
}

function emitError(title: string, detail?: string): void {
  console.error(title);
  if (detail) {
    console.error(detail);
  }
}

if (!appId || !appSecret) {
  emitError('请设置环境变量 FEISHU_APP_ID 和 FEISHU_APP_SECRET');
  emitError(
    '示例: FEISHU_APP_ID=xxx FEISHU_APP_SECRET=xxx npx ts-node test-connection.ts',
  );
  process.exit(1);
}

emitBanner('飞书长连接测试');
emitLine(`App ID: ${appId}`);
emitLine(`Domain: ${domain}`);
emitLine('');
emitLine('正在建立 WebSocket 连接...');
emitLine('');

const wsClient = new lark.WSClient({
  appId,
  appSecret,
  domain: domain === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
  loggerLevel: lark.LoggerLevel.info,
});

const eventDispatcher = new lark.EventDispatcher({});

eventDispatcher.register({
  'im.message.receive_v1': async (data: any) => {
    // 解析消息内容
    let messageText = '';
    try {
      if (data.message?.content) {
        const content = JSON.parse(data.message.content);
        messageText = content.text || JSON.stringify(content);
      }
    } catch {
      messageText = data.message?.content || '';
    }

    emitLine('');
    emitBanner('📩 收到飞书消息');
    emitLine(`消息ID: ${data.message?.message_id}`);
    emitLine(`会话ID: ${data.message?.chat_id}`);
    emitLine(
      `会话类型: ${data.message?.chat_type === 'p2p' ? '私聊' : '群聊'}`,
    );
    emitLine(`消息类型: ${data.message?.message_type}`);
    emitLine(`发送者ID: ${data.sender?.sender_id?.open_id}`);
    emitLine(`发送者类型: ${data.sender?.sender_type}`);
    emitLine(`消息内容: ${messageText}`);
    if (data.message?.mentions?.length > 0) {
      emitLine(
        `@提及: ${data.message.mentions.map((m: any) => m.name).join(', ')}`,
      );
    }
    emitLine(
      `事件时间: ${new Date(parseInt(data.message?.create_time || '0')).toLocaleString()}`,
    );
    emitBanner('');
    emitLine('原始数据:');
    emitLine(JSON.stringify(data, null, 2));
    emitLine('');
  },
});

wsClient
.start({ eventDispatcher })
  .then(() => {
    emitLine('');
    emitBanner('✅ WebSocket 连接成功！');
    emitLine('');
    emitLine('连接已建立，等待接收消息...');
    emitLine('请在飞书中向机器人发送消息进行测试');
    emitLine('');
    emitLine('按 Ctrl+C 退出');
    emitLine('');
  })
  .catch((error) => {
    emitError('');
    emitBanner('❌ WebSocket 连接失败！');
    emitError('');
    emitError(`错误信息: ${error.message || error}`);
    emitError('');
    emitError('可能的原因：');
    emitError('1. App ID 或 App Secret 不正确');
    emitError('2. 应用未发布或未启用');
    emitError('3. 网络问题');
    emitError('');
    process.exit(1);
  });

// 保持进程运行
process.on('SIGINT', () => {
  emitLine('\n正在关闭连接...');
  wsClient.close();
  process.exit(0);
});
