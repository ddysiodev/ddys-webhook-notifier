export {
  VERSION,
  DEFAULT_CONFIG,
  createConfig,
  describeConfig,
  loadConfigFromEnv,
  normalizeSource,
  normalizeSources,
  normalizeTarget,
  normalizeTargets,
  readEnvConfig
} from './config.js';
export { buildSourceUrl, fetchDdysSource, fetchDdysSources } from './client.js';
export { extractItems, fingerprintItem, normalizeItem, normalizeItems } from './normalize.js';
export { createKvDedupeStore, createMemoryDedupeStore, filterNewItems, markItemsSeen } from './dedupe.js';
export { buildNotification, itemMeta, notificationTitle, renderMarkdown, renderText } from './format.js';
export {
  buildDingTalkPayload,
  buildDingTalkUrl,
  buildDiscordPayload,
  buildGenericPayload,
  buildLarkPayload,
  buildSlackPayload,
  buildTargetRequest,
  buildTelegramPayload,
  buildTelegramUrl,
  buildWeComPayload,
  sendAllTargets,
  sendTarget
} from './targets.js';
export { createDdysWebhookNotifier, runNotifier } from './notifier.js';
export { createWorkerHandler, runWorkerNotifier } from './worker.js';
