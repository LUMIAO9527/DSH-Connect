window.__ModuleLoader__.load({
  id: 'dsh-connect',
  factory(require) {
    const { createElement: h, useEffect, useRef, useState } = require('react');
    const ADMIN = '/api/foreverweb';
    const BRAND_SVG = "<!-- DSH Connect mark: the DSH whale passing through a portal ring. Monochrome so it can inherit the current text colour. -->\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" fill=\"none\" role=\"img\" aria-label=\"DSH Connect\">\n<circle cx=\"16\" cy=\"16\" r=\"11.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-dasharray=\"63.335 7.037\" transform=\"rotate(-2 16 16)\"/>\n<g transform=\"translate(-99.037 -1.604) scale(0.74)\"><path d=\"M168.384 12.9517C168.138 12.8317 168.033 13.0607 167.889 13.1767C167.84 13.2142 167.799 13.2632 167.757 13.3082C167.399 13.6912 166.98 13.9427 166.433 13.9127C165.632 13.8677 164.949 14.1192 164.345 14.7312C164.217 13.9767 163.79 13.5262 163.141 13.2372C162.802 13.0872 162.458 12.9367 162.22 12.6102C162.054 12.3776 162.009 12.1186 161.926 11.8631C161.873 11.7091 161.82 11.5516 161.643 11.5251C161.45 11.4951 161.375 11.6566 161.299 11.7916C160.997 12.3436 160.88 12.9517 160.892 13.5677C160.918 14.9532 161.503 16.0568 162.666 16.8418C162.798 16.9318 162.832 17.0218 162.79 17.1533C162.711 17.4238 162.617 17.6863 162.534 17.9568C162.481 18.1293 162.402 18.1673 162.217 18.0918C161.579 17.8253 161.028 17.4308 160.541 16.9543C159.714 16.1548 158.967 15.2722 158.035 14.5812C157.816 14.4197 157.597 14.2697 157.37 14.1267C156.419 13.2032 157.495 12.4446 157.744 12.3546C158.004 12.2606 157.834 11.9376 156.993 11.9416C156.151 11.9451 155.381 12.2271 154.4 12.6027C154.256 12.6592 154.105 12.7002 153.951 12.7342C153.06 12.5652 152.135 12.5277 151.169 12.6367C149.35 12.8392 147.897 13.6992 146.829 15.1672C145.546 16.9318 145.244 18.9368 145.613 21.0279C146.002 23.232 147.127 25.0565 148.855 26.4831C150.648 27.9621 152.713 28.6871 155.068 28.5481C156.499 28.4656 158.091 28.2741 159.888 26.7536C160.341 26.9791 160.816 27.0691 161.605 27.1366C162.212 27.1931 162.797 27.1066 163.25 27.0126C163.96 26.8626 163.911 26.2056 163.654 26.0851C161.575 25.1165 162.031 25.5105 161.616 25.1915C162.673 23.9415 164.287 21.7194 164.785 18.6938C164.834 18.3598 164.896 17.8893 164.889 17.6188C164.885 17.4538 164.923 17.3898 165.111 17.3708C165.632 17.3108 166.138 17.1683 166.603 16.9128C167.95 16.1768 168.494 14.9677 168.622 13.5187C168.641 13.2972 168.618 13.0682 168.384 12.9517ZM156.642 25.9951C154.626 24.4105 153.649 23.889 153.245 23.9115C152.868 23.934 152.936 24.366 153.019 24.6475C153.106 24.9255 153.219 25.117 153.377 25.361C153.487 25.5225 153.562 25.7625 153.268 25.9431C152.619 26.3446 151.49 25.808 151.437 25.7815C150.124 25.008 149.025 23.987 148.251 22.5905C147.504 21.2464 147.07 19.8044 146.998 18.2653C146.979 17.8938 147.089 17.7623 147.459 17.6948C147.946 17.6048 148.448 17.5858 148.934 17.6573C150.992 17.9578 152.743 18.8773 154.211 20.3344C155.049 21.1639 155.683 22.1554 156.336 23.124C157.03 24.1525 157.777 25.1325 158.729 25.9361C159.065 26.2176 159.333 26.4316 159.589 26.5896C158.816 26.6761 157.525 26.6946 156.642 25.9961V25.9951ZM157.608 19.7814C157.608 19.6164 157.74 19.4849 157.906 19.4849C157.943 19.4849 157.977 19.4924 158.008 19.5034C158.049 19.5184 158.087 19.5409 158.117 19.5749C158.17 19.6274 158.2 19.7024 158.2 19.7814C158.2 19.9464 158.068 20.0779 157.902 20.0779C157.736 20.0779 157.608 19.9464 157.608 19.7814ZM160.608 21.3204C160.416 21.3994 160.223 21.4669 160.038 21.4744C159.751 21.4894 159.438 21.3729 159.268 21.2304C159.004 21.0089 158.815 20.8849 158.736 20.4984C158.702 20.3334 158.721 20.0779 158.751 19.9314C158.819 19.6159 158.744 19.4134 158.521 19.2294C158.34 19.0793 158.11 19.0378 157.857 19.0378C157.762 19.0378 157.676 18.9963 157.611 18.9628C157.506 18.9103 157.419 18.7788 157.502 18.6173C157.528 18.5648 157.657 18.4373 157.687 18.4148C158.03 18.2193 158.426 18.2833 158.793 18.4298C159.132 18.5688 159.389 18.8238 159.759 19.1844C160.136 19.6199 160.204 19.7399 160.419 20.0669C160.589 20.3224 160.744 20.5849 160.85 20.8854C160.914 21.0729 160.831 21.2264 160.608 21.3204Z\" fill=\"currentColor\"/></g>\n</svg>\n";
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
.dfw-settings .dfw-device-name{display:flex;align-items:center;min-height:30px;font-weight:500;line-height:1.4;overflow-wrap:anywhere}
.dfw-settings .dfw-device-meta{margin-top:3px;font-size:12px;color:var(--dfw-muted)}
.dfw-settings .dfw-device-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.dfw-settings .dfw-device-edit{display:flex;align-items:center;gap:8px;width:min(100%,320px);min-height:30px}
.dfw-settings .dfw-device-edit input{min-width:0;width:100%;height:30px;padding:4px 10px;border:1px solid var(--dfw-line);border-radius:8px;background:var(--dfw-field);color:var(--dfw-ink);font:inherit}.dfw-settings .dfw-device-edit .dfw-button{min-height:30px;padding-block:3px}
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
          const devicesRef = useRef([]);
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
          useEffect(() => { devicesRef.current = devices; }, [devices]);
          // A phone pairs in another browser, so the list must catch up on its
          // own instead of waiting for the panel to be reopened.
          useEffect(() => {
            if (!local()) return;
            const timer = setInterval(async () => {
              if (!active.current || document.hidden) return;
              try {
                const saved = await request('/devices', undefined, abort.current?.signal);
                if (!active.current || !Array.isArray(saved.devices)) return;
                const next = saved.devices, previous = devicesRef.current;
                const changed = next.length !== previous.length || next.some((device, index) => {
                  const candidate = previous[index];
                  return !candidate || device.id !== candidate.id || device.label !== candidate.label
                    || device.expiresAt !== candidate.expiresAt || device.lastSeenAt !== candidate.lastSeenAt;
                });
                if (!changed) return;
                if (next.length > previous.length && previous.length > 0) setTemporary('devices', '新设备已配对', { duration: 3000 });
                devicesRef.current = next.slice();
                setDevices(next);
              } catch { /* keep the last list; the manual refresh reports failures */ }
            }, 5000);
            return () => clearInterval(timer);
          }, []);
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
          const action = (key, fallback, onClick, { primary = false, danger = false, disabled, symbol, width, invisible } = {}) => {
            const style = {};
            if (width) style.minWidth = width + 'px';
            if (invisible) style.visibility = 'hidden';
            return h('button',
            { type: 'button', className: 'dfw-button' + (primary ? ' dfw-button-primary' : '') + (danger || flashError(key) ? ' dfw-button-danger' : ''), disabled: disabled ?? busy !== '', onClick,
              style: Object.keys(style).length ? style : undefined },
            symbol && icon(symbol), flashText(key, fallback));
          };
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
            { primary: true, width: 112, disabled: busy !== '' || !address.trim() || !status.editable })));
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
                      ? (publicOrigin ? '日常入口。第一次用手机请点「配对链接」，扫码或复制链接完成配对；之后再把上面的地址存为书签。' : '日常入口。第一次用手机请点「配对链接」完成配对，之后存为书签直接打开。')
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
                          ? [action('entry', '复制链接', () => copy(shownLink, 'entry'), { symbol: 'copy', width: 108, disabled: false }),
                             action('pair-qr', busy === 'pair-qr' ? '生成中…' : pairingView === 'qr' ? '收起' : '生成二维码', () => {
                               if (pairingView === 'qr') { setPairing(null); setPairingView(''); return; }
                               openPairing(sameNetwork ? 'lan' : 'remote', 'pair-qr', 'qr');
                             }, { symbol: 'qr', width: 116 })]
                          : [action('pair-link', busy === 'pair-link' ? '生成中…' : pairingView === 'link' ? '重新生成' : '生成链接',
                               () => openPairing(sameNetwork ? 'lan' : 'remote', 'pair-link', 'link'), { primary: true, symbol: 'link', width: 96 }),
                             pairingView === 'link' && pairing && action('pair-copy', '复制链接', () => copy(shownLink, 'pair-copy'), { disabled: !remaining, symbol: 'copy', width: 108 })].filter(Boolean)),
                      linkMode === 'permanent' && pairingView === 'qr' && pairing && h('div', { className: 'dfw-qr', role: 'img', 'aria-label': '配对二维码', dangerouslySetInnerHTML: { __html: pairing.qrSvg } }),
                      linkMode === 'permanent' && pairingView === 'qr' && pairing && h('div', { className: 'dfw-note' }, '手机扫码完成配对；也可以复制上面的链接，发给另一台设备打开。'))),
                  !publicOrigin && h('details', { className: 'dfw-setup dfw-advanced' }, h('summary', null, '使用已有 HTTPS 地址'), addressForm()))),
              h('section', { className: 'dfw-section', 'aria-labelledby': 'dfw-devices-title' },
                h('div', { className: 'dfw-section-head' },
                  h('div', { className: 'dfw-section-title' }, h('h4', { id: 'dfw-devices-title' }, '已配对设备'), h('span', { className: 'dfw-count' }, devices.length ? `${devices.length} 台` : '暂无')),
                  action('devices', '刷新', () => void run('devices', async signal => { await refresh(signal); if (active.current) setTemporary('devices', '已刷新', { duration: 1600 }); }, () => setTemporary('devices', '刷新失败，重试', { error: true, duration: 4000 })), { symbol: 'refresh', width: 136, disabled: busy !== '' })),
                h('div', { className: 'dfw-card' },
                  !devices.length ? h('p', { className: 'dfw-empty' }, '还没有配对设备。手机扫码或打开配对链接后，设备会自动出现在这里。')
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
                      action('rename:' + device.id, '重命名', () => setEditing({ id: device.id, name: device.label }), { disabled: busy !== '', width: 84, invisible: editing?.id === device.id }),
                      action('revoke:' + device.id, revoking === device.id ? '确认撤销' : '撤销授权', () => revoke(device), { danger: revoking === device.id, disabled: busy !== '', width: 88 })))))))),
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
                  }, () => setTemporary('updates', '检查失败，重试', { error: true, duration: 4000 })), { symbol: 'refresh', width: 136, disabled: busy !== '' || ['downloading', 'installing', 'restoring'].includes(update?.stage) }),
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
        const glyph = "<!-- DSH Connect mark: the DSH whale passing through a portal ring. Monochrome so it can inherit the current text colour. -->\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" fill=\"none\" role=\"img\" aria-label=\"DSH Connect\">\n<circle cx=\"16\" cy=\"16\" r=\"11.2\" fill=\"none\" stroke=\"#000\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-dasharray=\"63.335 7.037\" transform=\"rotate(-2 16 16)\"/>\n<g transform=\"translate(-99.037 -1.604) scale(0.74)\"><path d=\"M168.384 12.9517C168.138 12.8317 168.033 13.0607 167.889 13.1767C167.84 13.2142 167.799 13.2632 167.757 13.3082C167.399 13.6912 166.98 13.9427 166.433 13.9127C165.632 13.8677 164.949 14.1192 164.345 14.7312C164.217 13.9767 163.79 13.5262 163.141 13.2372C162.802 13.0872 162.458 12.9367 162.22 12.6102C162.054 12.3776 162.009 12.1186 161.926 11.8631C161.873 11.7091 161.82 11.5516 161.643 11.5251C161.45 11.4951 161.375 11.6566 161.299 11.7916C160.997 12.3436 160.88 12.9517 160.892 13.5677C160.918 14.9532 161.503 16.0568 162.666 16.8418C162.798 16.9318 162.832 17.0218 162.79 17.1533C162.711 17.4238 162.617 17.6863 162.534 17.9568C162.481 18.1293 162.402 18.1673 162.217 18.0918C161.579 17.8253 161.028 17.4308 160.541 16.9543C159.714 16.1548 158.967 15.2722 158.035 14.5812C157.816 14.4197 157.597 14.2697 157.37 14.1267C156.419 13.2032 157.495 12.4446 157.744 12.3546C158.004 12.2606 157.834 11.9376 156.993 11.9416C156.151 11.9451 155.381 12.2271 154.4 12.6027C154.256 12.6592 154.105 12.7002 153.951 12.7342C153.06 12.5652 152.135 12.5277 151.169 12.6367C149.35 12.8392 147.897 13.6992 146.829 15.1672C145.546 16.9318 145.244 18.9368 145.613 21.0279C146.002 23.232 147.127 25.0565 148.855 26.4831C150.648 27.9621 152.713 28.6871 155.068 28.5481C156.499 28.4656 158.091 28.2741 159.888 26.7536C160.341 26.9791 160.816 27.0691 161.605 27.1366C162.212 27.1931 162.797 27.1066 163.25 27.0126C163.96 26.8626 163.911 26.2056 163.654 26.0851C161.575 25.1165 162.031 25.5105 161.616 25.1915C162.673 23.9415 164.287 21.7194 164.785 18.6938C164.834 18.3598 164.896 17.8893 164.889 17.6188C164.885 17.4538 164.923 17.3898 165.111 17.3708C165.632 17.3108 166.138 17.1683 166.603 16.9128C167.95 16.1768 168.494 14.9677 168.622 13.5187C168.641 13.2972 168.618 13.0682 168.384 12.9517ZM156.642 25.9951C154.626 24.4105 153.649 23.889 153.245 23.9115C152.868 23.934 152.936 24.366 153.019 24.6475C153.106 24.9255 153.219 25.117 153.377 25.361C153.487 25.5225 153.562 25.7625 153.268 25.9431C152.619 26.3446 151.49 25.808 151.437 25.7815C150.124 25.008 149.025 23.987 148.251 22.5905C147.504 21.2464 147.07 19.8044 146.998 18.2653C146.979 17.8938 147.089 17.7623 147.459 17.6948C147.946 17.6048 148.448 17.5858 148.934 17.6573C150.992 17.9578 152.743 18.8773 154.211 20.3344C155.049 21.1639 155.683 22.1554 156.336 23.124C157.03 24.1525 157.777 25.1325 158.729 25.9361C159.065 26.2176 159.333 26.4316 159.589 26.5896C158.816 26.6761 157.525 26.6946 156.642 25.9961V25.9951ZM157.608 19.7814C157.608 19.6164 157.74 19.4849 157.906 19.4849C157.943 19.4849 157.977 19.4924 158.008 19.5034C158.049 19.5184 158.087 19.5409 158.117 19.5749C158.17 19.6274 158.2 19.7024 158.2 19.7814C158.2 19.9464 158.068 20.0779 157.902 20.0779C157.736 20.0779 157.608 19.9464 157.608 19.7814ZM160.608 21.3204C160.416 21.3994 160.223 21.4669 160.038 21.4744C159.751 21.4894 159.438 21.3729 159.268 21.2304C159.004 21.0089 158.815 20.8849 158.736 20.4984C158.702 20.3334 158.721 20.0779 158.751 19.9314C158.819 19.6159 158.744 19.4134 158.521 19.2294C158.34 19.0793 158.11 19.0378 157.857 19.0378C157.762 19.0378 157.676 18.9963 157.611 18.9628C157.506 18.9103 157.419 18.7788 157.502 18.6173C157.528 18.5648 157.657 18.4373 157.687 18.4148C158.03 18.2193 158.426 18.2833 158.793 18.4298C159.132 18.5688 159.389 18.8238 159.759 19.1844C160.136 19.6199 160.204 19.7399 160.419 20.0669C160.589 20.3224 160.744 20.5849 160.85 20.8854C160.914 21.0729 160.831 21.2264 160.608 21.3204Z\" fill=\"#000\"/></g>\n</svg>\n";
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
