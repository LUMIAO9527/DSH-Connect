// Optional client plugins a phone may skip. Core Harness packages stay outside
// the list: the phone filter only removes an entry from the mobile boot graph,
// while the Host keeps the same plugin enabled for every desktop client.
//
// The live roster comes from the Host's clientModules graph, so a newly
// installed third-party plugin appears automatically after DSH restarts. The
// static fallback is only used while that service is not available yet.
const LABELS = Object.freeze({
  'dsh-pet': '宠宠',
  '@linxin666/dsh-pet': '宠宠',
  'ds-bot': 'DS Bot',
  dshmarket: '插件市场',
  'dsh-context': 'DSH-Context',
  'dsh-ops': 'DSH-Ops',
  '@michengai/dsh-skills-manager': '技能',
  'dsh-thu-automad': '清华 MadModel',
  '@copylee/dsh-computer-use': '电脑控制',
  'dsh-focus': 'DSH-Focus',
  'dsh-suggestions': 'DSH-Suggestions',
  'dsh-rea-agents': 'REA Agents'
});

const ORDER = Object.freeze([
  '@linxin666/dsh-pet', 'dsh-pet', 'ds-bot', 'dshmarket', 'dsh-context',
  'dsh-ops', '@michengai/dsh-skills-manager', 'dsh-thu-automad',
  '@copylee/dsh-computer-use', 'dsh-focus', 'dsh-suggestions', 'dsh-rea-agents'
]);

export const FALLBACK_MOBILE_PLUGIN_ROSTER = Object.freeze(ORDER
  .filter(id => id !== '@linxin666/dsh-pet')
  .map(id => Object.freeze({ id, name: LABELS[id] })));

export function matchesPluginId(left, right) {
  return left === right || left.endsWith('/' + right) || right.endsWith('/' + left);
}

export function isCorePluginId(id) {
  return typeof id !== 'string' || id === 'dsh' || id === 'dsh-connect' || id.startsWith('@deepseek-ai/');
}

function labelFor(id) {
  return LABELS[id] || LABELS[id.split('/').pop()] || id.split('/').pop();
}

function orderFor(id) {
  return ORDER.findIndex(item => matchesPluginId(id, item));
}

export function mobilePluginRoster(entries) {
  const ids = Array.isArray(entries)
    ? [...new Set(entries.map(entry => entry?.id).filter(id => typeof id === 'string' && !isCorePluginId(id)))]
    : [];
  if (ids.length === 0) return FALLBACK_MOBILE_PLUGIN_ROSTER;
  ids.sort((left, right) => {
    const leftOrder = orderFor(left), rightOrder = orderFor(right);
    if (leftOrder >= 0 && rightOrder >= 0) return leftOrder - rightOrder;
    if (leftOrder >= 0) return -1;
    if (rightOrder >= 0) return 1;
    return labelFor(left).localeCompare(labelFor(right), 'zh-Hans-CN') || left.localeCompare(right);
  });
  return Object.freeze(ids.map(id => Object.freeze({ id, name: labelFor(id) })));
}