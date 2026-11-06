import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../mobile-client.js', import.meta.url), 'utf8');

function page({ authenticated = true, native = false, wide = false, files = false, transport = 'connecting', fullscreen = false, shell = false, conversation = false, settings = false, nestedDialog = false, viewport } = {}) {
  class Element extends EventTarget {
    constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.style = { setProperty(key, value) { this[key] = value; } }; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    hasAttribute(key) { return key in this.attrs; }
    removeAttribute(key) { delete this.attrs[key]; }
    toggleAttribute(key, on) { if (on) this.attrs[key] = ''; else delete this.attrs[key]; }
    querySelector(selector) { const match = selector.match(/^\[([^=\]]+)=?["']?([^"'\]]*)["']?\]$/); if (!match) return null; const [, key, value] = match; for (const child of this.children) { if (key in child.attrs && (!value || child.attrs[key] === value)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
    append(...nodes) { this.children.push(...nodes); }
    getClientRects() { return [{}]; }
    focus() { this.focused = true; }
  }
  const window = new EventTarget(), document = new EventTarget(), calls = [], timers = new Map(), destinations = [];
  const folderButton = new Element('button');
  folderButton.setAttribute('aria-label', '用 文件资源管理器 打开');
  const isFolderSelector = selector => selector.includes('[data-open-target="directory"]');
  const click = (button, matches) => {
    const event = new Event('click', { cancelable: true });
    Object.defineProperty(event, 'target', { value: { closest: selector => matches(selector) ? button : null } });
    document.dispatchEvent(event);
    return event;
  };
  const fileButton=new Element('button'),fileInput=new Element('input'),tools=new Element('div');
  fileButton.setAttribute('aria-haspopup','listbox');fileButton.setAttribute('aria-label','添加文件或调用指令');fileButton.parentElement=tools;fileInput.parentElement=tools;
  tools.querySelector=selector=>selector==='input[type="file"]'?fileInput:fileButton;
  fileInput.click=()=>calls.push('pick-file');document.activeElement={blur:()=>calls.push('blur')};
  document.documentElement = new Element('html'); document.head = new Element('head'); document.body = new Element('body'); document.readyState = 'complete';
  document.createElement = tag => new Element(tag);
  const viewportMeta = new Element('meta'); viewportMeta.setAttribute('content', 'width=device-width,initial-scale=1,viewport-fit=contain');
  const frame = new Element('div'); frame.setAttribute('data-sidebar-collapsed', 'true'); frame.setAttribute('data-rightbar-collapsed', 'true');
  if (fullscreen) frame.setAttribute('data-rightbar-fullscreen', 'true');
  const nativeMask = new Element('div'); nativeMask.setAttribute('data-sidebar-mask', '');
  const sidebar = new Element('div'), sidebarSlot = new Element('div'); sidebarSlot.setAttribute('data-slot', 'sidebar'); sidebar.append(sidebarSlot);
  const center = new Element('div'), mainPanel = new Element('div'), mainSlot = new Element('div'); mainSlot.setAttribute('data-slot', 'main'); mainPanel.append(mainSlot); center.append(mainPanel);
  frame.append(nativeMask, sidebar, center);
  const overlay = new Element('div'); overlay.parentElement = frame;
  const conversationHeader = new Element('header'), sessionHeader = new Element('div'), titleRow = new Element('div'), titleCluster = new Element('div'), tabsRow = new Element('div'), tabs = new Element('div');
  sessionHeader.parentElement = conversationHeader; sessionHeader.firstElementChild = titleRow; sessionHeader.nextElementSibling = tabsRow;
  titleRow.firstElementChild = titleCluster; tabs.setAttribute('data-conversation-tabs',''); tabs.parentElement=tabsRow; tabsRow.append(tabs); sessionHeader.append(titleRow,tabsRow); conversationHeader.append(sessionHeader);
  const settingsPanel = new Element('div'), category = new Element('button'), dialog = new Element('div'), escapes = [];
  settingsPanel.setAttribute('data-dsc-settings', ''); settingsPanel.setAttribute('data-dsc-settings-detail', '');
  settingsPanel.querySelector = () => category;
  settingsPanel.addEventListener('keydown', event => escapes.push('settings:' + event.type));
  dialog.addEventListener('keydown', event => escapes.push('nested:' + event.type));
  document.querySelector = query => query.startsWith('meta[name="dsh-foreverweb-gateway"]') && authenticated ? {} : query === 'meta[name="viewport"]' ? viewportMeta : query === '[data-shell-overlay]' && (fullscreen || shell) ? overlay
    : conversation && query === '[data-slot="conversation.session.header"]' ? sessionHeader
    : settings && query === '[data-shortcut-modal="settings"]' ? settingsPanel
    : settings && query === '[data-shortcut-modal="settings"][data-dsc-settings-detail]' && settingsPanel.hasAttribute('data-dsc-settings-detail') ? settingsPanel : null;
  document.querySelectorAll = query => query==='[data-composer-card] input[type="file"]' ? (files?[fileInput]:[]) : isFolderSelector(query) ? (conversation ? [folderButton] : []) : settings ? (nestedDialog ? [settingsPanel, dialog] : [settingsPanel]) : [];
  const media=Object.assign(new EventTarget(),{matches:!wide});window.matchMedia=()=>media;
  if (viewport) { window.innerHeight = viewport.innerHeight; window.visualViewport = Object.assign(new EventTarget(), { height: viewport.height }); }
  window.__DSH_CONNECT_TRANSPORT__ = transport;
  window.__DSH_FOREVERWEB_ACCESS__ = { getSnapshot: () => ({ device: { state: 'valid' }, session: { state: 'valid' } }), resume: async reason => calls.push(reason) };
  if (native) window.HarmonyConnector = { connectionChanged: state => calls.push(state), showComputers() {} };
  const navigator = { onLine: true, userAgent: native ? 'ArkWeb DSH-Connect/0.2.0' : 'Browser', clipboard: { writeText: async () => {} } };
  vm.runInNewContext(source, { window, document, navigator, location: { origin: 'https://example.test', pathname: '/', search: '', assign: url => destinations.push(url) },
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
    MutationObserver: class { observe() {} disconnect() {} }, KeyboardEvent: Event, getComputedStyle:element=>({visibility:element.visibility||'visible'}) });
  return { window, document, calls, navigator, destinations, frame, nativeMask, sidebar, center, settingsPanel, category, escapes, viewportMeta, conversationHeader, titleRow, titleCluster, tabsRow, fileButton,fileInput,media,folderButton,
    pick: () => click(fileButton, selector => selector === 'button[data-dsc-file-picker]'),
    openFolder: () => click(folderButton, isFolderSelector),
    banner: () => document.body.children.find(node => node.className === 'dsc-status'),
    flush() { const pending = [...timers.values()]; timers.clear(); for (const callback of pending) callback(); },
    access(detail) { const event = new Event('dsh-foreverweb:access-state'); event.detail = detail; window.dispatchEvent(event); } };
}

test('the original conversation folder opens in-app on mobile and keeps its upstream action on desktop', () => {
  const current = page({ conversation: true });
  const opened = [];
  let upstreamClicks = 0;
  current.window.__DSH_CONNECT_UI__.configure({ openWorkspaceFiles: button => opened.push(button) });
  current.document.addEventListener('click', () => upstreamClicks++);
  assert.equal(current.folderButton.getAttribute('aria-label'), '浏览电脑文件');
  assert.equal(current.openFolder().defaultPrevented, true);
  assert.deepEqual(opened, [current.folderButton]);
  assert.equal(upstreamClicks, 0);
  current.media.matches = false;
  current.media.dispatchEvent(new Event('change'));
  assert.equal(current.folderButton.getAttribute('aria-label'), '用 文件资源管理器 打开');
  assert.equal(current.openFolder().defaultPrevented, false);
  assert.equal(opened.length, 1);
  assert.equal(upstreamClicks, 1);
});

test('mobile attachment tap opens the existing file input without focusing the editor or launching commands',()=>{
  const mobile=page({files:true});
  assert.equal(mobile.fileButton.getAttribute('aria-label'),'添加附件');
  assert.equal(mobile.fileButton.getAttribute('aria-haspopup'),'dialog');
  assert.equal(mobile.pick().defaultPrevented,true);
  assert.deepEqual(mobile.calls,['blur','pick-file']);
  mobile.fileInput.disabled=true;mobile.pick();assert.deepEqual(mobile.calls,['blur','pick-file']);
});

test('wide browser keeps the upstream command launcher and responds to viewport changes',()=>{
  const desktop=page({files:true,wide:true});
  assert.equal(desktop.fileButton.getAttribute('aria-label'),'添加文件或调用指令');
  assert.equal(desktop.pick().defaultPrevented,false);assert.deepEqual(desktop.calls,[]);
  desktop.media.matches=true;desktop.media.dispatchEvent(new Event('change'));
  assert.equal(desktop.fileButton.getAttribute('aria-haspopup'),'dialog');desktop.pick();assert.deepEqual(desktop.calls,['blur','pick-file']);
  desktop.media.matches=false;desktop.media.dispatchEvent(new Event('change'));
  assert.equal(desktop.fileButton.getAttribute('aria-haspopup'),'listbox');assert.equal(desktop.fileButton.getAttribute('aria-label'),'添加文件或调用指令');
});

test('ordinary local desktop receives no mobile shell or native bridge', () => {
  const local = page({ authenticated: false, native: true });
  assert.equal(local.window.__DSH_CONNECT_UI__, undefined); assert.equal(local.document.body.children.length, 0); assert.deepEqual(local.calls, []);
});

test('mobile conversation header marks the semantic title row and tabs without touching text or actions', () => {
  const current=page({ native:true,transport:'connected',conversation:true });
  assert.equal(current.conversationHeader.hasAttribute('data-dsc-conversation-header'),true);
  assert.equal(current.titleRow.hasAttribute('data-dsc-conversation-title-row'),true);
  assert.equal(current.titleCluster.hasAttribute('data-dsc-conversation-title'),true);
  assert.equal(current.tabsRow.hasAttribute('data-dsc-conversation-tabs-row'),true);
  assert.deepEqual(current.destinations,[]);
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

test('a native mask before the sidebar does not become a white sidebar column', () => {
  const native = page({ native: true, transport: 'connected', shell: true });
  assert.equal(native.frame.hasAttribute('data-dsc-frame'), true);
  assert.equal(native.nativeMask.hasAttribute('data-dsc-sidebar'), false);
  assert.equal(native.nativeMask.hasAttribute('data-dsc-center'), false);
  assert.equal(native.sidebar.hasAttribute('data-dsc-sidebar'), true);
  assert.equal(native.center.hasAttribute('data-dsc-center'), true);
  assert.equal(native.document.body.children.find(node => node.className === 'dsc-drawer-mask').dataset.open, 'false');
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

test('a hidden navigation dialog never consumes Back ahead of an open file pane',()=>{
  const native=page({native:true,fullscreen:true,settings:true});native.settingsPanel.visibility='hidden';
  let closed=0;native.window.__DSH_CONNECT_UI__.configure({closeRightbar:()=>closed++});
  assert.equal(native.window.__DSH_CONNECT_UI__.back(),'consumed');assert.equal(closed,1);assert.deepEqual(native.escapes,[]);
});

test('native Web immersion and browsers retain system safe insets while the keyboard is closed', () => {
  const app = page({ native: true, viewport: { innerHeight: 760, height: 760 } });
  const browser = page({ viewport: { innerHeight: 760, height: 760 } });
  const appStyle = app.document.documentElement.style, browserStyle = browser.document.documentElement.style;
  assert.equal(appStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
  assert.equal(browserStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
  assert.equal(app.viewportMeta.getAttribute('content'), 'width=device-width,initial-scale=1,viewport-fit=cover');
  assert.equal(browser.viewportMeta.getAttribute('content'), 'width=device-width,initial-scale=1,viewport-fit=cover');
  for (const current of [app, browser]) {
    current.window.visualViewport.height = 470.5;
    current.window.visualViewport.dispatchEvent(new Event('resize'));
    assert.equal(current.document.documentElement.style['--dsc-viewport'], '470.5px');
    assert.equal(current.document.documentElement.style['--dsc-inset-bottom'], '0px');
    current.window.visualViewport.height = 760;
    current.window.dispatchEvent(new Event('resize'));
  }
  assert.equal(appStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
  assert.equal(browserStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
  assert.equal(app.viewportMeta.getAttribute('content').match(/viewport-fit/g).length, 1);
});
