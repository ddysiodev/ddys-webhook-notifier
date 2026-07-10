import {
  parseBoolean,
  parseNonNegativeInteger,
  parsePositiveInteger,
  redactSecret,
  redactUrl,
  splitList
} from './utils.js';

export const VERSION = '0.1.0';

export const DEFAULT_CONFIG = {
  version: VERSION,
  apiBase: 'https://ddys.io/api/v1',
  publicBase: 'https://ddys.io',
  userAgent: `ddys-webhook-notifier/${VERSION}`,
  sources: ['latest'],
  targets: [],
  maxItems: 8,
  mode: 'new',
  requestTimeoutMs: 10000,
  retries: 2,
  retryMinDelayMs: 500,
  retryMaxDelayMs: 4000,
  dedupeTtlSeconds: 14 * 24 * 60 * 60,
  dedupeMaxEntries: 2000,
  dryRun: false,
  failFast: false,
  titlePrefix: 'DDYS',
  includeDescription: true,
  includePoster: true,
  runToken: ''
};

export function loadConfigFromEnv(env = getProcessEnv()) {
  return createConfig({}, env);
}

export function createConfig(input = {}, env = input.env || getProcessEnv()) {
  const envConfig = readEnvConfig(env || {});
  const merged = {
    ...DEFAULT_CONFIG,
    ...envConfig,
    ...input
  };

  merged.apiBase = normalizeBaseUrl(merged.apiBase, 'apiBase');
  merged.publicBase = normalizeBaseUrl(merged.publicBase, 'publicBase');
  merged.maxItems = parsePositiveInteger(merged.maxItems, DEFAULT_CONFIG.maxItems, 'maxItems');
  merged.requestTimeoutMs = parsePositiveInteger(merged.requestTimeoutMs, DEFAULT_CONFIG.requestTimeoutMs, 'requestTimeoutMs');
  merged.retries = parseNonNegativeInteger(merged.retries, DEFAULT_CONFIG.retries, 'retries');
  merged.retryMinDelayMs = parseNonNegativeInteger(merged.retryMinDelayMs, DEFAULT_CONFIG.retryMinDelayMs, 'retryMinDelayMs');
  merged.retryMaxDelayMs = parseNonNegativeInteger(merged.retryMaxDelayMs, DEFAULT_CONFIG.retryMaxDelayMs, 'retryMaxDelayMs');
  merged.dedupeTtlSeconds = parsePositiveInteger(merged.dedupeTtlSeconds, DEFAULT_CONFIG.dedupeTtlSeconds, 'dedupeTtlSeconds');
  merged.dedupeMaxEntries = parsePositiveInteger(merged.dedupeMaxEntries, DEFAULT_CONFIG.dedupeMaxEntries, 'dedupeMaxEntries');
  merged.dryRun = parseBoolean(merged.dryRun, DEFAULT_CONFIG.dryRun);
  merged.failFast = parseBoolean(merged.failFast, DEFAULT_CONFIG.failFast);
  merged.mode = normalizeMode(merged.mode);
  merged.sources = normalizeSources(input.sources ?? envConfig.sources ?? DEFAULT_CONFIG.sources, merged);
  merged.targets = normalizeTargets(input.targets ?? envConfig.targets ?? DEFAULT_CONFIG.targets);
  return merged;
}

export function readEnvConfig(env = {}) {
  const out = {};
  if (env.DDYS_NOTIFY_API_BASE) out.apiBase = env.DDYS_NOTIFY_API_BASE;
  if (env.DDYS_NOTIFY_PUBLIC_BASE) out.publicBase = env.DDYS_NOTIFY_PUBLIC_BASE;
  if (env.DDYS_NOTIFY_USER_AGENT) out.userAgent = env.DDYS_NOTIFY_USER_AGENT;
  if (env.DDYS_NOTIFY_SOURCES) out.sources = env.DDYS_NOTIFY_SOURCES;
  if (env.DDYS_NOTIFY_MAX_ITEMS) out.maxItems = env.DDYS_NOTIFY_MAX_ITEMS;
  if (env.DDYS_NOTIFY_MODE) out.mode = env.DDYS_NOTIFY_MODE;
  if (env.DDYS_NOTIFY_TIMEOUT_MS) out.requestTimeoutMs = env.DDYS_NOTIFY_TIMEOUT_MS;
  if (env.DDYS_NOTIFY_RETRIES) out.retries = env.DDYS_NOTIFY_RETRIES;
  if (env.DDYS_NOTIFY_RETRY_MIN_DELAY_MS) out.retryMinDelayMs = env.DDYS_NOTIFY_RETRY_MIN_DELAY_MS;
  if (env.DDYS_NOTIFY_RETRY_MAX_DELAY_MS) out.retryMaxDelayMs = env.DDYS_NOTIFY_RETRY_MAX_DELAY_MS;
  if (env.DDYS_NOTIFY_DEDUPE_TTL_SECONDS) out.dedupeTtlSeconds = env.DDYS_NOTIFY_DEDUPE_TTL_SECONDS;
  if (env.DDYS_NOTIFY_DEDUPE_MAX_ENTRIES) out.dedupeMaxEntries = env.DDYS_NOTIFY_DEDUPE_MAX_ENTRIES;
  if (env.DDYS_NOTIFY_DRY_RUN) out.dryRun = env.DDYS_NOTIFY_DRY_RUN;
  if (env.DDYS_NOTIFY_FAIL_FAST) out.failFast = env.DDYS_NOTIFY_FAIL_FAST;
  if (env.DDYS_NOTIFY_TITLE_PREFIX) out.titlePrefix = env.DDYS_NOTIFY_TITLE_PREFIX;
  if (env.DDYS_NOTIFY_RUN_TOKEN) out.runToken = env.DDYS_NOTIFY_RUN_TOKEN;
  out.targets = buildTargetsFromEnv(env);
  return out;
}

