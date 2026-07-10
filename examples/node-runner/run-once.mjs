import { createJsonFileDedupeStore } from 'ddys-webhook-notifier/node-state';
import { runNotifier } from 'ddys-webhook-notifier';

const dedupeStore = await createJsonFileDedupeStore('.ddys-notifier-state.json');

const result = await runNotifier({
  sources: process.env.DDYS_NOTIFY_SOURCES || 'latest,hot',
  targets: [
    {
      type: 'discord',
      url: process.env.DDYS_NOTIFY_DISCORD_WEBHOOK_URL
    }
  ].filter((target) => target.url),
  dedupeStore
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
