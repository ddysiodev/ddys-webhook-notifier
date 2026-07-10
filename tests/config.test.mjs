import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfig, describeConfig, normalizeSource, normalizeTarget } from '../src/index.js';

test('parses env sources and platform targets', () => {
  const config = createConfig({}, {
    DDYS_NOTIFY_SOURCES: 'latest,hot,calendar:2026-07,search:space',
    DDYS_NOTIFY_DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/token',
    DDYS_NOTIFY_TELEGRAM_BOT_TOKEN: '123456:secret',
    DDYS_NOTIFY_TELEGRAM_CHAT_ID: '-1001',
    DDYS_NOTIFY_MAX_ITEMS: '5'
  });

  assert.equal(config.sources.length, 4);
  assert.equal(config.sources[2].query.year, 2026);
  assert.equal(config.sources[2].query.month, 7);
  assert.equal(config.sources[3].query.q, 'space');
  assert.equal(config.targets.length, 2);
  assert.equal(config.maxItems, 5);
});

test('normalizes endpoint source and target strings', () => {
  const source = normalizeSource('endpoint:/movies?type=movie', createConfig({ dryRun: true }));
  const target = normalizeTarget('discord:https://discord.com/api/webhooks/1/token');

  assert.equal(source.kind, 'endpoint');
  assert.equal(source.endpoint, '/movies?type=movie');
  assert.equal(target.type, 'discord');
  assert.equal(target.url, 'https://discord.com/api/webhooks/1/token');
});

test('describeConfig redacts target secrets', () => {
  const config = createConfig({
    dryRun: true,
    targets: [
      { type: 'dingtalk', url: 'https://oapi.dingtalk.com/robot/send?access_token=abcdef', secret: 'SEC123456789' },
      { type: 'discord', url: 'https://discord.com/api/webhooks/example/token' }
    ]
  });
  const description = describeConfig(config);

  assert.match(description.targets[0].url, /access_token=\*\*\*/);
  assert.equal(description.targets[0].type, 'dingtalk');
  assert.equal(description.targets[1].url, 'https://discord.com/api/webhooks/***/***');
});
