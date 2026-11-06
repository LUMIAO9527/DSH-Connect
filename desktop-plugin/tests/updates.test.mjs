import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newerVersion, releaseAsset, verifyPackage, updateController } from '../lib/updates.mjs';
import { VERSION } from '../lib/mobile-access/connection.mjs';
const nextVersion = VERSION.split('.').map((part, index) => Number(part) + (index === 2 ? 1 : 0)).join('.');

function archive(version, unsafe = false) {
  const files = { 'package/package.json': JSON.stringify({ name: 'dsh-connect', version, main: './index.js', dsh: { bundle: { patch: './cordis.patch.yml' } } }), 'package/index.js': 'export const name="dsh-connect";', 'package/cordis.patch.yml': '- insert: []' };
  if (unsafe) files['package/../outside'] = 'bad';
  const chunks = [];
  for (const [name, text] of Object.entries(files)) {
    const bytes = Buffer.from(text), header = Buffer.alloc(512); header.write(name); header.write(bytes.length.toString(8).padStart(11, '0'), 124); header[156] = 48;
    chunks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  chunks.push(Buffer.alloc(1024)); return gzipSync(Buffer.concat(chunks));
}
function release(bytes, version = '1.0.3') {
  return { tag_name: 'v' + version, assets: [{ name: `dsh-connect-${version}.tgz`, browser_download_url: `https://github.com/LUMIAO9527/DSH-Connect/releases/download/v${version}/dsh-connect-${version}.tgz`, size: bytes.length, digest: 'sha256:' + createHash('sha256').update(bytes).digest('hex') }] };
}
test('update selection rejects replaced URLs, absent digests and unsafe archives', () => {
  const bytes = archive('1.0.3'), selected = releaseAsset(release(bytes)); assert.equal(verifyPackage(bytes, selected).version, '1.0.3');
  const bad = release(bytes); bad.assets[0].browser_download_url = 'https://attacker.example/dsh.tgz'; assert.throws(() => releaseAsset(bad));
  delete bad.assets[0].digest; assert.throws(() => releaseAsset(bad));
  assert.throws(() => verifyPackage(Buffer.concat([bytes, Buffer.from('changed')]), selected));
  const unsafe = archive('1.0.3', true); assert.throws(() => verifyPackage(unsafe, releaseAsset(release(unsafe))));
  assert.equal(newerVersion('1.0.10', '1.0.2'), true); assert.equal(newerVersion('1.0.1', '1.0.2'), false);
});
for (const failure of [false, true]) test(`managed update ${failure ? 'restores the previous package after install refusal' : 'keeps configuration and leaves other bundles alone'}`, async t => {
  const parent = fileURLToPath(new URL('../../_wip/tests/', import.meta.url)); await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'update-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = archive(nextVersion), metadata = release(bytes, nextVersion), calls = [], saved = { publicOrigin: 'https://computer.example.com', stateDirectory: directory };
  let installed = true;
  const manager = {
    listBundles: async () => installed ? [{ name: 'dsh-connect', installed: true, enabled: true, source: 'file:D:/kept/previous.tgz' }, { name: 'unrelated', installed: true }] : [{ name: 'unrelated', installed: true }],
    removeBundle: async name => { assert.equal(name, 'dsh-connect'); calls.push('remove'); installed = false; return { application: 'applied' }; },
    installBundle: async path => { calls.push(path.endsWith('previous.tgz') ? 'restore' : 'install'); if (failure && !path.endsWith('previous.tgz')) return { application: 'failed' }; installed = true; return { application: 'applied' }; },
  };
  const editor = { entries: () => [{ options: { name: 'dsh-connect' } }], edit: async (_entry, change) => { assert.deepEqual(change({}), saved); calls.push('configure'); } };
  const ctx = { get: name => name === 'pluginManager' ? manager : editor };
  const fetcher = async url => new Response(url.includes('api.github.com') ? JSON.stringify(metadata) : bytes);
  const updates = updateController(ctx, directory, saved, fetcher); assert.equal((await updates.check()).canUpdate, true); await updates.start(nextVersion); await updates.start(nextVersion);
  for (let index = 0; index < 100 && !['complete', 'failed'].includes(updates.status().stage); index++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(updates.status().stage, failure ? 'failed' : 'complete');
  assert.deepEqual(calls, failure ? ['remove', 'install', 'restore', 'configure'] : ['remove', 'install', 'configure']);
});
