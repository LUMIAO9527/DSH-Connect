import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { renderLoginScript, renderPairScript } from '../lib/mobile-access/core/auth-pages.mjs';

const source = await readFile(new URL('../gateway-bootstrap.js', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const BASE_TIME = 1800000000000;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const snapshot = (overrides = {}) => ({ protocolVersion: 1, pluginVersion: '0.4.0-preview.1', hostId: 'a'.repeat(64), connectorInstanceId: 'fixture-process',
  capabilities: ['access-state-v1'], serverTime: BASE_TIME,
  device: { state: 'valid', expiresAt: BASE_TIME + 90 * 86400000 }, session: { state: 'valid', expiresAt: BASE_TIME + 8 * 3600000 },
  host: { state: 'reachable', observedAt: BASE_TIME }, ...overrides });
const renewed = (value = snapshot()) => Response.json({ sessionExpiresAt: value.session.expiresAt, deviceExpiresAt: value.device.expiresAt, connection: value });
const unauthorized = (scope = 'session', code = 'authentication_failed') => Response.json({ error: code }, {
  status: 401, headers: { 'x-dsh-foreverweb-error-scope': scope, 'x-dsh-foreverweb-error-code': code }
});

test('workspace startup prefetches the saved session once through the Session Controller', async () => {
  let plugin;
  const window = {
    __ModuleLoader__: { load: descriptor => { plugin = descriptor.factory(() => ({})); } },
    addEventListener() {}, removeEventListener() {},
  };
  const document = { querySelector: () => ({}) };
  const localStorage = { getItem: key => key === 'dsh.sessions.current' ? '{"sessionId":"session-saved"}' : null };
  vm.runInNewContext(clientSource, { window, document, localStorage, navigator: { onLine: true } });

  let state = 'connecting';
  const listeners = new Set(), prefetches = [];
  const effect = setup => setup();
  plugin.apply({
    effect,
    inject(dependencies, setup) {
      assert.deepEqual([...dependencies], ['sessions']);
      setup({ effect, sessions: { async refreshProjections(id) { prefetches.push(id); } } });
    },
    slots: { inject: (_key, setup) => setup(), register() {} },
    connection: { state: { getSnapshot: () => state, subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    } } },
  });
  await flush();
  assert.deepEqual(prefetches, []);
  for (const next of ['connected', 'disconnected', 'connected']) {
    state = next;
    for (const callback of listeners) callback();
    await flush();
  }
  assert.deepEqual(prefetches, ['session-saved']);
});

function application(nativeFetch, { initial = snapshot(), authenticated = true, href = 'https://harmony.test/', recovery } = {}) {
  let clock = BASE_TIME, timerId = 0;
  const timers = new Map(), events = [], handlers = new Map();
  const add = (type, listener) => { const list = handlers.get(type) || []; list.push(listener); handlers.set(type, list); };
  const window = { fetch: nativeFetch, addEventListener: add, dispatchEvent(event) { events.push(event); for (const listener of handlers.get(event.type) || []) listener(event); },
    ...(recovery ? { __DSH_CONNECTION_RECOVERY__: recovery } : {}) };
  const document = { querySelector: () => authenticated ? {} : null, getElementById: () => initial ? { textContent: JSON.stringify(initial) } : null,
    cookie: '__Host-dsh_ma_csrf=fixture-csrf', hidden: false, addEventListener: add };
  const navigator = { onLine: true };
  class TestDate extends Date { static now() { return clock; } }
  class TestEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  const location = new URL(href); location.replace = value => { throw new Error('Unexpected navigation: ' + value); };
  const context = vm.createContext({ window, document, navigator, location, URL, URLSearchParams, Request, Response, Headers,
    AbortController, DOMException, CustomEvent: TestEvent, Date: TestDate,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(source, context);
  return { window, document, navigator, events, timers, fetch: window.fetch, access: window.__DSH_FOREVERWEB_ACCESS__,
    advance(ms) { clock += ms; },
    fire(ms) { const [id, timer] = [...timers].find(([, value]) => value.ms === ms) || []; assert.ok(timer, 'expected timer ' + ms); timers.delete(id); timer.fn(); },
    emit(type) { for (const handler of handlers.get(type) || []) handler({ type }); } };
}

test('desktop transport remains untouched; authenticated first requests do not renew or navigate', async () => {
  let calls = 0, renewals = 0;
  const fetch = async input => { calls++; if (String(input).includes('/auth/renew')) renewals++; return new Response('ok'); };
  const desktop = application(fetch, { authenticated: false }); assert.equal(desktop.window.fetch, fetch);
  const app = application(fetch);
  assert.equal((await app.fetch('/api/first')).status, 200);
  assert.equal((await app.fetch('/plugins/first.js')).status, 200);
  assert.equal(calls, 2); assert.equal(renewals, 0);
  assert.equal(app.access.getSnapshot().hostId, 'a'.repeat(64));
  assert.equal(app.window.__DSH_CONNECTION_RECOVERY__.generationReadyTimeoutMs, 60000);
  assert.equal(app.events.some(event => event.type === 'dsh-foreverweb:access-state'), true);
});

test('legacy marker without expiry is nonblocking and preserves Host recovery options', async () => {
  let calls = 0;
  const app = application(async () => { calls++; return new Response('ok'); }, { initial: null, recovery: { backoffBaseMs: 700, generationReadyTimeoutMs: 90000 } });
  await app.fetch('/api/first'); assert.equal(calls, 1);
  assert.equal(app.window.__DSH_CONNECTION_RECOVERY__.backoffBaseMs, 700);
  assert.equal(app.window.__DSH_CONNECTION_RECOVERY__.generationReadyTimeoutMs, 90000);
});

test('still-valid requests are not parked behind proactive renewal', async () => {
  let renewals = 0, writes = 0; const pending = deferred();
  const app = application(async (input, init) => {
    if (String(input).includes('/auth/renew')) { renewals++; return pending.promise; }
    if (init?.method === 'POST') writes++;
    return new Response('ok');
  }, { initial: snapshot({ session: { state: 'valid', expiresAt: BASE_TIME + 100000 } }) });
  app.advance(91000);
  assert.equal((await app.fetch('/api/write', { method: 'POST', body: 'once' })).status, 200);
  assert.equal(renewals, 1); assert.equal(writes, 1);
  pending.resolve(renewed(snapshot({ serverTime: BASE_TIME + 91000 })));
  await flush(); assert.equal(app.access.getSnapshot().session.state, 'valid');
});

test('concurrent old 401s renew once, do not replay writes, and cannot invalidate a new generation', async () => {
  let renewals = 0; const one = deferred(), two = deferred(), refresh = deferred(); const calls = [];
  const app = application(async (input, init) => {
    if (String(input).includes('/auth/renew')) { renewals++; return refresh.promise; }
    calls.push({ input, body: init?.body, csrf: new Headers(init?.headers).get('x-dsh-mobile-csrf') });
    if (input === '/api/one') return one.promise;
    if (input === '/api/two') return two.promise;
    return new Response('ok');
  });
  const first = app.fetch('/api/one', { method: 'POST', body: 'immutable content' });
  const second = app.fetch('/api/two');
  one.resolve(unauthorized()); await flush(); assert.equal(renewals, 1);
  const later = app.fetch('/api/later'); let completed = false; later.then(() => { completed = true; });
  await flush(); assert.equal(completed, false);
  refresh.resolve(renewed()); assert.equal((await first).status, 401); await later;
  two.resolve(unauthorized()); assert.equal((await second).status, 401);
  assert.equal(renewals, 1); assert.equal(calls.filter(value => value.input === '/api/one').length, 1);
  assert.equal(calls[0].body, 'immutable content'); assert.equal(calls[0].csrf, 'fixture-csrf');
  assert.equal(app.access.getSnapshot().authGeneration, 1);
});

test('Host authentication failure is distinct from device/session renewal', async () => {
  let renewals = 0, writes = 0;
  const app = application(async (input, init) => {
    if (String(input).includes('/auth/renew')) { renewals++; return renewed(); }
    if (init?.method === 'POST') writes++;
    return unauthorized('host', 'upstream_authentication_failed');
  });
  assert.equal((await app.fetch('/api/write', { method: 'POST', body: 'once' })).status, 401);
  assert.equal(renewals, 0); assert.equal(writes, 1);
  assert.equal(app.access.getSnapshot().device.state, 'valid');
  assert.equal(app.access.getSnapshot().host.state, 'authentication-failed');
  assert.equal(app.access.getSnapshot().lastError.action, 'check-host');
});

test('confirmed invalid device grant stops automatic renewal and dispatch', async () => {
  let renewals = 0, calls = 0;
  const app = application(async input => {
    if (String(input).includes('/auth/renew')) { renewals++; return unauthorized('device'); }
    calls++; return unauthorized();
  });
  assert.equal((await app.fetch('/api/first')).status, 401);
  const blocked = await app.fetch('/api/write', { method: 'POST', body: 'must not send' });
  assert.equal(blocked.status, 401); assert.equal(blocked.headers.get('x-dsh-foreverweb-request-dispatched'), 'no');
  await app.access.resume('foreground'); app.emit('online'); await flush();
  assert.equal(renewals, 1); assert.equal(calls, 1);
  assert.equal(app.access.getSnapshot().device.state, 'invalid');
  assert.equal(app.access.getSnapshot().lastError.action, 'pair');
});

test('network renewal failure preserves device authorization and retries only after cooldown', async () => {
  let renewals = 0, calls = 0;
  const app = application(async input => {
    if (String(input).includes('/auth/renew')) { renewals++; if (renewals === 1) throw new TypeError('network down'); return renewed(); }
    calls++; return calls === 1 ? unauthorized() : new Response('ok');
  });
  await app.fetch('/api/first');
  assert.equal(app.access.getSnapshot().device.state, 'valid');
  assert.equal(app.access.getSnapshot().lastError.scope, 'network');
  assert.equal((await app.fetch('/api/before-cooldown')).status, 503);
  assert.equal(calls, 1); assert.equal(renewals, 1);
  app.advance(5001);
  assert.equal((await app.fetch('/api/after-cooldown')).status, 200);
  assert.equal(calls, 2); assert.equal(renewals, 2);
});

test('renewal deadline releases callers and a late response cannot overwrite a later round', async () => {
  let renewals = 0, writes = 0; const old = deferred(), next = deferred();
  const app = application(async (input, init) => {
    if (String(input).includes('/auth/renew')) return ++renewals === 1 ? old.promise : next.promise;
    if (init?.method === 'POST') writes++; return new Response('ok');
  }, { initial: snapshot({ session: { state: 'expired', expiresAt: BASE_TIME - 1 } }) });
  const waiting = app.fetch('/api/write', { method: 'POST', body: 'not yet sent' });
  await flush(); app.fire(8000);
  assert.equal((await waiting).status, 503); assert.equal(writes, 0);
  app.advance(5001);
  const later = app.fetch('/api/write', { method: 'POST', body: 'once' }); await flush();
  old.resolve(renewed(snapshot({ hostId: 'b'.repeat(64) }))); await flush();
  assert.equal(app.access.getSnapshot().hostId, 'a'.repeat(64));
  next.resolve(renewed()); assert.equal((await later).status, 200);
  assert.equal(writes, 1); assert.equal(app.access.getSnapshot().authGeneration, 1);
});

test('cancelling a waiting caller leaves shared renewal alive and honors Request signal inheritance', async () => {
  let renewals = 0, writes = 0, renewalSignal; const refresh = deferred();
  const app = application(async (input, init) => {
    if (String(input).includes('/auth/renew')) { renewals++; renewalSignal = init.signal; return refresh.promise; }
    if (init?.method === 'POST') writes++; return new Response('ok');
  }, { initial: snapshot({ session: { state: 'expired', expiresAt: BASE_TIME - 1 } }) });
  const controller = new AbortController();
  const request = new Request('https://harmony.test/api/cancelled', { method: 'POST', body: 'cancelled', signal: controller.signal });
  const cancelled = app.fetch(request, { signal: undefined });
  const continuing = app.fetch('/api/continuing', { method: 'POST', body: 'once' });
  await flush(); controller.abort(); await assert.rejects(cancelled, { name: 'AbortError' });
  assert.equal(renewalSignal.aborted, false);
  refresh.resolve(renewed()); assert.equal((await continuing).status, 200);
  assert.equal(renewals, 1); assert.equal(writes, 1);
});

test('foreground/online intents share one probe; healthy access never requests transport restart', async () => {
  let probes = 0, renewals = 0; const reply = deferred();
  const app = application(async input => {
    if (String(input).includes('/auth/renew')) { renewals++; return renewed(); }
    if (input === '/mobile-access/status') { probes++; return reply.promise; }
    return new Response('ok');
  });
  const first = app.access.resume('foreground'), second = app.access.resume('online');
  assert.equal(first, second); await flush(); assert.equal(probes, 1);
  reply.resolve(Response.json(snapshot())); assert.equal((await first).ready, true);
  assert.equal(renewals, 0);
  const intents = app.events.filter(event => event.type === 'dsh-foreverweb:recovery-intent');
  assert.deepEqual(intents.map(event => event.detail.phase), ['checking', 'ready']);
  assert.equal(intents[1].detail.scope, 'access');
});

test('DSH connected intent coalesces a fresh trailing status probe without restarting transport', async () => {
  const old = deferred(), fresh = deferred(); let probes = 0, renewals = 0;
  const app = application(async input => {
    if (input === '/mobile-access/status') return ++probes === 1 ? old.promise : probes === 2 ? fresh.promise : Response.json(snapshot());
    if (String(input).includes('/auth/renew')) { renewals++; return renewed(); }
    throw new Error('No business request or reconnect is expected');
  });
  const pending = app.access.resume('foreground'); await flush(); assert.equal(probes, 1);
  assert.equal(app.access.resume('transport-connected'), pending);
  assert.equal(app.access.resume('transport-connected'), pending);
  old.resolve(Response.json(snapshot({ host: { state: 'unavailable', observedAt: BASE_TIME - 1 } })));
  await flush(); assert.equal(probes, 2);
  fresh.resolve(Response.json(snapshot())); assert.equal((await pending).ready, true);
  assert.equal(app.access.getSnapshot().host.state, 'reachable'); assert.equal(renewals, 0);
  await app.access.resume('foreground'); assert.equal(probes, 2, 'ordinary intents retain the 2s coalescing window');
  await app.access.resume('transport-connected'); assert.equal(probes, 3, 'new DSH connected evidence bypasses a stale 2s snapshot');
});

test('late Host errors cannot replace a newer observation, and stale snapshots cannot clear a newer Host error', async () => {
  const oldRequest = deferred(), oldStatus = deferred(); let statuses = 0;
  const app = application(async input => {
    if (input === '/api/old') return oldRequest.promise;
    if (input === '/mobile-access/status') return ++statuses === 1 ? Response.json(snapshot()) : oldStatus.promise;
    return unauthorized('host', 'upstream_authentication_failed');
  });
  const stale = app.fetch('/api/old'); await app.access.resume('foreground');
  oldRequest.resolve(unauthorized('host', 'upstream_authentication_failed'));
  assert.equal((await stale).status, 401, 'the actual request outcome is preserved');
  assert.equal(app.access.getSnapshot().host.state, 'reachable'); assert.equal(app.access.getSnapshot().lastError, null);
  app.advance(3000);
  const status = app.access.resume('foreground'); await flush();
  await app.fetch('/api/current');
  oldStatus.resolve(Response.json(snapshot())); await status;
  assert.equal(app.access.getSnapshot().host.state, 'authentication-failed');
  assert.equal(app.access.getSnapshot().lastError.scope, 'host');
  assert.equal(app.access.getSnapshot().host.observedAt, BASE_TIME + 3000, 'client observations use the projected server time domain');
});

test('changed authenticated host blocks new writes until the user resolves identity', async () => {
  let writes = 0;
  const app = application(async (input, init) => {
    if (input === '/mobile-access/status') return Response.json(snapshot({ hostId: 'b'.repeat(64) }));
    if (init?.method === 'POST') writes++; return new Response('ok');
  });
  assert.equal((await app.access.resume('foreground')).ready, false);
  assert.equal((await app.fetch('/api/write', { method: 'POST', body: 'must not send' })).status, 409);
  assert.equal(writes, 0); assert.equal(app.access.getSnapshot().hostId, 'a'.repeat(64));
  assert.equal(app.access.getSnapshot().lastError.code, 'host_identity_changed');
});

test('server-time projection avoids treating handset clock skew as expired authorization', async () => {
  let renewals = 0;
  const app = application(async input => { if (String(input).includes('/auth/renew')) renewals++; return new Response('ok'); }, {
    initial: snapshot({ serverTime: BASE_TIME - 86400000, session: { state: 'valid', expiresAt: BASE_TIME - 86400000 + 3600000 } })
  });
  assert.equal((await app.fetch('/api/read')).status, 200); assert.equal(renewals, 0);
});

test('foreground expiry scheduling renews credentials without restarting transport and pauses in background', async () => {
  let renewals = 0;
  const initial = snapshot({ session: { state: 'valid', expiresAt: BASE_TIME + 100000 } });
  const app = application(async input => {
    if (String(input).includes('/auth/renew')) { renewals++; return renewed(snapshot({ serverTime: BASE_TIME + 90000 })); }
    return Response.json(initial);
  }, { initial });
  assert.equal([...app.timers.values()].filter(timer => timer.ms === 90000).length, 1);
  app.document.hidden = true; app.emit('visibilitychange'); assert.equal(app.timers.size, 0);
  app.document.hidden = false; await app.access.resume('foreground');
  assert.equal(app.timers.size, 1); assert.equal(renewals, 0);
  app.advance(90000); app.fire(90000); await flush();
  assert.equal(renewals, 1); assert.equal(app.access.getSnapshot().authGeneration, 1);
  assert.equal(app.events.filter(event => event.type === 'dsh-foreverweb:recovery-intent').length, 2);
});

test('network rejection reports uncertainty without replay or invalidating the grant', async () => {
  let calls = 0;
  const failure = new TypeError('Fixture connection lost after admission');
  const app = application(async () => { calls++; throw failure; });
  await assert.rejects(app.fetch('/api/write', { method: 'POST', body: 'once' }), error => error === failure);
  assert.equal(calls, 1); assert.equal(app.access.getSnapshot().device.state, 'valid');
  assert.equal(app.access.getSnapshot().lastError.code, 'request_unavailable');
});

test('pairing success opens the stock entry and never resubmits while pending', async () => {
  const submitted = deferred(); const handlers = new Map(), destinations = [], timers = new Map(); let timerId = 0, calls = 0;
  const submit = { disabled: false };
  const token = { value: 'A'.repeat(43), addEventListener() {}, removeAttribute() {}, setAttribute() {}, focus() {} };
  const nodes = { 'pair-form': { querySelector: () => submit, addEventListener: (name, handler) => handlers.set(name, handler), setAttribute() {}, removeAttribute() {} },
    'pair-token': token, 'device-label': { value: 'fixture' }, 'pair-status': { value: '' } };
  const location = new URL('https://harmony.test/mobile-access/pair'); location.replace = value => destinations.push(value);
  vm.runInNewContext(renderPairScript('zh'), { window: { addEventListener() {} }, document: { getElementById: id => nodes[id] }, location, history: { replaceState() {} },
    URLSearchParams, AbortController, fetch: () => { calls++; return submitted.promise; },
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); } });
  const first = handlers.get('submit')({ preventDefault() {} });
  await handlers.get('submit')({ preventDefault() {} });
  assert.equal(calls, 1); assert.equal(submit.disabled, true);
  assert.equal(submit.textContent, '正在配对…', 'progress replaces the submit label instead of adding a status line');
  submitted.resolve(new Response('{}', { status: 201 })); await first;
  assert.deepEqual(destinations, ['/']); assert.equal(submit.disabled, false); assert.equal(timers.size, 0);
  assert.equal(submit.textContent, '连接电脑', 'the submit label is restored after the attempt');
});

test('opening a complete pairing link pairs once and confirms saved browser authorization before entering DSH', async () => {
  for (const saved of [true, false]) {
    const calls = [], destinations = [], timers = new Map(); let timerId = 0;
    const token = { value: '', addEventListener() {}, removeAttribute() {}, setAttribute() {}, focus() {} };
    const nodes = { 'pair-form': { querySelector: () => ({ disabled: false }), addEventListener() {}, setAttribute() {}, removeAttribute() {} },
      'pair-token': token, 'device-label': { value: '' }, 'pair-status': { value: '' } };
    const location = new URL('https://harmony.test/mobile-access/pair#instance=' + 'a'.repeat(64) + '&token=' + 'B'.repeat(43));
    location.replace = value => destinations.push(value);
    vm.runInNewContext(renderPairScript('zh'), { window: { addEventListener() {} }, document: { getElementById: id => nodes[id] }, location, history: { replaceState() {} },
      URLSearchParams, AbortController, fetch: async (input, init) => {
        calls.push({ input, init });
        return input.endsWith('/pair') ? Response.json({ paired: true }, { status: 201 }) : new Response('{}', { status: saved ? 200 : 401 });
      }, setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); } });
    await flush();
    assert.equal(calls.length, 2); assert.equal(JSON.parse(calls[0].init.body).token, 'B'.repeat(43));
    assert.equal(calls[1].input, '/mobile-access/status');
    assert.deepEqual(destinations, saved ? ['/'] : []);
    if (!saved) assert.match(nodes['pair-status'].value, /浏览器没有保存配对授权/);
    assert.equal(timers.size, 0);
  }
});

