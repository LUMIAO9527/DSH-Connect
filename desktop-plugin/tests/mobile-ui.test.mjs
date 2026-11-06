import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../mobile-client.js', import.meta.url), 'utf8');

function page({ authenticated = true, native = false, wide = false, files = false, transport = 'connecting', fullscreen = false, shell = false, conversation = false, settings = false, nestedDialog = false, openMenu = false, viewport, drawer = false, hero = false, css = false } = {}) {
  class Element extends EventTarget {
    constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.style = { setProperty(key, value) { this[key] = value; }, getPropertyValue(key) { return this[key] || ''; } }; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    hasAttribute(key) { return key in this.attrs; }
    removeAttribute(key) { delete this.attrs[key]; }
    toggleAttribute(key, on) { if (on) this.attrs[key] = ''; else delete this.attrs[key]; }
    querySelector(selector) { const match = selector.match(/^\[([^=\]]+)=?["']?([^"'\]]*)["']?\]$/); if (!match) return null; const [, key, value] = match; for (const child of this.children) { if (key in child.attrs && (!value || child.attrs[key] === value)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
    append(...nodes) { this.children.push(...nodes); }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
    getClientRects() { return this.hidden ? [] : [{}]; }
    getBoundingClientRect() { this.rectCalls = (this.rectCalls || 0) + 1; return { width: this.rectWidth || 280, height: this.rectHeight || 0 }; }
    matches(selector) { return selector === '[data-chat-turn]' ? 'data-chat-turn' in this.attrs : false; }
    closest(selector) { return this.matches(selector) ? this : null; }
    focus() { this.focused = true; }
  }
  const window = new EventTarget(), document = new EventTarget(), calls = [], timers = new Map(), destinations = [];
  const observers = [], frames = [];
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
  frame.clientWidth = 366;
  if (fullscreen) frame.setAttribute('data-rightbar-fullscreen', 'true');
  const nativeMask = new Element('div'); nativeMask.setAttribute('data-sidebar-mask', '');
  const sidebar = new Element('div'), sidebarSlot = new Element('div'); sidebarSlot.setAttribute('data-slot', 'sidebar'); sidebar.append(sidebarSlot);
  const center = new Element('div'), mainPanel = new Element('div'), mainSlot = new Element('div'); mainSlot.setAttribute('data-slot', 'main'); mainPanel.append(mainSlot); center.append(mainPanel);
  frame.append(nativeMask, sidebar, center);
  const swipeArea = new Element('div');
  const leftDrawer = new Element('div'), rightDrawer = new Element('div');
  swipeArea.closest = () => null;
  if (drawer) {
    frame.setAttribute('data-sidebar-drawer', 'true');
    const left = new Element('button'), right = new Element('button');
    left.setAttribute('data-sidebar-opener', 'true'); right.setAttribute('data-sidebar-right-expand', 'true');
    left.closest = right.closest = () => null;
    left.click = () => { calls.push('open-left'); frame.removeAttribute('data-sidebar-collapsed'); };
    right.click = () => { calls.push('open-right'); frame.setAttribute('data-rightbar-fullscreen', 'true'); };
    right.hidden = hero;
    leftDrawer.setAttribute('data-shortcut-modal', 'sidebar');
    leftDrawer.closest = selector => selector === '[role="dialog"]' ? leftDrawer
      : selector.includes('[data-dsc-sidebar]') ? sidebar : null;
    rightDrawer.closest = selector => selector === '[data-rightbar-col]' ? rightDrawer : null;
    rightDrawer.setAttribute('data-rightbar-col', '');
    sidebar.append(leftDrawer);
    frame.append(left, right, rightDrawer);
    mainPanel.append(swipeArea);
  }
  const overlay = new Element('div'); overlay.parentElement = frame;
  const conversationHeader = new Element('header'), sessionHeader = new Element('div'), titleRow = new Element('div'), titleCluster = new Element('div'), tabsRow = new Element('div'), tabs = new Element('div');
  sessionHeader.parentElement = conversationHeader; sessionHeader.firstElementChild = titleRow; sessionHeader.nextElementSibling = tabsRow;
  titleRow.firstElementChild = titleCluster; tabs.setAttribute('data-conversation-tabs',''); tabs.parentElement=tabsRow; tabsRow.append(tabs); sessionHeader.append(titleRow,tabsRow); conversationHeader.append(sessionHeader);
  const settingsPanel = new Element('div'), dialog = new Element('div'), menu = new Element('div'), escapes = [];
  settingsPanel.setAttribute('data-shortcut-modal', 'settings');
  settingsPanel.addEventListener('keydown', event => escapes.push('settings:' + event.type));
  dialog.addEventListener('keydown', event => escapes.push('nested:' + event.type));
  menu.addEventListener('keydown', event => escapes.push('menu:' + event.type));
  document.querySelector = query => query.startsWith('meta[name="dsh-foreverweb-gateway"]') && authenticated ? {} : query === 'meta[name="viewport"]' ? viewportMeta : query === '[data-shell-overlay]' && (fullscreen || shell || drawer) ? overlay
    : conversation && query === '[data-slot="conversation.session.header"]' ? sessionHeader
    : settings && query === '[data-shortcut-modal="settings"]' ? settingsPanel : null;
  document.querySelectorAll = query => query==='[data-composer-card] input[type="file"]' ? (files?[fileInput]:[]) : isFolderSelector(query) ? (conversation ? [folderButton] : [])
    : query === '[role="menu"]' && openMenu ? [menu]
    : query === '[conversation-scroll] [data-chat-turn]' || query === '[data-conversation-scroll] [data-chat-turn]' ? turns
    : query === '[role="dialog"]' && settings ? (nestedDialog ? [settingsPanel, dialog] : [settingsPanel]) : [];
  const turns = [];
  const makeTurn = (height = 100) => { const element = new Element('div'); element.nodeType = 1; element.setAttribute('data-chat-turn', ''); element.rectHeight = height; turns.push(element); return element; };
  if (css) window.CSS = { supports: () => true };
  const media=Object.assign(new EventTarget(),{matches:!wide});window.matchMedia=()=>media;
  window.innerWidth = wide ? 1280 : 366;
  if (viewport) { window.innerHeight = viewport.innerHeight; window.visualViewport = Object.assign(new EventTarget(), { height: viewport.height }); }
  window.__DSH_CONNECT_TRANSPORT__ = transport;
  window.__DSH_FOREVERWEB_ACCESS__ = { getSnapshot: () => ({ device: { state: 'valid' }, session: { state: 'valid' } }), resume: async reason => calls.push(reason) };
  if (native) window.HarmonyConnector = { connectionChanged: state => calls.push(state), showComputers() {} };
  const navigator = { onLine: true, userAgent: native ? 'ArkWeb DSH-Connect/0.2.0' : 'Browser', clipboard: { writeText: async () => {} } };
  vm.runInNewContext(source, { window, document, navigator, location: { origin: 'https://example.test', pathname: '/', search: '', assign: url => destinations.push(url) },
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
    MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} disconnect() {} },
    requestAnimationFrame: callback => frames.push(callback),
    KeyboardEvent: Event, getComputedStyle:element=>({visibility:element.visibility||'visible',overflowX:element.overflowX}) });
  if (drawer) window.__DSH_CONNECT_UI__.configure({
    toggleSidebar() { calls.push('close-left'); frame.setAttribute('data-sidebar-collapsed', 'true'); },
    closeRightbar() { calls.push('close-right'); frame.removeAttribute('data-rightbar-fullscreen'); },
  });
  return { window, document, calls, navigator, destinations, frame, nativeMask, sidebar, center, settingsPanel, escapes, viewportMeta, conversationHeader, titleRow, titleCluster, tabsRow, fileButton,fileInput,media,folderButton, turns, makeTurn,
    pick: () => click(fileButton, selector => selector === 'button[data-dsc-file-picker]'),
    openFolder: () => click(folderButton, isFolderSelector),
    banner: () => document.body.children.find(node => node.className === 'dsc-status'),
    mutate: records => observers.forEach(callback => callback(records)),
    frames,
    swipeArea, leftDrawer, rightDrawer,
    touch(type, x, y, time = 0, target = swipeArea) {
      const event = new Event(type, { cancelable: true });
      const point = { identifier: 7, clientX: x, clientY: y };
      const ending = type === 'touchend' || type === 'touchcancel';
      Object.defineProperties(event, {
        target: { value: target }, timeStamp: { value: time },
        touches: { value: ending ? [] : [point] }, changedTouches: { value: [point] },
      });
      document.dispatchEvent(event);
      return event;
    },
    flush() { const pending = [...timers.values()]; timers.clear(); for (const callback of pending) callback(); },
    access(detail) { const event = new Event('dsh-foreverweb:access-state'); event.detail = detail; window.dispatchEvent(event); } };
}

