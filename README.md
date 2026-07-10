# ddys-webhook-notifier

低端影视 API 的定时 Webhook 通知器。它负责定时拉取最新、热门、日历或搜索结果，按指纹去重后推送到多个消息平台，适合放在 Cloudflare Workers、GitHub Actions、服务器定时任务或任意 Node 环境中运行。

[English](README.en.md)

## 功能

- 数据源：`latest`、`hot`、`calendar`、`search:关键词`，也支持自定义 API 路径。
- 去重：按来源和影片指纹记录已推送内容，避免重复刷屏。
- 推送目标：通用 Webhook、Discord、Slack、Telegram、钉钉、企业微信、飞书/Lark。
- 运行方式：Node CLI、Cloudflare Workers 定时触发、GitHub Actions。
- 稳定性：超时控制、重试、错误汇总、脱敏诊断、dry-run 预览。
- 安全默认值：Discord 禁用自动 mention，签名类机器人只在内存中使用密钥。

## 快速使用

配置环境变量：

```bash
DDYS_NOTIFY_SOURCES=latest,hot
DDYS_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DDYS_NOTIFY_MAX_ITEMS=8
```

运行一次：

```bash
npx ddys-webhook-notifier run --state-file .ddys-notifier-state.json
```

只预览不发送：

```bash
npx ddys-webhook-notifier run --dry-run
```

查看脱敏配置：

```bash
npx ddys-webhook-notifier diag
```

## 多平台配置

可以用单独变量：

```bash
DDYS_NOTIFY_DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=...
DDYS_NOTIFY_DINGTALK_SECRET=SEC...
DDYS_NOTIFY_WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...
DDYS_NOTIFY_LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/...
DDYS_NOTIFY_LARK_SECRET=...
DDYS_NOTIFY_TELEGRAM_BOT_TOKEN=123456:xxx
DDYS_NOTIFY_TELEGRAM_CHAT_ID=-1001234567890
DDYS_NOTIFY_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DDYS_NOTIFY_GENERIC_WEBHOOK_URL=https://example.com/ddys-webhook
```

也可以集中写成 JSON：

```bash
DDYS_NOTIFY_TARGETS='[
  {"type":"discord","url":"https://discord.com/api/webhooks/..."},
  {"type":"telegram","botToken":"123456:xxx","chatId":"-1001234567890"},
  {"type":"generic","url":"https://example.com/ddys-webhook","headers":{"x-source":"ddys"}}
]'
```

## 数据源写法

```bash
DDYS_NOTIFY_SOURCES=latest,hot,calendar,search:科幻
```

支持的写法：

| 写法 | 说明 |
| --- | --- |
| `latest` | 最新更新 |
| `hot` | 热门内容 |
| `calendar` | 当天日历 |
| `calendar:2026-07` | 指定年月日历 |
| `calendar:2026-07-10` | 指定日期日历 |
| `search:关键词` | 搜索关键词 |
| `endpoint:/movies?type=movie` | 自定义 API 路径 |

## Cloudflare Workers

`examples/cloudflare-worker` 提供了模块化 Worker 示例。绑定一个 KV 命名空间到 `DDYS_NOTIFY_KV` 后，去重状态会跨运行保存。

```js
import { createWorkerHandler } from 'ddys-webhook-notifier/worker';

export default createWorkerHandler();
```

Worker 还提供：

- `GET /health`：返回基础状态。
- `POST /run`：手动触发一次；设置 `DDYS_NOTIFY_RUN_TOKEN` 后需要 `Authorization: Bearer <token>`。

## 编程调用

```js
import { runNotifier, createMemoryDedupeStore } from 'ddys-webhook-notifier';

const result = await runNotifier({
  sources: ['latest', 'hot'],
  targets: [{ type: 'discord', url: process.env.DISCORD_WEBHOOK_URL }],
  dedupeStore: createMemoryDedupeStore()
});

console.log(result.ok, result.newItems);
```

## 通用 Webhook 负载

通用目标会收到结构化 JSON：

```json
{
  "title": "DDYS latest updates",
  "text": "DDYS latest updates\n\n1. Example",
  "markdown": "### DDYS latest updates\n\n1. **[Example](https://ddys.io/movies/example)**",
  "source": { "kind": "latest", "label": "latest" },
  "items": [],
  "generatedAt": "2026-07-10T15:00:00.000Z"
}
```

## 常用环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DDYS_NOTIFY_API_BASE` | `https://ddys.io/api/v1` | DDYS API 地址 |
| `DDYS_NOTIFY_PUBLIC_BASE` | `https://ddys.io` | 影片链接基础地址 |
| `DDYS_NOTIFY_SOURCES` | `latest` | 推送数据源 |
| `DDYS_NOTIFY_MAX_ITEMS` | `8` | 每个数据源最多推送条数 |
| `DDYS_NOTIFY_MODE` | `new` | `new` 只推新内容，`all` 每次都推 |
| `DDYS_NOTIFY_RETRIES` | `2` | 失败重试次数 |
| `DDYS_NOTIFY_TIMEOUT_MS` | `10000` | 请求超时毫秒数 |
| `DDYS_NOTIFY_DEDUPE_TTL_SECONDS` | `1209600` | 去重记录保留时间 |

## 说明

这个包只做独立通知能力，不绑定任何 CMS，也不依赖已有聊天机器人包。不同平台的交互式机器人仍然由各自独立仓库维护。
