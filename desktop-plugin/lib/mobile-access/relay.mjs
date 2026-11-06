import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import http from 'node:http';
import { connect } from 'node:net';
import { isAbsolute } from 'node:path';
import tls from 'node:tls';
import WebSocket, { createWebSocketStream, WebSocketServer } from 'ws';
import { restrictPrivateFile } from './core/private-file.mjs';

const routeId = /^[a-f0-9]{32}$/;
const relayKey = /^[a-f0-9]{64}$/;
const namePattern = /^relay\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const maxPayload = 256 * 1024;
const streamLimit = 64;
const connectTimeout = 8000;

function endpoint(value) {
  const address = new URL(value);
  if (address.protocol !== 'https:' || !namePattern.test(address.hostname) || address.pathname !== '/' ||
    address.username || address.password || address.search || address.hash) throw new Error('Invalid DSH Connect relay endpoint');
  return address;
}

export function relaySettings(value) {
  const address = endpoint(value?.endpoint);
  if (typeof value.route !== 'string' || typeof value.key !== 'string' || !routeId.test(value.route) || !relayKey.test(value.key)) {
    throw new Error('Invalid DSH Connect relay credentials');
  }
  const origin = new URL(address);
  origin.hostname = value.route + address.hostname.slice('relay'.length);
  return Object.freeze({ endpoint: address.origin, origin: origin.origin, route: value.route, key: value.key });
}

export async function readRelaySettings(file) {
  if (!isAbsolute(file)) throw new Error('The DSH Connect relay settings path must be absolute');
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.size > 8192) throw new Error('Invalid DSH Connect relay settings file');
  await restrictPrivateFile(file);
  return relaySettings(JSON.parse(await readFile(file, 'utf8')));
}

export function relayRouteKey(seed, route) {
  if (!relayKey.test(seed) || !routeId.test(route)) throw new Error('Invalid relay route key input');
  return createHmac('sha256', Buffer.from(seed, 'hex')).update('dsh-connect-relay/v1/' + route).digest('hex');
}

function bind(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
}

function bridge(left, right) {
  for (const [source, destination] of [[left, right], [right, left]]) {
    source.on('error', () => source.destroy());
    source.once('close', () => {
      if (!source.readableEnded) destination.destroy();
    });
    source.pipe(destination);
  }
}

function heartbeat(peer) {
  let alive = true;
  peer.on('error', () => peer.terminate());
  peer.on('pong', () => { alive = true; });
  const timer = setInterval(() => {
    if (!alive || peer.readyState !== WebSocket.OPEN) { peer.terminate(); return; }
    alive = false;
    peer.ping();
  }, 20000);
  timer.unref();
  peer.once('close', () => clearInterval(timer));
}

