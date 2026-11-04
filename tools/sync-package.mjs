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
const expected = JSON.stringify(manifest, null, 2) + '\n';
const target = path.join(root, 'package.json');
if (process.argv.includes('--check')) { if (fs.readFileSync(target,'utf8') !== expected) throw new Error('Root package metadata is out of date. Run node tools/sync-package.mjs.'); }
else fs.writeFileSync(target, expected);