test('a pasted pairing link is reduced to its one-use code', async () => {
  const handlers = new Map(), calls = [], destinations = [], timers = new Map(); let timerId = 0;
  const submit = { disabled: false };
  const link = 'https://harmony.test/mobile-access/pair#instance=' + 'a'.repeat(64) + '&token=' + 'C'.repeat(43) + '&pin=' + 'd'.repeat(64);
  const token = { value: link, addEventListener() {}, removeAttribute() {}, setAttribute() {}, focus() {} };
  const nodes = { 'pair-form': { querySelector: () => submit, addEventListener: (name, handler) => handlers.set(name, handler), setAttribute() {}, removeAttribute() {} },
    'pair-token': token, 'device-label': { value: '' }, 'pair-status': { value: '' } };
  const location = new URL('https://harmony.test/mobile-access/pair'); location.replace = value => destinations.push(value);
  vm.runInNewContext(renderPairScript('zh'), { window: { addEventListener() {} }, document: { getElementById: id => nodes[id] }, location, history: { replaceState() {} },
    URLSearchParams, AbortController, fetch: async (input, init) => {
      calls.push({ input, init });
      return input.endsWith('/pair') ? Response.json({ paired: true }, { status: 201 }) : new Response('{}', { status: 200 });
    }, setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); } });
  await handlers.get('submit')({ preventDefault() {} });
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[0].init.body).token, 'C'.repeat(43));
  assert.deepEqual(destinations, ['/']);
});

