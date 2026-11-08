import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
// The sidebar icon is the monochrome Cn glyph so it can inherit the host's text colour.
const svg = await readFile(new URL('brand.svg', root), 'utf8');
const descriptor = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const target = new URL(existsSync(new URL('src/client.js', root)) ? 'src/client.js' : 'client.js', root);
const source = await readFile(target, 'utf8');
const id = descriptor.name;
const label = descriptor.displayName;
const block = `    /* settings-icon:start */
    function installSettingsIcon(ctx) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || !ctx.effect) return;
      ctx.effect(() => {
        const mark = ${JSON.stringify(id)}, label = ${JSON.stringify(label)};
        const glyph = ${JSON.stringify(svg.replaceAll('currentColor', '#000'))};
        const style = document.createElement('style');
        const selector = 'button[data-dsh-plugin-icon="' + mark + '"] svg';
        const mask = 'url("data:image/svg+xml,' + encodeURIComponent(glyph) + '") center/contain no-repeat';
        style.textContent = selector + '{width:16px;height:16px;flex-shrink:0;display:block;background-color:currentColor;-webkit-mask:' + mask + ';mask:' + mask + '}' + selector + '>*{visibility:hidden}';
        document.head.appendChild(style);
        const update = () => {
          for (const button of document.querySelectorAll('[role="dialog"][data-shortcut-modal="settings"] nav button')) {
            if (button.textContent.trim() === label) button.setAttribute('data-dsh-plugin-icon', mark);
          }
        };
        const observer = new MutationObserver(update);
        observer.observe(document.body, { childList: true, subtree: true }); update();
        return () => { observer.disconnect(); style.remove(); for (const item of document.querySelectorAll('[data-dsh-plugin-icon="' + mark + '"]')) item.removeAttribute('data-dsh-plugin-icon'); };
      }, 'plugin settings glyph');
    }
    /* settings-icon:end */`;
const updated = source.replace(/    \/\* settings-icon:start \*\/[\s\S]*?    \/\* settings-icon:end \*\//, () => block);
if (updated === source && !source.includes('/* settings-icon:start */')) throw new Error('Settings icon marker missing.');
if (process.argv.includes('--check')) { if (updated !== source) throw new Error('Run node tools/sync-settings-icon.mjs.'); }
else await writeFile(target, updated, 'utf8');
