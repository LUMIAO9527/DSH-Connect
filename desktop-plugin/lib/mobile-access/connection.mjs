// DSH Connect gateway orchestration. Licensed protocol primitives are maintained
// as part of this project in core/; see NOTICE and LICENSE.
import http from 'node:http';
import https from 'node:https';
import { connect as connectSocket, isIPv4 } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import { gunzip, inflate, brotliDecompress, brotliCompressSync, gzipSync, createBrotliCompress, createGzip, constants as zlibConstants } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import QRCode from 'qrcode';
import { AccessController, AccessError, BoundedRateLimiter } from './core/access.mjs';
import { JsonDeviceStore } from './core/storage.mjs';
import { RequestTrustPolicy, parseCidr, parseAuthority, isLoopbackAddress } from './core/network.mjs';
import { isPrivateSubnet } from './lan.mjs';
import { HttpError, parseRequestTarget, assertExternalTrust, assertLocalAdminTrust,
  readJsonObject, sendJson, cookie, setSecurityHeaders,
  SESSION_COOKIE, DEVICE_COOKIE, CSRF_COOKIE, CSRF_HEADER, WS_PATHS } from './core/http-security.mjs';
import { browserAuthCookies, authenticatedCookie, HOST_SESSION_COOKIE,
  HOST_CSRF_COOKIE, HOST_DEVICE_COOKIE } from './core/browser-auth-cookies.mjs';
import { renderPairPage, renderPairScript, renderLoginPage, renderLoginScript } from './core/auth-pages.mjs';
import { resolveBrowserUiLocale } from './core/browser-ui-locale.mjs';
import { bridgeCompressedWebSocket } from './core/websocket-bridge.mjs';
import { CONNECTION_PROTOCOL_VERSION, CONNECTION_CAPABILITIES, connectionFailure, scopeFailure,
  ConnectionDiagnostics, ConnectionQueueBudget } from './core/connection-state.mjs';
import { APP_ICONS } from '../icons.mjs';
import { BRAND_WHALE_SVG, BRAND_WORDMARK_SVG } from '../brand.mjs';

