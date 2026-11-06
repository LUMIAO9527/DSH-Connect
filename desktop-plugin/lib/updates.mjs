import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { VERSION } from './mobile-access/connection.mjs';
import { connectionFields } from './configuration.mjs';

const REPO = 'https://github.com/LUMIAO9527/DSH-Connect';
const API = 'https://api.github.com/repos/LUMIAO9527/DSH-Connect/releases/latest';
const jobs = globalThis[Symbol.for('dsh-connect-update-jobs')] ??= new Map();
export const newerVersion = (value, current) => /^\d+\.\d+\.\d+$/.test(value) && value.split('.').reduce((out, part, index) => out || Math.sign(Number(part) - Number(current.split('.')[index])), 0) > 0;
export function releaseAsset(release) {
  const version = String(release.tag_name || '').replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version) || release.prerelease || release.draft) throw new Error('Invalid release');
  const asset = release.assets?.find(item => item.name === `dsh-connect-${version}.tgz`);
  const expected = `${REPO}/releases/download/v${version}/dsh-connect-${version}.tgz`;
  if (!asset || asset.browser_download_url !== expected || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') || !Number.isSafeInteger(asset.size) || asset.size < 100 || asset.size > 8 * 1024 * 1024) throw new Error('Invalid release artifact');
  return { version, url: expected, sha256: asset.digest.slice(7), size: asset.size };
}
async function bounded(url, maximum, fetcher = fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DSH-Connect/' + VERSION } });
  if (!response.ok || Number(response.headers.get('content-length')) > maximum) throw new Error('Update download refused');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > maximum) throw new Error('Update response too large'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export function verifyPackage(bytes, expected) {
  if (bytes.length !== expected.size || createHash('sha256').update(bytes).digest('hex') !== expected.sha256) throw new Error('Update checksum mismatch');
  const archive = gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }); let descriptor;
  const seen = new Set();
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512); if (header.every(value => value === 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString().replace(/\0.*$/, '');
    const type = header[156], sizeText = header.subarray(124, 136).toString().replace(/\0.*$/, '').trim();
    const size = parseInt(sizeText, 8);
    if (prefix || !name.startsWith('package/') || name.includes('\\') || name.split('/').some(part => ['.', '..'].includes(part)) || seen.has(name) || ![0, 48].includes(type) || !Number.isSafeInteger(size) || size < 0 || offset + 512 + size > archive.length) throw new Error('Unsafe update archive');
    seen.add(name);
    if (name === 'package/package.json') descriptor = JSON.parse(archive.subarray(offset + 512, offset + 512 + size).toString());
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  const patch = descriptor?.dsh?.bundle?.patch, main = descriptor?.main || descriptor?.exports?.['.'];
  const packaged = value => typeof value === 'string' && value.startsWith('./') && !value.split('/').includes('..') && seen.has('package/' + value.slice(2));
  if (descriptor?.name !== 'dsh-connect' || descriptor.version !== expected.version || !packaged(patch) || !packaged(main) || descriptor.scripts?.preinstall || descriptor.scripts?.install || descriptor.scripts?.postinstall) throw new Error('Unexpected update package');
  return descriptor;
}
export function updateController(ctx, directory, config, fetcher = fetch) {
  let job = jobs.get(directory);
  if (!job) { job = { stage: 'idle', current: VERSION }; jobs.set(directory, job); }
  const view = () => ({ current: VERSION, latest: job.asset?.version, stage: job.stage, message: job.message, available: Boolean(job.asset && newerVersion(job.asset.version, VERSION)), canUpdate: job.canUpdate === true });
  const ownerManager = ctx.get?.('pluginManager'), editor = ctx.get?.('configEditor');
  const manager = () => ownerManager;
  const ownBundle = async () => (await manager()?.listBundles())?.find(row => row.name === 'dsh-connect' && row.installed);
  const configure = async () => {
    const entry = editor?.entries().find(row => row.options.name === 'dsh-connect');
    if (!entry) throw new Error('Updated configuration entry missing');
    await editor.edit(entry, raw => ({ ...raw, ...connectionFields(config) }));
  };
  return {
    status: view,
    async check() {
      if (['downloading', 'installing', 'restoring'].includes(job.stage)) return view();
      const release = JSON.parse((await bounded(API, 256 * 1024, fetcher)).toString());
      const latest = String(release.tag_name || '').replace(/^v/, '');
      if (!/^\d+\.\d+\.\d+$/.test(latest) || release.prerelease || release.draft) throw new Error('Invalid latest release');
      if (!newerVersion(latest, VERSION)) { job.stage = 'current'; job.message = '已是最新版本'; job.asset = undefined; return view(); }
      job.asset = releaseAsset(release);
      const row = await ownBundle();
      job.canUpdate = Boolean(row?.source && (/^file:.+\.(?:tgz|tar\.gz)$/i.test(row.source) || row.source.startsWith(REPO + '/releases/download/') || /^dsh-connect(?:@[\d.^~]+)?$/.test(row.source)) && manager()?.installBundle && manager()?.removeBundle && editor);
      job.stage = 'available'; job.message = job.canUpdate ? '有新版本可用' : '开发目录由源码维护'; return view();
    },
    async start(version) {
      if (['downloading', 'installing', 'restoring'].includes(job.stage)) return view();
      if (!job.canUpdate || !job.asset || job.asset.version !== version || !newerVersion(version, VERSION)) throw new Error('Update not ready');
      const row = await ownBundle(); if (!row?.source) throw new Error('Installed package missing');
      const owner = manager(), expected = job.asset, previous = row.source;
      job.stage = 'downloading'; job.message = '正在下载更新…';
      void (async () => {
        let removed = false;
        try {
          const bytes = await bounded(expected.url, expected.size, fetcher); verifyPackage(bytes, expected);
          const staging = join(directory, 'updates', version + '-' + randomUUID()); await mkdir(staging, { recursive: true });
          const packagePath = join(staging, 'dsh-connect.tgz'); await writeFile(packagePath, bytes, { flag: 'wx', mode: 0o600 });
          if (!Buffer.from(await readFile(packagePath)).equals(bytes)) throw new Error('Staged update readback failed');
          job.stage = 'installing'; job.message = '正在更新插件…';
          const removal = await owner.removeBundle(row.name);
          if (removal.application === 'failed' || removal.application === 'cancelled') throw new Error('Plugin removal refused');
          removed = true;
          const result = await owner.installBundle(packagePath, { enabled: row.enabled, saveExact: true });
          if (!['applied', 'restart-required'].includes(result.application)) throw new Error('Plugin update failed');
          if (result.application === 'applied') await configure();
          job.stage = result.application === 'applied' ? 'complete' : 'restart-required'; job.message = result.application === 'applied' ? '更新完成' : '更新已安装，完成当前任务后重启 DSH';
        } catch {
          if (removed) {
            job.stage = 'restoring'; job.message = '正在恢复上一版…';
            try { const current = await ownBundle(); if (current) { const cleared = await owner.removeBundle(current.name); if (cleared.application !== 'applied') throw new Error('Failed update could not be removed'); } const restored = await owner.installBundle(previous, { enabled: row.enabled }); if (restored.application !== 'applied') throw new Error('Restore failed'); await configure(); job.stage = 'failed'; job.message = '更新失败，已恢复上一版'; }
            catch { job.stage = 'failed'; job.message = '更新未完成，请在插件管理中恢复安装'; }
          } else { job.stage = 'failed'; job.message = '更新未完成，现用版本保持不变'; }
        }
      })();
      return view();
    },
  };
}
