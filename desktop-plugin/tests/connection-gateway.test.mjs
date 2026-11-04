import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { DSHConnectGateway, VERSION } from '../lib/mobile-access/connection.mjs';
import { MemoryDeviceStore } from '../lib/mobile-access/core/storage.mjs';
const WebSocket = createRequire(new URL('../package.json', import.meta.url))('ws');
const { WebSocketServer } = WebSocket;

const origin = 'https://harmony.test';
const listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
function request(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: { host: 'harmony.test', ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.once('error', reject);
      res.once('end', () => { const data = Buffer.concat(chunks); resolve({ status: res.statusCode, headers: res.headers, text: data.toString(), json: () => JSON.parse(data) }); });
    });
    req.once('error', reject); req.setTimeout(3000, () => req.destroy(new Error('Fixture request timed out'))); req.end(body);
  });
}
const post = (port, path, data, headers = {}) => request(port, path, { method: 'POST',
  headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) });
const cookies = response => (response.headers['set-cookie'] || []).map(value => value.split(';')[0]).join('; ');

async function fixture(t, options = {}) {
  const counters = { writes: 0, auth: 0, upgrades: 0 }, paths = [];
  let startLateDenied, releaseLateDenied;
  const lateDeniedStarted = new Promise(resolve => { startLateDenied = resolve; });
  const lateDeniedReleased = new Promise(resolve => { releaseLateDenied = resolve; });
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const host = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fixture');
    if (url.searchParams.get('launch') === 'fixture') {
      if (options.rejectHostAuth) { counters.auth++; res.writeHead(401); res.end(); return; }
      counters.auth++; res.writeHead(303, { 'set-cookie': 'dsh-auth-fixture=fixture.cookie; Max-Age=3600; HttpOnly; Path=/', location: '/' }); res.end(); return;
    }
    paths.push(req.url);
    if (req.headers.cookie !== 'dsh-auth-fixture=fixture.cookie') { res.writeHead(401); res.end('host authentication required'); return; }
    if (url.pathname === '/late-denied') {
      startLateDenied(); await lateDeniedReleased; res.writeHead(401); res.end('old Host credential'); return;
    }
    if (url.pathname === '/') { res.setHeader('content-type', 'text/html'); res.end('<html><head><base href="./"><script>window.fixture=true</script></head><body>DSH fixture</body></html>'); return; }
    if (url.pathname === '/write' || url.pathname === '/host-denied') {
      counters.writes++; for await (const chunk of req) {}
      res.writeHead(url.pathname === '/host-denied' ? 401 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ accepted: url.pathname !== '/host-denied' })); return;
    }
    if (url.pathname === '/failed-write') {
      counters.writes++; for await (const chunk of req) {} req.socket.destroy(); return;
    }
    if (url.pathname === '/cancel-stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: initial\n\n'); return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' }); res.end('fixture asset');
  });
  host.on('upgrade', (req, socket, head) => {
    counters.upgrades++;
    if (options.rejectFirstUpgrade && counters.upgrades === 1) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, peer => {
      peer.on('error', () => {});
      if (options.largeMessage) peer.send(Buffer.alloc(2048, 'x'));
      else peer.on('message', (data, binary) => peer.send(data, { binary }));
    });
  });
  await listen(host);
  const store = new MemoryDeviceStore();
  const input = { stateFile: '/tmp/dsh-connection-gateway-fixture.json', upstreamOrigin: `http://127.0.0.1:${host.address().port}`,
    publicOrigin: origin, listenPort: 0, ...options.gateway };
  const dependencies = { store, authenticatedUrl: () => input.upstreamOrigin + '/?launch=fixture' };
  let gateway = new DSHConnectGateway(input, dependencies); await gateway.start();
  const pair = async () => {
    const opening = await gateway.access.openPairing();
    const response = await post(gateway.address().port, '/mobile-access/auth/pair', { token: opening.token, label: 'integration fixture' });
    assert.equal(response.status, 201);
    return { cookie: cookies(response), csrf: response.json().csrfToken, deviceId: response.json().deviceId, response };
  };
  t.after(async () => { await gateway.close(); for (const socket of wss.clients) socket.terminate(); await new Promise(resolve => wss.close(resolve)); await close(host); });
  return { get gateway() { return gateway; }, get port() { return gateway.address().port; }, counters, paths, pair, lateDeniedStarted, releaseLateDenied,
    async restart() { await gateway.close(); gateway = new DSHConnectGateway(input, dependencies); await gateway.start(); } };
}

