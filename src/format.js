import { escapeMarkdown, nowIso, truncate } from './utils.js';

export function buildNotification(sourceResult, config, runtime = {}) {
  const source = sourceResult.source;
  const items = sourceResult.items || [];
  const title = notificationTitle(source, config);
  const generatedAt = nowIso(runtime);
  return {
    title,
    text: renderText(title, items, config),
    markdown: renderMarkdown(title, items, config),
    source: {
      kind: source.kind,
      label: source.label,
      endpoint: source.endpoint,
      query: source.query
    },
    items: items.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      year: item.year,
      region: item.region,
      type: item.type,
      episode: item.episode,
      updatedAt: item.updatedAt,
      description: item.description,
      poster: item.poster,
      url: item.url,
      fingerprint: item.fingerprint
    })),
    generatedAt
  };
}

export function notificationTitle(source, config) {
  const prefix = config.titlePrefix || 'DDYS';
  if (source.kind === 'latest') return `${prefix} latest updates`;
  if (source.kind === 'hot') return `${prefix} hot content`;
  if (source.kind === 'calendar') return `${prefix} calendar`;
  if (source.kind === 'search') return `${prefix} search: ${source.value || source.query?.q || ''}`.trim();
  return `${prefix} ${source.label || 'notification'}`;
}

export function renderText(title, items, config = {}) {
  if (!items.length) return `${title}\n\nNo new items.`;
  return [
    title,
    '',
    ...items.map((item, index) => renderTextItem(item, index, config))
  ].join('\n');
}

export function renderMarkdown(title, items, config = {}) {
  if (!items.length) return `### ${escapeMarkdown(title)}\n\nNo new items.`;
  return [
    `### ${escapeMarkdown(title)}`,
    '',
    ...items.map((item, index) => renderMarkdownItem(item, index, config))
  ].join('\n');
}

export function renderTextItem(item, index, config = {}) {
  const meta = itemMeta(item);
  const lines = [`${index + 1}. ${item.title}`];
  if (meta) lines.push(`   ${meta}`);
  if (config.includeDescription !== false && item.description) lines.push(`   ${truncate(item.description, 120)}`);
  if (item.url) lines.push(`   ${item.url}`);
  return lines.join('\n');
}

export function renderMarkdownItem(item, index, config = {}) {
  const meta = itemMeta(item);
  const title = item.url ? `[${escapeMarkdown(item.title)}](${item.url})` : escapeMarkdown(item.title);
  const lines = [`${index + 1}. **${title}**`];
  if (meta) lines.push(`   ${escapeMarkdown(meta)}`);
  if (config.includeDescription !== false && item.description) lines.push(`   ${escapeMarkdown(truncate(item.description, 120))}`);
  return lines.join('\n');
}

export function itemMeta(item) {
  return [item.year, item.region, item.type, item.episode].filter(Boolean).join(' / ');
}
