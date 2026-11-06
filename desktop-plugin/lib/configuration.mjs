import { lstat, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

export const CONNECTION_FIELDS = ['publicOrigin', 'listenPort', 'stateDirectory', 'deviceLifetimeDays', 'sessionLifetimeHours'];
export function connectionFields(value = {}) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(CONNECTION_FIELDS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
}

// Renaming the package must not disconnect a profile which still names its old entry.
export async function configurationFor(ctx, config) {
  const raw = ctx.fiber?.entry?.options?.config;
  if (config.publicOrigin || raw && Object.hasOwn(raw, 'publicOrigin') || !ctx.profileContext?.patchPath) return config;
  const path = ctx.profileContext.patchPath;
  try {
    if ((await stat(path)).size > 512 * 1024) return config;
    const document = parseDocument(await readFile(path, 'utf8'), { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }] });
    if (document.errors.length) return config;
    const rows = document.toJS({ maxAliasCount: 20 });
    if (!Array.isArray(rows)) return config;
    const old = rows.filter(row => ['dsh-foreverweb', 'dsh-harmony-connect'].includes(row?.id) && !row.disabled && row.config?.publicOrigin);
    if (old.length !== 1) return config;
    return { ...config, ...connectionFields(old[0].config), ...connectionFields(raw) };
  } catch (error) { if (error.code === 'ENOENT') return config; return config; }
}

export function validateOrigin(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('请填写完整的 HTTPS 访问地址。');
  const address = new URL(value.trim());
  if (address.protocol !== 'https:' && !(address.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname))
    || address.username || address.password || address.pathname !== '/' || address.search || address.hash) throw new Error('请填写 HTTPS 地址，不包含路径、密码或参数。');
  return address.origin;
}

async function hasState(directory) {
  try {
    const entry = await lstat(join(directory, 'devices.json'));
    if (!entry.isFile()) throw new Error('Invalid device state file.');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function stateDirectoryFor(home, configured = '') {
  if (configured) return configured;
  const current = join(home, 'dsh-connect');
  if (await hasState(current)) return current;
  // Reuse an existing installation's state in place so its device grants and host identity survive the rename.
  const legacy = join(home, 'foreverweb');
  return await hasState(legacy) ? legacy : current;
}
