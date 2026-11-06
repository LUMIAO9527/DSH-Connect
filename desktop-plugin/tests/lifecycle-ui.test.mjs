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