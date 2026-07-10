import { createConfig } from './config.js';
import { fetchDdysSource } from './client.js';
import { createMemoryDedupeStore, filterNewItems, markItemsSeen } from './dedupe.js';
import { buildNotification } from './format.js';
import { sendAllTargets } from './targets.js';

export async function runNotifier(input = {}, runtime = {}) {
  const config = createConfig(input, input.env || runtime.env);
  const dedupeStore = runtime.dedupeStore || config.dedupeStore || createMemoryDedupeStore({
    maxEntries: config.dedupeMaxEntries,
    now: runtime.now
  });
  if (!config.dryRun && config.targets.length === 0) {
    throw new Error('At least one target is required unless dryRun is enabled.');
  }

  const result = {
    ok: true,
    dryRun: config.dryRun,
    sourceCount: config.sources.length,
    targetCount: config.targets.length,
    fetchedItems: 0,
    newItems: 0,
    sources: [],
    notifications: [],
    deliveries: [],
    errors: []
  };

  for (const source of config.sources) {
    try {
      const fetched = await fetchDdysSource(source, config, runtime);
      result.fetchedItems += fetched.items.length;
      const newItems = await filterNewItems(fetched.items, dedupeStore, config);
      result.newItems += newItems.length;

      const sourceSummary = {
        ok: true,
        source: source.label,
        kind: source.kind,
        fetched: fetched.items.length,
        fresh: newItems.length,
        url: fetched.url
      };
      result.sources.push(sourceSummary);

      if (!newItems.length) continue;
      const sourceResult = { ...fetched, items: newItems };
      const notification = buildNotification(sourceResult, config, runtime);
      result.notifications.push(notification);

      if (config.dryRun) {
        result.deliveries.push({ ok: true, type: 'dry-run', target: 'dry-run', source: source.label });
        await markItemsSeen(newItems, dedupeStore, config);
        continue;
      }

      const deliveries = await sendAllTargets(config.targets, notification, config, runtime);
      for (const delivery of deliveries) result.deliveries.push({ ...delivery, source: source.label });
      const delivered = deliveries.length > 0 && deliveries.every((delivery) => delivery.ok);
      if (delivered) await markItemsSeen(newItems, dedupeStore, config);
      else result.ok = false;
    } catch (error) {
      result.ok = false;
      result.sources.push({
        ok: false,
        source: source.label,
        kind: source.kind,
        error: error.message
      });
      result.errors.push({ source: source.label, error: error.message });
      if (config.failFast) throw error;
    }
  }

  if (typeof dedupeStore.save === 'function') await dedupeStore.save();
  return result;
}

export function createDdysWebhookNotifier(defaultConfig = {}, defaultRuntime = {}) {
  return {
    runOnce(config = {}, runtime = {}) {
      return runNotifier({ ...defaultConfig, ...config }, { ...defaultRuntime, ...runtime });
    }
  };
}
