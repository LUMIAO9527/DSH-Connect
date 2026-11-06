import { randomBytes } from 'node:crypto';
import { open, readFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { relayRouteKey, relaySettings, startRelayServer } from '../desktop-plugin/lib/mobile-access/relay.mjs';
import { restrictPrivateFile } from '../desktop-plugin/lib/mobile-access/core/private-file.mjs';

const [input, command, output] = process.argv.slice(2);
if (!input || command && (command !== '--issue' || !output)) {
  console.error('Usage: node tools/serve-relay.mjs relay.json [--issue device.json]');
  process.exit(2);
}
try {
  const folder = dirname(resolve(input));
  const config = JSON.parse(await readFile(input, 'utf8'));
  const seed = (await readFile(resolve(folder, config.seedFile), 'utf8')).trim();
  const route = randomBytes(16).toString('hex');
  const settings = relaySettings({ endpoint: config.origin, route, key: relayRouteKey(seed, route) });
  if (command === '--issue') {
    const target = resolve(output);
    const file = await open(target, 'wx', 0o600);
    try {
      await restrictPrivateFile(target);
      await file.writeFile(JSON.stringify({ endpoint: settings.endpoint, route, key: settings.key }) + '\n');
      await file.close();
    } catch (error) {
      await file.close();
      await rm(target, { force: true });
      throw error;
    }
    console.log('Created private DSH Connect relay settings.');
  } else {
    const [key, cert] = await Promise.all([config.keyFile, config.certFile].map(file => readFile(resolve(folder, file))));
    const service = await startRelayServer({ origin: settings.endpoint, seed, key, cert,
      port: Number(new URL(settings.endpoint).port || 443), host: config.host ?? '127.0.0.1' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void service.close(); });
    console.log('DSH Connect relay is listening on port ' + service.port + '.');
  }
} catch (error) {
  console.error('DSH Connect relay setup failed' + (typeof error.code === 'string' ? ' (' + error.code + ')' : '') + '.');
  process.exitCode = 1;
}
