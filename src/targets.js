import { createTimeoutSignal, dropUndefined, hmacSha256Base64, sleep, truncate } from './utils.js';

export async function sendAllTargets(targets, notification, config, runtime = {}) {
  const deliveries = [];
  for (const target of targets) {
    try {
      const delivery = await sendTarget(target, notification, config, runtime);
      deliveries.push(delivery);
    } catch (error) {
      const failure = {
        ok: false,
        target: target.id || target.type,
        type: target.type,
        error: error.message
      };
      deliveries.push(failure);
      if (config.failFast) throw error;
    }
  }
  return deliveries;
}

export async function sendTarget(target, notification, config, runtime = {}) {
  const fetchImpl = runtime.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  const request = await buildTargetRequest(target, notification, config, runtime);
  const started = Date.now();
  const response = await sendWithRetry(fetchImpl, request, config);
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(`${target.type} target failed with HTTP ${response.status}: ${body.message || body.text || ''}`.trim());
  }
  assertPlatformResponse(target, body);
  return {
    ok: true,
    target: target.id || target.type,
    type: target.type,
    status: response.status,
    ms: Date.now() - started,
    response: summarizeResponse(body)
  };
}

export async function buildTargetRequest(target, notification, config, runtime = {}) {
  switch (target.type) {
    case 'discord':
      return jsonRequest(requireUrl(target), buildDiscordPayload(notification, config, target));
    case 'slack':
      return jsonRequest(requireUrl(target), buildSlackPayload(notification, config, target));
    case 'telegram':
      return jsonRequest(buildTelegramUrl(target), buildTelegramPayload(notification, config, target));
    case 'dingtalk':
      return jsonRequest(await buildDingTalkUrl(target, runtime), buildDingTalkPayload(notification, config, target));
    case 'wecom':
      return jsonRequest(requireUrl(target), buildWeComPayload(notification, config, target));
    case 'lark':
    case 'feishu':
      return jsonRequest(requireUrl(target), await buildLarkPayload(notification, config, target, runtime));
    case 'generic':
    default:
      return jsonRequest(requireUrl(target), buildGenericPayload(notification, config, target), target);
  }
}

export function buildGenericPayload(notification, config, target = {}) {
  return {
    event: 'ddys.notification',
    title: notification.title,
    text: notification.text,
    markdown: notification.markdown,
    source: notification.source,
    items: notification.items,
    generatedAt: notification.generatedAt,
    meta: {
      notifier: 'ddys-webhook-notifier',
      version: config.version,
      target: target.id || target.type || 'generic'
    }
  };
}

export function buildDiscordPayload(notification, config, target = {}) {
  return {
    content: truncate(target.content || notification.title, 2000),
    allowed_mentions: { parse: [] },
    embeds: notification.items.slice(0, 10).map((item) => {
      const fields = [];
      const meta = [item.year, item.region, item.type, item.episode].filter(Boolean).join(' / ');
      if (meta) fields.push({ name: 'Info', value: truncate(meta, 1024), inline: true });
      const embed = {
        title: truncate(item.title || 'Untitled', 256),
        url: item.url || undefined,
        description: item.description ? truncate(item.description, 4096) : undefined,
        fields,
        color: target.color || 0x2f80ed
      };
      if (config.includePoster !== false && item.poster) embed.thumbnail = { url: item.poster };
      return dropUndefined(embed);
    })
  };
}

export function buildSlackPayload(notification, config, target = {}) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: truncate(notification.title, 150), emoji: false }
    }
  ];
  for (const item of notification.items.slice(0, 10)) {
    const meta = [item.year, item.region, item.type, item.episode].filter(Boolean).join(' / ');
    const line = item.url ? `<${item.url}|${escapeSlack(item.title)}>` : escapeSlack(item.title);
    const text = [`*${line}*`, meta, item.description ? truncate(item.description, 220) : ''].filter(Boolean).join('\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: truncate(text, 3000) } });
  }
  return {
    text: truncate(target.text || notification.text, 3000),
    blocks
  };
}

export function buildTelegramPayload(notification, config, target = {}) {
  return dropUndefined({
    chat_id: target.chatId,
    message_thread_id: target.threadId || undefined,
    text: truncate(notification.text, 4096),
    parse_mode: target.parseMode || undefined,
    disable_web_page_preview: target.disableWebPagePreview === true
  });
}

