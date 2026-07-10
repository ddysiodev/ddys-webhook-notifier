import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceUrl, createConfig, createMemoryDedupeStore, runNotifier } from '../src/index.js';
import { createFetchMock, jsonResponse, samplePayload } from './helpers.mjs';

test('builds DDYS calendar and search URLs', () => {
  const config = createConfig({ dryRun: true, sources: ['calendar:2026-07', 'search:space'] });
  assert.equal(buildSourceUrl(config.sources[0], config), 'https://ddys.io/api/v1/calendar?year=2026&month=7');
  assert.equal(buildSourceUrl(config.sources[1], config), 'https://ddys.io/api/v1/search?limit=8&q=space');
});

test('runNotifier fetches, sends, and dedupes items', async () => {
  const store = createMemoryDedupeStore();
  const fetch = createFetchMock((url) => {
    if (url.includes('/latest')) return jsonResponse(samplePayload);
    return jsonResponse({ ok: true });
  });

  const first = await runNotifier({
    sources: ['latest'],
    targets: [{ type: 'generic', url: 'https://example.com/webhook' }],
    dedupeStore: store
  }, { fetch });

  assert.equal(first.ok, true);
  assert.equal(first.fetchedItems, 2);
  assert.equal(first.newItems, 2);
  assert.equal(fetch.calls.length, 2);
  const sentBody = JSON.parse(fetch.calls[1].init.body);
  assert.equal(sentBody.items.length, 2);

  const second = await runNotifier({
    sources: ['latest'],
    targets: [{ type: 'generic', url: 'https://example.com/webhook' }],
    dedupeStore: store
  }, { fetch });

  assert.equal(second.ok, true);
  assert.equal(second.newItems, 0);
});

test('dry-run renders notification without real target', async () => {
  const fetch = createFetchMock(() => jsonResponse(samplePayload));
  const result = await runNotifier({
    sources: ['hot'],
    dryRun: true
  }, { fetch });

  assert.equal(result.ok, true);
  assert.equal(result.notifications.length, 1);
  assert.match(result.notifications[0].text, /Alpha Movie/);
});
