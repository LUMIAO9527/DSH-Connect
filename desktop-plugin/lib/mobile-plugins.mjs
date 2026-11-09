// Optional plugins a phone may skip. Core UI packages stay outside this list.
// Mobile filtering only removes an entry from the phone boot graph; the Host
// keeps the same plugin enabled for every desktop client.
export const MOBILE_PLUGIN_ROSTER = Object.freeze([
  Object.freeze({ id: 'dsh-pet', name: '宠宠' }),
  Object.freeze({ id: 'ds-bot', name: 'DS Bot' }),
  Object.freeze({ id: 'dshmarket', name: '插件市场' }),
  Object.freeze({ id: 'dsh-context', name: 'DSH-Context' }),
  Object.freeze({ id: 'dsh-ops', name: 'DSH-Ops' }),
  Object.freeze({ id: '@michengai/dsh-skills-manager', name: '技能' }),
  Object.freeze({ id: 'dsh-thu-automad', name: '清华 MadModel' }),
  Object.freeze({ id: '@copylee/dsh-computer-use', name: '电脑控制' }),
  Object.freeze({ id: 'dsh-focus', name: 'DSH-Focus' }),
  Object.freeze({ id: 'dsh-suggestions', name: 'DSH-Suggestions' }),
  Object.freeze({ id: 'dsh-rea-agents', name: 'REA Agents' })
]);