test('authenticated status and stock entry preserve existing authorization and hide credentials', { timeout: 10000 }, async t => {
  const env = await fixture(t);
  const anonymous = await request(env.port, '/mobile-access/status');
  assert.equal(anonymous.status, 401); assert.equal(anonymous.json().connection.scope, 'session');
  assert.equal(anonymous.json().connection.action, 'renew');
  const metadata = (await request(env.port, '/mobile-access/metadata')).json();
  assert.equal(metadata.version, 1); assert.equal(metadata.protocolVersion, 1); assert.equal('hostId' in metadata, false);
  const health = (await request(env.port, '/mobile-access/health')).json(); assert.equal('host' in health, false);
  const redirect = await request(env.port, '/?session=fixture', { headers: { accept: 'text/html' } });
  assert.equal(redirect.status, 303); assert.equal(new URL(redirect.headers.location, origin).searchParams.get('return'), '/?session=fixture');
  const paired = await env.pair();
  const status = (await request(env.port, '/mobile-access/status', { headers: { cookie: paired.cookie } })).json();
  assert.equal(status.host.state, 'unknown'); assert.equal(status.device.state, 'valid'); assert.equal(status.session.state, 'valid');
  assert.match(status.hostId, /^[a-f0-9]{64}$/); assert.equal(status.pluginVersion, VERSION);
  assert.equal(status.device.expiresAt, paired.response.json().deviceExpiresAt);
  assert.doesNotMatch(JSON.stringify(status), /sessionToken|deviceToken|csrfToken|tokenDigest/);
  const page = await request(env.port, '/?session=fixture', { headers: { cookie: paired.cookie, accept: 'text/html' } });
  assert.equal(page.status, 200); assert.equal(env.paths.at(-1), '/?session=fixture');
  const match = page.text.match(/<script type="application\/json" id="dsh-foreverweb-access-state">([^<]+)<\/script>/);
  assert.ok(match); const initial = JSON.parse(match[1]);
  assert.equal(initial.session.expiresAt, status.session.expiresAt); assert.equal(initial.host.state, 'reachable');
  assert.equal(initial.hostId, status.hostId); assert.doesNotMatch(page.text, /fixture\.cookie|csrfToken|deviceToken/);
  assert.doesNotMatch(page.text, /app.webmanifest|dhm-frame|dhc-frame/);
  assert.doesNotMatch(page.text, /<base\b/);
  assert.ok(page.headers['content-security-policy'].includes("base-uri 'none'"));
  const asset = await request(env.port, '/assets/test.js', { headers: { cookie: paired.cookie } });
  assert.equal(asset.status, 200); assert.equal(env.paths.at(-1), '/assets/test.js');
});

test('gateway restart preserves grant/host identity but invalidates only the short session', { timeout: 10000 }, async t => {
  const env = await fixture(t); const paired = await env.pair();
  const before = (await request(env.port, '/mobile-access/status', { headers: { cookie: paired.cookie } })).json();
  await env.restart();
  const stale = await request(env.port, '/mobile-access/status', { headers: { cookie: paired.cookie } });
  assert.equal(stale.status, 401); assert.equal(stale.headers['x-dsh-foreverweb-error-scope'], 'session');
  const renewed = await post(env.port, '/mobile-access/auth/renew', {}, { cookie: paired.cookie });
  assert.equal(renewed.status, 200);
  const connection = renewed.json().connection;
  assert.equal(connection.hostId, before.hostId); assert.notEqual(connection.connectorInstanceId, before.connectorInstanceId);
  assert.equal(connection.device.expiresAt, before.device.expiresAt);
  assert.equal((await request(env.port, '/mobile-access/status', { headers: { cookie: cookies(renewed) } })).status, 200);
});

