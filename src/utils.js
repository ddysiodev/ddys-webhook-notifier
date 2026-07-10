export function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(value, maxLength) {
  const text = cleanText(value);
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export function createTimeoutSignal(timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0 || typeof AbortController === 'undefined') {
    return { signal: undefined, cancel() {}, timedOut: () => false };
  }
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);
  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timer);
    },
    timedOut() {
      return didTimeout;
    }
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

export function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export function splitList(value) {
  if (Array.isArray(value)) return value.flatMap((item) => splitList(item));
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return false;
  return fallback;
}

export function parsePositiveInteger(value, fallback, name = 'value') {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer.`);
  return number;
}

export function parseNonNegativeInteger(value, fallback, name = 'value') {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${name} must be a non-negative integer.`);
  return number;
}

export function dropUndefined(value) {
  const output = {};
  for (const [key, item] of Object.entries(value || {})) {
    if (item !== undefined && item !== null && item !== '') output[key] = item;
  }
  return output;
}

export function absoluteUrl(value, baseUrl) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).toString();
  } catch {
    try {
      return new URL(raw, ensureTrailingSlash(baseUrl)).toString();
    } catch {
      return '';
    }
  }
}

export function joinUrl(baseUrl, pathname) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const path = String(pathname || '').startsWith('/') ? String(pathname) : `/${pathname || ''}`;
  return `${base}${path}`;
}

export function ensureTrailingSlash(value) {
  const text = String(value || '');
  return text.endsWith('/') ? text : `${text}/`;
}

export function escapeMarkdown(value) {
  return String(value || '').replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}

export function redactSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return '***';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

export function redactUrl(value) {
  const text = String(value || '');
  if (!text) return '';
  try {
    const url = new URL(text);
    for (const key of ['access_token', 'key', 'token', 'sign']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '***');
    }
    const host = url.hostname.toLowerCase();
    if (host.includes('discord.com') && url.pathname.includes('/api/webhooks/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      url.pathname = `/${parts.slice(0, 2).join('/')}/***/***`;
    } else if (host === 'hooks.slack.com' && url.pathname.startsWith('/services/')) {
      url.pathname = '/services/***/***/***';
    } else if ((host.includes('feishu.cn') || host.includes('larksuite.com')) && url.pathname.includes('/hook/')) {
      url.pathname = url.pathname.replace(/\/hook\/[^/]+.*/, '/hook/***');
    }
    return url.toString();
  } catch {
    return text.replace(/([?&](?:access_token|key|token|sign)=)[^&]+/gi, '$1***');
  }
}

export function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

export async function hmacSha256Base64(secret, data) {
  const key = String(secret || '');
  const message = String(data || '');
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    return bytesToBase64(new Uint8Array(signature));
  }
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', key).update(message).digest('base64');
}

export function bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function nowIso(runtime = {}) {
  const now = runtime.now || (() => Date.now());
  return new Date(now()).toISOString();
}
