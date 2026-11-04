import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rename, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DSHConnectGateway } from '../lib/mobile-access/connection.mjs';
import { JsonDeviceStore, MemoryDeviceStore, parseDeviceSnapshot } from '../lib/mobile-access/core/storage.mjs';
import { ConnectionDiagnostics, ConnectionQueueBudget, connectionFailure } from '../lib/mobile-access/core/connection-state.mjs';

const config = stateFile => ({ stateFile, publicOrigin: 'https://fixture.example', upstreamOrigin: 'http://127.0.0.1:12345', listenPort: 0 });

test('persistent host identity survives restart and relocation without changing legacy native identity', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-identity-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const firstPath = join(directory, 'first.json'), secondPath = join(directory, 'moved.json');
  const first = new DSHConnectGateway(config(firstPath));
  await first.access.initialize();
  const hostId = first.access.hostId, oldInstance = first.config.instanceId;
  const opened = await first.access.openPairing();
  const paired = await first.access.pair('fixture', opened.token, 'fixture device');
  assert.equal(paired.nativeInstanceId, oldInstance);
  const oldExpiry = paired.deviceExpiresAt;
  await first.close();
  await rename(firstPath, secondPath);
  const second = new DSHConnectGateway(config(secondPath));
  await second.access.initialize();
  assert.notEqual(second.config.instanceId, oldInstance);
  assert.equal(second.access.hostId, hostId);
  assert.notEqual(second.connectorInstanceId, first.connectorInstanceId);
  assert.throws(() => second.access.authorizeSession(paired.sessionToken));
  const renewed = await second.access.renew(paired.deviceToken);
  assert.equal(renewed.nativeInstanceId, oldInstance);
  assert.equal(renewed.deviceExpiresAt, oldExpiry);
  assert.equal(JSON.parse(await readFile(secondPath, 'utf8')).hostId, hostId);
  await second.close();
});

test('old snapshots migrate once; grant expiry is absolute and session expiry is capped', async () => {
  let clock = Date.now();
  const store = new MemoryDeviceStore();
  const gateway = new DSHConnectGateway({ ...config('/tmp/dsh-expiry-fixture.json'), deviceTtlMs: 60000, sessionTtlMs: 30000 }, { store, now: () => clock });
  await gateway.access.initialize();
  const opening = await gateway.access.openPairing();
  const pair = await gateway.access.pair('fixture', opening.token, 'expiry fixture');
  const grantExpiry = pair.deviceExpiresAt;
  clock += 30001;
  assert.throws(() => gateway.access.authorizeSession(pair.sessionToken), { status: 401 });
  const next = await gateway.access.renew(pair.deviceToken);
  assert.equal(next.deviceExpiresAt, grantExpiry);
  assert.equal(next.sessionExpiresAt, grantExpiry);
  assert.equal(store.inspect().hostId, gateway.access.hostId);
  clock = grantExpiry + 1;
  assert.throws(() => gateway.access.authorizeDevice(pair.deviceToken), { code: 'device_expired' });
  assert.throws(() => parseDeviceSnapshot({ version: 2, devices: [], hostId: 'invalid' }));
  await gateway.close();
});

test('default 90 day grant and 8 hour session remain distinct', async () => {
  const clock = Date.now();
  const gateway = new DSHConnectGateway(config('/tmp/dsh-default-expiry-fixture.json'), { store: new MemoryDeviceStore(), now: () => clock });
  await gateway.access.initialize();
  const opening = await gateway.access.openPairing();
  const pair = await gateway.access.pair('fixture', opening.token, 'default fixture');
  assert.equal(pair.deviceExpiresAt - clock, 90 * 86400000);
  assert.equal(pair.sessionExpiresAt - clock, 8 * 3600000);
  await gateway.close();
});

test('queue reservations enforce shared/per-device caps and release exactly once', () => {
  const budget = new ConnectionQueueBudget(100, 150);
  const a = budget.reserve('a', 60), b = budget.reserve('b', 60);
  assert.equal(typeof a, 'function'); assert.equal(typeof b, 'function');
  assert.equal(budget.reserve('a', 41), undefined);
  assert.equal(budget.reserve('c', 31), undefined);
  assert.equal(budget.total, 120);
  a(); a(); assert.equal(budget.total, 60);
  const c = budget.reserve('c', 90); assert.equal(typeof c, 'function');
  assert.equal(budget.peak, 150);
  b(); c(); assert.equal(budget.total, 0); assert.equal(budget.devices.size, 0);
});

test('diagnostics are bounded and exclude secrets, URLs and arbitrary error text', () => {
  const diagnostics = new ConnectionDiagnostics(4);
  for (let index = 0; index < 20; index++) diagnostics.record('http_failure', {
    scope: 'host', code: 'upstream_timeout', status: 504, token: 'secret-token', url: '/?secret=token', message: 'private prompt'
  });
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.sequence, 20); assert.equal(snapshot.entries.length, 4);
  assert.equal(snapshot.entries[0].sequence, 17);
  assert.doesNotMatch(JSON.stringify(snapshot), /secret|private|url|message/);
  assert.deepEqual(connectionFailure(401, 'authentication_failed', 'device'), {
    protocolVersion: 1, scope: 'device', code: 'authentication_failed', retryable: false, action: 'pair'
  });
  assert.equal(connectionFailure(401, 'authentication_failed', 'session').action, 'renew');
  assert.equal(connectionFailure(401, 'upstream_authentication_failed', 'session').scope, 'host');
});