test('downstream interruption and device revocation do not report a healthy Host unavailable', { timeout: 10000 }, async t => {
  const env = await fixture(t); const paired = await env.pair();
  const open = () => new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: env.port, path: '/cancel-stream', headers: { host: 'harmony.test', cookie: paired.cookie } });
    req.on('error', reject);
    req.once('response', response => {
      response.on('error', () => {});
      response.once('data', () => resolve({ req, response }));
    });
  });
  let current = await open();
  assert.equal(env.gateway.hostState.state, 'reachable');
  let closed = new Promise(resolve => current.response.once('close', resolve)); current.req.destroy(); await closed;
  for (let i = 0; i < 50 && env.gateway.operations.size; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(env.gateway.operations.size, 0);
  assert.equal(env.gateway.hostState.state, 'reachable', 'mobile transport cut is not a Host outage');
  current = await open();
  closed = new Promise(resolve => current.response.once('close', resolve));
  await env.gateway.access.revokeDevice(paired.deviceId); await closed;
  for (let i = 0; i < 50 && env.gateway.operations.size; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(env.gateway.operations.size, 0);
  assert.equal(env.gateway.hostState.state, 'reachable', 'authorization cancellation is not a Host outage');
  assert.equal(env.gateway.diagnostics.snapshot().entries.some(entry => entry.kind === 'host_state' && entry.code === 'upstream_unavailable'), false);
});

test('scoped errors distinguish CSRF, Host auth, revoked grant and unknown write outcome without replay', { timeout: 10000 }, async t => {
  const env = await fixture(t); const paired = await env.pair();
  const csrf = await post(env.port, '/write', { content: 'not sent' }, { cookie: paired.cookie });
  assert.equal(csrf.status, 403); assert.equal(csrf.json().connection.scope, 'csrf'); assert.equal(env.counters.writes, 0);
  const headers = { cookie: paired.cookie, 'x-dsh-mobile-csrf': paired.csrf };
  const denied = await post(env.port, '/host-denied', { content: 'once' }, headers);
  assert.equal(denied.status, 401); assert.equal(denied.headers['x-dsh-foreverweb-error-scope'], 'host');
  assert.deepEqual(denied.json(), { accepted: false }); assert.equal(env.counters.writes, 1);
  const hostState = (await request(env.port, '/mobile-access/status', { headers: { cookie: paired.cookie } })).json();
  assert.equal(hostState.host.state, 'authentication-failed'); assert.equal(hostState.device.state, 'valid');
  const failedWrite = await post(env.port, '/failed-write', { content: 'once' }, headers);
  assert.equal(failedWrite.status, 502); assert.equal(failedWrite.json().connection.scope, 'host'); assert.equal(env.counters.writes, 2);
  await env.gateway.access.revokeDevice(paired.deviceId);
  const invalid = await post(env.port, '/mobile-access/auth/renew', {}, { cookie: paired.cookie });
  assert.equal(invalid.status, 401); assert.equal(invalid.json().connection.scope, 'device');
  assert.equal(invalid.json().connection.action, 'pair'); assert.equal(invalid.json().error, 'authentication_failed');
});

test('a late Host 401 cannot discard a newer exchanged Host credential or healthy observation', { timeout: 10000 }, async t => {
  const env = await fixture(t); const paired = await env.pair();
  const headers = { cookie: paired.cookie, 'x-dsh-mobile-csrf': paired.csrf };
  const late = request(env.port, '/late-denied', { headers });
  await env.lateDeniedStarted;
  assert.equal((await post(env.port, '/host-denied', {}, headers)).status, 401);
  assert.equal((await post(env.port, '/write', {}, headers)).status, 200);
  assert.equal(env.counters.auth, 2);
  env.releaseLateDenied(); assert.equal((await late).status, 401);
  assert.equal(env.gateway.hostState.state, 'reachable');
  assert.equal((await post(env.port, '/write', {}, headers)).status, 200);
  assert.equal(env.counters.auth, 2);
});

test('failed Host credential exchange is projected as Host authentication failure, not an invalid device', { timeout: 10000 }, async t => {
  const env = await fixture(t, { rejectHostAuth: true }); const paired = await env.pair();
  const response = await post(env.port, '/write', {}, { cookie: paired.cookie, 'x-dsh-mobile-csrf': paired.csrf });
  assert.equal(response.status, 502); assert.equal(response.json().connection.code, 'upstream_authentication_failed');
  assert.equal(response.json().connection.scope, 'host'); assert.equal(env.counters.writes, 0);
  const status = (await request(env.port, '/mobile-access/status', { headers: { cookie: paired.cookie } })).json();
  assert.equal(status.host.state, 'authentication-failed'); assert.equal(status.device.state, 'valid');
});

