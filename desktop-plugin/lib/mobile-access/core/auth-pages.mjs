// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
import { BRAND_SVG } from '../../brand.mjs';
const BRAND_ICON_URL = 'data:image/svg+xml,' + encodeURIComponent(BRAND_SVG);
// Maintained in this project; see ../NOTICE and ../LICENSE.
const COPY = {
    en: {
        lang: 'en',
        pairTitle: 'Pair DSH Connect',
        pairHeading: 'Pair this device',
        pairingCode: 'Pairing code',
        deviceName: 'Device name',
        pair: 'Pair',
        pairing: 'Pairing…',
        cookieRequired: 'This browser did not save the pairing authorization. Open the complete link in your regular browser and allow this site to save its data.',
        pairingCodeHint: 'Enter the 43-character code generated on the computer.',
        invalidPairingCode: 'Enter the 43-character pairing code from the current pairing window on the computer.',
        pairFailed: 'Pairing failed. Check the code or generate a new one on the computer.',
        pairingExpired: 'The pairing code is invalid or has expired. Generate a new code on the computer and try again.',
        pairingLimited: 'Too many pairing attempts. Wait a moment and try again.',
        deviceLimit: 'The paired-device limit has been reached. Remove an unused device and generate a new pairing code on the computer.',
        unavailable: 'The computer is unavailable. Check the connection and try again.',
        reconnectTitle: 'Reconnect DSH Connect',
        reconnectHeading: 'Reconnect this device',
        restoring: 'Restoring this browser’s connection…',
        noLongerPaired: 'This device authorization is invalid or expired. Open pairing on the computer, then pair it again.',
        credentialMissing: 'This browser has no saved pairing authorization. Use the browser originally paired, or generate a new pairing link on the computer.',
        cookieConflict: 'This browser has conflicting pairing information. Generate a new pairing link on the computer and pair again.',
        openPairing: 'Open pairing',
        pairedEntry: 'Already paired? Open DSH',
        retry: 'Try again'
    },
    zh: {
        lang: 'zh-CN',
        pairTitle: '配对 DSH Connect',
        pairHeading: '连接你的电脑',
        pairingCode: '配对码',
        deviceName: '设备名称',
        pair: '连接电脑',
        pairing: '正在配对…',
        cookieRequired: '浏览器没有保存配对授权。请在常用浏览器中打开完整链接，并允许此网站保存数据。',
        pairingCodeHint: '请输入电脑端当前显示的 43 位配对码。',
        invalidPairingCode: '请输入电脑端当前配对窗口中的 43 位配对码。',
        pairFailed: '配对失败，请检查输入或在电脑端重新生成配对码。',
        pairingExpired: '配对码无效或已过期，请在电脑端重新生成后重试。',
        pairingLimited: '配对尝试过于频繁，请稍后再试。',
        deviceLimit: '已达到配对设备上限，请在电脑端移除不需要的设备后重新生成配对码。',
        unavailable: '电脑当前不可用，请检查连接后重试。',
        reconnectTitle: '重新连接 DSH Connect',
        reconnectHeading: '继续你的工作',
        restoring: '正在恢复此浏览器的连接…',
        noLongerPaired: '此设备的授权无效或已过期。请在电脑端打开配对，然后重新配对。',
        credentialMissing: '当前浏览器没有保存配对授权。请使用原来配对的浏览器，或在电脑端生成新的配对链接。',
        cookieConflict: '当前浏览器中有相互冲突的配对信息。请在电脑端生成新的配对链接，重新配对。',
        openPairing: '打开配对页面',
        pairedEntry: '已配对？打开 DSH',
        retry: '重新尝试'
    },
    it: {
        lang: 'it-IT',
        pairTitle: 'Abbina accesso mobile DSH',
        pairHeading: 'Abbina questo dispositivo',
        pairingCode: 'Codice di abbinamento',
        deviceName: 'Nome dispositivo',
        pair: 'Abbina',
        pairing: 'Abbinamento…',
        cookieRequired: 'Il browser non ha salvato l’autorizzazione. Apri il link completo nel browser abituale e consenti i dati del sito.',
        pairingCodeHint: 'Usa il codice di abbinamento di 43 caratteri mostrato sul computer.',
        invalidPairingCode: 'Inserisci il codice di 43 caratteri dalla finestra di abbinamento attuale sul computer.',
        pairFailed: 'Abbinamento non riuscito. Controlla il codice o generane uno nuovo sul computer.',
        pairingExpired: 'Il codice non è valido o è scaduto. Genera un nuovo codice sul computer e riprova.',
        pairingLimited: 'Troppi tentativi di abbinamento. Attendi un momento e riprova.',
        deviceLimit: 'È stato raggiunto il limite di dispositivi abbinati. Rimuovi un dispositivo inutilizzato e genera un nuovo codice sul computer.',
        unavailable: 'Il computer non è disponibile. Controlla la connessione e riprova.',
        reconnectTitle: 'Riconnetti accesso mobile DSH',
        reconnectHeading: 'Riconnetti questo dispositivo',
        restoring: 'Ripristino della sessione sicura…',
        noLongerPaired: 'L’autorizzazione del dispositivo non è valida o è scaduta. Apri l’abbinamento sul computer e ripeti la procedura.',
        credentialMissing: 'Questo browser non ha un’autorizzazione salvata. Usa il browser già abbinato o genera un nuovo link sul computer.',
        cookieConflict: 'Questo browser contiene dati di abbinamento in conflitto. Genera un nuovo link sul computer.',
        openPairing: 'Apri abbinamento',
        pairedEntry: 'Già abbinato? Apri DSH',
        retry: 'Riprova'
    }
};
// These are owned authentication pages, not overrides of DSH's DOM. One small
// stylesheet keeps pairing and recovery usable with touch, keyboard and zoom.
const AUTH_STYLE = `
:root{color-scheme:light dark;--bg:#f7f8fa;--surface:#fff;--text:#202329;--muted:#7b808b;--line:#e8ebf1;--accent:#4d6bfe;--focus:#4d6bfe;--inverse:#fff}
*{box-sizing:border-box}html{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;background:var(--bg);color:var(--text)}
body{margin:0;min-height:100vh;min-height:100dvh;padding:max(20px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));line-height:1.55}
main{width:min(100%,480px);margin:clamp(0px,5vh,48px) auto;padding:clamp(24px,6vw,40px);background:var(--surface);border:1px solid var(--line);border-radius:26px;box-shadow:0 8px 40px #20232904}
.brand{display:flex;align-items:center;gap:11px;font-size:1rem;letter-spacing:-.02em;font-weight:650;color:var(--text);margin:0 0 36px}.brand svg{display:block;width:36px;height:36px;flex-shrink:0}h1{font-size:clamp(1.65rem,6vw,2rem);font-weight:650;letter-spacing:-.04em;line-height:1.3;margin:0 0 28px;overflow-wrap:anywhere}
form{display:grid;gap:18px}label{display:grid;gap:8px;font-weight:650}input,textarea,button,a{font:inherit}input,textarea{width:100%;min-width:0;min-height:48px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text);font-size:16px}
button,main a{min-height:48px;padding:12px 18px;border-radius:18px;touch-action:manipulation}button{border:0;background:var(--accent);color:var(--inverse);font-weight:600;cursor:pointer}button:disabled{opacity:.65;cursor:wait}main a{display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--accent);font-weight:500;text-decoration:none;border:1px solid var(--line)}form+ a{margin-top:16px}
input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:3px}input[aria-invalid=true]{border-color:#b3261e}p{color:var(--muted);margin:0 0 18px;overflow-wrap:anywhere}#pair-token-hint{font-size:.875rem;margin:-8px 0 0}output{display:block;min-height:1.5em;font-size:.925rem;overflow-wrap:anywhere}#login-retry{width:100%;margin-top:8px}[hidden]{display:none!important}
@media(prefers-color-scheme:dark){:root{--bg:#15171b;--surface:#202329;--text:#f2f4f8;--muted:#a0a6b2;--line:#323741;--accent:#657fff;--focus:#8fa3ff;--inverse:#fff}input[aria-invalid=true]{border-color:#e58e85}}
`;
export function resolveAuthPageLocale(header) {
    const values = header?.split(',').map((value, index)=>{
        const [language, ...parameters] = value.split(';');
        const quality = parameters.find((parameter)=>parameter.trim().toLowerCase().startsWith('q='));
        const parsedQuality = quality === undefined ? 1 : Number(quality.trim().slice(2));
        return {
            language: language?.trim().toLowerCase() ?? '',
            quality: Number.isFinite(parsedQuality) ? Math.max(0, Math.min(1, parsedQuality)) : 0,
            index
        };
    }).filter((value)=>value.quality > 0).sort((left, right)=>right.quality - left.quality || left.index - right.index).map((value)=>value.language) ?? [];
    for (const value of values){
        if (value.startsWith('zh')) return 'zh';
        if (value.startsWith('it')) return 'it';
        if (value.startsWith('en')) return 'en';
    }
    return 'en';
}
export function renderPairPage(locale) {
    const copy = COPY[locale];
    return `<!doctype html>
<html lang="${copy.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" type="image/svg+xml" href="${BRAND_ICON_URL}">
<style>${AUTH_STYLE}</style>
<title>${copy.pairTitle}</title>
</head>
<body>
<main>
  <p class="brand">${BRAND_SVG}DSH Connect</p>
  <h1>${copy.pairHeading}</h1>
  <form id="pair-form">
    <label>${copy.pairingCode} <input id="pair-token" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" aria-describedby="pair-token-hint pair-status" required></label>
    <p id="pair-token-hint">${copy.pairingCodeHint}</p>
    <label>${copy.deviceName} <input id="device-label" maxlength="64" autocomplete="off"></label>
    <button type="submit">${copy.pair}</button>
    <output id="pair-status" aria-live="polite"></output>
  </form>
  <a href="/">${copy.pairedEntry}</a>
</main>
<script src="/mobile-access/pair.js" defer></script>
</body>
</html>
`;
}
export function renderPairScript(locale) {
    const copy = COPY[locale];
    return `(() => {
  const form = document.getElementById('pair-form')
  const token = document.getElementById('pair-token')
  const label = document.getElementById('device-label')
  const status = document.getElementById('pair-status')
  const submit = form.querySelector('button[type="submit"]')
  let submitting = false
  const fragment = new URLSearchParams(location.hash.slice(1))
  const supplied = fragment.get('token')
  history.replaceState(null, '', location.pathname)
  if (supplied) token.value = supplied
  token.addEventListener('input', () => {
    token.removeAttribute('aria-invalid')
    if (!submitting) status.value = ''
  })
  const pair = async (event) => {
    event.preventDefault()
    if (submitting) return
    const code = token.value.trim()
    token.removeAttribute('aria-invalid')
    if (!/^[A-Za-z0-9_-]{43}$/u.test(code)) {
      status.value = ${JSON.stringify(copy.invalidPairingCode)}
      token.setAttribute('aria-invalid', 'true')
      token.focus()
      return
    }
    submitting = true
    submit.disabled = true
    status.value = ${JSON.stringify(copy.pairing)}
    const controller = new AbortController()
    let timer
    try {
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new Error('pair_timeout'))
      }, 10000) })
      const response = await Promise.race([timeout, fetch('/mobile-access/auth/pair', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: code, label: label.value || undefined }),
        signal: controller.signal,
      })])
      if (!response.ok) {
        if (token.value.trim() !== code) { status.value = ''; return }
        status.value = response.status === 401 ? ${JSON.stringify(copy.pairingExpired)}
          : response.status === 429 ? ${JSON.stringify(copy.pairingLimited)}
          : response.status === 409 ? ${JSON.stringify(copy.deviceLimit)}
          : response.status >= 500 ? ${JSON.stringify(copy.unavailable)}
          : ${JSON.stringify(copy.pairFailed)}
        if (response.status === 401) token.setAttribute('aria-invalid', 'true')
        return
      }
      const saved = await fetch('/mobile-access/status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      if (!saved.ok) { status.value = ${JSON.stringify(copy.cookieRequired)}; return }
      location.replace('/')
    } catch {
      status.value = token.value.trim() === code ? ${JSON.stringify(copy.unavailable)} : ''
    } finally {
      clearTimeout(timer)
      submitting = false
      submit.disabled = false
    }
  }
  form.addEventListener('submit', pair)
  // Opening the complete, current one-use link is the pairing action.
  // Manual entry remains available when the fragment was not supplied.
  if (supplied) void pair({ preventDefault() {} })
})()
`;
}
export function renderLoginPage(locale) {
    const copy = COPY[locale];
    return `<!doctype html>
<html lang="${copy.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" type="image/svg+xml" href="${BRAND_ICON_URL}">
<style>${AUTH_STYLE}</style>
<title>${copy.reconnectTitle}</title>
</head>
<body>
<main>
  <p class="brand">${BRAND_SVG}DSH Connect</p>
  <h1>${copy.reconnectHeading}</h1>
  <p id="login-progress" aria-live="polite">${copy.restoring}</p>
  <button id="login-retry" type="button" hidden>${copy.retry}</button>
  <section id="login-failed" hidden>
    <p id="login-failure-message">${copy.noLongerPaired}</p>
    <a href="/mobile-access/pair">${copy.openPairing}</a>
  </section>
</main>
<script src="/mobile-access/login.js" defer></script>
</body>
</html>
`;
}
export function renderLoginScript(locale) {
    const copy = COPY[locale];
    return `(() => {
  const candidate = new URL(location.href).searchParams.get('return')
  let returnPath = '/'
  if (candidate && candidate.startsWith('/')) {
    try {
      const resolved = new URL(candidate, location.origin)
      const pathname = decodeURIComponent(resolved.pathname)
      if (resolved.origin === location.origin && pathname !== '/mobile-access'
        && !pathname.startsWith('/mobile-access/') && !pathname.includes('\\\\')) {
        returnPath = pathname === '/mobile/app' || pathname === '/mobile/app/'
          ? '/' : resolved.pathname + resolved.search + resolved.hash
      }
    } catch {
      // Malformed untrusted return targets keep the safe root default.
    }
  }
  let flight
  const report = (state, error) => {
    const value = { protocolVersion: 1, state, ...(error ? { error } : {}) }
    window.__DSH_FOREVERWEB_LOGIN_STATE__ = value
    window.dispatchEvent(new CustomEvent('dsh-foreverweb:login-state', { detail: value }))
  }
  const restore = () => {
    if (flight) return flight
    const progress = document.getElementById('login-progress')
    const failed = document.getElementById('login-failed')
    const retry = document.getElementById('login-retry')
    progress.hidden = false; progress.textContent = ${JSON.stringify(copy.restoring)}
    failed.hidden = true; retry.hidden = true; delete failed.dataset.authState
    report('restoring')
    const controller = new AbortController()
    let timer
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
      controller.abort(); reject(new Error('renew_timeout'))
    }, 8000) })
    flight = Promise.race([timeout, fetch('/mobile-access/auth/renew', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: '{}', signal: controller.signal
    })]).then(response => {
      if (response.ok) { report('ready'); location.replace(returnPath); return }
      const scope = response.headers.get('x-dsh-foreverweb-error-scope') || 'device'
      const code = response.headers.get('x-dsh-foreverweb-error-code') || 'authentication_failed'
      if (response.status === 401 && scope === 'device') {
        const message = document.getElementById('login-failure-message')
        if (message) message.textContent = code === 'device_credential_missing' ? ${JSON.stringify(copy.credentialMissing)}
          : code === 'device_cookie_conflict' ? ${JSON.stringify(copy.cookieConflict)} : ${JSON.stringify(copy.noLongerPaired)}
        progress.hidden = true; failed.hidden = false; failed.dataset.authState = 'invalid'
        report('authorization-invalid', { scope, code }); return
      }
      progress.textContent = ${JSON.stringify(copy.unavailable)}; retry.hidden = false
      report('unavailable', { scope, code })
    }).catch(() => {
      progress.textContent = ${JSON.stringify(copy.unavailable)}; retry.hidden = false
      report('unavailable', { scope: 'network', code: controller.signal.aborted ? 'renew_timeout' : 'renew_unavailable' })
    }).finally(() => { clearTimeout(timer); flight = undefined })
    return flight
  }
  document.getElementById('login-retry').addEventListener('click', restore)
  restore()
})()
`;
}
