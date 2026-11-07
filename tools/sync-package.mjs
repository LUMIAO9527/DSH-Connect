import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'desktop-plugin/package.json'), 'utf8'));
const manifest = structuredClone(plugin);
delete manifest.repository.directory;
delete manifest.type;
manifest.main = './desktop-plugin/index.js';
manifest.files = plugin.files.map(name => 'desktop-plugin/' + name).concat(['desktop-plugin/package.json', 'LICENSE', 'README.md']);
manifest.exports = Object.fromEntries(Object.entries(plugin.exports).map(([key, value]) => [key, key === './package.json' ? './package.json' : value.replace('./','./desktop-plugin/')]));
manifest.dsh.bundle.patch = './desktop-plugin/cordis.patch.yml';
manifest.scripts = { check: 'node tools/sync-package.mjs --check && npm --prefix desktop-plugin run check', test: 'npm --prefix desktop-plugin test' };
const outputs = new Map([['package.json', JSON.stringify(manifest, null, 2) + '\n']]);
// The HarmonyOS app was retired on 2026-11-07; only the desktop plugin is packaged now.
const core = 'desktop-plugin/lib/mobile-access/connection.mjs';
const connection = fs.readFileSync(path.join(root, core), 'utf8');
if (!/^export const VERSION = '[^']+';/m.test(connection)) throw new Error('Connection version declaration not found.');
outputs.set(core, connection.replace(/^export const VERSION = '[^']+';/m, `export const VERSION = '${plugin.version}';`));
for (const [relative, expected] of outputs) {
    const target = path.join(root, relative);
    if (process.argv.includes('--check')) {
        if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) throw new Error(relative + ' is out of date. Run node tools/sync-package.mjs.');
    } else fs.writeFileSync(target, expected);
}