test('mobile home opens only its left drawer when swiping across the page', () => {
  const home = page({ drawer: true, hero: true });
  home.touch('touchstart', 180, 160);
  home.touch('touchend', 88, 163, 120);
  home.touch('touchstart', 180, 160);
  home.touch('touchend', 273, 163, 120);
  assert.deepEqual(home.calls, ['open-left']);
});

test('the conversation opens either original drawer, including a slow drag', () => {
  const conversation = page({ drawer: true });
  conversation.touch('touchstart', 84, 150);
  conversation.touch('touchmove', 124, 157, 550);
  conversation.touch('touchend', 178, 159, 1290);
  conversation.frame.setAttribute('data-sidebar-collapsed', 'true');
  conversation.touch('touchstart', 282, 180);
  conversation.touch('touchend', 183, 179, 160);
  assert.deepEqual(conversation.calls, ['open-left', 'open-right']);
});

test('a partial drag follows the current Harness sidebar and returns it after cancellation', () => {
  const current = page({ drawer: true });
  current.sidebar.style.transform = 'scale(1)';
  current.touch('touchstart', 84, 150);
  current.touch('touchmove', 91, 150, 65);
  assert.equal(current.sidebar.style.translate, '-273px');
  current.touch('touchmove', 130, 150, 300);
  assert.equal(current.frames.length, 1);
  current.frames.shift()();
  assert.equal(current.sidebar.style.translate, '-234px');
  assert.equal(current.nativeMask.style.opacity, String(1 - 234 / 280));
  assert.equal(current.sidebar.getAttribute('data-dsc-swipe'), 'left');
  assert.deepEqual(current.calls, ['open-left']);
  current.touch('touchend', 130, 150, 320);
  assert.equal(current.sidebar.hasAttribute('data-dsc-swipe'), false);
  assert.equal(current.sidebar.style.transform, 'scale(1)');
  assert.deepEqual(current.calls, ['open-left', 'close-left']);
});