test('a pasted link without a current pairing token asks for the code', async () => {
  const handlers = new Map(), attrs = {}; let calls = 0;
  const token = { value: 'https://harmony.test/mobile-access/pair', addEventListener() {}, removeAttribute() {},
    setAttribute(name, value) { attrs[name] = value; }, focus() {} };
  const nodes = { 'pair-form': { querySelector: () => ({ disabled: false }), addEventListener: (name, handler) => handlers.set(name, handler), setAttribute() {}, removeAttribute() {} },
    'pair-token': token, 'device-label': { value: '' }, 'pair-status': { value: '' } };
  const location = new URL('https://harmony.test/mobile-access/pair'); location.replace = () => {};
  vm.runInNewContext(renderPairScript('zh'), { window: { addEventListener() {} }, document: { getElementById: id => nodes[id] }, location, history: { replaceState() {} },
    URLSearchParams, AbortController, fetch: async () => { calls++; return new Response('{}', { status: 201 }); },
    setTimeout() { return 0; }, clearTimeout() {} });
  await handlers.get('submit')({ preventDefault() {} });
  assert.equal(calls, 0);
  assert.equal(attrs['aria-invalid'], 'true');
  assert.match(nodes['pair-status'].value, /43 位配对码/);
});

test('login defaults to the stock entry and preserves an explicit compatible stock return', async () => {
  for (const [query, expected] of [['', '/'], ['?return=%2F%3Ffrontend%3Dstock', '/?frontend=stock'], ['?return=https%3A%2F%2Fevil.example', '/'],
    ['?return=%2Fmobile%2Fapp', '/'], ['?return=%2Fmobile%2Fapp%2F%3Ffrontend%3Dold', '/']]) {
    const nodes = Object.fromEntries(['login-progress', 'login-failed', 'login-retry'].map(id => [id, { hidden: false, dataset: {}, addEventListener() {} }]));
    const destinations = [], timers = new Map(); let timerId = 0;
    const location = new URL('https://harmony.test/mobile-access/login' + query); location.replace = value => destinations.push(value);
    class Event { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    vm.runInNewContext(renderLoginScript('zh'), { window: { dispatchEvent() {} }, document: { getElementById: id => nodes[id] },
      location, URL, AbortController, CustomEvent: Event, fetch: async () => renewed(),
      setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); } });
    await flush(); assert.deepEqual(destinations, [expected]); assert.equal(timers.size, 0);
  }
});