export function buildDingTalkPayload(notification, config, target = {}) {
  return {
    msgtype: 'markdown',
    markdown: {
      title: truncate(notification.title, 128),
      text: truncate(notification.markdown, 12000)
    },
    at: {
      atMobiles: Array.isArray(target.atMobiles) ? target.atMobiles : [],
      atUserIds: Array.isArray(target.atUserIds) ? target.atUserIds : [],
      isAtAll: Boolean(target.isAtAll)
    }
  };
}

export function buildWeComPayload(notification, config, target = {}) {
  if (target.format === 'news') {
    return {
      msgtype: 'news',
      news: {
        articles: notification.items.slice(0, 8).map((item) => ({
          title: truncate(item.title, 128),
          description: truncate([item.year, item.region, item.type, item.description].filter(Boolean).join(' / '), 512),
          url: item.url,
          picurl: config.includePoster === false ? '' : item.poster
        }))
      }
    };
  }
  return {
    msgtype: 'markdown',
    markdown: { content: truncate(notification.markdown, 4000) }
  };
}

export async function buildLarkPayload(notification, config, target = {}, runtime = {}) {
  const payload = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: truncate(notification.title, 80) }
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content: truncate(notification.markdown, 6000) }
        }
      ]
    }
  };
  if (target.secret) {
    const now = runtime.now || (() => Date.now());
    const timestamp = Math.floor(now() / 1000);
    payload.timestamp = String(timestamp);
    payload.sign = await hmacSha256Base64(target.secret, `${timestamp}\n${target.secret}`);
  }
  return payload;
}

export async function buildDingTalkUrl(target, runtime = {}) {
  const url = new URL(requireUrl(target));
  if (!target.secret) return url.toString();
  const now = runtime.now || (() => Date.now());
  const timestamp = String(now());
  const sign = await hmacSha256Base64(target.secret, `${timestamp}\n${target.secret}`);
  url.searchParams.set('timestamp', timestamp);
  url.searchParams.set('sign', sign);
  return url.toString();
}

export function buildTelegramUrl(target) {
  if (target.url) return target.url;
  if (!target.botToken) throw new Error('Telegram target requires botToken.');
  const apiBase = String(target.apiBase || 'https://api.telegram.org').replace(/\/+$/, '');
  return `${apiBase}/bot${target.botToken}/sendMessage`;
}

function jsonRequest(url, payload, target = {}) {
  return {
    url,
    init: {
      method: target.method || 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json; charset=utf-8',
        ...(target.headers || {})
      },
      body: JSON.stringify(payload)
    },
    payload
  };
}

async function sendWithRetry(fetchImpl, request, config) {
  let lastError;
  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    const timeout = createTimeoutSignal(config.requestTimeoutMs);
    try {
      const response = await fetchImpl(request.url, { ...request.init, signal: timeout.signal });
      if (response.ok || attempt >= config.retries) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = timeout.timedOut()
        ? new Error(`Request timed out after ${config.requestTimeoutMs}ms.`)
        : error;
      if (attempt >= config.retries) throw lastError;
    } finally {
      timeout.cancel();
    }
    await sleep(backoffDelay(config, attempt));
  }
  throw lastError;
}

function backoffDelay(config, attempt) {
  const min = config.retryMinDelayMs;
  const max = config.retryMaxDelayMs;
  return Math.min(max, min * (2 ** attempt));
}

async function readResponseBody(response) {
  if (response.status === 204) return {};
  const type = response.headers?.get?.('content-type') || '';
  const text = await response.text();
  if (!text) return {};
  if (type.includes('application/json') || /^[\s{[]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }
  return { text };
}

function assertPlatformResponse(target, body) {
  if (!body || typeof body !== 'object') return;
  if (target.type === 'telegram' && body.ok === false) throw new Error(`Telegram API failed: ${body.description || 'unknown error'}`);
  if (['dingtalk', 'wecom'].includes(target.type) && 'errcode' in body && body.errcode !== 0) {
    throw new Error(`${target.type} API failed: ${body.errmsg || body.errcode}`);
  }
  if (['lark', 'feishu'].includes(target.type) && 'code' in body && body.code !== 0) {
    throw new Error(`Lark API failed: ${body.msg || body.message || body.code}`);
  }
}

function summarizeResponse(body) {
  if (!body || typeof body !== 'object') return {};
  return dropUndefined({
    ok: body.ok,
    errcode: body.errcode,
    code: body.code,
    message: body.description || body.errmsg || body.msg || body.message
  });
}

function requireUrl(target) {
  if (!target.url) throw new Error(`${target.type || 'generic'} target requires url.`);
  return String(target.url);
}

function escapeSlack(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
