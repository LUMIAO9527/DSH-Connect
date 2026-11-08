// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
import { BRAND_LOCKUP_SVG } from '../../brand.mjs';
// Maintained in this project; see ../NOTICE and ../LICENSE.
const COPY = {
    en: {
        lang: 'en',
        pairTitle: 'Pair DSH Connect',
        pairHeading: 'Pair this device',
        pairingCode: 'Pairing code or link',
        pairingCodePlaceholder: 'Paste the pairing link, or enter the 43-character code',
        deviceName: 'Device name',
        pair: 'Pair',
        pairing: 'Pairing…',
        cookieRequired: 'This browser did not save the pairing authorization. Open the complete link in your regular browser and allow this site to save its data.',
        invalidPairingCode: 'Enter the 43-character pairing code or paste the complete pairing link.',
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
        pairingCode: '配对码或链接',
        pairingCodePlaceholder: '粘贴配对链接，或输入 43 位配对码',
        deviceName: '设备名称',
        pair: '连接电脑',
        pairing: '正在配对…',
        cookieRequired: '浏览器没有保存配对授权。请在常用浏览器中打开完整链接，并允许此网站保存数据。',
        invalidPairingCode: '请输入 43 位配对码，或粘贴完整的配对链接。',
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
        pairingCode: 'Codice o link di abbinamento',
        pairingCodePlaceholder: 'Incolla il link, oppure inserisci il codice di 43 caratteri',
        deviceName: 'Nome dispositivo',
        pair: 'Abbina',
        pairing: 'Abbinamento…',
        cookieRequired: 'Il browser non ha salvato l’autorizzazione. Apri il link completo nel browser abituale e consenti i dati del sito.',
        invalidPairingCode: 'Inserisci il codice di 43 caratteri o incolla il link completo di abbinamento.',
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
:root{color-scheme:light dark;--bg:#f7f8fa;--surface:#fff;--text:#202329;--muted:#7b808b;--line:#e8ebf1;--accent:#4d6bfe;--focus:#4d6bfe;--inverse:#fff;--dsc-lockup-contrast:#fff}
*{box-sizing:border-box}html{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;background:var(--bg);color:var(--text)}
body{margin:0;min-height:100vh;min-height:100dvh;padding:max(20px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));line-height:1.55}
main{width:min(100%,480px);margin:clamp(0px,4vh,40px) auto;padding:clamp(22px,5vw,32px);background:var(--surface);border:1px solid var(--line);border-radius:26px;box-shadow:0 8px 40px #20232904}
.brand{display:block;width:152px;max-width:100%;color:var(--text);margin:0 0 26px}.brand svg{display:block;width:100%;height:auto}h1{font-size:clamp(1.55rem,5.6vw,1.875rem);font-weight:650;letter-spacing:-.04em;line-height:1.3;margin:0 0 22px;overflow-wrap:anywhere}
form{display:grid;gap:14px}label{display:grid;gap:8px;font-weight:650}input,textarea,button,a{font:inherit}input,textarea{width:100%;min-width:0;min-height:48px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text);font-size:16px}
button,main a{min-height:48px;padding:12px 18px;border-radius:18px;touch-action:manipulation}button{border:0;background:var(--accent);color:var(--inverse);font-weight:600;cursor:pointer;width:100%}button:disabled{opacity:.65;cursor:wait}main a{display:block;width:fit-content;margin:10px auto 0;padding:10px 8px;background:none;color:var(--accent);font-weight:500;text-decoration:none;border:0}
input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:3px}input[aria-invalid=true]{border-color:#b3261e}p{color:var(--muted);margin:0 0 18px;overflow-wrap:anywhere}output{display:block;font-size:.925rem;overflow-wrap:anywhere}output:empty{display:none}#login-retry{width:100%;margin-top:8px}[hidden]{display:none!important}
button:not(:disabled):active,main a:active{filter:brightness(.94)}
@media(prefers-reduced-motion:no-preference){
  button,main a{transition:scale 140ms cubic-bezier(.2,.7,.25,1)}
  button:not(:disabled):active,main a:active{scale:.97;transition-duration:85ms}
  main{animation:dsc-auth-enter 190ms cubic-bezier(.2,.7,.25,1)}
  @keyframes dsc-auth-enter{from{opacity:.65;translate:0 4px}to{opacity:1;translate:0 0}}
}
@media(prefers-color-scheme:dark){:root{--bg:#15171b;--surface:#202329;--text:#f2f4f8;--muted:#a0a6b2;--line:#323741;--accent:#657fff;--focus:#8fa3ff;--inverse:#fff;--dsc-lockup-contrast:#353638}input[aria-invalid=true]{border-color:#e58e85}}
`;
// Opening screen: white page, the native DeepSeek Harness lockup, one short entrance.
// It deliberately ignores the dark colour scheme so every phone starts on the same
// white surface, then hands over to the workspace.
const SPLASH_STYLE = `
:root{color-scheme:light}
*{box-sizing:border-box}
html,body{height:100%}
html{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#202329}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:max(28px,env(safe-area-inset-top)) max(22px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(22px,env(safe-area-inset-left));background:#fff}
main{width:min(100%,360px);margin:0;text-align:center}
.brand{display:block;width:min(78vw,262px);max-width:100%;margin:0 auto 26px;color:#0f1115;--dsc-lockup-contrast:#fff}
.brand svg{display:block;width:100%;height:auto}
.progress{margin:20px 0 0;font-size:.9375rem;line-height:1.6;color:#7b808b;min-height:1.6em}
button,main a{font:inherit;display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:20px;padding:12px 22px;border-radius:18px;touch-action:manipulation;text-decoration:none}
button{border:0;background:#17191e;color:#fff;font-weight:600;cursor:pointer}
main a{background:#f3f4f7;color:#202329;border:1px solid #e8ebf1;font-weight:500}
main a+button,button+a{margin-left:8px}
button:not(:disabled):active,main a:active{scale:.97;transition-duration:85ms}
input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #4d6bfe;outline-offset:3px}
section{margin-top:6px}
#login-failure-message{margin:16px 0 0;font-size:.9375rem;line-height:1.6;color:#7b808b;overflow-wrap:anywhere}
[hidden]{display:none!important}
@media(prefers-reduced-motion:no-preference){
  button,main a{transition:scale 140ms cubic-bezier(.2,.7,.25,1)}
  .brand{animation:splash-mark 620ms cubic-bezier(.2,.7,.25,1) both}
  .progress{animation:splash-name 520ms cubic-bezier(.2,.7,.25,1) 150ms both}
  @keyframes splash-mark{from{opacity:0;translate:0 12px;scale:.965}to{opacity:1;translate:0 0;scale:1}}
  @keyframes splash-name{from{opacity:0;translate:0 6px}to{opacity:1;translate:0 0}}
}
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
<link rel="manifest" href="/mobile-access/manifest.webmanifest">
<link rel="apple-touch-icon" sizes="180x180" href="/mobile-access/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/mobile-access/icon-192.png">
<style>${AUTH_STYLE}</style>
<title>${copy.pairTitle}</title>
</head>
<body>
<main>
  <div class="brand" role="img" aria-label="DeepSeek Harness">${BRAND_LOCKUP_SVG}</div>
  <h1>${copy.pairHeading}</h1>
  <form id="pair-form">
    <label>${copy.pairingCode} <input id="pair-token" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" placeholder="${copy.pairingCodePlaceholder}" aria-describedby="pair-status" required></label>
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
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const namedDevice = agent.match(/DSH-Device[/]([^ ;]+)/)?.[1]
  const platform = /Windows/.test(agent) ? 'Windows' : /OpenHarmony|HarmonyOS/.test(agent) ? 'HarmonyOS'
    : /Android/.test(agent) ? 'Android' : /iPad/.test(agent) ? 'iPad' : /iPhone/.test(agent) ? 'iPhone'
    : /Macintosh|Mac OS X/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : ''
  const client = /DSH-Connect[/]/.test(agent) ? 'DSH Connect' : /Edg[/]/.test(agent) ? 'Edge'
    : /Firefox[/]/.test(agent) ? 'Firefox' : /Chrome[/]/.test(agent) ? 'Chrome' : /Safari[/]/.test(agent) ? 'Safari' : ''
  let deviceName = platform
  try { if (namedDevice) deviceName = decodeURIComponent(namedDevice) } catch (_) {}
  if (!label.value && client) label.value = [deviceName, client].filter(Boolean).join(' · ').slice(0, 64)
  const status = document.getElementById('pair-status')
  const submit = form.querySelector('button[type="submit"]')
  let submitting = false
  let pendingLink = false
  token.addEventListener('input', () => {
    token.removeAttribute('aria-invalid')
    if (!submitting) status.value = ''
  })
  // The desktop shows a pairing link, not the 43-character code, so accept both.
  const pairingToken = value => {
    const input = value.trim()
    if (/^[A-Za-z0-9_-]{43}$/u.test(input)) return input
    let candidate = ''
    try {
      const url = new URL(input)
      candidate = new URLSearchParams(url.hash.slice(1)).get('token') || url.searchParams.get('token') || ''
    } catch (_) {
      // A pasted fragment without a URL scheme is handled below.
    }
    if (!candidate) candidate = /(?:^|[#&?])token=([A-Za-z0-9_-]{43})(?:$|[&#])/u.exec(input)?.[1] || ''
    return /^[A-Za-z0-9_-]{43}$/u.test(candidate) ? candidate : ''
  }
  const pair = async (event) => {
    event.preventDefault()
    if (submitting) return
    const entered = token.value.trim()
    const code = pairingToken(entered)
    token.removeAttribute('aria-invalid')
    if (!code) {
      status.value = ${JSON.stringify(copy.invalidPairingCode)}
      token.setAttribute('aria-invalid', 'true')
      token.focus()
      return
    }
    submitting = true
    submit.disabled = true
    submit.textContent = ${JSON.stringify(copy.pairing)}
    form.setAttribute('aria-busy', 'true')
    status.value = ''
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
        if (token.value.trim() !== entered) { status.value = ''; return }
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
      status.value = token.value.trim() === entered ? ${JSON.stringify(copy.unavailable)} : ''
    } finally {
      clearTimeout(timer)
      submitting = false
      submit.disabled = false
      submit.textContent = ${JSON.stringify(copy.pair)}
      form.removeAttribute('aria-busy')
      if (pendingLink) receivePairLink()
    }
  }
  form.addEventListener('submit', pair)
  function receivePairLink() {
    const supplied = new URLSearchParams(location.hash.slice(1)).get('token')
    if (!supplied) return
    if (submitting) { pendingLink = true; return }
    pendingLink = false
    history.replaceState(null, '', location.pathname)
    token.value = supplied
    void pair({ preventDefault() {} })
  }
  window.addEventListener('hashchange', receivePairLink)
  receivePairLink()
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
<meta name="theme-color" content="#ffffff">
<link rel="manifest" href="/mobile-access/manifest.webmanifest">
<link rel="apple-touch-icon" sizes="180x180" href="/mobile-access/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/mobile-access/icon-192.png">
<style>${SPLASH_STYLE}</style>
<title>${copy.reconnectTitle}</title>
</head>
<body>
<main>
  <div class="brand" role="img" aria-label="DeepSeek Harness">${BRAND_LOCKUP_SVG}</div>
  <p id="login-progress" class="progress" aria-live="polite">${copy.restoring}</p>
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
