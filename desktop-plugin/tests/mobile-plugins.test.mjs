import test from 'node:test';
import assert from 'node:assert/strict';
import { mobilePluginRoster, matchesPluginId } from '../lib/mobile-plugins.mjs';

test('live graph drives the roster and new third-party plugins are discovered', () => {
  const roster = mobilePluginRoster([
    { id: '@deepseek-ai/dsh-client-ui' },
    { id: '@deepseek-ai/dsh-client-modules' },
    { id: 'dsh-connect' },
    { id: 'dsh-pet' },
    { id: 'new-plugin' },
    { id: '@someone/new-thing' }
  ]);
  assert.deepEqual(roster.map(item => item.id), ['dsh-pet', '@someone/new-thing', 'new-plugin']);
  assert.equal(roster[0].name, 'dsh-pet');
  assert.equal(roster[1].name, '@someone/new-thing');
  assert.equal(roster[2].name, 'new-plugin');
});

test('the pet alias resolves to the same mobile toggle', () => {
  const roster = mobilePluginRoster([{ id: '@linxin666/dsh-pet' }, { id: 'ds-bot' }]);
  assert.equal(roster[0].id, '@linxin666/dsh-pet');
  assert.equal(roster[0].name, '@linxin666/dsh-pet');
  assert.equal(matchesPluginId('dsh-pet', '@linxin666/dsh-pet'), true);
});

test('an unavailable graph falls back to the known plugin list', () => {
  const roster = mobilePluginRoster(undefined);
  assert.ok(roster.some(item => item.id === 'dsh-pet'));
  assert.ok(roster.every(item => !item.id.startsWith('@deepseek-ai/')));
});