export function normalizeSources(value, config = DEFAULT_CONFIG) {
  const values = Array.isArray(value) ? value : splitList(value);
  const sources = values.map((item) => normalizeSource(item, config)).filter(Boolean);
  return sources.length ? sources : [normalizeSource('latest', config)];
}

export function normalizeSource(value, config = DEFAULT_CONFIG) {
  if (!value && value !== 0) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const source = { ...value };
    source.kind = normalizeSourceKind(source.kind || source.type || source.name || 'endpoint');
    if (source.kind !== 'endpoint' && !source.endpoint) source.endpoint = endpointForKind(source.kind);
    source.label = source.label || labelForSource(source);
    source.limit = parsePositiveInteger(source.limit ?? config.maxItems, config.maxItems, 'source.limit');
    source.query = normalizeSourceQuery(source, config);
    return source;
  }

  const token = String(value || '').trim();
  if (!token) return null;
  const separator = token.indexOf(':');
  const rawKind = separator >= 0 ? token.slice(0, separator) : token;
  const rawValue = separator >= 0 ? token.slice(separator + 1) : '';
  const kind = normalizeSourceKind(rawKind);
  const source = {
    kind,
    value: rawValue,
    endpoint: kind === 'endpoint' ? rawValue : endpointForKind(kind),
    limit: config.maxItems
  };
  source.query = normalizeSourceQuery(source, config);
  source.label = labelForSource(source);
  return source;
}

export function normalizeTargets(value) {
  const rawTargets = Array.isArray(value) ? value : parseTargetsValue(value);
  return rawTargets
    .map((item) => normalizeTarget(item))
    .filter((item) => item && item.enabled !== false);
}

export function normalizeTarget(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const separator = value.indexOf(':');
    if (separator < 0) return { type: 'generic', url: value.trim() };
    const type = value.slice(0, separator).trim().toLowerCase();
    const url = value.slice(separator + 1).trim();
    return normalizeTarget({ type, url });
  }

  const target = { ...value };
  target.type = String(target.type || target.kind || 'generic').trim().toLowerCase();
  if (target.webhookUrl && !target.url) target.url = target.webhookUrl;
  if (target.bot_token && !target.botToken) target.botToken = target.bot_token;
  if (target.chat_id && !target.chatId) target.chatId = target.chat_id;
  if (target.thread_id && !target.threadId) target.threadId = target.thread_id;
  target.id = target.id || target.name || defaultTargetId(target);
  if (target.headers && typeof target.headers !== 'object') target.headers = {};
  return target;
}

export function describeConfig(config) {
  return {
    version: config.version,
    apiBase: config.apiBase,
    publicBase: config.publicBase,
    sources: config.sources.map((source) => ({
      kind: source.kind,
      label: source.label,
      endpoint: source.endpoint,
      query: source.query,
      limit: source.limit
    })),
    targets: config.targets.map((target) => ({
      id: target.id,
      type: target.type,
      url: target.url ? redactUrl(target.url) : '',
      botToken: target.botToken ? redactSecret(target.botToken) : '',
      chatId: target.chatId ? String(target.chatId) : ''
    })),
    maxItems: config.maxItems,
    mode: config.mode,
    requestTimeoutMs: config.requestTimeoutMs,
    retries: config.retries,
    dedupeTtlSeconds: config.dedupeTtlSeconds,
    dryRun: config.dryRun
  };
}