test('compressed bridge rejects shared queue overflow and releases every reservation', { timeout: 10000 }, async t => {
  const env = await fixture(t, { largeMessage: true, gateway: { maxDeviceQueuedBytes: 1024, maxTotalQueuedBytes: 1024 } });
  const paired = await env.pair();
  const client = new WebSocket(`ws://127.0.0.1:${env.port}/api/remote.mux`, {
    perMessageDeflate: true, headers: { host: 'harmony.test', origin, cookie: paired.cookie }
  });
  client.on('error', () => {}); t.after(() => client.terminate());
  const [code] = await once(client, 'close');
  assert.equal(code, 1009); assert.equal(env.gateway.queueBudget.total, 0);
  assert.ok(env.gateway.diagnostics.snapshot().entries.some(entry => entry.code === 'shared_queue_limit'));
});

test('per-device websocket limit applies to compressed and raw branches', { timeout: 10000 }, async t => {
  const env = await fixture(t, { gateway: { maxDeviceWebSockets: 1 } });
  const paired = await env.pair();
  const headers = { host: 'harmony.test', origin, cookie: paired.cookie };
  const first = new WebSocket(`ws://127.0.0.1:${env.port}/api/remote.mux`, { perMessageDeflate: false, headers });
  first.on('error', () => {}); t.after(() => first.terminate()); await once(first, 'open');
  const second = new WebSocket(`ws://127.0.0.1:${env.port}/api/remote.mux`, { perMessageDeflate: true, headers });
  second.on('error', () => {}); t.after(() => second.terminate());
  const [, response] = await once(second, 'unexpected-response');
  assert.equal(response.statusCode, 429); assert.equal(response.headers['x-dsh-foreverweb-error-code'], 'device_connection_limit');
  response.resume(); second.terminate(); first.terminate();
});

test('Host websocket 401 invalidates only the upstream credential in both bridge branches', { timeout: 10000 }, async t => {
  for (const compressed of [false, true]) await t.test(compressed ? 'compressed' : 'raw', async sub => {
    const env = await fixture(sub, { rejectFirstUpgrade: true });
    const paired = await env.pair();
    const headers = { host: 'harmony.test', origin, cookie: paired.cookie };
    const first = new WebSocket(`ws://127.0.0.1:${env.port}/api/remote.mux`, { perMessageDeflate: compressed, headers });
    first.on('error', () => {});
    first.on('unexpected-response', (_req, response) => { response.resume(); first.terminate(); });
    await new Promise(resolve => first.once('close', resolve));
    const state = (await request(env.port, '/mobile-access/status', { headers: { cookie: paired.cookie } })).json();
    assert.equal(state.host.state, 'authentication-failed');
    assert.equal(state.device.state, 'valid'); assert.equal(state.session.state, 'valid');
    assert.equal(env.counters.auth, 1);
    const second = new WebSocket(`ws://127.0.0.1:${env.port}/api/remote.mux`, { perMessageDeflate: compressed, headers });
    second.on('error', () => {}); sub.after(() => second.terminate());
    await once(second, 'open');
    assert.equal(env.counters.auth, 2); assert.equal(env.gateway.hostState.state, 'reachable');
    second.terminate();
  });
});

test('separate browsers retain independent grants through restart and selective revocation', { timeout: 10000 }, async t => {
  const env = await fixture(t);
  const opening = await env.gateway.access.openPairing();
  const first = await post(env.port, '/mobile-access/auth/pair', { token: opening.token, label: 'First browser' });
  assert.equal(first.status, 201);
  assert.equal((await post(env.port, '/mobile-access/auth/pair', { token: opening.token, label: 'Replay' })).status, 401);
  const second = await env.pair();
  const firstId = first.json().deviceId;
  assert.notEqual(firstId, second.deviceId);
  await env.restart();
  assert.equal((await post(env.port, '/mobile-access/auth/renew', {}, { cookie: cookies(first) })).status, 200);
  assert.equal((await post(env.port, '/mobile-access/auth/renew', {}, { cookie: second.cookie })).status, 200);
  await env.gateway.access.revokeDevice(firstId);
  assert.equal((await post(env.port, '/mobile-access/auth/renew', {}, { cookie: cookies(first) })).status, 401);
  const renewed = await post(env.port, '/mobile-access/auth/renew', {}, { cookie: second.cookie });
  assert.equal(renewed.status, 200);
  assert.equal(renewed.json().deviceId, second.deviceId);
});