function reject(socket, status = '503 Service Unavailable') {
  if (!socket.destroyed) socket.end('HTTP/1.1 ' + status + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
}

export async function startRelayServer({ origin, seed, key, cert, host = '127.0.0.1', port = 443 }) {
  const address = endpoint(origin);
  if (!relayKey.test(seed)) throw new Error('Invalid DSH Connect relay seed');
  const suffix = address.hostname.slice('relay'.length);
  const peers = new Map(), pending = new Map(), connections = new Set();
  const upgrade = new WebSocketServer({ noServer: true, maxPayload, perMessageDeflate: false });
  const control = http.createServer({ maxHeaderSize: 8192, headersTimeout: 5000, requestTimeout: 10000 },
    (_request, response) => response.writeHead(404).end());
  const edge = tls.createServer({ key, cert, minVersion: 'TLSv1.2', handshakeTimeout: 5000, ALPNProtocols: ['http/1.1'] });
  edge.maxConnections = 512;
  edge.on('connection', socket => {
    connections.add(socket);
    socket.on('error', () => socket.destroy());
    socket.once('close', () => connections.delete(socket));
  });
  control.on('upgrade', (request, socket, head) => {
    const route = request.headers['x-dsh-relay-route'];
    const supplied = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization ?? '')?.[1];
    if (request.headers.host !== address.host || typeof route !== 'string' || !routeId.test(route) || !supplied
      || !timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(relayRouteKey(seed, route), 'hex'))) {
      reject(socket, '403 Forbidden');
      return;
    }
    if (request.url === '/v1/connect') {
      if (peers.has(route)) { reject(socket, '409 Conflict'); return; }
      upgrade.handleUpgrade(request, socket, head, peer => {
        const streams = new Set();
        peers.set(route, { peer, streams });
        heartbeat(peer);
        peer.on('message', () => peer.terminate());
        peer.once('close', () => {
          peers.delete(route);
          for (const stream of streams) stream.destroy();
        });
      });
      return;
    }
    const ticket = /^\/v1\/stream\/([a-f0-9]{32})$/.exec(request.url ?? '')?.[1];
    const waiting = pending.get(ticket);
    if (!waiting || waiting.route !== route || waiting.socket.destroyed) { reject(socket, '404 Not Found'); return; }
    upgrade.handleUpgrade(request, socket, head, peer => {
      pending.delete(ticket);
      clearTimeout(waiting.timer);
      peer.on('error', () => peer.terminate());
      bridge(waiting.socket, createWebSocketStream(peer));
    });
  });
  edge.on('secureConnection', socket => {
    socket.on('error', () => socket.destroy());
    socket.setTimeout(180000, () => socket.destroy());
    if (socket.servername === address.hostname) {
      const proxy = connect(control.address().port, '127.0.0.1');
      bridge(socket, proxy);
      return;
    }
    const name = socket.servername || '';
    const route = name.endsWith(suffix) ? name.slice(0, -suffix.length) : '';
    const registration = routeId.test(route) && peers.get(route);
    if (!registration || registration.peer.readyState !== WebSocket.OPEN || registration.streams.size >= streamLimit) {
      reject(socket);
      return;
    }
    socket.pause();
    const ticket = randomBytes(16).toString('hex');
    const timer = setTimeout(() => { pending.delete(ticket); reject(socket); }, connectTimeout);
    pending.set(ticket, { route, socket, timer });
    registration.streams.add(socket);
    socket.once('close', () => {
      clearTimeout(timer);
      pending.delete(ticket);
      registration.streams.delete(socket);
    });
    registration.peer.send(ticket, error => { if (error) socket.destroy(); });
  });
  const close = async () => {
    for (const socket of connections) socket.destroy();
    for (const peer of upgrade.clients) peer.terminate();
    await Promise.all([edge, control].filter(server => server.listening).map(server => new Promise(resolve => server.close(resolve))));
  };
  try {
    await bind(control, 0, '127.0.0.1');
    await bind(edge, port, host);
    if (port === 0) address.port = String(edge.address().port);
    if (Number(address.port || 443) !== edge.address().port) throw new Error('Relay origin must match the public TLS port');
    return { port: edge.address().port, close };
  } catch (error) { await close(); throw error; }
}

export function startRelayAgent({ settings, gatewayPort, ca, lookup }) {
  const configuration = relaySettings(settings);
  const headers = { authorization: 'Bearer ' + configuration.key, 'x-dsh-relay-route': configuration.route };
  const streams = new Set();
  let control, timer, closed = false, online = false, retry = 500;
  const websocket = path => new WebSocket(configuration.endpoint.replace(/^https:/, 'wss:') + path,
    { headers, ca, lookup, handshakeTimeout: connectTimeout, maxPayload, perMessageDeflate: false });
  const connectControl = () => {
    control = websocket('/v1/connect');
    control.on('error', () => control.terminate());
    control.on('open', () => { online = true; retry = 500; heartbeat(control); });
    control.on('message', (data, binary) => {
      const ticket = String(data);
      if (binary || !routeId.test(ticket) || streams.size >= streamLimit) return;
      const peer = websocket('/v1/stream/' + ticket);
      streams.add(peer);
      peer.on('error', () => peer.terminate());
      peer.once('close', () => streams.delete(peer));
      peer.once('open', () => bridge(createWebSocketStream(peer), connect(gatewayPort, '127.0.0.1')));
    });
    control.once('close', () => {
      online = false;
      for (const stream of streams) stream.terminate();
      if (closed) return;
      timer = setTimeout(connectControl, retry + Math.floor(Math.random() * 250));
      timer.unref();
      retry = Math.min(retry * 2, 15000);
    });
  };
  connectControl();
  return {
    get online() { return online; },
    close() {
      closed = true; online = false;
      clearTimeout(timer);
      for (const stream of streams) stream.terminate();
      control.terminate();
    },
  };
}
