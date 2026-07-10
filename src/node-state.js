import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function createJsonFileDedupeStore(filePath, options = {}) {
  const resolved = path.resolve(filePath || '.ddys-notifier-state.json');
  const now = options.now || (() => Date.now());
  const maxEntries = options.maxEntries || 2000;
  const state = await readState(resolved);
  const entries = new Map(Object.entries(state.entries || {}));

  return {
    type: 'json-file',
    filePath: resolved,
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
    async save() {
      await this.deleteExpired();
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, JSON.stringify({
        version: 1,
        updatedAt: new Date(now()).toISOString(),
        entries: Object.fromEntries(entries)
      }, null, 2));
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

async function readState(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return { version: 1, entries: {} };
    throw error;
  }
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