test('settling continues from the painted offset without reopening the sidebar', async () => {
  const current = page({ drawer: true });
  current.window.matchMedia = () => ({ matches: false });
  let finish, cancelled = false, positions;
  current.sidebar.animate = keyframes => {
    positions = Array.from(keyframes, keyframe => keyframe.translate);
    return { finished: new Promise(resolve => { finish = resolve; }), cancel() { cancelled = true; } };
  };
  current.nativeMask.animate = () => ({ finished: Promise.resolve(), cancel() {} });
  current.touch('touchstart', 84, 150);
  current.touch('touchmove', 174, 150, 100);
  current.touch('touchend', 179, 150, 120);
  assert.deepEqual(positions, ['-190px', '0px']);
  assert.equal(current.sidebar.style.translate, positions[0]);
  assert.deepEqual(current.calls, ['open-left']);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(current.calls, ['open-left']);
  assert.equal(cancelled, true);
  assert.equal(current.sidebar.style.translate, '');
  assert.equal(current.frame.hasAttribute('data-sidebar-collapsed'), false);
  assert.equal(current.sidebar.hasAttribute('data-dsc-swipe'), false);
});

test('a plugin can replace the sidebar through the current opener without a stale gesture closing it', () => {
  const current = page({ drawer: true });
  const button = current.frame.querySelector('[data-sidebar-right-expand]');
  const replacement = new current.rightDrawer.constructor('div');
  replacement.setAttribute('data-rightbar-col', '');
  replacement.setAttribute('data-plugin-dock', 'active');
  button.click = () => {
    current.calls.push('open-plugin-dock');
    current.frame.children = current.frame.children.map(node => node === current.rightDrawer ? replacement : node);
    current.frame.setAttribute('data-rightbar-fullscreen', 'true');
  };
  current.touch('touchstart', 282, 180);
  current.touch('touchmove', 272, 180, 50);
  current.touch('touchend', 183, 180, 160);
  assert.deepEqual(current.calls, ['open-plugin-dock']);
  assert.equal(current.frame.hasAttribute('data-rightbar-fullscreen'), true);
  assert.equal(current.rightDrawer.hasAttribute('data-dsc-swipe'), false);
  assert.equal(replacement.style.translate, undefined);
});

