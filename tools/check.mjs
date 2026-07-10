import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const root = process.cwd();
const failures = [];

const requiredFiles = [
  'README.md',
  'README.en.md',
  'LICENSE',
  '.gitignore',
  '.env.example',
  'package.json',
  'index.d.ts',
  'bin/ddys-webhook-notifier.js',
  'src/index.js',
  'src/config.js',
  'src/client.js',
  'src/normalize.js',
  'src/dedupe.js',
  'src/format.js',
  'src/targets.js',
  'src/notifier.js',
  'src/worker.js',
  'src/node-state.js',
  'src/utils.js',
  'examples/cloudflare-worker/package.json',
  'examples/cloudflare-worker/wrangler.jsonc',
  'examples/cloudflare-worker/src/index.js',
  'examples/github-actions/ddys-webhook-notifier.yml',
  'examples/node-runner/run-once.mjs',
  'tests/config.test.mjs',
  'tests/runtime.test.mjs',
  'tests/targets.test.mjs',
  'tests/helpers.mjs',
  'tools/check.mjs',
  'tools/build-package.ps1'
];

for (const file of requiredFiles) await mustExist(file);
await checkEncoding();
await checkSyntax();
await checkPackage();
await checkRuntime();
await checkDocs();
await checkForbiddenFiles();
await checkForbiddenText();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, files: (await listFiles(root)).length, package: 'ddys-webhook-notifier' }, null, 2));

async function checkSyntax() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!/\.(js|mjs)$/i.test(rel)) continue;
    const result = spawnSync(process.execPath, ['--check', full], { stdio: 'inherit' });
    assert(result.status === 0, `${rel} failed node --check.`);
  }
}

async function checkPackage() {
  const pkg = JSON.parse(await read('package.json'));
  assert(pkg.name === 'ddys-webhook-notifier', 'package name mismatch.');
  assert(pkg.version === '0.1.0', 'package version mismatch.');
  assert(pkg.type === 'module', 'package must be ESM.');
  assert(pkg.bin?.['ddys-webhook-notifier'] === './bin/ddys-webhook-notifier.js', 'CLI bin is missing.');
  assert(pkg.exports?.['.']?.import === './src/index.js', 'root export must point at source entry.');
  assert(pkg.exports?.['./worker']?.import === './src/worker.js', 'worker export is missing.');
  assert(pkg.exports?.['./node-state']?.import === './src/node-state.js', 'node-state export is missing.');
  assert(pkg.scripts?.test?.includes('node --test'), 'test script must use Node test runner.');
  assert((await read('src/config.js')).includes(`VERSION = '${pkg.version}'`), 'runtime version must match package.json.');
  const buildScript = await read('tools/build-package.ps1');
  assert(buildScript.includes(`$Version = "${pkg.version}"`), 'build-package default version must match package.json.');
}

async function checkRuntime() {
  const entry = await import(pathToFileURL(path.join(root, 'src/index.js')).href);
  for (const name of [
    'runNotifier',
    'createDdysWebhookNotifier',
    'createWorkerHandler',
    'createMemoryDedupeStore',
    'createKvDedupeStore',
    'buildDiscordPayload',
    'buildTelegramPayload',
    'buildDingTalkUrl',
    'buildLarkPayload',
    'describeConfig'
  ]) assert(name in entry, `entry export missing ${name}.`);

  const targets = await read('src/targets.js');
  for (const fragment of ['allowed_mentions', 'sendMessage', 'msgtype', 'HMAC', 'dingtalk', 'wecom', 'lark', 'slack', 'discord', 'telegram']) {
    assert(targets.toLowerCase().includes(fragment.toLowerCase()), `targets missing ${fragment}.`);
  }

  const worker = await read('src/worker.js');
  for (const fragment of ['scheduled', 'DDYS_NOTIFY_KV', '/health', '/run', 'authorization']) {
    assert(worker.includes(fragment), `worker missing ${fragment}.`);
  }

  const types = await read('index.d.ts');
  for (const fragment of ['DdysNotifierConfig', 'DdysTarget', 'DedupeStore', 'runNotifier', 'createWorkerHandler', 'createJsonFileDedupeStore']) {
    assert(types.includes(fragment), `types missing ${fragment}.`);
  }
}

async function checkDocs() {
  const zh = await read('README.md');
  const en = await read('README.en.md');
  for (const fragment of ['ddys-webhook-notifier', 'Cloudflare Workers', 'GitHub Actions', 'Discord', 'Telegram', '钉钉', '企业微信', '飞书']) {
    assert(zh.includes(fragment), `README.md missing ${fragment}.`);
  }
  for (const fragment of ['ddys-webhook-notifier', 'Cloudflare Workers', 'GitHub Actions', 'Discord', 'Telegram', 'DingTalk', 'WeCom', 'Lark']) {
    assert(en.includes(fragment), `README.en.md missing ${fragment}.`);
  }
}

async function checkForbiddenFiles() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    assert(!/(^|\/)(node_modules|dist|coverage|package|\.wrangler)(\/|$)/.test(rel), `forbidden path: ${rel}`);
    assert(rel !== 'pnpm-lock.yaml' && rel !== 'package-lock.json' && rel !== 'yarn.lock', `forbidden lockfile: ${rel}`);
    assert(!/\.(log|bak|tmp|cache|tgz|zip)$/i.test(rel), `forbidden file: ${rel}`);
    assert(rel === '.env.example' || !/(^|\/)\.env(\.|$)/.test(rel), `forbidden env file: ${rel}`);
  }
}

async function checkForbiddenText() {
  const patterns = ['ghp_', 'github_pat_', 'npm_', '\uFFFD', 'DDYS_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1/token'];
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!isTextFile(rel) || rel === 'tools/check.mjs') continue;
    const text = await fs.readFile(full, 'utf8');
    for (const pattern of patterns) assert(!text.includes(pattern), `${rel} contains forbidden text pattern ${pattern}.`);
  }
}

async function checkEncoding() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!isTextFile(rel)) continue;
    const buffer = await fs.readFile(full);
    assert(!(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf), `${rel} has BOM.`);
    assert(!buffer.toString('utf8').includes('\uFFFD'), `${rel} has replacement char.`);
  }
}

async function mustExist(rel) {
  try {
    await fs.stat(path.join(root, rel));
  } catch {
    failures.push(`Missing required file: ${rel}`);
  }
}

async function read(rel) {
  return fs.readFile(path.join(root, rel), 'utf8');
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', 'dist', 'coverage', 'package', '.wrangler'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push(full);
  }
  return out;
}

function isTextFile(rel) {
  return /\.(js|mjs|json|jsonc|d\.ts|md|txt|ps1|ya?ml)$/i.test(rel) || rel === '.gitignore' || rel === 'LICENSE' || rel === '.env.example';
}

function slash(value) {
  return value.replace(/\\/g, '/');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
