import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { bridgeCompressedWebSocket } from '../lib/mobile-access/core/websocket-bridge.mjs';
const WebSocket = createRequire(new URL('../package.json', import.meta.url))('ws');
const { WebSocketServer } = WebSocket;
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

async function fixture(t, changes = {}) {
  const upstream = http.createServer();
  const hostSockets = new WebSocketServer({ noServer: true });
  upstream.on('upgrade', (req, socket, head) => hostSockets.handleUpgrade(req, socket, head,
    peer => { peer.on('error', () => {}); hostSockets.emit('connection', peer); }));
  await listen(upstream);
  const gateway = http.createServer();
  const rawSockets = new Set();
  gateway.on('connection', socket => { rawSockets.add(socket); socket.once('close', () => rawSockets.delete(socket)); });
  gateway.on('upgrade', (req, client, head) => {
    const target = new URL('/api/remote.mux', `http://127.0.0.1:${upstream.address().port}`);
    const socket = net.connect(upstream.address().port, '127.0.0.1');
    bridgeCompressedWebSocket(req, client, socket, head, target, undefined, {
      maxMessageBytes: 2 * 1024 * 1024, maxQueuedBytes: 4 * 1024 * 1024,
      thresholdBytes: 1024, concurrencyLimit: 4, level: 1,
      clientHeartbeatIntervalMs: 40, clientHeartbeatTimeoutMs: 240, ...changes
    }, 250).catch(() => client.destroy());
  });
  await listen(gateway);
  const clients = new Set();
  t.after(async () => {
    for (const socket of clients) socket.terminate();
    for (const socket of hostSockets.clients) socket.terminate();
    for (const socket of rawSockets) socket.destroy();
    await Promise.all([new Promise(resolve => gateway.close(resolve)),
      new Promise(resolve => upstream.close(resolve)), new Promise(resolve => hostSockets.close(resolve))]);
  });
  return { hostSockets, connect: options => {
    const socket = new WebSocket(`ws://127.0.0.1:${gateway.address().port}/api/remote.mux`, options);
    socket.on('error', () => {}); clients.add(socket); return socket;
  } };
}

test('mobile liveness independently retains responsive clients and closes silent clients', { timeout: 3000 }, async t => {
  const f = await fixture(t);
  const healthy = f.connect();
  const silent = f.connect({ autoPong: false });
  const ended = once(silent, 'close');
  await Promise.all([once(healthy, 'open'), once(silent, 'open')]);
  const [code, reason] = await ended;
  assert.equal(code, 1001); assert.equal(reason.toString(), 'Client heartbeat timed out');
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(healthy.readyState, WebSocket.OPEN);
  assert.equal(f.hostSockets.clients.size, 1, 'the silent client must release its Host leg');
});

test('a bounded relay queue closes overload instead of retaining unlimited data', { timeout: 3000 }, async t => {
  const f = await fixture(t, { maxQueuedBytes: 65536 });
  f.hostSockets.once('connection', peer => peer.send(Buffer.alloc(131072, 65)));
  const client = f.connect();
  const [code] = await once(client, 'close');
  assert.equal(code, 1009);
});
