import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

const status = {
  configured: true, version: '1.0.14', editable: true,
  gateway: { origin: 'http://127.0.0.1:12875' }
};
const devices = [
  { id: 'a'.repeat(32), label: 'Mobile device', createdAt: 1, expiresAt: Date.now() + 86400000, lastSeenAt: Date.now() },
  { id: 'b'.repeat(32), label: 'Mate 80', createdAt: 1, expiresAt: Date.now() + 86400000, lastSeenAt: Date.now() }
];

const response = value => ({ ok: true, status: 200, json: async () => value });
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const all = tree => tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(all)] : [];
const button = (nodes, label) => nodes.find(node => node.type === 'button' && text(node).includes(label));

async function flush() { for (let index = 0; index < 24; index++) await Promise.resolve(); }

async function mount(overrides = {}, options = {}) {
  let module, component, index = 0;
  const states = [], refs = [], requests = [], effects = [], intervals = [];
  const deviceList = options.devices ?? devices;
  const activeStatus = { ...status, ...overrides };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
    useState(initial) { const key = index++; if (!(key in states)) states[key] = initial; return [states[key], value => { states[key] = typeof value === 'function' ? value(states[key]) : value; }]; },
    useEffect(callback) { effects.push(callback); },
    useRef(initial) { const key = index++; if (!(key in refs)) refs[key] = { current: initial }; return refs[key]; }
  };
  const fetch = async (url, options = {}) => {
    const entry = { url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : undefined };
    requests.push(entry);
    if (entry.url.endsWith('/status')) return response(activeStatus);
    if (entry.url.endsWith('/updates/status')) return response({ current: '1.0.14', message: '更新保留连接地址和已配对设备。' });
    if (entry.url.endsWith('/devices')) return response({ devices: deviceList });
    if (entry.url.endsWith('/plugins')) return response({ plugins: [{ id: 'dsh-pet', name: '宠宠' }], disabled: [] });
    if (entry.url.endsWith('/devices/rename')) {
      const target = deviceList.find(device => device.id === entry.body.deviceId);
      return response({ device: { ...target, label: entry.body.label.trim() } });
    }
    if (entry.url.endsWith('/pairing/open')) return response({ pairUrl: 'https://computer.example/pair#token=fixture', qrSvg: '<svg></svg>', expiresAt: Date.now() + 600000 });
    return response({});
  };
  const window = { __ModuleLoader__: { load(value) { module = value.factory(name => name === 'react' ? react : {}); } } };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const navigator = { clipboard: { writeText: async () => {} } };
  vm.runInNewContext(source, { window, document, navigator, fetch, AbortController, console,
    location: { protocol: 'http:', hostname: '127.0.0.1' }, setTimeout: () => 0, clearTimeout: () => {},
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval: () => {} });
  module.apply({ effect: setup => setup(), slots: { inject: (_name, setup) => setup(), register: (_options, value) => { component = value; } } });
  const render = () => { index = 0; return component(); };
  render();
  for (const effect of effects.splice(0)) effect();
  await flush();
  return { render: () => all(render()), requests, intervals };
}

test('mobile plugin switch sends the disabled list to the gateway', async () => {
  const view = await mount();
  let nodes = view.render();
  const toggle = nodes.find(node => node.type === 'button' && node.props.role === 'switch' && node.props['aria-label'] === '宠宠在手机端加载');
  assert.ok(toggle);
  assert.equal(toggle.props['aria-checked'], true);
  toggle.props.onClick();
  await flush();
  const request = view.requests.find(entry => entry.method === 'POST' && entry.url.endsWith('/plugins'));
  assert.deepEqual(request.body, { disabled: ['dsh-pet'] });
  nodes = view.render();
  const updated = nodes.find(node => node.type === 'button' && node.props.role === 'switch');
  assert.equal(updated.props['aria-checked'], false);
});