test('swiping leaves vertical scroll, editing, horizontal scrollers and system edges alone', () => {
  const conversation = page({ drawer: true });
  conversation.touch('touchstart', 25, 100);
  assert.equal(conversation.touch('touchmove', 27, 145, 65).defaultPrevented, false);
  conversation.touch('touchend', 145, 130, 140);
  conversation.touch('touchstart', 5, 120);
  conversation.touch('touchend', 112, 121, 120);
  conversation.swipeArea.closest = selector => selector.includes('[contenteditable]') ? conversation.swipeArea : null;
  conversation.touch('touchstart', 25, 120);
  conversation.touch('touchend', 120, 125, 120);
  conversation.swipeArea.closest = () => null;
  Object.assign(conversation.swipeArea,{clientWidth:100,scrollWidth:200,overflowX:'auto'});
  conversation.touch('touchstart', 84, 120);
  conversation.touch('touchend', 180, 125, 120);
  conversation.swipeArea.scrollWidth=100;
  conversation.frame.setAttribute('data-rightbar-fullscreen', 'true');
  conversation.touch('touchstart', 25, 120);
  conversation.touch('touchend', 120, 125, 120);
  assert.deepEqual(conversation.calls, []);
});

test('reverse swipes inside either drawer close it through the original control', () => {
  const current = page({ drawer: true });
  current.window.__DSH_CONNECT_UI__.configure({
    toggleSidebar: () => current.calls.push('close-left'),
    closeRightbar: () => current.calls.push('close-right'),
  });
  current.frame.removeAttribute('data-sidebar-collapsed');
  current.touch('touchstart', 88, 160, 0, current.leftDrawer);
  current.touch('touchend', 183, 160, 120, current.leftDrawer);
  current.touch('touchstart', 180, 160, 0, current.leftDrawer);
  current.touch('touchend', 82, 160, 140, current.leftDrawer);
  current.frame.setAttribute('data-sidebar-collapsed', 'true');
  current.frame.setAttribute('data-rightbar-fullscreen', 'true');
  current.touch('touchstart', 180, 160, 0, current.rightDrawer);
  current.touch('touchend', 82, 160, 120, current.rightDrawer);
  current.touch('touchstart', 80, 160, 0, current.rightDrawer);
  current.touch('touchend', 182, 160, 160, current.rightDrawer);
  assert.deepEqual(current.calls, ['close-left', 'close-right']);
});

test('a nested dialog and a drawer that changes mid-swipe preserve their own state', () => {
  const current = page({ drawer: true });
  current.window.__DSH_CONNECT_UI__.configure({ toggleSidebar: () => current.calls.push('close-left') });
  current.frame.removeAttribute('data-sidebar-collapsed');
  const closest = current.leftDrawer.closest;
  current.leftDrawer.closest = selector => selector === '[role="dialog"]' ? current.settingsPanel : closest(selector);
  current.touch('touchstart', 180, 160, 0, current.leftDrawer);
  current.touch('touchend', 82, 160, 120, current.leftDrawer);
  current.leftDrawer.closest = closest;
  current.touch('touchstart', 180, 160, 0, current.leftDrawer);
  current.frame.setAttribute('data-sidebar-collapsed', 'true');
  current.touch('touchend', 82, 160, 140, current.leftDrawer);
  assert.deepEqual(current.calls, []);
});

