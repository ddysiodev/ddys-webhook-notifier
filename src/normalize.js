import { absoluteUrl, cleanText, stableJson } from './utils.js';

export function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const candidate of [
    payload.items,
    payload.results,
    payload.list,
    payload.records,
    payload.data,
    payload.data?.items,
    payload.data?.results,
    payload.data?.list,
    payload.data?.records,
    payload.result?.items,
    payload.result?.results,
    payload.result?.list,
    payload.result?.records
  ]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function normalizeItems(payload, source, config) {
  return extractItems(payload)
    .map((item, index) => normalizeItem(item, index, source, config))
    .filter((item) => item.title);
}

export function normalizeItem(item, index, source, config) {
  const raw = item && typeof item === 'object' ? item : {};
  const slug = readFirst(raw, ['slug', 'vod_en', 'alias', 'route', 'uuid']);
  const id = readFirst(raw, ['id', 'movie_id', 'movieId', 'vod_id', 'uuid', 'slug']) || slug || `${source.kind}-${index + 1}`;
  const title = cleanText(readFirst(raw, ['title', 'name', 'movie_title', 'vod_name', 'cn_name', 'zh_title']));
  const year = cleanText(readFirst(raw, ['year', 'release_year', 'date', 'pubdate', 'vod_year']));
  const region = cleanText(readFirst(raw, ['region', 'area', 'country', 'vod_area']));
  const type = cleanText(readFirst(raw, ['type', 'category', 'kind', 'module', 'vod_class']));
  const episode = cleanText(readFirst(raw, ['episode', 'episode_title', 'serial', 'vod_serial', 'note', 'remarks']));
  const updatedAt = cleanText(readFirst(raw, ['updated_at', 'updatedAt', 'update_time', 'vod_time', 'created_at', 'date']));
  const description = cleanText(readFirst(raw, ['description', 'intro', 'summary', 'content', 'plot', 'overview', 'vod_content']));
  const poster = absoluteUrl(readFirst(raw, ['poster', 'cover', 'image', 'thumbnail', 'pic', 'vod_pic']), config.publicBase);
  const explicitUrl = readFirst(raw, ['url', 'link', 'detail_url', 'detailUrl', 'share_url', 'shareUrl']);
  const url = absoluteUrl(explicitUrl, config.publicBase) || fallbackMovieUrl(slug || id, config);

  const normalized = {
    id: String(id),
    slug: String(slug || id),
    title,
    year,
    region,
    type,
    episode,
    updatedAt,
    description,
    poster,
    url,
    source: source.label,
    raw
  };
  normalized.fingerprint = fingerprintItem(normalized, source);
  return normalized;
}

export function fingerprintItem(item, source = {}) {
  const stable = [
    source.label || source.kind || '',
    item.id,
    item.slug,
    item.url,
    item.title,
    item.episode,
    item.updatedAt
  ].filter(Boolean).join('|');
  if (stable) return stable.toLowerCase();
  return stableJson(item.raw || item).toLowerCase();
}

function readFirst(source, keys) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function fallbackMovieUrl(value, config) {
  const slug = String(value || '').trim();
  if (!slug) return config.publicBase;
  return absoluteUrl(`/movies/${encodeURIComponent(slug)}`, config.publicBase);
}
