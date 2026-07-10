import { normalizeItems } from './normalize.js';
import { createTimeoutSignal, joinUrl } from './utils.js';

export async function fetchDdysSource(source, config, runtime = {}) {
  const fetchImpl = runtime.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');

  const url = buildSourceUrl(source, config, runtime);
  const timeout = createTimeoutSignal(config.requestTimeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': config.userAgent
      },
      signal: timeout.signal
    });
  } catch (error) {
    if (timeout.timedOut()) throw new Error(`DDYS source ${source.label} timed out after ${config.requestTimeoutMs}ms.`);
    throw error;
  } finally {
    timeout.cancel();
  }

  const payload = await readJsonResponse(response);
  if (!response.ok || payload?.success === false) {
    throw new Error(`DDYS source ${source.label} failed: ${payload?.message || response.status}`);
  }
  const items = normalizeItems(payload, source, config).slice(0, source.limit || config.maxItems);
  return { source, url, payload, items };
}

export async function fetchDdysSources(sources, config, runtime = {}) {
  const results = [];
  for (const source of sources) {
    results.push(await fetchDdysSource(source, config, runtime));
  }
  return results;
}

export function buildSourceUrl(source, config, runtime = {}) {
  const endpoint = source.endpoint || '';
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? new URL(endpoint)
    : new URL(joinUrl(config.apiBase, endpoint || '/'));
  const query = { ...(source.query || {}) };
  if (source.kind === 'calendar' && !query.year && !query.month) {
    const date = new Date((runtime.now || (() => Date.now()))());
    query.year = date.getFullYear();
    query.month = date.getMonth() + 1;
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse DDYS API response as JSON: ${error.message}`);
  }
}
