window.__ModuleLoader__.load({
  id: 'dsh-connect',
  factory(require) {
    const { createElement: h, useEffect, useRef, useState } = require('react');
    const ADMIN = '/api/foreverweb';
    const BRAND_SVG = "\u003csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 32 32\" fill=\"none\" role=\"img\" aria-label=\"DSH Connect\"\u003e\n  \u003crect id=\"cn-tile\" width=\"32\" height=\"32\" rx=\"10\" fill=\"#ffffff\" stroke=\"#d7d7d7\" stroke-width=\"0.75\"/\u003e\n  \u003cg id=\"cn-letters\" stroke=\"#171717\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"\u003e\n    \u003cpath d=\"M14 10.5C12.9 9.6 11.8 9.4 10.7 9.4C7.8 9.4 6.5 12.1 6.5 15.7C6.5 19.3 7.8 22 10.7 22C11.9 22 13 21.7 14 20.7\"/\u003e\n    \u003cpath d=\"M18.6 22V15.3C18.6 11.8 26.4 11.8 26.4 15.3V22\"/\u003e\n  \u003c/g\u003e\n\u003c/svg\u003e";
    const STYLE = `
.dfw-settings{--dfw-ink:var(--dsw-alias-label-primary,CanvasText);--dfw-muted:var(--dsw-alias-label-secondary,var(--dfw-ink));--dfw-line:color-mix(in srgb,var(--dfw-ink) 11%,transparent);--dfw-surface:var(--dsw-alias-bg-layer-1,Canvas);--dfw-field:var(--dsw-alias-bg-module-platform,var(--dfw-surface));--dfw-soft:color-mix(in srgb,var(--dfw-field) 52%,var(--dfw-surface));--dfw-inverse:var(--dsw-alias-bg-base,Canvas);--dfw-danger:var(--dsw-alias-label-error,#b72c39);--dfw-ok:var(--dsw-alias-state-success-label,var(--dsw-alias-state-success-primary,#16814a));container:dsh-connect-settings / inline-size;width:100%;max-width:680px;padding:8px 0 24px;color:var(--dfw-ink);font-size:14px;line-height:1.6;box-sizing:border-box}
.dfw-settings *{box-sizing:border-box}
.dfw-settings h3,.dfw-settings h4,.dfw-settings p{margin:0}
.dfw-settings h3{font-size:20px;line-height:1.4;font-weight:600}
.dfw-settings h4{font-size:14px;font-weight:600}
.dfw-settings p{color:var(--dfw-muted)}
.dfw-settings .dfw-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 20px}
.dfw-settings .dfw-brand{display:flex;align-items:center;gap:10px;min-width:0}
.dfw-settings .dfw-brand-mark,.dfw-settings .dfw-brand-mark svg,.dfw-settings .dfw-brand-mark img{display:block;width:36px;height:36px;flex:none}
.dfw-settings .dfw-brand-mark{overflow:hidden;border-radius:10px}
.dfw-settings .dfw-brand-mark img{object-fit:contain}
.dfw-settings .dfw-features{display:flex;flex-wrap:wrap;gap:6px;min-width:0;margin:0;padding:0;list-style:none}
.dfw-settings .dfw-features li{max-width:100%;padding:2px 8px;border:1px solid var(--dfw-line);border-radius:8px;background:var(--dfw-soft);color:var(--dfw-muted);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.dfw-settings .dfw-state{display:inline-flex;padding:2px 7px;border-radius:8px;background:color-mix(in srgb,var(--dfw-ok) 11%,var(--dfw-surface));color:color-mix(in srgb,var(--dfw-ok) 72%,var(--dfw-ink));font-size:12px;line-height:17px}
.dfw-settings .dfw-section,.dfw-settings .dfw-head+.dfw-card{margin-top:22px}
.dfw-settings .dfw-section-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;margin-bottom:10px}
.dfw-settings .dfw-section-title{display:flex;align-items:baseline;gap:8px;min-width:0}
.dfw-settings .dfw-count{font-size:12px;font-weight:400;color:var(--dfw-muted)}
.dfw-settings .dfw-card{border:1px solid var(--dfw-line);border-radius:16px;background:var(--dfw-surface);overflow:hidden}
.dfw-settings .dfw-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px}
.dfw-settings .dfw-row+.dfw-row{border-top:1px solid var(--dfw-line)}
.dfw-settings .dfw-row-main{min-width:0;flex:1 1 120px;overflow-wrap:anywhere}
.dfw-settings .dfw-row-title{font-size:14px;font-weight:500}
.dfw-settings .dfw-row-desc{margin-top:4px;font-size:12px;color:var(--dfw-muted)}
.dfw-settings .dfw-row-control{flex:0 1 56%;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dfw-settings .dfw-pair-options{flex-wrap:wrap}
.dfw-settings .dfw-field{display:flex;align-items:center;gap:8px;width:100%;min-width:0}
.dfw-settings .dfw-link{min-width:0;width:100%;height:34px;padding:6px 10px;border:1px solid var(--dfw-line);border-radius:8px;background:var(--dfw-field);color:var(--dfw-ink);font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis}
.dfw-settings .dfw-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;min-width:32px;padding:5px 10px;border:1px solid var(--dfw-line);border-radius:8px;background:transparent;color:var(--dfw-ink);font:inherit;font-size:13px;line-height:1.4;white-space:nowrap;cursor:pointer;touch-action:manipulation}
.dfw-settings .dfw-button-primary{background:var(--dfw-ink);border-color:transparent;color:var(--dfw-inverse);font-weight:600}
.dfw-settings .dfw-button-danger{border-color:color-mix(in srgb,var(--dfw-danger) 45%,var(--dfw-line));color:var(--dfw-danger)}
.dfw-settings .dfw-button:hover:not(:disabled){background:color-mix(in srgb,var(--dfw-ink) 7%,transparent)}
.dfw-settings .dfw-button-primary:hover:not(:disabled){background:color-mix(in srgb,var(--dfw-ink) 88%,var(--dfw-inverse))}
.dfw-settings .dfw-button-danger:hover:not(:disabled){background:color-mix(in srgb,var(--dfw-danger) 9%,transparent)}
.dfw-settings .dfw-button:active:not(:disabled){filter:brightness(.94)}
.dfw-settings .dfw-button:disabled{opacity:.45;cursor:not-allowed}
.dfw-settings .dfw-button:focus-visible,.dfw-settings input:focus-visible{outline:2px solid var(--dfw-ink);outline-offset:3px}
.dfw-settings .dfw-icon{display:block;flex-shrink:0;width:17px;height:17px}
.dfw-settings .dfw-pairing{margin:0 16px 12px;padding:12px;border:1px solid var(--dfw-line);border-radius:12px;background:var(--dfw-soft)}
.dfw-settings .dfw-stack{display:grid;gap:12px}
.dfw-settings .dfw-panel{display:grid;gap:12px;padding:16px}
.dfw-settings .dfw-panel-head{display:grid;gap:4px}
.dfw-settings .dfw-panel-title{font-size:14px;font-weight:600}
.dfw-settings .dfw-panel-desc{font-size:12px;line-height:1.55;color:var(--dfw-muted)}
.dfw-settings .dfw-panel-body{display:grid;gap:10px}
.dfw-settings .dfw-panel-actions{display:flex;flex-wrap:wrap;gap:8px}
.dfw-settings .dfw-panel .dfw-qr{width:168px;margin:2px auto 0}
.dfw-settings .dfw-seg{display:inline-flex;padding:2px;border:1px solid var(--dfw-line);border-radius:10px;background:var(--dfw-soft);width:fit-content}
.dfw-settings .dfw-seg-item{padding:5px 13px;border:0;border-radius:8px;background:transparent;color:var(--dfw-muted);font:inherit;font-size:13px;line-height:1.4;cursor:pointer;touch-action:manipulation}
.dfw-settings .dfw-seg-item.is-active{background:var(--dfw-surface);color:var(--dfw-ink);font-weight:600;box-shadow:0 1px 2px rgb(0 0 0 / 8%)}
.dfw-settings .dfw-stack>.dfw-card>.dfw-pairing-body{padding:0 16px 14px}
.dfw-settings .dfw-pairing-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;margin-bottom:10px}
.dfw-settings .dfw-pairing-state{font-size:12px;font-weight:600;color:var(--dfw-ink)}
.dfw-settings .dfw-pairing-state[data-expired=true]{color:var(--dfw-muted);font-weight:400}
.dfw-settings .dfw-pairing-body{display:grid;grid-template-columns:minmax(0,1fr) 168px;gap:14px;align-items:start}
.dfw-settings .dfw-pairing-main{min-width:0}
.dfw-settings .dfw-pairing-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.dfw-settings .dfw-qr{width:168px;max-width:100%;padding:10px;border:1px solid var(--dfw-line);border-radius:12px;background:#fff;line-height:0}
.dfw-settings .dfw-qr svg{width:100%;height:auto}
.dfw-settings .dfw-qr[aria-disabled=true]{opacity:.3}
.dfw-settings .dfw-note{margin-top:10px;font-size:12px;color:var(--dfw-muted)}
.dfw-settings .dfw-device-list{list-style:none;padding:0;margin:0}
.dfw-settings .dfw-device{display:flex;align-items:center;justify-content:space-between;gap:12px 16px;padding:12px 16px}
.dfw-settings .dfw-device+.dfw-device{border-top:1px solid var(--dfw-line)}
.dfw-settings .dfw-device-info{min-width:0;flex:1 1 auto}
.dfw-settings .dfw-device-name{font-weight:500;overflow-wrap:anywhere}
.dfw-settings .dfw-device-meta{margin-top:3px;font-size:12px;color:var(--dfw-muted)}
.dfw-settings .dfw-device-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.dfw-settings .dfw-device-edit{display:flex;align-items:center;gap:8px;width:min(100%,320px)}
.dfw-settings .dfw-device-edit input{min-width:0;width:100%;height:34px;padding:6px 10px;border:1px solid var(--dfw-line);border-radius:8px;background:var(--dfw-field);color:var(--dfw-ink);font:inherit}
.dfw-settings .dfw-empty{padding:14px 16px;font-size:12px;color:var(--dfw-muted)}
.dfw-settings .dfw-foot{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 16px;margin-top:22px}
.dfw-settings .dfw-foot-info{min-width:0}
.dfw-settings .dfw-foot-version{font-size:12px;font-weight:600;color:var(--dfw-ink)}
.dfw-settings .dfw-foot-note{margin-top:3px;font-size:12px;color:var(--dfw-muted);overflow-wrap:anywhere}
.dfw-settings .dfw-foot-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.dfw-settings .dfw-loading{padding:20px 2px;color:var(--dfw-muted)}
.dfw-settings .dfw-setup{padding:14px 16px}
.dfw-settings .dfw-setup-title{font-size:14px;font-weight:600}
.dfw-settings .dfw-setup-body{margin-top:10px;display:grid;gap:10px}
.dfw-settings .dfw-setup label{font-size:12px;color:var(--dfw-muted)}
.dfw-settings .dfw-setup input{width:100%;height:36px;padding:6px 10px;border:1px solid var(--dfw-line);border-radius:8px;background:var(--dfw-field);color:var(--dfw-ink);font:inherit}
.dfw-settings .dfw-setup-actions{display:flex;justify-content:flex-end}
.dfw-settings .dfw-advanced{border-top:1px solid var(--dfw-line)}
.dfw-settings .dfw-advanced summary{font-size:12px;color:var(--dfw-muted);cursor:pointer}
.dfw-settings .dfw-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@container dsh-connect-settings (max-width:520px){
  .dfw-settings .dfw-row,.dfw-settings .dfw-device{flex-direction:column;align-items:stretch;gap:10px}
  .dfw-settings .dfw-row-main,.dfw-settings .dfw-row-control{flex:0 0 auto}
  .dfw-settings .dfw-row-control,.dfw-settings .dfw-foot-actions{justify-content:flex-start}
  .dfw-settings .dfw-pairing-body{grid-template-columns:minmax(0,1fr)}
  .dfw-settings .dfw-qr{justify-self:center}
  .dfw-settings .dfw-device-actions{flex-wrap:wrap}
  .dfw-settings .dfw-device-edit{width:100%;flex-wrap:wrap}
  .dfw-settings .dfw-foot{flex-direction:column}
}
@media(prefers-reduced-motion:no-preference){
  .dfw-settings .dfw-button{transition:scale 140ms cubic-bezier(.2,.7,.25,1),background-color 140ms,color 140ms}
  .dfw-settings .dfw-button:active:not(:disabled){scale:.97;transition-duration:85ms}
  .dfw-settings :is(.dfw-pairing,.dfw-device-edit,.dfw-setup-body){animation:dfw-enter 190ms cubic-bezier(.2,.7,.25,1)}
  @keyframes dfw-enter{from{opacity:.45;translate:0 4px}to{opacity:1;translate:0 0}}
}
`;
    function icon(name) {
      const paths = { link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
        copy: 'M9 9h12v12H9zM15 5V3H3v12h2', qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z', refresh: 'M20 7V3m0 4h-4M4 17v4m0-4h4M5.1 8a8 8 0 0 1 13.4-3L20 7M4 17l1.5 2A8 8 0 0 0 19 16' };
      return h('svg', { className: 'dfw-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[name] }));
    }
    const local = () => location.protocol === 'dsh-app:' && location.hostname === 'app'
      || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    async function request(path, body, signal) {
      const headers = { 'content-type': 'application/json' };
      if (body !== undefined) headers[location.protocol === 'dsh-app:' ? 'x-dsh-mobile-desktop-admin' : 'x-dsh-mobile-web-admin']
        = location.protocol === 'dsh-app:' ? 'dsh-app://app' : 'same-origin-json';
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) controller.abort();
      const timeout = setTimeout(cancel, 12000);
      try {
        const response = await fetch(ADMIN + path, { method: body === undefined ? 'GET' : 'POST', headers,
          body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store' });
        if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || (response.status === 401 ? '电脑端连接已失效，请重新打开设置。'
          : response.status === 403 ? '本机请求未通过校验，请重新打开此设置页后再试。' : '操作暂未完成，请检查电脑连接后重试。')); }
        return await response.json();
      } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
    }
    function Settings() {
          const [status, setStatus] = useState(null), [devices, setDevices] = useState([]);
          const [pairing, setPairing] = useState(null);
          const [busy, setBusy] = useState(''), [now, setNow] = useState(Date.now());
          const [address, setAddress] = useState(''), [update, setUpdate] = useState(null);
          const [flash, setFlash] = useState({}), [announcement, setAnnouncement] = useState('');
          const [issue, setIssue] = useState('');
          const [editing, setEditing] = useState(null), [revoking, setRevoking] = useState('');
          const [pairingView, setPairingView] = useState('');
          const [linkMode, setLinkMode] = useState('permanent');
          const active = useRef(false), pending = useRef(false), abort = useRef(null), timers = useRef(new Map());
          const setTemporary = (key, text, { error = false, duration = 2200, announce = true } = {}) => {
            if (!active.current) return;
            const cache = timers.current, previous = cache.get(key);
            if (previous) clearTimeout(previous);
            setFlash(value => ({ ...value, [key]: { text, error } }));
            if (announce) setAnnouncement(text);
            const timer = setTimeout(() => {
              cache.delete(key);
              if (active.current) setFlash(value => { const next = { ...value }; delete next[key]; return next; });
            }, duration);
            cache.set(key, timer);
          };
          const flashText = (key, fallback) => flash[key]?.text ?? fallback;
          const flashError = key => Boolean(flash[key]?.error);
          const refresh = async signal => {
            const value = await request('/status', undefined, signal);
            if (!active.current || signal?.aborted) return value;
            setStatus(value);
            const versions = await request('/updates/status', undefined, signal);
            if (active.current && !signal?.aborted) setUpdate(versions);
            if (value.configured !== false) {
              const result = await request('/devices', undefined, signal);
              if (active.current && !signal?.aborted) setDevices(result.devices);
            }
            return value;
          };
          useEffect(() => {
            active.current = true; const controller = new AbortController(); abort.current = controller;
            if (local()) void refresh(controller.signal).catch(error => {
              if (active.current && !controller.signal.aborted) setTemporary('status', error.message, { error: true, duration: 8000 });
            });
            return () => { active.current = false; controller.abort(); for (const timer of timers.current.values()) clearTimeout(timer); timers.current.clear(); };
          }, []);
          useEffect(() => { if (!pairing) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [pairing]);
          useEffect(() => {
            if (!status || status.localNetwork === undefined) return;
            const timer = setInterval(() => {
              void request('/status', undefined, abort.current?.signal).then(async value => {
                if (!active.current) return;
                const changed = value.localNetwork !== status.localNetwork || value.remoteAvailable !== status.remoteAvailable
                  || value.configured !== status.configured || value.gateway?.origin !== status.gateway?.origin;
                if (!changed) return;
                setStatus(value);
                setPairing(null);
                if (value.configured) {
                  const saved = await request('/devices', undefined, abort.current?.signal);
                  if (active.current) setDevices(saved.devices);
                }
              }).catch(() => {});
            }, 5000);
            return () => clearInterval(timer);
          }, [status?.gateway?.origin, status?.remoteAvailable, status?.configured, status?.localNetwork]);
          useEffect(() => {
            if (!['downloading', 'installing', 'restoring'].includes(update?.stage)) return;
            const timer = setInterval(() => { void request('/updates/status', undefined, abort.current?.signal).then(value => { if (active.current) setUpdate(value); }).catch(() => {}); }, 1500);
            return () => clearInterval(timer);
          }, [update?.stage]);
          useEffect(() => {
            if (!revoking) return;
            const timer = setTimeout(() => { if (active.current) setRevoking(current => current === revoking ? '' : current); }, 4000);
            return () => clearTimeout(timer);
          }, [revoking]);
          useEffect(() => { if (editing && !devices.some(device => device.id === editing.id)) setEditing(null); }, [devices, editing]);
          const run = async (key, action, onError) => {
            if (pending.current) return;
            pending.current = true; setBusy(key); setIssue('');
            try { await action(abort.current?.signal); }
            catch (error) { if (active.current && !abort.current?.signal.aborted) { setIssue(error?.message || ''); onError?.(error); } }
            finally { pending.current = false; if (active.current) setBusy(''); }
          };
          const copy = (value, key) => void navigator.clipboard.writeText(value)
            .then(() => { if (active.current) setTemporary(key, '已复制', { duration: 1600 }); })
            .catch(() => { if (active.current) setTemporary(key, '请手动复制', { error: true, duration: 2800 }); });
          const action = (key, fallback, onClick, { primary = false, danger = false, disabled, symbol } = {}) => h('button',
            { type: 'button', className: 'dfw-button' + (primary ? ' dfw-button-primary' : '') + (danger || flashError(key) ? ' dfw-button-danger' : ''), disabled: disabled ?? busy !== '', onClick },
            symbol && icon(symbol), flashText(key, fallback));
          const openPairing = (mode, key, view) => void run(key, async signal => {
            const value = await request('/pairing/open', { ttlMs: 600000, mode }, signal);
            if (!active.current) return;
            if (typeof value.pairUrl !== 'string' || !value.qrSvg?.startsWith('<svg')) throw new Error('invalid pairing');
            setPairing({ ...value, mode, view }); setPairingView(view); setNow(Date.now());
          }, () => setTemporary(key, '生成失败，点此重试', { error: true, duration: 4000 }));
          const saveRename = () => {
            const label = (editing?.name ?? '').trim();
            if (label.length < 1 || label.length > 64) { setTemporary('rename-save', '名称需 1–64 字', { error: true, duration: 3200 }); return; }
            void run('rename-save', async signal => {
              const result = await request('/devices/rename', { deviceId: editing.id, label }, signal);
              if (!active.current) return;
              setDevices(current => current.map(device => device.id === result.device.id ? result.device : device));
              setEditing(null);
              setTemporary('rename:' + result.device.id, '已命名', { duration: 2000 });
            }, () => setTemporary('rename-save', '命名失败，重试', { error: true, duration: 4000 }));
          };
          const revoke = device => {
            if (revoking !== device.id) { setRevoking(device.id); return; }
            setRevoking('');
            void run('revoke:' + device.id, async signal => {
              await request('/devices/revoke', { deviceId: device.id }, signal);
              if (!active.current) return;
              setDevices(current => current.filter(candidate => candidate.id !== device.id));
              setTemporary('revoke:' + device.id, '已撤销', { duration: 1800 });
            }, () => setTemporary('revoke:' + device.id, '撤销失败，重试', { error: true, duration: 4000 }));
          };
          const remaining = pairing ? Math.max(0, Math.ceil((pairing.expiresAt - now) / 1000)) : 0;
          const configured = status?.configured !== false;
          const publicOrigin = status?.gateway?.origin;
          const lanOrigin = status?.lanOrigin;
          const permanentOrigin = publicOrigin || lanOrigin;
          const shownLink = linkMode === 'permanent'
            ? (pairingView === 'qr' && pairing ? pairing.pairUrl : permanentOrigin + '/')
            : (pairingView === 'link' && pairing ? pairing.pairUrl : '');
          const sameNetwork = status?.localNetwork === true;
          const differentNetwork = publicOrigin && status?.remoteAvailable !== false;
          const addressForm = () => h('div', { className: 'dfw-setup-body' },
            h('label', { htmlFor: 'dsh-connect-origin' }, '电脑访问地址'),
            h('input', { id: 'dsh-connect-origin', type: 'url', placeholder: 'https://…', value: address,
              onChange: event => setAddress(event.target.value), autoComplete: 'url', spellCheck: false }),
            h('div', { className: 'dfw-setup-actions' }, action('configuration', '启用连接', () => void run('configuration', async signal => {
              await request('/configuration', { publicOrigin: address }, signal);
              await refresh(signal);
            }, () => setTemporary('configuration', '保存失败，重试', { error: true, duration: 4000 })),
            { primary: true, disabled: busy !== '' || !address.trim() || !status.editable })));
          return h('section', { className: 'dfw-settings', 'aria-label': 'DSH Connect' },
            h('style', null, STYLE),
            h('header', { className: 'dfw-head' },
              h('div', { className: 'dfw-brand' },
                h('span', { className: 'dfw-brand-mark', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: window.__DSH_CONNECT_BRAND__ || BRAND_SVG } }),
                h('h3', null, 'DSH Connect')),
              h('ul', { className: 'dfw-features', role: 'list' },
                h('li', null, '浏览器访问'), h('li', null, '扫码配对'), h('li', null, '设备管理'))),
            !local() ? h('div', { className: 'dfw-card' }, h('p', { className: 'dfw-empty' }, '请在运行 DSH 的电脑上打开此设置页，生成配对链接和管理设备。'))
            : !status ? h('div', { className: 'dfw-loading' },
              h('div', null, flashText('status', '正在读取连接状态…')),
              flashError('status') && action('status', '重新读取', () => void run('status', signal => refresh(signal), () => setTemporary('status', '读取失败，重试', { error: true, duration: 5000 })), { symbol: 'refresh' }))
            : !configured ? h('div', { className: 'dfw-card' }, h('div', { className: 'dfw-setup' },
              h('div', { className: 'dfw-setup-title' }, '连接这台电脑'),
              h('p', { className: 'dfw-note', style: { marginTop: 6 } }, status.error || status.message)),
              h('details', { className: 'dfw-setup dfw-advanced' }, h('summary', null, '使用已有 HTTPS 地址'), addressForm()))
            : h('div', null,
              h('section', { className: 'dfw-section', 'aria-labelledby': 'dfw-connection-title' },
                h('div', { className: 'dfw-section-head' },
                  h('div', { className: 'dfw-section-title' }, h('h4', { id: 'dfw-connection-title' }, '连接与访问')),
                  h('span', { className: 'dfw-state' }, sameNetwork || differentNetwork ? '可配对' : '正在连接')),
                h('div', { className: 'dfw-stack' },
                  permanentOrigin && h('div', { className: 'dfw-card dfw-panel' },
                    h('div', { className: 'dfw-seg', role: 'tablist', 'aria-label': '链接类型' },
                      h('button', { type: 'button', role: 'tab', 'aria-selected': linkMode === 'permanent', className: 'dfw-seg-item' + (linkMode === 'permanent' ? ' is-active' : ''),
                        onClick: () => { setLinkMode('permanent'); setPairing(null); setPairingView(''); } }, '永久链接'),
                      h('button', { type: 'button', role: 'tab', 'aria-selected': linkMode === 'temporary', className: 'dfw-seg-item' + (linkMode === 'temporary' ? ' is-active' : ''),
                        onClick: () => { setLinkMode('temporary'); setPairing(null); setPairingView(''); } }, '临时链接')),
                    h('div', { className: 'dfw-panel-desc' }, linkMode === 'permanent'
                      ? (publicOrigin ? '日常入口。新设备先扫码配对，之后存为书签直接打开。' : '日常入口。手机和电脑同一网络时可用，换网络后地址会变。')
                      : '临时分享用。生成后 10 分钟内有效，只能用一次。'),
                    h('div', { className: 'dfw-panel-body' },
                      linkMode === 'temporary' && pairingView === 'link' && pairing && h('div', { className: 'dfw-pairing-state', 'data-expired': remaining === 0 }, remaining
                        ? `剩余 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · 仅能用一次`
                        : '已过期，请重新生成。'),
                      h('input', { className: 'dfw-link', readOnly: true,
                        'aria-label': linkMode === 'permanent' ? '永久链接' : '临时链接',
                        value: shownLink,
                        placeholder: linkMode === 'temporary' ? '点「生成链接」后显示' : '' }),
                      h('div', { className: 'dfw-panel-actions' },
                        linkMode === 'permanent'
                          ? [action('entry', '复制链接', () => copy(shownLink, 'entry'), { symbol: 'copy', disabled: false }),
                             action('pair-qr', busy === 'pair-qr' ? '生成中…' : pairingView === 'qr' ? '收起' : '配对链接', () => {
                               if (pairingView === 'qr') { setPairing(null); setPairingView(''); return; }
                               openPairing(sameNetwork ? 'lan' : 'remote', 'pair-qr', 'qr');
                             }, { symbol: 'qr' })]
                          : [action('pair-link', busy === 'pair-link' ? '生成中…' : pairingView === 'link' ? '重新生成' : '生成链接',
                               () => openPairing(sameNetwork ? 'lan' : 'remote', 'pair-link', 'link'), { primary: true, symbol: 'link' }),
                             pairingView === 'link' && pairing && action('pair-copy', '复制链接', () => copy(shownLink, 'pair-copy'), { disabled: !remaining, symbol: 'copy' })].filter(Boolean)),
                      linkMode === 'permanent' && pairingView === 'qr' && pairing && h('div', { className: 'dfw-qr', role: 'img', 'aria-label': '配对二维码', dangerouslySetInnerHTML: { __html: pairing.qrSvg } }))),
                  !publicOrigin && h('details', { className: 'dfw-setup dfw-advanced' }, h('summary', null, '使用已有 HTTPS 地址'), addressForm()))),
              h('section', { className: 'dfw-section', 'aria-labelledby': 'dfw-devices-title' },
                h('div', { className: 'dfw-section-head' },
                  h('div', { className: 'dfw-section-title' }, h('h4', { id: 'dfw-devices-title' }, '已配对设备'), h('span', { className: 'dfw-count' }, devices.length ? `${devices.length} 台` : '暂无')),
                  action('devices', '刷新', () => void run('devices', async signal => { await refresh(signal); if (active.current) setTemporary('devices', '已刷新', { duration: 1600 }); }, () => setTemporary('devices', '刷新失败，重试', { error: true, duration: 4000 })), { symbol: 'refresh', disabled: busy !== '' })),
                h('div', { className: 'dfw-card' },
                  !devices.length ? h('p', { className: 'dfw-empty' }, '暂无配对设备。生成配对链接后，新设备会显示在这里。')
                  : h('ul', { className: 'dfw-device-list' }, devices.map(device => h('li', { className: 'dfw-device', key: device.id },
                    h('div', { className: 'dfw-device-info' },
                      editing?.id === device.id
                        ? h('div', { className: 'dfw-device-edit' },
                          h('input', { value: editing.name, maxLength: 64, 'aria-label': '设备名称', autoFocus: true,
                            onChange: event => setEditing(current => current && current.id === device.id ? { ...current, name: event.target.value } : current),
                            onKeyDown: event => { if (event.key === 'Enter') saveRename(); else if (event.key === 'Escape') setEditing(null); } }),
                          action('rename-save', '保存', saveRename, { primary: true, disabled: busy !== '' }),
                          action('rename-cancel', '取消', () => setEditing(null), { disabled: busy !== '' }))
                        : h('div', { className: 'dfw-device-name' }, device.label),
                      h('div', { className: 'dfw-device-meta' }, `授权至 ${new Date(device.expiresAt).toLocaleDateString()} · 最近使用 ${new Date(device.lastSeenAt).toLocaleDateString()}`)),
                    h('div', { className: 'dfw-device-actions' },
                      editing?.id === device.id ? null : action('rename:' + device.id, '重命名', () => setEditing({ id: device.id, name: device.label }), { disabled: busy !== '' }),
                      action('revoke:' + device.id, revoking === device.id ? '确认撤销' : '撤销授权', () => revoke(device), { danger: revoking === device.id, disabled: busy !== '' })))))))),
            h('div', { className: 'dfw-foot' },
                h('div', { className: 'dfw-foot-info' },
                  h('div', { className: 'dfw-foot-version' }, 'DSH Connect ' + (status?.version || '')),
                  h('div', { className: 'dfw-foot-note', role: 'status', 'aria-live': 'polite' }, issue || update?.message || '更新保留连接地址和已配对设备。')),
                local() && h('div', { className: 'dfw-foot-actions' },
                  action('updates', busy === 'updates' ? '正在检查…' : '检查更新', () => void run('updates', async signal => {
                    const value = await request('/updates/check', {}, signal);
                    if (!active.current) return;
                    setUpdate(value);
                    setTemporary('updates', '已检查', { duration: 1600 });
                  }, () => setTemporary('updates', '检查失败，重试', { error: true, duration: 4000 })), { symbol: 'refresh', disabled: busy !== '' || ['downloading', 'installing', 'restoring'].includes(update?.stage) }),
                  update?.available && update.canUpdate && action('apply', '更新到 ' + update.latest, () => void run('apply', async signal => {
                    const value = await request('/updates/apply', { version: update.latest }, signal);
                    if (active.current) setUpdate(value);
                  }, () => setTemporary('apply', '更新失败，重试', { error: true, duration: 4000 })), { primary: true, disabled: busy !== '' || update.stage !== 'available' }),
                  h('a', { className: 'dfw-button', href: 'https://github.com/LUMIAO9527/DSH-Connect/releases/latest', target: '_blank', rel: 'noopener noreferrer' }, '发布记录'))),
              h('div', { className: 'dfw-sr', role: 'status', 'aria-live': 'polite' }, announcement));
        }
    /* settings-icon:start */
    function installSettingsIcon(ctx) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || !ctx.effect) return;
      ctx.effect(() => {
        const mark = "dsh-connect", label = "DSH Connect";
        const glyph = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 32 32\" fill=\"none\" role=\"img\" aria-label=\"DSH Connect\">\n  <rect id=\"cn-tile\" width=\"32\" height=\"32\" rx=\"10\" fill=\"#ffffff\" stroke=\"#d7d7d7\" stroke-width=\"0.75\"/>\n  <g id=\"cn-letters\" stroke=\"#171717\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\">\n    <path d=\"M14 10.5C12.9 9.6 11.8 9.4 10.7 9.4C7.8 9.4 6.5 12.1 6.5 15.7C6.5 19.3 7.8 22 10.7 22C11.9 22 13 21.7 14 20.7\"/>\n    <path d=\"M18.6 22V15.3C18.6 11.8 26.4 11.8 26.4 15.3V22\"/>\n  </g>\n</svg>\n";
        const style = document.createElement('style');
        const selector = 'button[data-dsh-plugin-icon="' + mark + '"] svg';
        style.textContent = selector + '{width:16px;height:16px;flex-shrink:0;display:block;background:transparent url("data:image/svg+xml,' + encodeURIComponent(glyph) + '") center/contain no-repeat;mask:none}' + selector + '>*{visibility:hidden}';
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
    /* settings-icon:end */
    function apply(ctx) {
      installSettingsIcon(ctx);
      ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-connect', order: 35, label: 'DSH Connect' }, Settings)), 'DSH Connect settings');
      // DSH owns reconnection and data synchronization. Access renewal only asks
      // for a reconnect when the existing transport is already disconnected.
      if (!document.querySelector('meta[name="dsh-foreverweb-gateway"][content="authenticated"]')) return;
      const connection = ctx.connection;
      ctx.inject?.(['sessions'], scope => {
        let prepared = false;
        const prepareSelection = () => {
          if (prepared || connection.state.getSnapshot() !== 'connected') return;
          prepared = true;
          let saved;
          try { saved = JSON.parse(localStorage.getItem('dsh.sessions.current')); }
          catch { return; }
          if (saved?.subagentAddress !== undefined || typeof saved?.sessionId !== 'string' || !saved.sessionId) return;
          // The Session Controller shares this read with workspace restoration.
          void Promise.resolve().then(() => {
            if (connection.state.getSnapshot() === 'connected') return scope.sessions.refreshProjections(saved.sessionId);
          }).catch(() => {});
        };
        scope.effect(() => {
          const off = connection.state.subscribe(prepareSelection);
          prepareSelection();
          return off;
        }, 'prepare saved workspace session');
      });
      window.__DSH_CONNECT_UI__?.configure({
        toggleSidebar: () => ctx.layout?.toggleSidebar(),
        closeRightbar: () => ctx.sidebarRight?.toggleExpanded(),
        openWorkspaceFiles(button) {
          const target = ctx.sidebarRight?.commandTarget(button);
          if (target !== undefined) ctx.sidebarRight.openTabFromTarget('files', target);
        }
      });
      if (ctx.layout?.panelInfo) {
        let panel = ctx.layout.panelInfo.getSnapshot().activePanelId;
        const offPanel=ctx.layout.panelInfo.subscribe(()=>{
          const next=ctx.layout.panelInfo.getSnapshot().activePanelId;
          if(next!==panel){panel=next;window.__DSH_CONNECT_UI__?.closeSidebar();}
        });
        ctx.effect(()=>offPanel,'connect mobile panel navigation');
      }
      const intent = event => {
        const detail = event.detail;
        if (detail?.phase === 'ready' && detail.reason !== 'transport-connected'
          && navigator.onLine !== false && connection.state.getSnapshot() === 'disconnected') connection.reconnect();
      };
      let previous = connection.state.getSnapshot();
      const observed = () => {
        const state = connection.state.getSnapshot();
        window.__DSH_CONNECT_TRANSPORT__ = state;
        window.__DSH_CONNECT_UI__?.setTransport(state);
        if (state === 'connected' && previous !== 'connected') void window.__DSH_FOREVERWEB_ACCESS__?.resume('transport-connected');
        if (state === 'disconnected' && previous !== 'disconnected') void window.__DSH_FOREVERWEB_ACCESS__?.resume('transport-disconnected');
        previous = state;
      };
      window.addEventListener('dsh-foreverweb:recovery-intent', intent);
      const unsubscribe = connection.state.subscribe(observed);
      observed();
      ctx.effect(() => () => { window.removeEventListener('dsh-foreverweb:recovery-intent', intent); unsubscribe(); }, 'DSH Connect recovery observation');
      void window.__DSH_FOREVERWEB_ACCESS__?.resume('client-ready');
    }
    return { name: 'dsh-connect', inject: ['slots', 'connection', 'layout', 'sidebarRight'], apply };
  },
});
