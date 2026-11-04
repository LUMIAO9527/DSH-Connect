import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

async function hasState(directory) {
  try {
    const entry = await lstat(join(directory, 'devices.json'));
    if (!entry.isFile()) throw new Error('Invalid device state file.');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function stateDirectoryFor(home, configured = '') {
  if (configured) return configured;
  const current = join(home, 'dsh-connect');
  if (await hasState(current)) return current;
  // Reuse an existing installation's state in place so its device grants and host identity survive the rename.
  const legacy = join(home, 'foreverweb');
  return await hasState(legacy) ? legacy : current;
}
