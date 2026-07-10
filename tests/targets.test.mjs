import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDingTalkUrl,
  buildDiscordPayload,
  buildLarkPayload,
  buildSlackPayload,
  buildTelegramPayload,
  buildWeComPayload,
  createConfig
} from '../src/index.js';

const config = createConfig({ dryRun: true, includePoster: true });
const notification = {
  title: 'DDYS latest updates',
  text: 'DDYS latest updates\n\n1. Alpha',
  markdown: '### DDYS latest updates\n\n1. **[Alpha](https://ddys.io/movies/alpha)**',
  source: { kind: 'latest', label: 'latest' },
  generatedAt: '2026-07-10T00:00:00.000Z',
  items: [
    {
      title: 'Alpha',
      url: 'https://ddys.io/movies/alpha',
      year: '2026',
      region: 'JP',
      type: 'movie',
      description: 'Description',
      poster: 'https://ddys.io/a.jpg'
    }
  ]
};

test('builds Discord payload with mention-safe defaults', () => {
  const payload = buildDiscordPayload(notification, config);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.equal(payload.embeds[0].title, 'Alpha');
  assert.equal(payload.embeds[0].thumbnail.url, 'https://ddys.io/a.jpg');
});

test('builds Slack, Telegram, WeCom payloads', () => {
  assert.equal(buildSlackPayload(notification, config).blocks[0].type, 'header');
  assert.equal(buildTelegramPayload(notification, config, { chatId: '-100' }).chat_id, '-100');
  assert.equal(buildWeComPayload(notification, config).msgtype, 'markdown');
});

test('signs DingTalk and Lark payloads', async () => {
  const runtime = { now: () => 1000 };
  const url = await buildDingTalkUrl({ type: 'dingtalk', url: 'https://example.com/hook', secret: 'secret' }, runtime);
  const lark = await buildLarkPayload(notification, config, { type: 'lark', secret: 'secret' }, runtime);

  assert.match(url, /timestamp=1000/);
  assert.match(url, /sign=/);
  assert.equal(lark.timestamp, '1');
  assert.ok(lark.sign);
});
