import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stateDirectoryFor } from '../lib/configuration.mjs';

async function fixture(t) {
  const parent = fileURLToPath(new URL('../../_wip/tests/', import.meta.url));
  await mkdir(parent, { recursive: true });
  const home = await mkdtemp(join(parent, 'dsh-connect-state-'));
  t.after(async () => { assert.equal(dirname(resolve(home)), resolve(parent)); await rm(home, { recursive: true, force: true }); });
  return home;
}
async function state(home, name) { const directory = join(home, name); await mkdir(directory); await writeFile(join(directory, 'devices.json'), '{}'); return directory; }

test('new installations choose the DSH Connect state directory', async t => {
  const home = await fixture(t); assert.equal(await stateDirectoryFor(home), join(home, 'dsh-connect'));
});
test('renamed installations reuse existing grants in place', async t => {
  const home = await fixture(t); const previous = await state(home, 'foreverweb'); assert.equal(await stateDirectoryFor(home), previous);
});
test('current state wins when both generations exist and explicit configuration remains authoritative', async t => {
  const home = await fixture(t); await state(home, 'foreverweb'); const current = await state(home, 'dsh-connect');
  assert.equal(await stateDirectoryFor(home), current); assert.equal(await stateDirectoryFor(home, join(home, 'configured')), join(home, 'configured'));
});
test('an invalid current state is reported instead of silently creating a different host identity', async t => {
  const home = await fixture(t); const current = join(home, 'dsh-connect'); await mkdir(join(current, 'devices.json'), { recursive: true });
  await assert.rejects(stateDirectoryFor(home), /Invalid device state/);
});