test('streamed messages do not rescan controls but a late composer is adapted', () => {
  const current = page({ shell: true, files: true });
  const target = { closest: () => null };
  const unrelated = { nodeType: 1, matches: () => false, querySelector: () => null };
  current.mutate([{ target, addedNodes: [unrelated, { nodeType: 3 }] }]);
  assert.equal(current.frames.length, 0);

  current.fileButton.removeAttribute('data-dsc-file-picker');
  current.fileButton.setAttribute('aria-haspopup', 'listbox');
  const composer = { ...unrelated, matches: selector => selector.includes('[data-composer-card]') };
  const mutation = [{ target, addedNodes: [composer] }];
  current.mutate(mutation);
  current.mutate(mutation);
  assert.equal(current.frames.length, 1);
  current.frames.shift()();
  assert.equal(current.fileButton.hasAttribute('data-dsc-file-picker'), true);
  assert.equal(current.fileButton.getAttribute('aria-haspopup'), 'dialog');
});

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

test('phone navigation uses the Harness shell and native Back dismisses its open menu', () => {
  const native = page({ native: true, openMenu: true, settings: true });
  assert.deepEqual(native.document.body.children, [native.banner()]);
  assert.equal(native.window.__DSH_CONNECT_UI__.back(), 'consumed');
  assert.deepEqual(native.escapes, ['menu:keydown']);
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
  assert.deepEqual(native.document.body.children, [native.banner()]);
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

test('Back dismisses Harness settings through its own dialog handler', () => {
  const native = page({ native: true, transport: 'connected', settings: true });
  assert.equal(native.window.__DSH_CONNECT_UI__.back(), 'consumed');
  assert.deepEqual(native.escapes, ['settings:keydown']);
});

test('a child dialog closes before the Harness settings dialog', () => {
  const native = page({ native: true, transport: 'connected', settings: true, nestedDialog: true });
  assert.equal(native.window.__DSH_CONNECT_UI__.back(), 'consumed');
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
    current.frames.shift()();
    assert.equal(current.document.documentElement.style['--dsc-viewport'], '470.5px');
    assert.equal(current.document.documentElement.style['--dsc-inset-bottom'], '0px');
    current.window.visualViewport.height = 760;
    current.window.dispatchEvent(new Event('resize'));
    current.frames.shift()();
  }
  assert.equal(appStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
  assert.equal(browserStyle['--dsc-inset-bottom'], 'env(safe-area-inset-bottom,0px)');
  assert.equal(app.viewportMeta.getAttribute('content').match(/viewport-fit/g).length, 1);
});

test('keyboard resize events share one layout update and use the native viewport when available', () => {
  const current = page({ native: true, viewport: { innerHeight: 771, height: 771.14 } });
  assert.equal(current.document.documentElement.style['--dsc-viewport'], '100dvh');
  current.window.visualViewport.height = 457;
  current.window.innerHeight = 457;
  current.window.dispatchEvent(new Event('resize'));
  current.window.visualViewport.dispatchEvent(new Event('resize'));
  assert.equal(current.frames.length, 1);
  current.frames.shift()();
  assert.equal(current.document.documentElement.style['--dsc-viewport'], '100dvh');
});

test('only turns added since the last frame are measured for content visibility', () => {
  const current = page({ conversation: true, css: true });
  const flush = () => { for (let round = 0; round < 3; round += 1) current.frames.splice(0).forEach(callback => callback()); };
  flush();
  const first = current.makeTurn(120);
  current.mutate([{ addedNodes: [first], target: current.document.body }]);
  flush();
  assert.equal(first.rectCalls, 1);
  assert.ok('data-dsc-turn-rendering' in first.attrs);
  const second = current.makeTurn(80);
  current.mutate([{ addedNodes: [second], target: current.document.body }]);
  flush();
  assert.equal(first.rectCalls, 1, 'the retained turn is not measured again');
  assert.equal(second.rectCalls, 1);
  current.media.matches = true;
  current.media.dispatchEvent(new Event('change'));
  flush();
  assert.equal(first.rectCalls, 1, 'a layout-mode change skips turns already seeded');
  assert.equal(second.rectCalls, 1);
});
