import { createConfig, describeConfig } from './config.js';
import { createKvDedupeStore } from './dedupe.js';
import { runNotifier } from './notifier.js';

export function createWorkerHandler(options = {}) {
  return {
    async scheduled(controller, env = {}, ctx = {}) {
      const promise = runWorkerNotifier(options, env, ctx);
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(promise);
      return promise;
    },
    async fetch(request, env = {}, ctx = {}) {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/health') {
        const config = createWorkerConfig(options, env);
        return jsonResponse({ ok: true, config: describeConfig(config) });
      }
      if (request.method === 'POST' && url.pathname === '/run') {
        const config = createWorkerConfig(options, env);
        const auth = request.headers.get('authorization') || '';
        if (config.runToken && auth !== `Bearer ${config.runToken}`) {
          return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401);
        }
        const result = await runWorkerNotifier(options, env, ctx);
        return jsonResponse(result, result.ok ? 200 : 500);
      }
      return jsonResponse({ ok: false, error: 'Not found.' }, 404);
    }
  };
}

export async function runWorkerNotifier(options = {}, env = {}, ctx = {}) {
  const config = createWorkerConfig(options, env);
  const runtime = {
    env,
    fetch: options.fetch || globalThis.fetch,
    now: options.now,
    dedupeStore: options.dedupeStore || (env.DDYS_NOTIFY_KV ? createKvDedupeStore(env.DDYS_NOTIFY_KV, {
      prefix: options.kvPrefix || 'ddys-notifier'
    }) : undefined)
  };
  const promise = runNotifier(config, runtime);
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(promise);
  return promise;
}

function createWorkerConfig(options, env) {
  return createConfig(options.config || {}, env);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
