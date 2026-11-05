window.__ModuleLoader__.load({
  id: 'dsh-connect',
  factory(require) {
    const { createElement: h, useEffect, useRef, useState } = require('react');
    const ADMIN = '/api/foreverweb';
    const STYLE = `
.dfw-settings{--dfw-ink:var(--dsw-alias-label-primary,#171717);--dfw-muted:var(--dsw-alias-label-secondary,#686868);--dfw-line:var(--dsw-alias-border-l2,#e8e8e8);--dfw-surface:color-mix(in srgb,var(--dfw-ink) 4%,transparent);--dfw-inverse:var(--dsw-alias-bg-base,#fff);width:100%;max-width:780px;padding:8px 0 28px;color:var(--dfw-ink);font-size:14px;line-height:1.55;box-sizing:border-box}
.dfw-settings .dfw-brand{display:flex;align-items:center;gap:12px;min-width:0}.dfw-settings .dfw-brand-mark,.dfw-settings .dfw-brand-mark svg{display:block;width:34px;height:34px;flex-shrink:0}.dfw-settings .dfw-brand-mark #cn-tile{fill:var(--dsw-alias-bg-base,#fff);stroke:var(--dsw-alias-border-l2,#d7d7d7);stroke-width:.75}.dfw-settings .dfw-brand-mark #cn-letters{stroke:var(--dsw-alias-label-primary,#171717)}.dfw-settings *{box-sizing:border-box}.dfw-settings h3,.dfw-settings h4,.dfw-settings p{margin:0}.dfw-settings h3{font-size:22px;line-height:1.3;font-weight:650;letter-spacing:-.4px}.dfw-settings h4{font-size:15px;font-weight:600}.dfw-settings p{color:var(--dfw-muted)}.dfw-settings .dfw-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:8px}.dfw-settings .dfw-intro{margin-bottom:24px}.dfw-settings .dfw-badge{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;font-size:12px;color:var(--dfw-muted)}.dfw-settings .dfw-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}.dfw-settings .dfw-card{margin-top:12px;padding:20px;border:1px solid var(--dfw-line);border-radius:16px;background:var(--dfw-surface)}.dfw-settings .dfw-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.dfw-settings .dfw-hint{font-size:12px;color:var(--dfw-muted)}.dfw-settings .dfw-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:16px}.dfw-settings .dfw-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;min-width:40px;padding:8px 14px;border:1px solid var(--dfw-line);border-radius:15px;background:transparent;color:var(--dfw-ink);font:inherit;line-height:1.4;white-space:nowrap;cursor:pointer;touch-action:manipulation;transition:background 160ms,box-shadow 160ms}.dfw-settings .dfw-button-primary{min-height:44px;border-radius:16px;background:var(--dfw-ink);border-color:transparent;color:var(--dfw-inverse);font-weight:600}.dfw-settings .dfw-button:hover:not(:disabled){box-shadow:0 3px 12px #00000014;background:color-mix(in srgb,var(--dfw-ink) 8%,transparent)}.dfw-settings .dfw-button-primary:hover:not(:disabled){background:color-mix(in srgb,var(--dfw-ink) 88%,var(--dfw-inverse))}.dfw-settings .dfw-button:active:not(:disabled){box-shadow:none}.dfw-settings .dfw-button:disabled{opacity:.46;cursor:not-allowed}.dfw-settings .dfw-button:focus-visible,.dfw-settings input:focus-visible{outline:2px solid var(--dfw-ink);outline-offset:3px}.dfw-settings .dfw-icon{display:block;flex-shrink:0;width:18px;height:18px}.dfw-settings .dfw-link-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}.dfw-settings .dfw-link{min-width:0;width:100%;height:42px;padding:10px 12px;border:1px solid var(--dfw-line);border-radius:12px;background:var(--dfw-inverse);color:var(--dfw-ink);font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis}.dfw-settings .dfw-pair-body{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:20px;align-items:start;margin-top:20px;padding-top:20px;border-top:1px solid var(--dfw-line)}.dfw-settings .dfw-qr{padding:10px;border:1px solid var(--dfw-line);border-radius:12px;background:#fff;line-height:0}.dfw-settings .dfw-qr svg{width:100%;height:auto}.dfw-settings .dfw-qr[aria-disabled=true]{opacity:.25}.dfw-settings .dfw-pair-body .dfw-link{margin-top:12px}.dfw-settings .dfw-device-list{list-style:none;padding:0;margin:0}.dfw-settings .dfw-device{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--dfw-line)}.dfw-settings .dfw-device:first-child{padding-top:2px}.dfw-settings .dfw-device:last-child{border-bottom:0;padding-bottom:0}.dfw-settings .dfw-device-name{font-weight:500;overflow-wrap:anywhere}.dfw-settings .dfw-device-meta{margin-top:4px;font-size:12px;color:var(--dfw-muted)}.dfw-settings .dfw-notice{margin:16px 0;padding:12px 14px;border:1px solid var(--dfw-line);border-radius:12px;overflow-wrap:anywhere}.dfw-settings .dfw-footer{margin-top:16px;font-size:12px}.dfw-settings .dfw-loading{padding:20px 0;color:var(--dfw-muted)}
@media(max-width:540px){.dfw-settings .dfw-card{padding:16px}.dfw-settings .dfw-pair-body{grid-template-columns:1fr}.dfw-settings .dfw-qr{width:160px}.dfw-settings .dfw-device{align-items:flex-start;gap:8px}.dfw-settings .dfw-device .dfw-button{min-height:44px}.dfw-settings .dfw-head{flex-wrap:wrap}.dfw-settings .dfw-link-row{align-items:stretch;flex-wrap:wrap}.dfw-settings .dfw-card-head,.dfw-settings .dfw-device{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.dfw-settings .dfw-button{transition:none}}
`;
    function icon(name) {
      const paths = { link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
        copy: 'M9 9h12v12H9zM15 5V3H3v12h2', refresh: 'M20 7V3m0 4h-4M4 17v4m0-4h4M5.1 8a8 8 0 0 1 13.4-3L20 7M4 17l1.5 2A8 8 0 0 0 19 16' };
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
        if (!response.ok) throw new Error(response.status === 401 ? '电脑端连接已失效，请重新打开设置。'
          : response.status === 403 ? '本机请求未通过校验，请重新打开此设置页后再试。' : '操作暂未完成，请检查电脑连接后重试。');
        return await response.json();
      } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
    }
    function Settings() {
      const [status, setStatus] = useState(null), [devices, setDevices] = useState([]);
      const [pairing, setPairing] = useState(null), [notice, setNotice] = useState(null);
      const [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
      const active = useRef(false), pending = useRef(false), abort = useRef(null);
      const refresh = async signal => {
        const value = await request('/status', undefined, signal);
        if (!active.current || signal?.aborted) return;
        setStatus(value);
        if (value.configured !== false) {
          const result = await request('/devices', undefined, signal);
          if (active.current && !signal?.aborted) setDevices(result.devices);
        }
      };
      useEffect(() => {
        active.current = true; const controller = new AbortController(); abort.current = controller;
        if (local()) void refresh(controller.signal).catch(error => { if (active.current && !controller.signal.aborted) setNotice({ scope: 'status', message: error.message }); });
        return () => { active.current = false; controller.abort(); };
      }, []);
      useEffect(() => { if (!pairing) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [pairing]);
      const run = async (action, scope = 'pairing') => {
        if (pending.current) return; pending.current = true; setBusy(true); setNotice(null);
        try { await action(abort.current.signal); }
        catch (error) { if (active.current && !abort.current.signal.aborted) setNotice({ scope, message: error.message }); }
        finally { pending.current = false; if (active.current) setBusy(false); }
      };
      const copy = (value, scope) => void navigator.clipboard.writeText(value)
        .then(() => { if (active.current) setNotice({ scope, message: '链接已复制。' }); })
        .catch(() => { if (active.current) setNotice({ scope, message: '请选中链接后手动复制。' }); });
      const feedback = scope => notice?.scope === scope && h('div', { className: 'dfw-notice', role: 'status' }, notice.message);
      const action = (label, onClick, { primary = false, disabled = busy, symbol } = {}) => h('button',
        { type: 'button', className: 'dfw-button' + (primary ? ' dfw-button-primary' : ''), disabled, onClick }, symbol && icon(symbol), label);
      const remaining = pairing ? Math.max(0, Math.ceil((pairing.expiresAt - now) / 1000)) : 0;
      return h('section', { className: 'dfw-settings', 'aria-label': 'DSH Connect' },
        h('style', null, STYLE),
        h('div', { className: 'dfw-head' }, h('div', { className: 'dfw-brand' },
          window.__DSH_CONNECT_BRAND__ && h('span', { className: 'dfw-brand-mark', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: window.__DSH_CONNECT_BRAND__ } }), h('h3', null, 'DSH Connect')),
          local() && status?.configured !== false && status && h('span', { className: 'dfw-badge' }, '连接服务已开启')),
        h('p', { className: 'dfw-intro' }, '手机应用与浏览器，共用这台电脑的会话、文件和工具。'),
        !local() ? h('div', { className: 'dfw-card' }, h('p', null, '请在运行 DSH 的电脑上打开此设置页，生成配对链接和管理设备。'))
        : !status ? h('div', { className: 'dfw-loading' }, notice
          ? h('div', null, feedback('status'), action('重新读取', () => void run(signal => refresh(signal), 'status'), { symbol: 'refresh' })) : '正在读取连接状态…')
        : status.configured === false ? h('div', { className: 'dfw-card' }, h('h4', null, '设置固定访问地址'),
          h('p', { style: { marginTop: 8 } }, status.error || status.message),
          h('p', { className: 'dfw-footer' }, '打开「插件 → DSH Connect → 配置」，填写 publicOrigin，并使 HTTPS 入口转发到本机网关。'))
        : h('div', null,
          h('div', { className: 'dfw-card' },
            h('div', { className: 'dfw-card-head' }, h('h4', null, '日常访问'), h('span', { className: 'dfw-hint' }, '已配对的浏览器使用')),
            h('div', { className: 'dfw-link-row' },
              h('input', { className: 'dfw-link', value: status.gateway.origin + '/', readOnly: true, 'aria-label': '固定访问入口' }),
              action('复制入口', () => copy(status.gateway.origin + '/', 'entry'), { disabled: false, symbol: 'copy' })),
            feedback('entry'),
            h('p', { className: 'dfw-hint' }, '将此地址存为书签，用原来配对的浏览器打开即可恢复连接。')),
          h('div', { className: 'dfw-card' },
            h('h4', null, '连接新设备'),
            h('p', { className: 'dfw-hint', style: { marginTop: 6 } }, '新设备或浏览器丢失授权时，生成一个新链接完成配对。'),
            h('div', { className: 'dfw-actions' }, action(busy ? '处理中…' : pairing ? '重新生成链接' : '生成配对链接', () => void run(async signal => {
              const value = await request('/pairing/open', { ttlMs: 600000 }, signal);
              if (!active.current) return;
              if (typeof value.pairUrl !== 'string' || !value.qrSvg?.startsWith('<svg')) throw new Error('配对信息无效，请重试。');
              setPairing(value); setNow(Date.now());
            }), { primary: true, symbol: 'link' })),
            feedback('pairing'),
            pairing && h('div', { className: 'dfw-pair-body' },
              h('div', null,
                h('p', null, remaining ? `单次有效 · 剩余 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '链接已过期，请重新生成。'),
                h('input', { className: 'dfw-link', value: pairing.pairUrl, readOnly: true, 'aria-label': '配对链接' }),
                h('div', { className: 'dfw-actions' }, action('复制浏览器链接', () => copy(pairing.pairUrl, 'pairing'), { disabled: !remaining, symbol: 'copy' }),
                  action('复制应用链接', () => copy('dshconnect://connect?url=' + encodeURIComponent(pairing.pairUrl), 'pairing'), { disabled: !remaining, symbol: 'copy' })),
                h('p', { className: 'dfw-footer' }, '鸿蒙应用内扫码即可连接；浏览器直接打开链接。每个入口各自配对，之后共用电脑上的同一份 DSH。')),
              h('div', { className: 'dfw-qr', role: 'img', 'aria-label': '配对二维码', 'aria-disabled': !remaining, dangerouslySetInnerHTML: { __html: pairing.qrSvg } }))),
          h('div', { className: 'dfw-card' },
            h('div', { className: 'dfw-card-head' }, h('h4', null, `已配对设备${devices.length ? ` · ${devices.length}` : ''}`),
              action('刷新', () => void run(signal => refresh(signal), 'devices'), { symbol: 'refresh' })),
            feedback('devices'),
            !devices.length ? h('p', { className: 'dfw-hint' }, '暂无配对设备。')
            : h('ul', { className: 'dfw-device-list' }, devices.map(device => h('li', { className: 'dfw-device', key: device.id },
              h('div', null, h('div', { className: 'dfw-device-name' }, device.label),
                h('div', { className: 'dfw-device-meta' }, `授权至 ${new Date(device.expiresAt).toLocaleDateString()} · 最近使用 ${new Date(device.lastSeenAt).toLocaleDateString()}`)),
              h('div', null, action('撤销授权', () => void run(async signal => { await request('/devices/revoke', { deviceId: device.id }, signal); await refresh(signal); }, 'device:' + device.id)), feedback('device:' + device.id)))))),
          h('p', { className: 'dfw-footer' }, '电脑、DSH 和 HTTPS 通道需保持运行。配对设备可操作此 DSH 的工作区和工具，请只分享给信任的人。')));
    }
    function apply(ctx) {
      ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-connect', order: 35, label: 'DSH Connect' }, Settings)), 'DSH Connect settings');
      // DSH owns reconnection and data synchronization. Access renewal only asks
      // for a reconnect when the existing transport is already disconnected.
      if (!document.querySelector('meta[name="dsh-foreverweb-gateway"][content="authenticated"]')) return;
      const connection = ctx.connection;
      window.__DSH_CONNECT_UI__?.configure({toggleSidebar:()=>ctx.layout?.toggleSidebar(),closeRightbar:()=>ctx.sidebarRight?.toggleExpanded()});
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
