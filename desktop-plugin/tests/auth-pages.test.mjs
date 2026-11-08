import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPairPage, renderLoginPage } from '../lib/mobile-access/core/auth-pages.mjs';

// The welcome lockup is the official DeepSeek Harness mark shipped by DSH
// itself (renderer/assets/welcome-brand.svg). The splash and pairing pages
// must show it instead of the old stacked whale + "DeepSeekHarness" text.
const LOCKUP_VIEWBOX = 'viewBox="145.467 11.5215 181.207 17.0435"';

test('splash and pairing pages show the official DeepSeek Harness lockup', () => {
  for (const locale of ['zh', 'en', 'it']) {
    for (const html of [renderLoginPage(locale), renderPairPage(locale)]) {
      assert.equal((html.match(/<svg /gu) || []).length, 1, `${locale}: exactly one inline lockup`);
      assert.ok(html.includes(LOCKUP_VIEWBOX), `${locale}: native lockup view box`);
      assert.match(html, /class="brand" role="img" aria-label="DeepSeek Harness"/u);
      assert.ok(html.includes('--dsc-lockup-contrast'), `${locale}: themed badge lettering`);
      assert.ok(!html.includes('>DeepSeekHarness<'), `${locale}: the old wordmark text is gone`);
    }
  }
});

test('pairing page accepts a link or the 43-character code', () => {
  const expected = {
    zh: ['配对码或链接', '粘贴配对链接，或输入 43 位配对码'],
    en: ['Pairing code or link', 'Paste the pairing link, or enter the 43-character code'],
    it: ['Codice o link di abbinamento', 'Incolla il link, oppure inserisci il codice di 43 caratteri'],
  };
  for (const [locale, [label, placeholder]] of Object.entries(expected)) {
    const html = renderPairPage(locale);
    assert.ok(html.includes(label), locale + ': label');
    assert.ok(html.includes(placeholder), locale + ': placeholder');
  }
});