test('connection and device sections replace expanding notices with button feedback', async () => {
  const view = await mount();
  let nodes = view.render();
  assert.ok(nodes.find(node => node.type === 'h4' && text(node) === '连接与访问'));
  assert.ok(nodes.find(node => node.type === 'h4' && text(node) === '已配对设备'));
  assert.equal(nodes.some(node => String(node.props.className || '').includes('dfw-notice')), false);

  button(nodes, '复制').props.onClick();
  await flush();
  nodes = view.render();
  assert.ok(button(nodes, '已复制'), 'copy feedback stays on the original button');

  const rename = button(nodes, '重命名');
  assert.ok(rename);
  rename.props.onClick();
  nodes = view.render();
  assert.equal(button(nodes, '重命名').props.style.visibility, 'hidden', 'the rename control keeps its space while editing');
  const name = nodes.find(node => node.type === 'input' && node.props['aria-label'] === '设备名称');
  assert.ok(name);
  name.props.onChange({ target: { value: 'Mate 80 Pro' } });
  nodes = view.render();
  button(nodes, '保存').props.onClick();
  await flush();
  const request = view.requests.find(entry => entry.url.endsWith('/devices/rename'));
  assert.deepEqual({ method: request.method, deviceId: request.body.deviceId, label: request.body.label },
    { method: 'POST', deviceId: 'a'.repeat(32), label: 'Mate 80 Pro' });
  nodes = view.render();
  assert.ok(nodes.find(node => node.props.className === 'dfw-device-name' && text(node) === 'Mate 80 Pro'));
  assert.ok(button(nodes, '已命名'));

  button(nodes, '撤销授权').props.onClick();
  nodes = view.render();
  assert.ok(button(nodes, '确认撤销'), 'revoke asks for confirmation through the button label');

  button(nodes, '临时链接').props.onClick();
  nodes = view.render();
  button(nodes, '生成链接').props.onClick();
  await flush();
  nodes = view.render();
  assert.equal(nodes.some(node => String(node.props.className || '').includes('dfw-notice')), false);
  const temporary = nodes.find(node => node.type === 'input' && node.props['aria-label'] === '临时链接');
  assert.ok(temporary && String(temporary.props.value).includes('/pair#token='));
});

test('the open panel picks up a pairing made in another browser', async () => {
  const list = [];
  const view = await mount({}, { devices: list });
  let nodes = view.render();
  assert.ok(nodes.find(node => String(node.props.className || '') === 'dfw-empty'));
  list.push({ id: 'c'.repeat(32), label: 'Mate 80', createdAt: 1, expiresAt: Date.now() + 86400000, lastSeenAt: Date.now() });
  const poll = view.intervals.find(entry => entry.ms === 5000);
  assert.ok(poll, 'the open panel polls the device list');
  await poll.fn();
  await flush();
  nodes = view.render();
  assert.ok(nodes.find(node => node.props.className === 'dfw-device-name' && text(node) === 'Mate 80'),
    'a device paired on the phone appears without reopening the settings');
  list.push({ id: 'd'.repeat(32), label: 'iPad', createdAt: 1, expiresAt: Date.now() + 86400000, lastSeenAt: Date.now() });
  await poll.fn();
  await flush();
  nodes = view.render();
  assert.ok(button(nodes, '新设备已配对'), 'a new device is announced on the refresh control');
});

test('pairing controls keep their width while the label changes', async () => {
  const view = await mount({ localNetwork: true, remoteAvailable: true });
  let nodes = view.render();
  assert.equal(button(nodes, '复制链接').props.style.minWidth, '108px');
  const idle = button(nodes, '生成二维码');
  assert.equal(idle.props.style.minWidth, '116px');
  idle.props.onClick();
  await flush();
  nodes = view.render();
  assert.equal(button(nodes, '收起').props.style.minWidth, '116px', 'the same control keeps its width when it becomes 收起');
  assert.equal(button(nodes, '复制链接').props.style.minWidth, '108px');
  assert.ok(nodes.find(node => String(node.props.className || '') === 'dfw-note' && text(node).includes('手机扫码完成配对')));
});

test('an unconfigured installation keeps its setup and update controls', async () => {
  const view = await mount({ configured: false, message: '填写这台电脑的 HTTPS 访问地址，启用后即可连接手机。' });
  let nodes = view.render();
  const address = nodes.find(node => node.type === 'input' && node.props.type === 'url');
  assert.ok(address);
  address.props.onChange({ target: { value: 'https://computer.example.com' } });
  nodes = view.render();
  assert.equal(button(nodes, '启用连接').props.disabled, false);
  assert.equal(button(nodes, '检查更新').props.disabled, false);
  assert.equal(nodes.find(node => node.type === 'a').props.href, 'https://github.com/LUMIAO9527/DSH-Connect/releases/latest');
});

test('same-network pairing presents the temporary link and a permanent QR', async () => {
  const view = await mount({ localNetwork: true, remoteAvailable: true });
  let nodes = view.render();
  button(nodes, '临时链接').props.onClick();
  nodes = view.render();
  button(nodes, '生成链接').props.onClick();
  await flush();
  assert.equal(view.requests.at(-1).body.mode, 'lan');
  nodes = view.render();
  assert.ok(button(nodes, '复制链接'));
  assert.equal(button(nodes, '复制应用链接'), undefined);
  assert.equal(nodes.find(node => node.props['aria-label'] === '配对二维码'), undefined);
  button(nodes, '永久链接').props.onClick();
  nodes = view.render();
  button(nodes, '生成二维码').props.onClick();
  await flush();
  assert.equal(view.requests.at(-1).body.mode, 'lan');
  nodes = view.render();
  assert.ok(nodes.find(node => node.props['aria-label'] === '配对二维码'));
});
