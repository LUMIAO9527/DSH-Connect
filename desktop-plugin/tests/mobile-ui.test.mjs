import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../mobile-client.js', import.meta.url), 'utf8');

function page({ authenticated = true, native = false, transport = 'connecting', fullscreen = false, settings = false, nestedDialog = false, viewport } = {}) {
  class Element extends EventTarget {
    constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.style = { setProperty(key, value) { this[key] = value; } }; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    hasAttribute(key) { return key in this.attrs; }
    removeAttribute(key) { delete this.attrs[key]; }
    toggleAttribute(key, on) { if (on) this.attrs[key] = ''; else delete this.attrs[key]; }
    append(...nodes) { this.children.push(...nodes); }
    getClientRects() { return [{}]; }
    focus() { this.focused = true; }
  }
  const window = new EventTarget(), document = new EventTarget(), calls = [], timers = new Map(), destinations = [];
  document.documentElement = new Element('html'); document.head = new Element('head'); document.body = new Element('body'); document.readyState = 'complete';
  document.createElement = tag => new Element(tag);
  const frame = new Element('div'); frame.setAttribute('data-sidebar-collapsed', 'true'); frame.setAttribute('data-rightbar-collapsed', 'true');
  if (fullscreen) frame.setAttribute('data-rightbar-fullscreen', 'true');
  frame.append(new Element('div'), new Element('div'), new Element('div'));
  const overlay = new Element('div'); overlay.parentElement = frame;
  const settingsPanel = new Element('div'), category = new Element('button'), dialog = new Element('div'), escapes = [];
  settingsPanel.setAttribute('data-dsc-settings', ''); settingsPanel.setAttribute('data-dsc-settings-detail', '');
  settingsPanel.querySelector = () => category;
  settingsPanel.addEventListener('keydown', event => escapes.push('settings:' + event.type));
  dialog.addEventListener('keydown', event => escapes.push('nested:' + event.type));
  document.querySelector = query => query.startsWith('meta[') && authenticated ? {} : query === '[data-shell-overlay]' && fullscreen ? overlay
    : settings && query === '[data-shortcut-modal="settings"]' ? settingsPanel
    : settings && query === '[data-shortcut-modal="settings"][data-dsc-settings-detail]' && settingsPanel.hasAttribute('data-dsc-settings-detail') ? settingsPanel : null;
  document.querySelectorAll = () => settings ? (nestedDialog ? [settingsPanel, dialog] : [settingsPanel]) : [];
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  if (viewport) { window.innerHeight = viewport.innerHeight; window.visualViewport = Object.assign(new EventTarget(), { height: viewport.height }); }
  window.__DSH_CONNECT_TRANSPORT__ = transport;
  window.__DSH_FOREVERWEB_ACCESS__ = { getSnapshot: () => ({ device: { state: 'valid' }, session: { state: 'valid' } }), resume: async reason => calls.push(reason) };
  if (native) window.HarmonyConnector = { connectionChanged: state => calls.push(state), showComputers() {} };
  const navigator = { onLine: true, userAgent: native ? 'ArkWeb DSH-Connect/0.2.0' : 'Browser', clipboard: { writeText: async () => {} } };
  vm.runInNewContext(source, { window, document, navigator, location: { origin: 'https://example.test', pathname: '/', search: '', assign: url => destinations.push(url) },
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
    MutationObserver: class { observe() {} disconnect() {} }, KeyboardEvent: Event });
  return { window, document, calls, navigator, destinations, frame, settingsPanel, category, escapes,
    banner: () => document.body.children.find(node => node.className === 'dsc-status'),
    flush() { const pending = [...timers.values()]; timers.clear(); for (const callback of pending) callback(); },
    access(detail) { const event = new Event('dsh-foreverweb:access-state'); event.detail = detail; window.dispatchEvent(event); } };
}

test('ordinary local desktop receives no mobile shell or native bridge', () => {
  const local = page({ authenticated: false, native: true });
  assert.equal(local.window.__DSH_CONNECT_UI__, undefined); assert.equal(local.document.body.children.length, 0); assert.deepEqual(local.calls, []);
});

