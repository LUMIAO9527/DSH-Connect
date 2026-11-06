import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
test('unconfigured installations expose connection setup and version controls', () => {
  let module, component, index = 0;
  const states = [], react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
    useState(initial) { const key = index++; if (!(key in states)) states[key] = initial; return [states[key], value => { states[key] = value; }]; },
    useEffect() {}, useRef: value => ({ current: value }),
  };
  const window = { __ModuleLoader__: { load(value) { module = value.factory(() => react); } } };
  vm.runInNewContext(source, { window, document: { querySelector: () => null }, location: { protocol: 'http:', hostname: '127.0.0.1' }, navigator: {} });
  module.apply({ effect: setup => setup(), slots: { inject: (_name, setup) => setup(), register: (_options, value) => { component = value; } } });
  const all = tree => tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(all)] : [];
  component(); states[0] = { configured: false, editable: true, version: '1.0.2' }; index = 0;
  let nodes = all(component());
  const address = nodes.find(node => node.type === 'input' && node.props.type === 'url');
  assert.ok(address); address.props.onChange({ target: { value: 'https://computer.example.com' } }); index = 0;
  nodes = all(component());
  assert.equal(nodes.find(node => node.type === 'button' && node.children.includes('启用连接')).props.disabled, false);
  assert.equal(nodes.find(node => node.type === 'button' && node.children.includes('检查更新')).props.disabled, false);
  assert.equal(nodes.find(node => node.type === 'a' && node.children.includes('发布记录')).props.href, 'https://github.com/LUMIAO9527/DSH-Connect/releases/latest');
});

test('remote workspace folder opens the current DSH file pane through its public service',()=>{
  let module, controls, target;
  const opened=[],element={};
  const window={addEventListener(){},removeEventListener(){},__DSH_CONNECT_UI__:{configure(value){controls=value;},setTransport(){}},__ModuleLoader__:{load(value){module=value.factory(()=>({}));}}};
  vm.runInNewContext(source,{window,document:{querySelector:query=>query.includes('dsh-foreverweb-gateway')?{}:null},navigator:{onLine:true}});
  const ctx={effect:setup=>setup(),slots:{inject:(_name,setup)=>setup(),register(){}},
    connection:{state:{getSnapshot:()=> 'connected',subscribe:()=>()=>{}}},
    sidebarRight:{commandTarget:current=>{assert.equal(current,element);return target;},openTabFromTarget:(kind,value)=>opened.push({kind,value})}};
  module.apply(ctx);
  controls.openWorkspaceFiles(element);assert.equal(opened.length,0);
  target={sessionId:'current',paneId:'pane'};controls.openWorkspaceFiles(element);
  assert.equal(opened.length,1);assert.equal(opened[0].kind,'files');assert.equal(opened[0].value,target);
});

test('mobile overflow can pin and unpin the Harness views that are actually available', () => {
  let module, options, ViewActions;
  const MenuItemButton = Symbol('native MenuItemButton');
  const react = { createElement: (type, props, label) => ({ type, props, label }) };
  const loader = name => name === 'react' ? react : { MenuItemButton };
  const window = { addEventListener() {}, removeEventListener() {}, __ModuleLoader__: { load(value) { module = value.factory(loader); } } };
  const document = {
    documentElement: { lang: 'zh-CN', hasAttribute: () => true },
    querySelector: query => query.includes('dsh-foreverweb-gateway') ? {} : null,
    querySelectorAll: () => [{ textContent: '上下文' }]
  };
  vm.runInNewContext(source, { window, document, navigator: { onLine: true } });
  module.apply({
    effect: setup => setup(),
    slots: {
      inject: (_name, setup) => setup(),
      register(value, component) {
        if (value.id === 'dsh-connect-mobile-tabs') { options = value; ViewActions = component; }
      },
      entries: () => [
        { options: { id: 'chat', label: '对话' } },
        { options: { id: 'trajectory', label: '轨迹' } },
        { options: { id: 'context', label: '上下文' } },
        { options: { id: 'fleet', label: () => '编队' } }
      ]
    },
    connection: { state: { getSnapshot: () => 'connected', subscribe: () => () => {} } }
  });
  const changes = [];
  const nodes = ViewActions({
    ...options.inject(), entries: [{ id: 'fleet', pinned: false }],
    onPinnedChange: (id, pinned) => changes.push([id, pinned]), onDismiss: () => changes.push('dismiss')
  });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].type, MenuItemButton);
  assert.equal(nodes[0].label, '收起上下文');
  assert.equal(nodes[1].label, '展开编队');
  nodes[0].props.onSelect();
  nodes[1].props.onSelect();
  assert.deepEqual(changes, [['context', false], 'dismiss', ['fleet', true], 'dismiss']);
});
