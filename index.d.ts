export type DdysNotifierMode = 'new' | 'all';
export type DdysSourceKind = 'latest' | 'hot' | 'calendar' | 'search' | 'endpoint';
export type DdysTargetType = 'generic' | 'discord' | 'slack' | 'telegram' | 'dingtalk' | 'wecom' | 'lark' | 'feishu';

export interface DdysSource {
  kind: DdysSourceKind | string;
  label?: string;
  value?: string;
  endpoint?: string;
  query?: Record<string, unknown>;
  limit?: number;
}

export interface DdysTarget {
  type: DdysTargetType | string;
  id?: string;
  name?: string;
  url?: string;
  webhookUrl?: string;
  headers?: Record<string, string>;
  secret?: string;
  botToken?: string;
  chatId?: string | number;
  threadId?: string | number;
  parseMode?: string;
  format?: 'markdown' | 'news' | string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface DdysNotifierConfig {
  version?: string;
  apiBase?: string;
  publicBase?: string;
  userAgent?: string;
  sources?: Array<DdysSource | string> | string;
  targets?: Array<DdysTarget | string> | string;
  maxItems?: number | string;
  mode?: DdysNotifierMode | string;
  requestTimeoutMs?: number | string;
  retries?: number | string;
  retryMinDelayMs?: number | string;
  retryMaxDelayMs?: number | string;
  dedupeTtlSeconds?: number | string;
  dedupeMaxEntries?: number | string;
  dryRun?: boolean | string;
  failFast?: boolean | string;
  titlePrefix?: string;
  includeDescription?: boolean;
  includePoster?: boolean;
  runToken?: string;
  dedupeStore?: DedupeStore;
  env?: Record<string, string | undefined>;
}

export interface DdysItem {
  id: string;
  slug: string;
  title: string;
  year: string;
  region: string;
  type: string;
  episode: string;
  updatedAt: string;
  description: string;
  poster: string;
  url: string;
  source: string;
  fingerprint: string;
  raw?: unknown;
}

export interface DdysSourceResult {
  source: DdysSource;
  url: string;
  payload?: unknown;
  items: DdysItem[];
}

export interface DdysNotification {
  title: string;
  text: string;
  markdown: string;
  source: Record<string, unknown>;
  items: DdysItem[];
  generatedAt: string;
}

export interface DedupeStore {
  type?: string;
  has(key: string): boolean | Promise<boolean>;
  set(key: string, value?: unknown, ttlSeconds?: number): void | Promise<void>;
  deleteExpired?(): void | Promise<void>;
  save?(): void | Promise<void>;
  export?(): unknown | Promise<unknown>;
  size?(): number;
}

export interface DdysRuntime {
  fetch?: typeof fetch;
  now?: () => number;
  env?: Record<string, unknown>;
  dedupeStore?: DedupeStore;
}

export interface DdysRunResult {
  ok: boolean;
  dryRun: boolean;
  sourceCount: number;
  targetCount: number;
  fetchedItems: number;
  newItems: number;
  sources: Array<Record<string, unknown>>;
  notifications: DdysNotification[];
  deliveries: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
}

export const VERSION: string;
export const DEFAULT_CONFIG: Required<Omit<DdysNotifierConfig, 'dedupeStore' | 'env'>>;

export function createConfig(input?: DdysNotifierConfig, env?: Record<string, string | undefined>): Required<DdysNotifierConfig>;
export function loadConfigFromEnv(env?: Record<string, string | undefined>): Required<DdysNotifierConfig>;
export function readEnvConfig(env?: Record<string, string | undefined>): Partial<DdysNotifierConfig>;
export function describeConfig(config: DdysNotifierConfig): Record<string, unknown>;
export function normalizeSource(value: DdysSource | string, config?: DdysNotifierConfig): DdysSource;
export function normalizeSources(value: Array<DdysSource | string> | string, config?: DdysNotifierConfig): DdysSource[];
export function normalizeTarget(value: DdysTarget | string): DdysTarget;
export function normalizeTargets(value: Array<DdysTarget | string> | string): DdysTarget[];

export function buildSourceUrl(source: DdysSource, config: DdysNotifierConfig, runtime?: DdysRuntime): string;
export function fetchDdysSource(source: DdysSource, config: DdysNotifierConfig, runtime?: DdysRuntime): Promise<DdysSourceResult>;
export function fetchDdysSources(sources: DdysSource[], config: DdysNotifierConfig, runtime?: DdysRuntime): Promise<DdysSourceResult[]>;
export function extractItems(payload: unknown): unknown[];
export function normalizeItems(payload: unknown, source: DdysSource, config: DdysNotifierConfig): DdysItem[];
export function normalizeItem(item: unknown, index: number, source: DdysSource, config: DdysNotifierConfig): DdysItem;
export function fingerprintItem(item: DdysItem, source?: DdysSource): string;

export function createMemoryDedupeStore(options?: { maxEntries?: number; now?: () => number }): DedupeStore;
export function createKvDedupeStore(namespace: unknown, options?: { prefix?: string }): DedupeStore;
export function filterNewItems(items: DdysItem[], store: DedupeStore, config: DdysNotifierConfig): Promise<DdysItem[]>;
export function markItemsSeen(items: DdysItem[], store: DedupeStore, config: DdysNotifierConfig): Promise<void>;

export function buildNotification(sourceResult: DdysSourceResult, config: DdysNotifierConfig, runtime?: DdysRuntime): DdysNotification;
export function notificationTitle(source: DdysSource, config: DdysNotifierConfig): string;
export function renderText(title: string, items: DdysItem[], config?: DdysNotifierConfig): string;
export function renderMarkdown(title: string, items: DdysItem[], config?: DdysNotifierConfig): string;
export function itemMeta(item: DdysItem): string;

export function buildTargetRequest(target: DdysTarget, notification: DdysNotification, config: DdysNotifierConfig, runtime?: DdysRuntime): Promise<Record<string, unknown>>;
export function sendTarget(target: DdysTarget, notification: DdysNotification, config: DdysNotifierConfig, runtime?: DdysRuntime): Promise<Record<string, unknown>>;
export function sendAllTargets(targets: DdysTarget[], notification: DdysNotification, config: DdysNotifierConfig, runtime?: DdysRuntime): Promise<Array<Record<string, unknown>>>;
export function buildGenericPayload(notification: DdysNotification, config: DdysNotifierConfig, target?: DdysTarget): Record<string, unknown>;
export function buildDiscordPayload(notification: DdysNotification, config: DdysNotifierConfig, target?: DdysTarget): Record<string, unknown>;
export function buildSlackPayload(notification: DdysNotification, config: DdysNotifierConfig, target?: DdysTarget): Record<string, unknown>;
export function buildTelegramPayload(notification: DdysNotification, config: DdysNotifierConfig, target?: DdysTarget): Record<string, unknown>;
export function buildTelegramUrl(target: DdysTarget): string;
export function buildDingTalkPayload(notification: DdysNotification, config: DdysNotifierConfig, target?: DdysTarget): Record<string, unknown>;
export function buildDingTalkUrl(target: DdysTarget, runtime?: DdysRuntime): Promise<string>;
export function buildWeComPayload(notification: DdysNotification, config: DdysNotifierConfig, target?: DdysTarget): Record<string, unknown>;
export function buildLarkPayload(notification: DdysNotification, config: DdysNotifierConfig, target?: DdysTarget, runtime?: DdysRuntime): Promise<Record<string, unknown>>;

export function runNotifier(input?: DdysNotifierConfig, runtime?: DdysRuntime): Promise<DdysRunResult>;
export function createDdysWebhookNotifier(defaultConfig?: DdysNotifierConfig, defaultRuntime?: DdysRuntime): {
  runOnce(config?: DdysNotifierConfig, runtime?: DdysRuntime): Promise<DdysRunResult>;
};

export function createWorkerHandler(options?: Record<string, unknown>): {
  scheduled(controller: unknown, env?: Record<string, unknown>, ctx?: { waitUntil?: (promise: Promise<unknown>) => void }): Promise<DdysRunResult>;
  fetch(request: Request, env?: Record<string, unknown>, ctx?: { waitUntil?: (promise: Promise<unknown>) => void }): Promise<Response>;
};
export function runWorkerNotifier(options?: Record<string, unknown>, env?: Record<string, unknown>, ctx?: Record<string, unknown>): Promise<DdysRunResult>;

export function createJsonFileDedupeStore(filePath: string, options?: { maxEntries?: number; now?: () => number }): Promise<DedupeStore>;
