#!/usr/bin/env node
import process from 'node:process';
import { createConfig, describeConfig, runNotifier, VERSION } from '../src/index.js';
import { createJsonFileDedupeStore } from '../src/node-state.js';

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.positionals[0] || 'help';
  if (parsed.options.help || command === 'help') {
    console.log(helpText());
    return;
  }
  if (command === 'version' || command === '--version') {
    console.log(VERSION);
    return;
  }

  const overrides = configFromOptions(parsed.options);
  const runtime = {};
  if (parsed.options.stateFile) {
    runtime.dedupeStore = await createJsonFileDedupeStore(parsed.options.stateFile, {
      maxEntries: overrides.dedupeMaxEntries
    });
  }

  if (command === 'diag') {
    const config = createConfig(overrides);
    console.log(JSON.stringify(describeConfig(config), null, 2));
    return;
  }

  if (command !== 'run') throw new Error(`Unknown command: ${command}`);
  const result = await runNotifier(overrides, runtime);
  if (parsed.options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printRunSummary(result);
  }
  if (!result.ok) process.exitCode = 1;
}

function configFromOptions(options) {
  const config = {};
  if (options.apiBase) config.apiBase = options.apiBase;
  if (options.publicBase) config.publicBase = options.publicBase;
  if (options.source?.length) config.sources = options.source;
  if (options.target?.length) config.targets = options.target;
  if (options.maxItems) config.maxItems = options.maxItems;
  if (options.mode) config.mode = options.mode;
  if (options.timeoutMs) config.requestTimeoutMs = options.timeoutMs;
  if (options.retries !== undefined) config.retries = options.retries;
  if (options.dryRun) config.dryRun = true;
  if (options.failFast) config.failFast = true;
  return config;
}

function parseArgs(argv) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }
    const [rawName, inlineValue] = arg.replace(/^--?/, '').split(/=(.*)/s, 2);
    const name = toCamel(rawName);
    if (['dryRun', 'failFast', 'json', 'help'].includes(name)) {
      options[name] = true;
      continue;
    }
    const value = inlineValue !== undefined ? inlineValue : argv[++index];
    if (value === undefined) throw new Error(`Missing value for --${rawName}.`);
    if (['source', 'target'].includes(name)) {
      if (!options[name]) options[name] = [];
      options[name].push(value);
    } else {
      options[name] = value;
    }
  }
  return { options, positionals };
}

function printRunSummary(result) {
  console.log(`ok: ${result.ok}`);
  console.log(`sources: ${result.sourceCount}, targets: ${result.targetCount}`);
  console.log(`fetched: ${result.fetchedItems}, new: ${result.newItems}`);
  for (const source of result.sources) {
    console.log(`- ${source.source}: fetched=${source.fetched || 0}, fresh=${source.fresh || 0}${source.ok ? '' : `, error=${source.error}`}`);
  }
  if (result.dryRun) {
    for (const notification of result.notifications) {
      console.log('');
      console.log(notification.text);
    }
  }
  for (const delivery of result.deliveries) {
    console.log(`delivery ${delivery.ok ? 'ok' : 'failed'}: ${delivery.type}/${delivery.target}${delivery.error ? ` ${delivery.error}` : ''}`);
  }
}

function helpText() {
  return [
    'ddys-webhook-notifier',
    '',
    'Usage:',
    '  ddys-webhook-notifier run [--dry-run] [--state-file FILE]',
    '  ddys-webhook-notifier diag',
    '  ddys-webhook-notifier version',
    '',
    'Options:',
    '  --source VALUE       latest, hot, calendar, search:keyword, endpoint:/path',
    '  --target VALUE       generic:https://example.com/webhook or discord:https://...',
    '  --state-file FILE    Persist dedupe fingerprints in a JSON file',
    '  --max-items N        Max items per source',
    '  --mode new|all       Dedupe mode',
    '  --dry-run            Render notifications without sending',
    '  --json               Print JSON result'
  ].join('\n');
}

function toCamel(value) {
  return String(value || '').replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