export { JsonDeviceStore };
export const VERSION = '1.3.0';
const CONTROL_LIMIT = 16 * 1024;
const DOCUMENT_LIMIT = 8 * 1024 * 1024;
// The DSH frontend ships its own icons, but those requests require a device
// session. Serve the same artwork from public gateway routes so a home-screen
// shortcut saved from any DSH Connect page keeps the DeepSeek Harness icon.
const APP_ICON_ROUTES = Object.freeze({
  '/mobile-access/apple-touch-icon.png': 'apple-touch-icon.png',
  '/mobile-access/icon-192.png': 'icon-192.png',
  '/mobile-access/icon-512.png': 'icon-512.png',
  '/mobile-access/icon-maskable-512.png': 'icon-maskable-512.png'
});
const APP_ICON_BUFFERS = new Map(Object.entries(APP_ICONS).map(([name, uri]) => [name, Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64')]));
const APP_MANIFEST = Buffer.from(JSON.stringify({
  name: 'DeepSeek Harness', short_name: 'DSH', start_url: '/', scope: '/',
  display: 'standalone', background_color: '#ffffff', theme_color: '#ffffff',
  icons: [
    { src: '/mobile-access/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/mobile-access/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/mobile-access/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}));
const BOOT_SPLASH_STYLE = `<style>
#dsc-boot{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;background:#fff;color:#0f1115;transition:opacity 180ms ease-out}
#dsc-boot.is-leaving{opacity:0;pointer-events:none}
#dsc-boot .dsc-boot-whale{display:block;width:min(38vw,132px);max-width:100%;margin:0 auto 18px;color:#0f1115}
#dsc-boot .dsc-boot-whale svg,#dsc-boot .dsc-boot-wordmark svg{display:block;width:100%;height:auto}
#dsc-boot .dsc-boot-wordmark{display:block;width:min(66vw,236px);max-width:100%;margin:0 auto 26px;color:#0f1115;--dsc-lockup-contrast:#fff}
#dsc-boot .dsc-boot-dots{display:inline-flex;align-items:center;gap:7px;height:14px}
#dsc-boot .dsc-boot-dots i{display:block;width:6px;height:6px;border-radius:50%;background:#8a8f99}
#dsc-boot .dsc-boot-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media(prefers-reduced-motion:no-preference){
  #dsc-boot .dsc-boot-whale{animation:dsc-boot-mark 620ms cubic-bezier(.2,.7,.25,1) both}
  #dsc-boot .dsc-boot-wordmark{animation:dsc-boot-name 520ms cubic-bezier(.2,.7,.25,1) 120ms both}
  #dsc-boot .dsc-boot-dots{animation:dsc-boot-name 520ms cubic-bezier(.2,.7,.25,1) 200ms both}
  #dsc-boot .dsc-boot-dots i{animation:dsc-boot-dot 1150ms cubic-bezier(.45,0,.55,1) infinite}
  #dsc-boot .dsc-boot-dots i:nth-child(2){animation-delay:120ms}
  #dsc-boot .dsc-boot-dots i:nth-child(3){animation-delay:240ms}
}
@keyframes dsc-boot-mark{from{opacity:0;translate:0 12px;scale:.965}to{opacity:1;translate:0 0;scale:1}}
@keyframes dsc-boot-name{from{opacity:0;translate:0 6px}to{opacity:1;translate:0 0}}
@keyframes dsc-boot-dot{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-5px);opacity:1}}
@media(prefers-color-scheme:dark){
  #dsc-boot{background:#17191e;color:#f2f4f8}
  #dsc-boot .dsc-boot-whale,#dsc-boot .dsc-boot-wordmark{color:#f2f4f8}
  #dsc-boot .dsc-boot-wordmark{--dsc-lockup-contrast:#17191e}
  #dsc-boot .dsc-boot-dots i{background:#8b919c}
}
</style>`;
const BOOT_SPLASH = '<div id="dsc-boot" data-dsc-boot aria-hidden="true">'
  + '<div class="dsc-boot-whale">' + BRAND_WHALE_SVG + '</div>'
  + '<div class="dsc-boot-wordmark" role="img" aria-label="DeepSeek Harness">' + BRAND_WORDMARK_SVG + '</div>'
  + '<div class="dsc-boot-dots"><i></i><i></i><i></i></div>'
  + '<span class="dsc-boot-sr">正在加载 DSH</span></div>';
const SERVICE_WORKER_STATIC_PATHS = Object.freeze([
  '/mobile-access/apple-touch-icon.png',
  '/mobile-access/icon-192.png',
  '/mobile-access/icon-512.png',
  '/mobile-access/icon-maskable-512.png',
  '/mobile-access/manifest.webmanifest'
]);
const SERVICE_WORKER_SOURCE = `'use strict';
const CACHE = ${JSON.stringify('dsh-connect-static-' + VERSION)};
const STATIC_PATHS = ${JSON.stringify(SERVICE_WORKER_STATIC_PATHS)};
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  const cacheable = path.startsWith('/assets/') || path.startsWith('/plugins/') || STATIC_PATHS.includes(path);
  if (!cacheable) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response && response.status === 200 && response.type === 'basic') {
        void cache.put(request, response.clone());
        void trim(cache);
      }
      return response;
    } catch (error) {
      const fallback = await cache.match(request, { ignoreSearch: true });
      if (fallback) return fallback;
      throw error;
    }
  })());
});
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= 240) return;
  await Promise.all(keys.slice(0, keys.length - 240).map(key => cache.delete(key)));
}
`;
const APP_HEAD_LINKS = '<link rel="manifest" href="/mobile-access/manifest.webmanifest">'
  + '<link rel="apple-touch-icon" sizes="180x180" href="/mobile-access/apple-touch-icon.png">'
  + '<link rel="icon" type="image/png" sizes="192x192" href="/mobile-access/icon-192.png">'
  + '<script>if("serviceWorker" in navigator){addEventListener("load",function(){navigator.serviceWorker.register("/mobile-access/sw.js",{scope:"/",updateViaCache:"none"}).catch(function(){})})}</script>';
// Public, side-effect free probe used to decide whether the mobile runtime can
// carry a P2P transport at all. It only reports what the engine supports.
const LITE_PROBE_HTML = `﻿<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>DSH Lite · 协议探针</title>
<style>
:root{color-scheme:dark;--bg:#111318;--card:#1b1e24;--line:#2e333d;--ink:#f2f4f8;--muted:#9aa0aa;--ok:#63d6a3;--bad:#ff8e86}
*{box-sizing:border-box}body{margin:0;padding:max(16px,env(safe-area-inset-top)) 14px max(20px,env(safe-area-inset-bottom));background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}p{color:var(--muted);margin:0 0 14px}
button{min-height:40px;padding:8px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:inherit;margin:0 8px 8px 0}
button:disabled{opacity:.45}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;min-height:180px;max-height:50vh;overflow:auto;font:12px/1.5 ui-monospace,monospace}
#sessions{display:grid;gap:6px;margin:0 0 12px}
.session{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
.session b{font-weight:500;overflow-wrap:anywhere}.session span{color:var(--muted);font-size:12px}
.note{font-size:12px;color:var(--muted)}.ok{color:var(--ok)}.err{color:var(--bad)}
</style>
</head>
<body>
<h1>DSH Lite · 协议探针</h1>
<p>只读验证：直连 <code>POST /api/session/list</code>、<code>POST /api/session/events</code>，再用 WebSocket 跟随 <code>session/follow</code>。不发消息、不改会话。</p>
<div><button id="list">读取会话列表</button><button id="events" disabled>读取最近会话历史</button><button id="follow" disabled>跟随最近会话</button><button id="clear">清空日志</button></div>
<div id="sessions"></div>
<pre id="log">尚未连接。</pre>
<div class="note">列表出现后，下一步才是聊天渲染。审批/发送会改状态，本探针不做。</div>
<script>
(() => {
  const log = document.getElementById('log');
  const sessionsBox = document.getElementById('sessions');
  const eventsBtn = document.getElementById('events');
  const followBtn = document.getElementById('follow');
  let sessions = [];
  let selected = '';
  let socket;
  const write = (text, cls) => {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  };
  const clear = () => { log.textContent = ''; };
  const csrf = () => {
    const entry = document.cookie.split('; ').find(value => value.startsWith('dsh_ma_csrf='));
    return entry ? decodeURIComponent(entry.slice('dsh_ma_csrf='.length)) : '';
  };
  const rpc = async (endpoint, args) => {
    const rpcId = 'probe-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    const response = await fetch('/api/' + endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-dsh-mobile-csrf': csrf() },
      body: JSON.stringify({ type: 'client-request', rpcId, method: endpoint, payload: { args } })
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new Error('HTTP ' + response.status + ': ' + text.slice(0, 200)); }
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + text.slice(0, 200));
    if (!body || body.type !== 'server-response' || body.rpcId !== rpcId) throw new Error('bad envelope');
    if (!body.result || body.result.ok !== true) throw new Error((body.result && body.result.error && body.result.error.code) || 'rpc failed');
    return body.result.value;
  };
  const select = id => {
    selected = id;
    eventsBtn.disabled = false;
    followBtn.disabled = false;
    for (const row of sessionsBox.querySelectorAll('[data-session]')) row.classList.toggle('is-selected', row.dataset.session === id);
  };
  const renderSessions = value => {
    sessions = Array.isArray(value && value.items) ? value.items : [];
    sessionsBox.textContent = '';
    if (!sessions.length) { write('session/list 返回 0 条', 'err'); return; }
    for (const session of sessions.slice(0, 20)) {
      const row = document.createElement('div');
      row.className = 'session';
      row.dataset.session = session.sessionId;
      const name = document.createElement('b');
      name.textContent = (session.projections && (session.projections.title || session.projections.name)) || session.sessionId;
      const meta = document.createElement('span');
      meta.textContent = (session.running ? 'running ' : '') + (session.blank ? 'blank ' : '') + (session.updatedAt ? new Date(session.updatedAt).toLocaleString() : '');
      row.append(name, meta);
      row.addEventListener('click', () => select(session.sessionId));
      sessionsBox.appendChild(row);
    }
    select(sessions[0].sessionId);
    write('session/list ok · ' + sessions.length + ' 条', 'ok');
  };
  const list = async () => {
    try {
      clear();
      write('POST /api/session/list');
      const value = await rpc('session/list', { _request: {} });
      renderSessions(value);
      write(JSON.stringify(value).slice(0, 4000));
    } catch (error) { write('list failed: ' + error.message, 'err'); }
  };
  const events = async () => {
    if (!selected) return;
    try {
      clear();
      write('POST /api/session/events · ' + selected);
      const value = await rpc('session/events', { request: { address: { kind: 'session', sessionId: selected }, maxMessages: 30 } });
      write('records: ' + (value && value.records ? value.records.length : '?') + ' · hasMore: ' + (value && value.hasMore), 'ok');
      write(JSON.stringify(value).slice(0, 6000));
    } catch (error) { write('events failed: ' + error.message, 'err'); }
  };
  const follow = () => {
    if (!selected) return;
    try { socket && socket.close(); } catch {}
    clear();
    write('WS /api/remote.mux · session/follow · ' + selected);
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(scheme + '//' + location.host + '/api/remote.mux');
    socket.onopen = () => {
      write('socket open', 'ok');
      socket.send(JSON.stringify({ type: 'open', streamId: 'follow-1', endpoint: 'session/follow', payload: { args: { request: { address: { kind: 'session', sessionId: selected }, assistantStream: true, maxMessages: 30 } } } }));
    };
    let frames = 0;
    socket.onmessage = event => {
      frames += 1;
      let summary = event.data;
      try {
        const frame = JSON.parse(event.data);
        const value = frame && frame.value;
        summary = frame.type + (value && value.type ? ' · ' + value.type : '') + ' · ' + event.data.slice(0, 1200);
        if (frame.type === 'error') summary = 'error: ' + (frame.error && (frame.error.code + ' ' + frame.error.message));
      } catch {}
      write(summary, frames === 1 ? 'ok' : '');
      if (frames >= 30) { write('已收到 30 帧，关闭探针流', 'ok'); socket.close(); }
    };
    socket.onerror = () => write('socket error', 'err');
    socket.onclose = event => write('socket closed ' + event.code + ' ' + event.reason);
  };
  document.getElementById('list').addEventListener('click', list);
  eventsBtn.addEventListener('click', events);
  followBtn.addEventListener('click', follow);
  document.getElementById('clear').addEventListener('click', clear);
})();
</script>
</body>
</html>
`;
const WEBRTC_PROBE_HTML = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>WebRTC 探针 · DSH Connect</title>
<body style="margin:0;padding:24px;font:15px/1.7 system-ui,sans-serif;color:#202329;background:#fff">
<h1 style="font-size:19px;margin:0 0 12px">WebRTC 探针</h1>
<p style="color:#6b7280;margin:0 0 16px">判断当前内核能否建立 P2P 数据通道。打开后等待结果即可。</p>
<pre id="out" style="white-space:pre-wrap;background:#f5f7fa;border:1px solid #e7e9ee;border-radius:14px;padding:14px">检测中…</pre>
<script>
(function(){
  var rows=[];
  function log(k,v){rows.push(k+': '+v);}
  log('userAgent', navigator.userAgent);
  log('RTCPeerConnection', String(typeof window.RTCPeerConnection));
  log('createDataChannel', String(!!(window.RTCPeerConnection && window.RTCPeerConnection.prototype.createDataChannel)));
  function loopback(){
    return new Promise(function(resolve,reject){
      if(!window.RTCPeerConnection) return reject(new Error('no RTCPeerConnection'));
      var a=new RTCPeerConnection(), b=new RTCPeerConnection(), done=false;
      var timer=setTimeout(function(){ if(!done){done=true;reject(new Error('timeout'));} }, 6000);
      a.onicecandidate=function(e){ if(e.candidate) b.addIceCandidate(e.candidate).catch(function(){}); };
      b.onicecandidate=function(e){ if(e.candidate) a.addIceCandidate(e.candidate).catch(function(){}); };
      var dc=a.createDataChannel('probe');
      dc.onopen=function(){ if(done) return; done=true; clearTimeout(timer); a.close(); b.close(); resolve('pass'); };
      a.createOffer().then(function(offer){ return a.setLocalDescription(offer); })
        .then(function(){ return b.setRemoteDescription(a.localDescription); })
        .then(function(){ return b.createAnswer(); })
        .then(function(answer){ return b.setLocalDescription(answer); })
        .then(function(){ return a.setRemoteDescription(b.localDescription); })
        .catch(function(error){ if(!done){done=true; clearTimeout(timer); reject(error);} });
    });
  }
  loopback().then(function(result){ log('loopback data channel', result); })
    .catch(function(error){ log('loopback data channel', 'FAIL ' + (error && error.message)); })
    .then(function(){ document.getElementById('out').textContent = rows.join('\\n'); });
})();
</script>`;
const META = '<meta name="dsh-foreverweb-gateway" content="authenticated">';
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const READ_METHODS = new Set(['GET', 'HEAD']);
const decoders = { gzip: promisify(gunzip), deflate: promisify(inflate), br: promisify(brotliDecompress) };

function limit(value, fallback, min, max) {
  const actual = value ?? fallback;
  if (!Number.isSafeInteger(actual) || actual < min || actual > max) throw new Error('Invalid DSH Connect resource limit');
  return actual;
}

export function gatewayConfig(input) {
  if (!input || !isAbsolute(input.stateFile || '')) throw new Error('DSH Connect requires an absolute stateFile');
  const upstreamOrigin = new URL(input.upstreamOrigin);
  if (upstreamOrigin.protocol !== 'http:' || !isLoopbackAddress(upstreamOrigin.hostname) || !upstreamOrigin.port
    || upstreamOrigin.username || upstreamOrigin.password || upstreamOrigin.pathname !== '/' || upstreamOrigin.search || upstreamOrigin.hash) {
    throw new Error('DSH Connect upstream must be a loopback HTTP origin');
  }
  const origin = input.publicOrigin ? new URL(input.publicOrigin) : undefined;
  const lan = input.lan;
  if (origin && ((origin.protocol !== 'https:' && !(origin.protocol === 'http:' && !lan && isLoopbackAddress(origin.hostname)))
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)) {
    throw new Error('DSH Connect requires an HTTPS origin');
  }
  if (lan) {
    const subnet = parseCidr(lan.cidr);
    const localTest = isIPv4(lan.host) && isLoopbackAddress(lan.host) && subnet.source === '127.0.0.0/8';
    if ((!localTest && !isPrivateSubnet(lan.host, subnet)) || !/^[a-f\d]{64}$/.test(lan.fingerprint)) throw new Error('Invalid LAN listener');
  }
  const listenHost = input.listenHost ?? '127.0.0.1';
  if (!isLoopbackAddress(listenHost)) throw new Error('DSH Connect listener must remain on loopback');
  const stateFile = resolve(input.stateFile);
  const instanceId = input.instanceId ?? createHash('sha256').update(stateFile).digest('hex');
  if (!/^[a-f\d]{64}$/.test(instanceId)) throw new Error('Invalid DSH Connect instance identity');
  const deviceTtlMs = limit(input.deviceTtlMs, 90 * 86400000, 60000, 366 * 86400000);
  const sessionTtlMs = limit(input.sessionTtlMs, 8 * 3600000, 30000, 86400000);
  if (sessionTtlMs > deviceTtlMs) throw new Error('Session lifetime exceeds device lifetime');
  return Object.freeze({ ...input, stateFile, instanceId, upstreamOrigin, publicOrigin: origin?.origin ?? '', listenHost,
    listenPort: limit(input.listenPort, 3446, 0, 65535), secure: origin?.protocol !== 'http:',
    mobileDisabledPlugins: Object.freeze(Array.isArray(input.mobileDisabledPlugins)
      ? [...new Set(input.mobileDisabledPlugins.filter(id => typeof id === 'string' && id.length <= 200))].slice(0, 32) : []),
    pairingTtlMs: limit(input.pairingTtlMs, 600000, 10000, 600000), deviceTtlMs, sessionTtlMs,
    maxDevices: limit(input.maxDevices, 20, 1, 256), maxSessions: limit(input.maxSessions, 40, 1, 1024),
    maxConnections: limit(input.maxConnections, 128, 1, 1024), maxActiveRequests: limit(input.maxActiveRequests, 128, 1, 1024),
    maxWebSockets: limit(input.maxWebSockets, 40, 1, 256),
    maxDeviceWebSockets: limit(input.maxDeviceWebSockets, 8, 1, 256),
    maxDeviceQueuedBytes: limit(input.maxDeviceQueuedBytes, 64 * 1024 * 1024, 1024, 1024 * 1024 * 1024),
    maxTotalQueuedBytes: limit(input.maxTotalQueuedBytes, 128 * 1024 * 1024, 1024, 2 * 1024 * 1024 * 1024),
    maxBodyBytes: limit(input.maxBodyBytes, 160 * 1024 * 1024, 1024, 256 * 1024 * 1024),
    upstreamTimeoutMs: limit(input.upstreamTimeoutMs, 15000, 1000, 300000),
    upstreamApiTimeoutMs: limit(input.upstreamApiTimeoutMs, 120000, 1000, 300000) });
}

function requestHeaders(request, upstream, credential, upgrade = false) {
  const blocked = new Set([...HOP, 'host', 'cookie', 'authorization', 'forwarded', 'x-forwarded-for',
    'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'x-dsh-mobile-csrf', 'x-dsh-mobile-desktop-admin', 'x-dsh-mobile-web-admin']);
  for (const value of String(request.headers.connection || '').split(',')) blocked.add(value.trim().toLowerCase());
  const headers = {};
  for (const [key, value] of Object.entries(request.headers)) if (value !== undefined && !blocked.has(key) && key !== 'sec-websocket-extensions') headers[key] = value;
  headers.host = upstream.host;
  if (credential) headers.cookie = credential;
  if (headers.origin) headers.origin = upstream.origin;
  if (headers.referer) headers.referer = upstream.origin + '/';
  if (upgrade) { headers.connection = 'Upgrade'; headers.upgrade = 'websocket'; }
  else headers['accept-encoding'] = 'identity';
  return headers;
}

function responseHeaders(incoming, upstream, publicOrigin, requestTarget) {
  const headers = {};
  const blocked = new Set([...HOP, 'set-cookie', 'www-authenticate', 'access-control-allow-origin', 'access-control-allow-credentials',
    'x-dsh-foreverweb-error-scope', 'x-dsh-foreverweb-error-code']);
  for (const value of String(incoming.connection || '').split(',')) blocked.add(value.trim().toLowerCase());
  for (const [key, value] of Object.entries(incoming)) if (value !== undefined && !blocked.has(key)) headers[key] = value;
  if (headers.location) {
    try {
      // Resolve relative redirects against the request URL, not the upstream
      // origin root: DSH's /api/file answers relative `?path=...&v=...`
      // locations, and losing the path turned images into the HTML document.
      const base = requestTarget === undefined ? upstream : new URL(requestTarget, upstream);
      const target = new URL(headers.location, base);
      if (target.origin === upstream.origin) headers.location = publicOrigin + target.pathname + target.search + target.hash;
    } catch { delete headers.location; }
  }
  return headers;
}

function encodingQuality(value, encoding) {
  let exact, wildcard;
  for (const part of String(value || '').split(',')) {
    const [coding, ...parameters] = part.trim().toLowerCase().split(';');
    if (coding !== encoding && coding !== '*') continue;
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    const match = quality?.trim().match(/^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/);
    const weight = quality === undefined ? 1 : match ? Number(match[1]) : 0;
    if (coding === encoding) exact = weight; else wildcard = weight;
  }
  return exact ?? wildcard ?? 0;
}

/**
 * Drop selected optional client plugins from the phone boot graph. The Host
 * still composes one graph for every client; the mobile gateway only trims the
 * graph it serves to phones. Removing an entry that another enabled entry
 * injects would break module resolution, so dependents are removed too.
 */
function filterMobileBootHtml(html, disabled) {
  if (!Array.isArray(disabled) || disabled.length === 0) return html;
  const boot = /<script>globalThis\["__DSH_BOOT__"\] = ([\s\S]*?)<\/script>/.exec(html);
  if (!boot) return html;
  let graph;
  try { graph = JSON.parse(boot[1]); } catch { return html; }
  if (!Array.isArray(graph.entries) || !Array.isArray(graph.batches)) return html;
  const stripClient = id => id.endsWith('/client') ? id.slice(0, -7) : id;
  const disabledSet = new Set(disabled);
  const isDisabled = id => disabledSet.has(id)
    || [...disabledSet].some(value => id.endsWith('/' + value) || value.endsWith('/' + id));
  // Follow inject edges until no enabled entry depends on a removed plugin.
  for (let changed = true; changed;) {
    changed = false;
    for (const entry of graph.entries) {
      if (isDisabled(entry.id) || !Array.isArray(entry.inject)) continue;
      if (entry.inject.some(dependency => isDisabled(stripClient(dependency)))) {
        disabledSet.add(entry.id); changed = true;
      }
    }
  }
  const entries = graph.entries.filter(entry => !isDisabled(entry.id));
  const bootstrap = graph.batches.filter(batch => batch.phase === 'bootstrap');
  const bootstrapIds = new Set(bootstrap.flatMap(batch => batch.entries || []));
  const application = entries.filter(entry => !bootstrapIds.has(entry.id));
  // A batch URL is the only thing the client fetches for its entries. Replace
  // the merged application batches with one combo per remaining plugin so no
  // removed plugin bytes are requested on the phone.
  graph.entries = entries;
  graph.batches = [...bootstrap, ...application.map(entry => ({
    phase: 'application', url: entry.url, rev: entry.rev, entries: [entry.id] }))];
  const markup = '<script>globalThis["__DSH_BOOT__"] = '
    + JSON.stringify(graph).replaceAll('<', '\\u003c') + '</script>';
  html = html.replace(boot[0], markup);
  html = html.replace(/<link rel="preload" as="script" href="[^"]*plugins\/[^"]*">/g, '');
  if (application.length > 0) {
    const links = application.map(entry => '<link rel="preload" as="script" href="'
      + entry.url.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '">').join('');
    html = html.includes('</head>') ? html.replace('</head>', links + '</head>') : links + html;
  }
  return html;
}

function responseCompression(req, target, upstream, headers) {
  // Keep JSON RPC compression fast and reduce the larger cold-start asset downloads.
  const type = String(headers['content-type']).split(';', 1)[0].trim().toLowerCase();
  const rpc = req.method === 'POST' && target.decodedPathname.startsWith('/api/') && /^application\/(?:json|[\w.+-]+\+json)$/.test(type);
  const asset = READ_METHODS.has(req.method) && /^\/(?:plugins|assets)\//.test(target.decodedPathname)
    && /^(?:text\/(?:javascript|css)|application\/(?:javascript|json)|image\/svg\+xml)$/.test(type);
  const font = READ_METHODS.has(req.method) && /^font\/(?:ttf|otf)$/.test(type)
    && /\.(?:ttf|otf)$/i.test(target.decodedPathname);
  // Plain GET JSON responses carry session lists and transcripts; only
  // complete bodies (content-length) are compressed so long-lived streams are
  // never buffered behind a transform.
  const jsonGet = READ_METHODS.has(req.method) && target.decodedPathname.startsWith('/api/')
    && /^application\/(?:json|[\w.+-]+\+json)$/.test(type) && headers['content-length'] !== undefined;
  if ((!rpc && !asset && !font && !jsonGet) || upstream.statusCode !== 200
    || req.headers.range || headers['content-range']
    || (headers['content-encoding'] && headers['content-encoding'] !== 'identity')
    || /(?:^|,)\s*no-transform\s*(?:,|$)/i.test(String(headers['cache-control']))
    || /(?:^|,)\s*no-transform\s*(?:,|$)/i.test(String(req.headers['cache-control']))) return;
  const vary = String(headers.vary || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!vary.some(value => value === '*' || value.toLowerCase() === 'accept-encoding')) vary.push('Accept-Encoding');
  headers.vary = vary.join(', ');
  const accepted = req.headers['accept-encoding'];
  const gzip = encodingQuality(accepted, 'gzip');
  const br = asset || font || jsonGet ? encodingQuality(accepted, 'br') : 0;
  const encoding = br > 0 && br >= gzip ? 'br' : gzip > 0 ? 'gzip' : undefined;
  if (!encoding) return;
  delete headers['content-length']; delete headers['accept-ranges'];
  headers['content-encoding'] = encoding;
  if (typeof headers.etag === 'string' && headers.etag.startsWith('"')) headers.etag = 'W/' + headers.etag;
  return encoding === 'br'
    ? createBrotliCompress({ params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } })
    : createGzip({ level: zlibConstants.Z_BEST_SPEED });
}

async function boundedBody(stream, maximum) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maximum) { stream.destroy(); throw new HttpError(502, 'upstream_response_too_large'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function documentBody(response) {
  let body = await boundedBody(response, DOCUMENT_LIMIT);
  const encoding = String(response.headers['content-encoding'] || 'identity').trim().toLowerCase();
  if (encoding !== 'identity') {
    if (!decoders[encoding]) throw new HttpError(502, 'unsupported_upstream_encoding');
    body = await decoders[encoding](body, { maxOutputLength: DOCUMENT_LIMIT });
  }
  return body.toString('utf8');
}

function fail(response, error, tls = false, diagnostics) {
  if (response.destroyed) return;
  if (response.headersSent) { response.destroy(); return; }
  const known = error instanceof HttpError || error instanceof AccessError;
  const status = known ? error.status : 503;
  const code = known ? error.code : 'connection_unavailable';
  const connection = connectionFailure(status, code, error?.connectionScope);
  diagnostics?.record('http_failure', { ...connection, status });
  response.setHeader('x-dsh-foreverweb-error-scope', connection.scope);
  response.setHeader('x-dsh-foreverweb-error-code', connection.code);
  sendJson(response, status, { error: code, connection }, tls);
}

async function waitWithSignal(task, signal) {
  signal.throwIfAborted(); let abort;
  try {
    return await Promise.race([task, new Promise((_, reject) => {
      abort = () => reject(signal.reason ?? new Error('Request cancelled'));
      signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { signal.removeEventListener('abort', abort); }
}

export class DSHConnectGateway {
  constructor(input, { authenticatedUrl, store, now, remoteReady = () => true, configurationEditable = () => false } = {}) {
    this.config = gatewayConfig(input); this.authenticatedUrl = authenticatedUrl;
    this.remoteReady = remoteReady;
    this.configurationEditable = configurationEditable;
    this.access = new AccessController(store ?? new JsonDeviceStore(this.config.stateFile, this.config.maxDevices), {
      ...this.config, rateLimitWindowMs: 60000, maxPairingAttempts: 8, maxRateLimitKeys: 256,
      pairingInstanceId: this.config.instanceId, legacyInstanceId: this.config.instanceId, ...(now ? { now } : {}) });
    this.sockets = new Set(); this.operations = new Set(); this.webSockets = new Set(); this.listeners = new Map();
    this.connectorInstanceId = randomUUID();
    this.hostState = Object.freeze({ state: 'unknown' });
    this.diagnostics = new ConnectionDiagnostics(64);
    this.queueBudget = new ConnectionQueueBudget(this.config.maxDeviceQueuedBytes, this.config.maxTotalQueuedBytes);
    this.credentialExpires = 0; this.credentialGeneration = 0; this.closing = false; this.ready = false;
    this.authLimiter = new BoundedRateLimiter(80, 60000, 256);
    this.renewLimiter = new BoundedRateLimiter(24, 60000, 256);
    this.unsubscribe = this.access.onSessionEnded((authorization, reason) => {
      this.diagnostics.record('session_ended', { code: reason });
      for (const item of [...this.operations, ...this.webSockets]) if (item.sessionKey === authorization.sessionKey) {
        item.abort(scopeFailure(new HttpError(401, reason === 'revoked' ? 'device_invalid' : 'session_expired'), reason === 'revoked' ? 'device' : 'session'));
      }
    });
  }

  address() { return { host: this.config.listenHost, port: this.server?.address()?.port ?? this.config.listenPort, origin: this.config.publicOrigin }; }

  connectionState(authorization) {
    return { protocolVersion: CONNECTION_PROTOCOL_VERSION, pluginVersion: VERSION,
      hostId: this.access.hostId, connectorInstanceId: this.connectorInstanceId,
      capabilities: CONNECTION_CAPABILITIES, serverTime: Date.now(),
      device: { state: 'valid', expiresAt: authorization.deviceExpiresAt },
      session: { state: 'valid', expiresAt: authorization.expiresAt ?? authorization.sessionExpiresAt },
      host: this.hostState };
  }

  observeHost(state, code) {
    if (this.hostState.state !== state) this.diagnostics.record('host_state', { code: code ?? state, scope: 'host' });
    this.hostState = Object.freeze({ state, observedAt: Date.now(), ...(code ? { code } : {}) });
  }

  mobileDisabledPlugins() { return this.config.mobileDisabledPlugins; }

  setMobileDisabledPlugins(value) {
    const disabled = Object.freeze(Array.isArray(value)
      ? [...new Set(value.filter(id => typeof id === 'string' && id.length <= 200))].slice(0, 32) : []);
    this.config = Object.freeze({ ...this.config, mobileDisabledPlugins: disabled });
    return disabled;
  }

  async start() {
    if (this.ready) return;
    if (this.closing) throw new Error('Gateway has been closed');
    await this.access.initialize();
    try {
      if (this.config.publicOrigin) {
        const publicUrl = new URL(this.config.publicOrigin);
        this.server = await this.listen(this.config.listenHost, publicUrl, ['127.0.0.0/8', '::1/128']);
        this.config = Object.freeze({ ...this.config, publicOrigin: publicUrl.origin });
      }
      if (this.config.lan) {
        try { await this.configureLan(this.config.lan); }
        catch (error) { if (!this.server) throw error; }
      }
      this.ready = true;
    } catch (error) { await this.close(); throw error; }
  }

  async configureLan(lan) {
    if (this.closing) return;
    const next = gatewayConfig({ ...this.config, lan });
    const previous = this.lanServer;
    this.lanServer = undefined; this.lanOrigin = '';
    await this.stopListener(previous);
    if (this.closing) return;
    this.config = next;
    if (!lan) return;
    const { host, cidr, key, cert } = lan;
    const origin = new URL('https://' + host + ':' + this.config.listenPort);
    this.lanServer = await this.listen(host, origin, [cidr], { key, cert, minVersion: 'TLSv1.2' });
    this.lanOrigin = origin.origin;
  }

  async stopListener(server) {
    if (!server) return;
    const stopped = server.listening ? new Promise(done => server.close(done)) : Promise.resolve();
    for (const socket of this.listeners.get(server) ?? []) socket.destroy();
    this.listeners.delete(server);
    await stopped;
  }

  async listen(host, origin, cidrs, tls) {
    const subnet = cidrs.map(parseCidr);
    let policy;
    const request = (req, res) => this.handle(req, res, policy, origin.origin, tls ? 'lan' : undefined)
      .catch(error => fail(res, error, this.config.secure, this.diagnostics));
    const server = tls ? https.createServer(tls, request) : http.createServer(request);
    const sockets = new Set();
    this.listeners.set(server, sockets);
    server.requestTimeout = 120000; server.headersTimeout = 25000; server.keepAliveTimeout = 15000; server.maxHeadersCount = 128;
    server.on('connection', socket => {
      if (this.sockets.size >= this.config.maxConnections) { socket.destroy(); return; }
      this.sockets.add(socket); sockets.add(socket);
      socket.on('error', () => {});
      socket.once('close', () => { this.sockets.delete(socket); sockets.delete(socket); });
    });
    server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head, policy).catch(error => {
      if (socket.destroyed) return;
      const status = error instanceof HttpError || error instanceof AccessError ? error.status : 502;
      const code = error instanceof HttpError || error instanceof AccessError ? error.code : 'upstream_unavailable';
      const connection = connectionFailure(status, code, error?.connectionScope);
      this.diagnostics.record('ws_rejected', { ...connection, status });
      socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nx-dsh-foreverweb-error-scope: ${connection.scope}\r\nx-dsh-foreverweb-error-code: ${connection.code}\r\nContent-Length: 0\r\n\r\n`);
    }));
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(this.config.listenPort, host, () => {
        server.off('error', reject);
        if (origin.port === '0') origin.port = String(server.address().port);
        policy = new RequestTrustPolicy([parseAuthority(origin.host)], Number(origin.port || (this.config.secure ? 443 : 80)), subnet, this.config.secure);
        done();
      });
    }).catch(error => { this.listeners.delete(server); throw error; });
    if (this.closing) { await this.stopListener(server); throw new Error('Gateway has been closed'); }
    return server;
  }

  authorize(req) {
    try {
      const cookies = browserAuthCookies(req.headers.cookie);
      const name = this.config.secure && cookies.has(HOST_SESSION_COOKIE) ? HOST_SESSION_COOKIE : SESSION_COOKIE;
      return authenticatedCookie(cookies.get(name) ?? [], value => this.access.authorizeSession(value)).result;
    } catch (error) { throw scopeFailure(error, 'session'); }
  }

  assertCsrf(authorization, value) {
    try { this.access.assertCsrf(authorization, value); } catch (error) { throw scopeFailure(error, 'csrf'); }
  }

  sessionCookies(res, result) {
    const opts = { tls: this.config.secure, path: '/', maxAgeSeconds: (result.sessionExpiresAt - Date.now()) / 1000 };
    res.setHeader('Set-Cookie', [cookie(SESSION_COOKIE, result.sessionToken, { ...opts, httpOnly: true }),
      cookie(CSRF_COOKIE, result.csrfToken, { ...opts, httpOnly: false }),
      ...(this.config.secure ? [cookie(HOST_SESSION_COOKIE, result.sessionToken, { ...opts, httpOnly: true }),
        cookie(HOST_CSRF_COOKIE, result.csrfToken, { ...opts, httpOnly: false })] : [])]);
  }

  deviceBinding(res, id, expiresAt) {
    if (this.config.secure) res.setHeader('Set-Cookie', [...res.getHeader('Set-Cookie'), cookie(HOST_DEVICE_COOKIE, id,
      { tls: true, httpOnly: true, path: '/', maxAgeSeconds: (expiresAt - Date.now()) / 1000 })]);
  }

  async auth(req, res, action, scope) {
    if (!['pair', 'renew', 'logout'].includes(action)) throw new HttpError(404, 'not_found');
    if (!this.authLimiter.take(req.socket.remoteAddress ?? 'unknown', Date.now())) throw new HttpError(429, 'rate_limited');
    const body = await readJsonObject(req, CONTROL_LIMIT);
    if (action === 'pair') {
      if (typeof body.token !== 'string' || (body.label !== undefined && typeof body.label !== 'string')
        || (body.instance !== undefined && body.instance !== this.config.instanceId)) throw new HttpError(400, 'bad_request');
      const result = await this.access.pair(req.socket.remoteAddress ?? 'unknown', body.token, body.label, scope);
      this.sessionCookies(res, result);
      res.setHeader('Set-Cookie', [...res.getHeader('Set-Cookie'), cookie(DEVICE_COOKIE, result.deviceToken,
        { tls: this.config.secure, httpOnly: true, path: '/mobile-access/auth/renew', maxAgeSeconds: (result.deviceExpiresAt - Date.now()) / 1000 })]);
      this.deviceBinding(res, result.deviceId, result.deviceExpiresAt);
      sendJson(res, 201, { paired: true, deviceId: result.deviceId, csrfToken: result.csrfToken,
        sessionExpiresAt: result.sessionExpiresAt, deviceExpiresAt: result.deviceExpiresAt, connection: this.connectionState(result) }, this.config.secure);
      return;
    }
    if (action === 'logout') {
      const authorization = this.authorize(req); this.assertCsrf(authorization, req.headers[CSRF_HEADER]); this.access.logout(authorization);
      res.setHeader('Set-Cookie', [SESSION_COOKIE, CSRF_COOKIE, ...(this.config.secure ? [HOST_SESSION_COOKIE, HOST_CSRF_COOKIE] : [])]
        .map(name => cookie(name, '', { tls: this.config.secure, httpOnly: name !== CSRF_COOKIE && name !== HOST_CSRF_COOKIE, path: '/', maxAgeSeconds: 0 })));
      sendJson(res, 200, { loggedOut: true }, this.config.secure); return;
    }
    const cookies = browserAuthCookies(req.headers.cookie);
    const credentials = cookies.get(DEVICE_COOKIE) ?? [];
    if (!credentials.length) throw new HttpError(401, 'device_credential_missing');
    const bindings = this.config.secure ? cookies.get(HOST_DEVICE_COOKIE) : undefined;
    if (bindings && bindings.length !== 1) throw new HttpError(401, 'device_cookie_conflict');
    const found = authenticatedCookie(credentials, value => this.access.authorizeDevice(value),
      candidate => !bindings || candidate.deviceId === bindings[0]);
    const identity = found.result;
    this.renewLimiter.retainKeys(new Set(this.access.listDevices().map(device => device.id)));
    if (!this.renewLimiter.take(identity.deviceId, Date.now())) throw new HttpError(429, 'rate_limited');
    const result = await this.access.renew(found.value);
    this.sessionCookies(res, result); this.deviceBinding(res, result.deviceId, identity.deviceExpiresAt);
    sendJson(res, 200, { renewed: true, deviceId: result.deviceId, csrfToken: result.csrfToken,
      sessionExpiresAt: result.sessionExpiresAt, deviceExpiresAt: result.deviceExpiresAt, connection: this.connectionState(result) }, this.config.secure);
  }

  async handle(req, res, policy, origin, scope) {
    if (!this.ready || this.closing) throw new HttpError(503, 'unavailable');
    const target = parseRequestTarget(req.url); assertExternalTrust(req, policy, !READ_METHODS.has(req.method));
    const p = target.decodedPathname;
    if (p === '/api/mobile-access' || p.startsWith('/api/mobile-access/') || p === '/api/foreverweb' || p.startsWith('/api/foreverweb/')) throw new HttpError(404, 'not_found');
    if (req.method === 'TRACE' || req.method === 'CONNECT') throw new HttpError(405, 'method_not_allowed');
    if (req.method === 'GET' && !target.search && p === '/mobile-access/health') { sendJson(res, 200, { ok: true, version: VERSION }, this.config.secure); return; }
    if (req.method === 'GET' && !target.search && p === '/mobile-access/webrtc-probe') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
        'x-content-type-options': 'nosniff' });
      res.end(WEBRTC_PROBE_HTML);
      return;
    }
    if (req.method === 'GET' && !target.search && p === '/mobile-access/metadata') { sendJson(res, 200, { version: 1, pluginVersion: VERSION,
      protocolVersion: CONNECTION_PROTOCOL_VERSION, capabilities: CONNECTION_CAPABILITIES }, this.config.secure); return; }
    if (req.method === 'GET' && !target.search && p === '/mobile-access/sw.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-length': Buffer.byteLength(SERVICE_WORKER_SOURCE),
        'cache-control': 'no-cache', 'service-worker-allowed': '/', 'x-content-type-options': 'nosniff' });
      res.end(SERVICE_WORKER_SOURCE); return;
    }
    if (req.method === 'GET' && !target.search && p === '/mobile-access/manifest.webmanifest') {
      res.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8', 'content-length': APP_MANIFEST.length,
        'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
      res.end(APP_MANIFEST); return;
    }
    const iconName = APP_ICON_ROUTES[p];
    if (req.method === 'GET' && !target.search && iconName !== undefined) {
      const icon = APP_ICON_BUFFERS.get(iconName);
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': icon.length,
        'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' });
      res.end(icon); return;
    }
    // Keep old browser bookmarks usable without loading the retired frontend.
    if (req.method === 'GET' && (p === '/mobile/app' || p === '/mobile/app/')) {
      setSecurityHeaders(res, this.config.secure); res.writeHead(303, { Location: '/' }); res.end(); return;
    }
    if (req.method === 'GET' && ['/mobile-access/pair', '/mobile-access/pair.js', '/mobile-access/login', '/mobile-access/login.js'].includes(p)) {
      // The public form may be opened before a pairing window. Only a valid,
      // current one-use token can create access in the POST handler above.
      if (p === '/mobile-access/pair' && target.search) throw new HttpError(400, 'bad_request');
      if (p.endsWith('.js') && target.search) throw new HttpError(400, 'bad_request');
      const locale = resolveBrowserUiLocale(req.headers.cookie, req.headers['accept-language']);
      const render = p.includes('/pair') ? (p.endsWith('.js') ? renderPairScript : renderPairPage) : (p.endsWith('.js') ? renderLoginScript : renderLoginPage);
      const body = render(locale); setSecurityHeaders(res, this.config.secure);
      res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }); res.end(body); return;
    }
    if (p.startsWith('/mobile-access/auth/') && req.method === 'POST' && !target.search) {
      const action = p.slice('/mobile-access/auth/'.length);
      try { await this.auth(req, res, action, scope); }
      catch (error) {
        if (!error.connectionScope && ['renew', 'pair'].includes(action)) {
          scopeFailure(error, action.endsWith('pair') ? 'pairing' : 'device');
        }
        throw error;
      }
      return;
    }
    let authorization;
    try { authorization = this.authorize(req); }
    catch (error) {
      if (req.method === 'GET' && (p === '/' || p === '/index.html') && String(req.headers.accept).includes('text/html')) {
        const returnTo = '?return=' + encodeURIComponent(target.pathname + target.search);
        setSecurityHeaders(res, this.config.secure); res.writeHead(303, { Location: '/mobile-access/login' + returnTo }); res.end(); return;
      }
      throw error;
    }
    if (!READ_METHODS.has(req.method)) this.assertCsrf(authorization, req.headers[CSRF_HEADER]);
    if (p === '/mobile-access/lite' && req.method === 'GET' && !target.search) {
      setSecurityHeaders(res, this.config.secure);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(LITE_PROBE_HTML) });
      res.end(LITE_PROBE_HTML); return;
    }
    if (p === '/mobile-access/status' && req.method === 'GET' && !target.search) {
      sendJson(res, 200, this.connectionState(authorization), this.config.secure); return;
    }
    if (p === '/mobile-access' || p.startsWith('/mobile-access/')) throw new HttpError(404, 'not_found');
    await this.proxyHttp(req, res, authorization, target, origin);
  }

  operation(req, res, authorization) {
    if (this.operations.size >= this.config.maxActiveRequests) throw new HttpError(429, 'busy');
    const controller = new AbortController(); const abort = reason => controller.abort(reason instanceof Error ? reason : new Error('Connection ended'));
    const item = { ...authorization, controller, abort }; this.operations.add(item);
    const timer = setTimeout(() => abort(scopeFailure(new HttpError(401, 'session_expired'), 'session')), Math.max(1, authorization.expiresAt - Date.now())); timer.unref();
    const onClose = () => { if (!res.writableEnded) abort(); }; req.once('aborted', abort); res.once('close', onClose);
    let finished = false;
    item.finish = () => {
      if (finished) return; finished = true;
      clearTimeout(timer); req.off('aborted', abort); res.off('close', onClose); this.operations.delete(item);
    };
    return item;
  }

  async hostCookie(signal) {
    if (!this.authenticatedUrl) return undefined;
    if (this.credential && this.credentialExpires > Date.now() + 30000) return this.credential;
    if (!this.credentialTask) {
      const controller = new AbortController(); this.credentialController = controller;
      const timer = setTimeout(() => controller.abort(), this.config.upstreamTimeoutMs); timer.unref();
      const task = this.exchangeHostCookie(controller.signal).catch(error => {
        const failure = error instanceof HttpError ? error : new HttpError(502, 'upstream_unavailable');
        this.observeHost(failure.code === 'upstream_authentication_failed' ? 'authentication-failed' : 'unavailable', failure.code);
        throw scopeFailure(failure, 'host');
      }).finally(() => {
        clearTimeout(timer); if (this.credentialTask === task) { this.credentialTask = undefined; this.credentialController = undefined; }
      });
      this.credentialTask = task;
    }
    return waitWithSignal(this.credentialTask, signal);
  }

  async exchangeHostCookie(signal) {
    const target = new URL(typeof this.authenticatedUrl === 'function' ? this.authenticatedUrl() : this.authenticatedUrl);
    if (target.origin !== this.config.upstreamOrigin.origin || target.pathname !== '/' || !target.search || target.hash) throw new HttpError(502, 'upstream_unavailable');
    const response = await this.upstreamRequest('GET', target.pathname + target.search,
      { host: target.host, accept: 'text/html', 'accept-encoding': 'identity' }, signal);
    await boundedBody(response, CONTROL_LIMIT);
    if (response.statusCode !== 303) throw new HttpError(502, 'upstream_authentication_failed');
    const header = response.headers['set-cookie']?.find(value => /^dsh-auth-[\w-]+=/.test(value));
    const pair = header?.split(';')[0]; const seconds = Number(/(?:^|;\s*)Max-Age=(\d+)(?:;|$)/i.exec(header || '')?.[1]);
    if (!pair || pair.length > 4096 || !/^dsh-auth-[\w-]+=[\w.-]+$/.test(pair) || !Number.isSafeInteger(seconds) || seconds <= 0) throw new HttpError(502, 'upstream_authentication_failed');
    signal.throwIfAborted(); this.credential = pair; this.credentialExpires = Date.now() + seconds * 1000;
    this.credentialGeneration++; return pair;
  }

  upstreamRequest(method, path, headers, signal, body) {
    signal.throwIfAborted();
    return new Promise((resolveResponse, reject) => {
      const target = this.config.upstreamOrigin;
      const up = http.request({ hostname: target.hostname.replace(/^\[|\]$/g, ''), port: target.port, method, path, headers, signal });
      up.setTimeout(this.config.upstreamTimeoutMs, () => up.destroy(new HttpError(504, 'upstream_timeout')));
      // Once an API request has been sent, the Host may legitimately wait for
      // a model/tool result. Its response budget differs from authentication
      // and handshake timeouts; caller cancellation and session expiry remain.
      if (path === '/api' || path.startsWith('/api/')) up.once('finish', () => up.setTimeout(this.config.upstreamApiTimeoutMs));
      up.once('response', response => {
        // Reading can pause while the mobile leg drains. Do not apply the
        // short header timeout to a response body under backpressure.
        up.setTimeout(/text\/event-stream|application\/(?:x-ndjson|jsonl)/i.test(String(response.headers['content-type']))
          ? 0 : this.config.upstreamApiTimeoutMs);
        resolveResponse(response);
      });
      up.once('error', reject);
      if (body) body.pipe(up); else up.end();
    });
  }

  async proxyHttp(req, res, authorization, target, origin) {
    const declared = req.headers['content-length'];
    if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > this.config.maxBodyBytes)) throw new HttpError(413, 'payload_too_large');
    const op = this.operation(req, res, authorization); let inputBytes = 0, requestHostGeneration, receivedHostResponse = false;
    const countBody = chunk => { inputBytes += chunk.length; if (inputBytes > this.config.maxBodyBytes) op.controller.abort(new HttpError(413, 'payload_too_large')); };
    req.on('data', countBody); req.pause();
    try {
      const credential = await this.hostCookie(op.controller.signal);
      const hostCredentialGeneration = this.credentialGeneration;
      requestHostGeneration = hostCredentialGeneration;
      const up = await this.upstreamRequest(req.method, target.pathname + target.search, requestHeaders(req, this.config.upstreamOrigin, credential), op.controller.signal, req);
      receivedHostResponse = true;
      const outgoing = responseHeaders(up.headers, this.config.upstreamOrigin, origin, target.raw);
      if (hostCredentialGeneration === this.credentialGeneration) {
        this.observeHost(up.statusCode === 401 ? 'authentication-failed' : 'reachable', up.statusCode === 401 ? 'upstream_authentication_failed' : undefined);
      }
      if (up.statusCode === 401) {
        if (this.authenticatedUrl && hostCredentialGeneration === this.credentialGeneration) { this.credential = undefined; this.credentialExpires = 0; }
        outgoing['x-dsh-foreverweb-error-scope'] = 'host'; outgoing['x-dsh-foreverweb-error-code'] = 'upstream_authentication_failed';
      }
      // Harness asset names carry a content hash; keep them for a year even
      // when the Host omits an explicit policy. Plugin bundles stay untouched.
      if (!outgoing['cache-control'] && READ_METHODS.has(req.method)
        && (/^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(target.decodedPathname)
          || /^\/plugins\//.test(target.decodedPathname) && /(?:^|[?&])rev=[A-Za-z0-9_-]+/.test(target.search))) {
        outgoing['cache-control'] = 'public, max-age=31536000, immutable';
      }
      const document = req.method === 'GET' && (target.decodedPathname === '/' || target.decodedPathname === '/index.html')
        && up.statusCode === 200 && String(up.headers['content-type']).includes('text/html');
      if (document) {
        let html = await documentBody(up);
        // The original root-relative base is redundant at this root mount.
        html = html.replace(/(<head\b[^>]*>)<base href="\.\/">/i, '$1');
        // Replace the Host's authenticated icon links with public gateway
        // routes, so saving this page to a home screen works offline of the
        // session and does not fall back to a generic system icon.
        html = html.replace(/<link\b[^>]*\brel="(?:manifest|icon|apple-touch-icon)"[^>]*>/gi, '');
        if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, value => APP_HEAD_LINKS + BOOT_SPLASH_STYLE + value);
        else if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, value => value + APP_HEAD_LINKS + BOOT_SPLASH_STYLE);
        else html = APP_HEAD_LINKS + BOOT_SPLASH_STYLE + html;
        html = /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, value => value + BOOT_SPLASH) : BOOT_SPLASH + html;
        html = filterMobileBootHtml(html, this.config.mobileDisabledPlugins);
        const state = JSON.stringify(this.connectionState(authorization)).replace(/</g, '\\u003c');
        const marker = META + '<script type="application/json" id="dsh-foreverweb-access-state">' + state + '</script>';
        html = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, value => value + marker) : marker + html;
        let body = Buffer.from(html); delete outgoing['content-encoding']; delete outgoing.etag; delete outgoing['last-modified'];
        delete outgoing['content-security-policy'];
        const accepted = req.headers['accept-encoding'];
        const gzip = encodingQuality(accepted, 'gzip');
        const br = encodingQuality(accepted, 'br');
        const encoding = br > 0 && br >= gzip ? 'br' : gzip > 0 ? 'gzip' : undefined;
        if (encoding) {
          body = encoding === 'br'
            ? brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } })
            : gzipSync(body, { level: zlibConstants.Z_BEST_SPEED });
          outgoing['content-encoding'] = encoding;
          const vary = String(outgoing.vary || '').split(',').map(value => value.trim()).filter(Boolean);
          if (!vary.some(value => value === '*' || value.toLowerCase() === 'accept-encoding')) vary.push('Accept-Encoding');
          outgoing.vary = vary.join(', ');
        }
        outgoing['content-length'] = String(body.length); outgoing['cache-control'] = 'no-store'; outgoing['content-type'] = 'text/html; charset=utf-8';
        setSecurityHeaders(res, this.config.secure, 'proxied'); res.writeHead(up.statusCode, outgoing); res.end(body);
      } else {
        const compression = responseCompression(req, target, up, outgoing);
        res.writeHead(up.statusCode || 502, outgoing);
        if (compression) await pipeline(up, compression, res, { signal: op.controller.signal });
        else await pipeline(up, res, { signal: op.controller.signal });
      }
    } catch (error) {
      // A mobile connection cut, caller cancellation, revoked/expired session
      // or gateway shutdown cancels the upstream leg too. None of those proves
      // that the Host failed. In particular pipeline() may already have
      // destroyed res; do not fall through to a negative Host observation.
      if (op.controller.signal.aborted) {
        this.diagnostics.record('request_cancelled', { scope: 'gateway' });
        if (res.destroyed || res.writableEnded) return;
        throw op.controller.signal.reason instanceof HttpError ? op.controller.signal.reason : new HttpError(504, 'request_cancelled');
      }
      // An interrupted response body is ambiguous about which network leg
      // failed. Headers already proved the Host reachable; DSH owns stream
      // repair and the individual request still fails without any replay.
      if (receivedHostResponse) this.diagnostics.record('response_interrupted', { scope: 'gateway' });
      if (error instanceof HttpError) {
        if (!receivedHostResponse && error.code.startsWith('upstream_') && (requestHostGeneration === undefined || requestHostGeneration === this.credentialGeneration)) {
          this.observeHost(error.code === 'upstream_authentication_failed' ? 'authentication-failed' : 'unavailable', error.code);
        }
        throw error;
      }
      if (!receivedHostResponse && (requestHostGeneration === undefined || requestHostGeneration === this.credentialGeneration)) this.observeHost('unavailable', 'upstream_unavailable');
      throw new HttpError(502, 'upstream_unavailable');
    } finally { req.off('data', countBody); op.finish(); }
  }

  async handleUpgrade(req, client, head, policy) {
    if (!this.ready || this.closing) throw new HttpError(503, 'unavailable');
    const target = parseRequestTarget(req.url); assertExternalTrust(req, policy, true);
    if (!WS_PATHS.has(target.decodedPathname)) throw new HttpError(404, 'not_found');
    if (req.method !== 'GET' || String(req.headers.upgrade).toLowerCase() !== 'websocket'
      || !String(req.headers.connection).toLowerCase().split(/\s*,\s*/).includes('upgrade') || req.headers['sec-websocket-version'] !== '13') throw new HttpError(400, 'bad_request');
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string' || Buffer.from(key, 'base64').length !== 16 || Buffer.from(key, 'base64').toString('base64') !== key) throw new HttpError(400, 'bad_request');
    if (this.webSockets.size >= this.config.maxWebSockets) throw new HttpError(429, 'busy');
    let authorization = this.authorize(req); const controller = new AbortController();
    const onClientClose = () => controller.abort(); client.once('close', onClientClose);
    const credential = await this.hostCookie(controller.signal); authorization = this.authorize(req);
    const hostCredentialGeneration = this.credentialGeneration;
    if (this.webSockets.size >= this.config.maxWebSockets) throw new HttpError(429, 'busy');
    if ([...this.webSockets].filter(item => item.deviceId === authorization.deviceId).length >= this.config.maxDeviceWebSockets) throw new HttpError(429, 'device_connection_limit');
    let upstreamSocket, timer, ended = false;
    const connectionId = randomUUID();
    const record = { ...authorization, abort: reason => {
      if (ended) return; ended = true;
      this.diagnostics.record('ws_closed', { connectionId, code: reason instanceof HttpError ? reason.code : 'socket_closed' });
      controller.abort(); client.destroy(); upstreamSocket?.destroy();
      clearTimeout(timer); this.webSockets.delete(record);
    } };
    timer = setTimeout(() => record.abort(new HttpError(401, 'session_expired')), Math.max(1, authorization.expiresAt - Date.now())); timer.unref(); this.webSockets.add(record);
    client.on('error', record.abort); client.once('close', record.abort);
    const branch = /(?:^|,)\s*permessage-deflate(?:\s*;|\s*,|\s*$)/i.test(String(req.headers['sec-websocket-extensions'] || '')) ? 'compressed' : 'raw';
    {
      const target = new URL(req.url, this.config.upstreamOrigin);
      const headers = requestHeaders(req, this.config.upstreamOrigin, credential, true);
      for (const key of ['connection', 'upgrade', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol']) delete headers[key];
      upstreamSocket = connectSocket({ host: this.config.upstreamOrigin.hostname.replace(/^\[|\]$/g, ''), port: Number(this.config.upstreamOrigin.port) });
      try {
        await bridgeCompressedWebSocket(req, client, upstreamSocket, head, target, credential, {
          headers, maxMessageBytes: Math.min(this.config.maxBodyBytes, 16 * 1024 * 1024),
          maxQueuedBytes: 32 * 1024 * 1024, thresholdBytes: 1024, concurrencyLimit: 4, level: 1,
          reserveQueuedBytes: bytes => this.queueBudget.reserve(authorization.deviceId, bytes),
          onDiagnostic: detail => this.diagnostics.record('ws_bridge', { ...detail, connectionId, branch })
        }, this.config.upstreamTimeoutMs);
        if (!controller.signal.aborted && hostCredentialGeneration === this.credentialGeneration) this.observeHost('reachable');
        this.diagnostics.record('ws_open', { connectionId, branch });
      } catch (error) {
        if (!controller.signal.aborted && hostCredentialGeneration === this.credentialGeneration) {
          if (error instanceof HttpError && error.code === 'upstream_authentication_failed') {
            this.credential = undefined; this.credentialExpires = 0;
            this.observeHost('authentication-failed', error.code);
          } else this.observeHost('unavailable', 'upstream_unavailable');
        }
        // The bridge has already destroyed the rejected client socket. Keep a
        // structured observation for /status even when no HTTP reply remains.
        record.abort(error); throw error;
      }
      return;
    }
  }

  localAdminRoute(prefix, authenticated) {
    return { kind: 'prefix', path: prefix, handler: async (req, res) => {
      try {
        if (!authenticated(req)) throw new HttpError(401, 'authentication_required');
        assertLocalAdminTrust(req, req.method === 'POST', () => authenticated(req));
        const target = parseRequestTarget(req.url); if (target.search) throw new HttpError(400, 'bad_request');
        const route = target.decodedPathname.slice(prefix.length);
        if (req.method === 'GET' && route === '/status') {
          sendJson(res, 200, { configured: Boolean(this.config.publicOrigin || this.lanOrigin),
            gateway: this.address(), lanOrigin: this.lanOrigin, localNetwork: Boolean(this.lanOrigin), editable: this.configurationEditable(),
            message: '电脑接入家庭或办公局域网后，可生成同网配对二维码。',
            remoteAvailable: Boolean(this.config.publicOrigin && this.remoteReady()),
            pairing: this.access.pairingStatus(), deviceCount: this.access.listDevices().length,
            resources: { connections: this.sockets.size, activeRequests: this.operations.size, webSockets: this.webSockets.size,
              compressedQueues: this.queueBudget.snapshot() }, version: VERSION, hostId: this.access.hostId,
            connectorInstanceId: this.connectorInstanceId, host: this.hostState, diagnostics: this.diagnostics.snapshot() }, false); return;
        }
        if (req.method === 'GET' && route === '/devices') { sendJson(res, 200, { devices: this.access.listDevices() }, false); return; }
        if (req.method === 'GET' && route === '/connector') { sendJson(res, 200, { version: VERSION, frontend: 'stock', origin: this.address().origin }, false); return; }
        if (req.method !== 'POST') throw new HttpError(404, 'not_found');
        const body = await readJsonObject(req, CONTROL_LIMIT);
        if (route === '/pairing/open') {
          const mode = body.mode ?? (this.config.publicOrigin ? 'remote' : 'lan');
          if (mode !== 'lan' && mode !== 'remote') throw new HttpError(400, 'bad_request');
          const origin = mode === 'lan' ? this.lanOrigin : this.config.publicOrigin;
          if (!origin || mode === 'remote' && !this.remoteReady()) throw new HttpError(409, 'connection_unavailable');
          const opened = await this.access.openPairing(body.ttlMs, mode === 'lan' ? 'lan' : undefined);
          const pin = mode === 'lan' ? '&pin=' + this.config.lan.fingerprint : '';
          const pairUrl = origin + '/mobile-access/pair#instance=' + this.config.instanceId + '&token=' + opened.token + pin;
          const qrSvg = await QRCode.toString(pairUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
          sendJson(res, 201, { ...opened, pairUrl, qrSvg, mode }, false); return;
        }
        if (route === '/devices/revoke') {
          if (typeof body.deviceId !== 'string' || !/^[a-f\d]{32}$/.test(body.deviceId)) throw new HttpError(400, 'bad_request');
          if (!await this.access.revokeDevice(body.deviceId)) throw new HttpError(404, 'not_found');
          sendJson(res, 200, { revoked: true }, false); return;
        }
        if (route === '/devices/rename') {
          if (typeof body.deviceId !== 'string' || !/^[a-f\d]{32}$/.test(body.deviceId) || typeof body.label !== 'string') throw new HttpError(400, 'bad_request');
          const device = await this.access.renameDevice(body.deviceId, body.label);
          if (device === undefined) throw new HttpError(404, 'not_found');
          sendJson(res, 200, { device }, false); return;
        }
        if (route === '/devices/reset') {
          if (body.confirm !== true) throw new HttpError(400, 'bad_request');
          await this.access.resetDevices(); sendJson(res, 200, { reset: true }, false); return;
        }
        throw new HttpError(404, 'not_found');
      } catch (error) { fail(res, error, false, this.diagnostics); }
    } };
  }

  close() {
    if (this.closeTask) return this.closeTask;
    this.closing = true; this.ready = false;
    this.closeTask = (async () => {
      this.credentialController?.abort();
      for (const item of [...this.operations, ...this.webSockets]) item.abort();
      const stopped = [this.server, this.lanServer].filter(server => server?.listening).map(server => new Promise(done => server.close(done)));
      for (const socket of this.sockets) socket.destroy();
      await Promise.allSettled([...stopped, this.access.close(), this.credentialTask]);
      this.listeners.clear();
      this.unsubscribe(); this.credential = undefined; this.credentialExpires = 0;
    })();
    return this.closeTask;
  }
}