test('login shows pairing only for invalid device authorization, not network/429/Host failures', async () => {
  for (const [response, expected] of [[() => unauthorized('device'), 'authorization-invalid'], [() => new Response('', { status: 429 }), 'unavailable'],
    [() => unauthorized('host'), 'unavailable'], [() => Promise.reject(new Error('network')), 'unavailable']]) {
    const nodes = Object.fromEntries(['login-progress', 'login-failed', 'login-retry'].map(id => [id, { hidden: false, dataset: {}, addEventListener() {} }]));
    const reports = [], native = [], timers = new Map(); let timerId = 0;
    const window = { dispatchEvent: event => reports.push(event.detail), HarmonyConnector: { connectionChanged: value => native.push(value) } };
    class Event { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    vm.runInNewContext(renderLoginScript('zh'), { window, document: { getElementById: id => nodes[id] },
      location: new URL('https://harmony.test/mobile-access/login?return=%2Fmobile%2Fapp'), URL, AbortController, CustomEvent: Event,
      fetch: () => Promise.resolve().then(response), setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); } });
    await flush();
    assert.equal(reports.at(-1).state, expected);
    assert.equal(native.length, 0);
    assert.equal(nodes['login-failed'].hidden, expected !== 'authorization-invalid');
    assert.equal(timers.size, 0);
  }
});

test('login describes a missing browser credential without calling it expired', async () => {
  const nodes = Object.fromEntries(['login-progress', 'login-failed', 'login-retry', 'login-failure-message'].map(id => [id, { hidden: false, dataset: {}, addEventListener() {} }]));
  const window = { dispatchEvent() {} };
  class Event { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(renderLoginScript('zh'), { window, document: { getElementById: id => nodes[id] },
    location: new URL('https://harmony.test/mobile-access/login'), URL, AbortController, CustomEvent: Event,
    fetch: async () => unauthorized('device', 'device_credential_missing'), setTimeout, clearTimeout });
  await flush();
  assert.equal(window.__DSH_FOREVERWEB_LOGIN_STATE__.state, 'authorization-invalid');
  assert.match(nodes['login-failure-message'].textContent, /没有保存配对授权/);
  assert.doesNotMatch(nodes['login-failure-message'].textContent, /过期/);
});