test('remote users cannot reach pairing administration or removed app endpoints', { timeout: 10000 }, async t => {
  const env = await fixture(t), paired = await env.pair();
  for (const path of ['/api/foreverweb/status', '/api/foreverweb/devices', '/api/mobile-access/harmony/status', '/mobile-access/client-modules', '/mobile-access/app.webmanifest']) {
    assert.equal((await request(env.port, path, { headers: { cookie: paired.cookie } })).status, 404, path);
  }
  assert.equal((await post(env.port, '/mobile-access/auth/native-pair', {})).status, 404);
  assert.equal((await post(env.port, '/mobile-access/auth/native-renew', {})).status, 404);
});

test('missing browser credential is distinguished from expiry without deleting other devices', { timeout: 10000 }, async t => {
  const env = await fixture(t), paired = await env.pair();
  const missing = await post(env.port, '/mobile-access/auth/renew', {});
  assert.equal(missing.status, 401);
  assert.equal(missing.headers['x-dsh-foreverweb-error-code'], 'device_credential_missing');
  assert.equal(missing.json().connection.scope, 'device');
  assert.equal(env.gateway.access.listDevices().length, 1);
  assert.equal((await post(env.port, '/mobile-access/auth/renew', {}, { cookie: paired.cookie })).status, 200);
  const binding = '__Host-dsh_ma_device_id';
  const conflicted = paired.cookie + '; ' + binding + '=' + 'f'.repeat(32);
  const conflict = await post(env.port, '/mobile-access/auth/renew', {}, { cookie: conflicted });
  assert.equal(conflict.status, 401);
  assert.equal(conflict.headers['x-dsh-foreverweb-error-code'], 'device_cookie_conflict');
  assert.equal((await post(env.port, '/mobile-access/auth/renew', {}, { cookie: paired.cookie })).status, 200);
});

test('recovery pairing form stays reachable with a closed window while creation still requires a current token', { timeout: 10000 }, async t => {
  const env = await fixture(t);
  assert.equal(env.gateway.access.pairingStatus().open, false);
  const form = await request(env.port, '/mobile-access/pair');
  assert.equal(form.status, 200); assert.match(form.text, /pair-form/); assert.match(form.text, /href="\/"/);
  assert.equal((await request(env.port, '/mobile-access/pair.js')).status, 200);
  assert.equal((await post(env.port, '/mobile-access/auth/pair', { token: 'A'.repeat(43) })).status, 401);
  assert.equal(env.gateway.access.listDevices().length, 0);
  const paired = await env.pair();
  assert.equal((await request(env.port, '/mobile-access/pair')).status, 200);
  assert.equal((await post(env.port, '/mobile-access/auth/renew', {}, { cookie: paired.cookie })).status, 200);
  for (const path of ['/mobile/app', '/mobile/app/', '/mobile/app?frontend=old']) {
    const redirect = await request(env.port, path, { headers: { accept: 'text/html' } });
    assert.equal(redirect.status, 303); assert.equal(redirect.headers.location, '/');
  }
});

test('plain and compressed browser sockets preserve text and binary messages', { timeout: 10000 }, async t => {
  for (const compressed of [false, true]) await t.test(compressed ? 'compressed browser' : 'plain browser', async sub => {
    const env = await fixture(sub), paired = await env.pair();
    const socket = new WebSocket(`ws://127.0.0.1:${env.port}/api/remote.mux`, { perMessageDeflate: compressed,
      headers: { host: 'harmony.test', origin, cookie: paired.cookie } });
    socket.on('error', () => {}); sub.after(() => socket.terminate());
    await once(socket, 'open');
    let received = once(socket, 'message'); socket.send('browser round trip');
    let [message, binary] = await received; assert.equal(message.toString(), 'browser round trip'); assert.equal(binary, false);
    const bytes = Buffer.alloc(256 * 1024, 137); received = once(socket, 'message'); socket.send(bytes);
    [message, binary] = await received; assert.equal(binary, true); assert.deepEqual(message, bytes);
    assert.equal(env.gateway.hostState.state, 'reachable');
  });
});