function buildTargetsFromEnv(env) {
  const targets = [];
  if (env.DDYS_NOTIFY_TARGETS) targets.push(...parseTargetsValue(env.DDYS_NOTIFY_TARGETS));
  for (const url of splitList(env.DDYS_NOTIFY_GENERIC_WEBHOOK_URL)) targets.push({ type: 'generic', url });
  for (const url of splitList(env.DDYS_NOTIFY_DISCORD_WEBHOOK_URL)) targets.push({ type: 'discord', url });
  for (const url of splitList(env.DDYS_NOTIFY_SLACK_WEBHOOK_URL)) targets.push({ type: 'slack', url });
  for (const url of splitList(env.DDYS_NOTIFY_DINGTALK_WEBHOOK_URL)) {
    targets.push({ type: 'dingtalk', url, secret: env.DDYS_NOTIFY_DINGTALK_SECRET || '' });
  }
  for (const url of splitList(env.DDYS_NOTIFY_WECOM_WEBHOOK_URL)) targets.push({ type: 'wecom', url });
  for (const url of splitList(env.DDYS_NOTIFY_LARK_WEBHOOK_URL || env.DDYS_NOTIFY_FEISHU_WEBHOOK_URL)) {
    targets.push({ type: 'lark', url, secret: env.DDYS_NOTIFY_LARK_SECRET || env.DDYS_NOTIFY_FEISHU_SECRET || '' });
  }
  if (env.DDYS_NOTIFY_TELEGRAM_BOT_TOKEN && env.DDYS_NOTIFY_TELEGRAM_CHAT_ID) {
    targets.push({
      type: 'telegram',
      botToken: env.DDYS_NOTIFY_TELEGRAM_BOT_TOKEN,
      chatId: env.DDYS_NOTIFY_TELEGRAM_CHAT_ID,
      threadId: env.DDYS_NOTIFY_TELEGRAM_THREAD_ID || ''
    });
  }
  return targets;
}

function parseTargetsValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return [value];
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[') || text.startsWith('{')) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return splitList(text);
}

function normalizeSourceKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  const aliases = {
    new: 'latest',
    newest: 'latest',
    popular: 'hot',
    cal: 'calendar',
    schedule: 'calendar',
    find: 'search',
    s: 'search',
    api: 'endpoint',
    path: 'endpoint',
    custom: 'endpoint'
  };
  return aliases[kind] || kind || 'latest';
}

function endpointForKind(kind) {
  if (kind === 'latest') return '/latest';
  if (kind === 'hot') return '/hot';
  if (kind === 'calendar') return '/calendar';
  if (kind === 'search') return '/search';
  if (kind === 'endpoint') return '';
  throw new Error(`Unsupported source kind: ${kind}`);
}

function normalizeSourceQuery(source, config) {
  const query = { ...(source.query || {}) };
  if (!('limit' in query) && source.kind !== 'calendar') query.limit = source.limit || config.maxItems;
  if (source.kind === 'search') {
    const q = source.value || query.q || query.query || '';
    if (!q) throw new Error('search source requires a keyword, for example search:keyword.');
    query.q = q;
    delete query.query;
  }
  if (source.kind === 'calendar') {
    const value = String(source.value || '').trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) {
      const [year, month] = value.split('-');
      query.year = Number(year);
      query.month = Number(month);
    } else if (/^\d{4}-\d{1,2}$/.test(value)) {
      const [year, month] = value.split('-');
      query.year = Number(year);
      query.month = Number(month);
    }
  }
  return query;
}

function labelForSource(source) {
  if (source.label) return source.label;
  if (source.kind === 'search') return `search:${source.value || source.query?.q || ''}`;
  if (source.kind === 'endpoint') return source.endpoint || 'endpoint';
  return source.kind;
}

function defaultTargetId(target) {
  const type = String(target.type || 'generic').toLowerCase();
  if (type === 'telegram') return `${type}:${target.chatId || 'chat'}`;
  if (target.url) {
    try {
      const url = new URL(target.url);
      return `${type}:${url.hostname}`;
    } catch {
      return type;
    }
  }
  return type;
}

function normalizeMode(value) {
  const mode = String(value || DEFAULT_CONFIG.mode).trim().toLowerCase();
  if (['new', 'all'].includes(mode)) return mode;
  throw new Error('mode must be "new" or "all".');
}

function normalizeBaseUrl(value, name) {
  try {
    const url = new URL(String(value || '').trim());
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}

function getProcessEnv() {
  return globalThis.process?.env || {};
}
