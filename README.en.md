# ddys-webhook-notifier

Scheduled webhook notifier for the DDYS API. It polls latest, hot, calendar, search, or custom endpoints, deduplicates items, and fan-outs notifications to multiple chat platforms.

[中文](README.md)

## Features

- Sources: `latest`, `hot`, `calendar`, `search:keyword`, and custom API endpoints.
- Deduplication: item fingerprints prevent repeated notifications.
- Targets: generic webhook, Discord, Slack, Telegram, DingTalk, WeCom, and Feishu/Lark.
- Runtimes: Node CLI, Cloudflare Workers scheduled triggers, GitHub Actions, or any Node runner.
- Reliability: timeouts, retries, dry-run rendering, and redacted diagnostics.

## Quick Start

```bash
DDYS_NOTIFY_SOURCES=latest,hot
DDYS_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
npx ddys-webhook-notifier run --state-file .ddys-notifier-state.json
```

Preview without sending:

```bash
npx ddys-webhook-notifier run --dry-run
```

Show redacted diagnostics:

```bash
npx ddys-webhook-notifier diag
```

## Targets

Use per-platform variables:

```bash
DDYS_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DDYS_NOTIFY_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DDYS_NOTIFY_DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=...
DDYS_NOTIFY_DINGTALK_SECRET=SEC...
DDYS_NOTIFY_WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...
DDYS_NOTIFY_LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/...
DDYS_NOTIFY_LARK_SECRET=...
DDYS_NOTIFY_TELEGRAM_BOT_TOKEN=123456:xxx
DDYS_NOTIFY_TELEGRAM_CHAT_ID=-1001234567890
```

Or provide one JSON array:

```bash
DDYS_NOTIFY_TARGETS='[
  {"type":"discord","url":"https://discord.com/api/webhooks/..."},
  {"type":"telegram","botToken":"123456:xxx","chatId":"-1001234567890"},
  {"type":"generic","url":"https://example.com/ddys-webhook"}
]'
```

## Cloudflare Workers

```js
import { createWorkerHandler } from 'ddys-webhook-notifier/worker';

export default createWorkerHandler();
```

Bind a KV namespace as `DDYS_NOTIFY_KV` to persist dedupe state between scheduled runs.

## Programmatic Usage

```js
import { runNotifier, createMemoryDedupeStore } from 'ddys-webhook-notifier';

const result = await runNotifier({
  sources: ['latest', 'hot'],
  targets: [{ type: 'discord', url: process.env.DISCORD_WEBHOOK_URL }],
  dedupeStore: createMemoryDedupeStore()
});

console.log(result.ok, result.newItems);
```
