import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

function client(initial = 'connected', authenticated = true) {
  const events = new EventTarget(), cleanups = [], subscribers = new Set(), resumes = [];
  let state = initial, reconnects = 0, module;
  const window = { addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    __DSH_FOREVERWEB_ACCESS__: { resume: async reason => { resumes.push(reason); } },
    __ModuleLoader__: { load(value) { module = value.factory(() => ({ createElement() {}, useEffect() {}, useRef() {}, useState() {} })); } } };
  vm.runInNewContext(source, { window, document: { querySelector: () => authenticated ? {} : null }, navigator: { onLine: true } });
  const ctx = { slots: { inject: (_name, fn) => fn(), register: () => () => {} },
    effect: setup => { const cleanup = setup(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
    connection: { state: { getSnapshot: () => state, subscribe: callback => { subscribers.add(callback); return () => subscribers.delete(callback); } },
      reconnect() { reconnects++; } } };
  module.apply(ctx);
  return { get reconnects() { return reconnects; }, resumes,
    transition(value) { state = value; for (const callback of subscribers) callback(); },
    intent(phase, reason) { const event = new Event('dsh-foreverweb:recovery-intent'); event.detail = { phase, reason }; events.dispatchEvent(event); },
    dispose() { for (const cleanup of cleanups.reverse()) cleanup(); } };
}

test('healthy authentication renewal keeps DSH transport; only ready disconnected transport reconnects', () => {
  const page = client();
  page.intent('ready', 'foreground'); assert.equal(page.reconnects, 0);
  page.transition('disconnected'); page.intent('blocked', 'foreground'); assert.equal(page.reconnects, 0);
  assert.ok(page.resumes.includes('transport-disconnected'));
  page.intent('ready', 'transport-connected'); assert.equal(page.reconnects, 0);
  page.intent('ready', 'foreground'); assert.equal(page.reconnects, 1);
  page.transition('connecting'); page.intent('ready', 'online'); assert.equal(page.reconnects, 1);
  page.transition('connected'); assert.ok(page.resumes.includes('transport-connected'));
  page.dispose(); page.transition('disconnected'); page.intent('ready', 'online'); assert.equal(page.reconnects, 1);
});

test('ordinary desktop does not receive a transport recovery owner', () => {
  const page = client('disconnected', false); page.intent('ready', 'online');
  assert.equal(page.reconnects, 0); assert.equal(page.resumes.length, 0); page.dispose();
});