test('a native app opened after transport initialization receives connected immediately', () => {
  const native = page({ native: true, transport: 'connected' });
  assert.deepEqual(native.calls, ['connected']); assert.equal(native.banner().hidden, true);
  native.window.__DSH_CONNECT_UI__.setTransport('connected'); assert.deepEqual(native.calls, ['connected']);
  native.navigator.onLine = false; native.window.dispatchEvent(new Event('offline')); native.flush();
  assert.equal(native.banner().dataset.state, 'offline'); assert.equal(native.banner().children[2].hidden, true);
  native.navigator.onLine = true; native.window.dispatchEvent(new Event('online'));
  assert.equal(native.banner().hidden, true); assert.deepEqual(native.calls, ['connected', 'offline', 'connected']);
});

test('invalid device grant asks for pairing and retry never replays a business request', () => {
  const browser = page({ transport: 'connected' });
  browser.access({ device: { state: 'invalid' }, session: { state: 'expired' } }); browser.flush();
  assert.equal(browser.banner().dataset.state, 'auth-required'); assert.equal(browser.banner().hidden, false);
  browser.banner().children[2].dispatchEvent(new Event('click'));
  assert.deepEqual(browser.destinations, ['/mobile-access/login?return=%2F']); assert.deepEqual(browser.calls, []);
});

test('native back closes a fullscreen tool page whose layout reserves no side track', () => {
  const native = page({ native: true, transport: 'connected', fullscreen: true }); let closed = 0;
  native.window.__DSH_CONNECT_UI__.configure({ closeRightbar() { closed++; native.frame.removeAttribute('data-rightbar-fullscreen'); } });
  assert.equal(native.window.__DSH_CONNECT_UI__.back(), 'consumed'); assert.equal(closed, 1);
  assert.equal(native.window.__DSH_CONNECT_UI__.back(), 'root'); assert.equal(closed, 1);
});

test('returning from the native home coalesces access recovery without navigation', async () => {
  const native = page({ native: true, transport: 'connected' });
  const first = native.window.__DSH_CONNECT_UI__.resume();
  const second = native.window.__DSH_CONNECT_UI__.resume();
  assert.equal(first, second);
  await first;
  assert.deepEqual(native.calls, ['connected', 'native-foreground']);
  assert.deepEqual(native.destinations, []);
  await native.window.__DSH_CONNECT_UI__.resume();
  assert.deepEqual(native.calls, ['connected', 'native-foreground', 'native-foreground']);
});

test('settings detail returns to its category before closing the settings dialog', () => {
  const native = page({ native: true, transport: 'connected', settings: true });
  assert.equal(native.window.__DSH_CONNECT_UI__.back(), 'consumed');
  assert.equal(native.settingsPanel.hasAttribute('data-dsc-settings-detail'), false);
  assert.equal(native.category.focused, true); assert.deepEqual(native.escapes, []);
  native.window.__DSH_CONNECT_UI__.back(); assert.deepEqual(native.escapes, ['settings:keydown']);
});

test('a child dialog closes before the settings detail moves back', () => {
  const native = page({ native: true, transport: 'connected', settings: true, nestedDialog: true });
  assert.equal(native.window.__DSH_CONNECT_UI__.back(), 'consumed');
  assert.equal(native.settingsPanel.hasAttribute('data-dsc-settings-detail'), true);
  assert.deepEqual(native.escapes, ['nested:keydown']);
});

test('app and browser each have one safe-area owner across keyboard and window changes', () => {
  const app = page({ native: true, viewport: { innerHeight: 760, height: 760 } });
  const browser = page({ viewport: { innerHeight: 760, height: 760 } });
  const appStyle = app.document.documentElement.style, browserStyle = browser.document.documentElement.style;
  assert.equal(appStyle['--dsc-inset-bottom'], '0px');
  assert.equal(browserStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
  for (const current of [app, browser]) {
    current.window.visualViewport.height = 470.5;
    current.window.visualViewport.dispatchEvent(new Event('resize'));
    assert.equal(current.document.documentElement.style['--dsc-viewport'], '470.5px');
    assert.equal(current.document.documentElement.style['--dsc-inset-bottom'], '0px');
    current.window.visualViewport.height = 760;
    current.window.dispatchEvent(new Event('resize'));
  }
  assert.equal(appStyle['--dsc-inset-bottom'], '0px');
  assert.equal(browserStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
});
