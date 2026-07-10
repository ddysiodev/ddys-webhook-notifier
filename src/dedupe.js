export function createMemoryDedupeStore(options = {}) {
  const entries = new Map();
  const maxEntries = options.maxEntries || 2000;
  const now = options.now || (() => Date.now());
  return {
    type: 'memory',
    async has(key) {
      const entry = entries.get(key);
      if (!entry) return false;
      if (entry.expiresAt && entry.expiresAt <= now()) {
        entries.delete(key);
        return false;
      }
      return true;
    },
    async set(key, value = {}, ttlSeconds = 0) {
      entries.set(key, {
        value,
        expiresAt: ttlSeconds > 0 ? now() + ttlSeconds * 1000 : 0
      });
      pruneEntries(entries, maxEntries);
    },
    async deleteExpired() {
      const current = now();
      for (const [key, entry] of entries) {
        if (entry.expiresAt && entry.expiresAt <= current) entries.delete(key);
      }
    },
    async export() {
      await this.deleteExpired();
      return Object.fromEntries(entries);
    },
    size() {
      return entries.size;
    }
  };
}

export function createKvDedupeStore(namespace, options = {}) {
  if (!namespace || typeof namespace.get !== 'function' || typeof namespace.put !== 'function') {
    throw new Error('A Cloudflare KV namespace with get and put methods is required.');
  }
  const prefix = options.prefix || 'ddys-notifier';
  return {
    type: 'kv',
    async has(key) {
      return Boolean(await namespace.get(`${prefix}:${key}`));
    },
    async set(key, value = {}, ttlSeconds = 0) {
      const options = ttlSeconds > 0 ? { expirationTtl: ttlSeconds } : undefined;
      await namespace.put(`${prefix}:${key}`, JSON.stringify(value), options);
    },
    async deleteExpired() {}
  };
}

export async function filterNewItems(items, store, config) {
  if (!store || config.mode === 'all') return items;
  const out = [];
  for (const item of items) {
    const key = item.fingerprint;
    if (!key) {
      out.push(item);
      continue;
    }
    if (!await store.has(key)) out.push(item);
  }
  return out;
}

export async function markItemsSeen(items, store, config) {
  if (!store) return;
  for (const item of items) {
    if (!item.fingerprint) continue;
    await store.set(item.fingerprint, {
      title: item.title,
      url: item.url,
      source: item.source,
      seenAt: new Date().toISOString()
    }, config.dedupeTtlSeconds);
  }
  if (typeof store.save === 'function') await store.save();
}

function pruneEntries(entries, maxEntries) {
  if (!maxEntries || entries.size <= maxEntries) return;
  const overflow = entries.size - maxEntries;
  let index = 0;
  for (const key of entries.keys()) {
    entries.delete(key);
    index += 1;
    if (index >= overflow) break;
  }
}
