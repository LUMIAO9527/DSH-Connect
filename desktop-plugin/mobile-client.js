(() => {
  if (!document.querySelector('meta[name="dsh-foreverweb-gateway"][content="authenticated"]') || window.__DSH_CONNECT_UI__) return;
  const media = window.matchMedia('(max-width: 900px)');
  const native = /DSH-Connect\//.test(navigator.userAgent) && !!window.HarmonyConnector;
  let transport = window.__DSH_CONNECT_TRANSPORT__ || 'connecting', access = window.__DSH_FOREVERWEB_ACCESS__?.getSnapshot(), timer, lastBridge = '', controls = {}, frame;
  let foregroundTask;
  const style = document.createElement('style'); style.id = 'dsh-connect-mobile-style';
  style.textContent = window.__DSH_CONNECT_MOBILE_STYLE__ || ''; delete window.__DSH_CONNECT_MOBILE_STYLE__;
  document.head.append(style);
  const layout = () => {
    document.documentElement.toggleAttribute('data-dsh-connect-mobile', media.matches || native);
    document.documentElement.setAttribute('data-dsh-connect-surface', native ? 'harmony' : 'browser');
    const view = window.visualViewport;
    if (view) document.documentElement.style.setProperty('--dsc-viewport', `${view.height}px`);
    // ArkWeb and browsers expose the actual overlap with the system gesture area.
    // Only interactive content avoids it; page and drawer backgrounds extend underneath.
    document.documentElement.style.setProperty('--dsc-inset-bottom', view && window.innerHeight - view.height > 120 ? '0px' : 'env(safe-area-inset-bottom,0px)');
    if (media.matches || native) {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        const content = viewport.getAttribute('content') || 'width=device-width,initial-scale=1';
        if (!/(?:^|,)\s*viewport-fit\s*=\s*cover(?:,|$)/i.test(content)) viewport.setAttribute('content', content.replace(/(?:^|,)\s*viewport-fit\s*=[^,]*/gi, '') + ',viewport-fit=cover');
      }
    }
  };
  layout(); media.addEventListener('change', layout); window.addEventListener('resize', layout); window.visualViewport?.addEventListener('resize', layout);
  let banner, caption, retry;
  const markConversationHeader=()=>{
    const slot=document.querySelector('[data-slot="conversation.session.header"]');
    const header=slot?.parentElement, row=slot?.firstElementChild;
    if(header?.tagName!=='HEADER'||!row)return;
    header.setAttribute('data-dsc-conversation-header','');
    row.setAttribute('data-dsc-conversation-title-row','');
    row.firstElementChild?.setAttribute('data-dsc-conversation-title','');
    header.querySelector('[data-conversation-tabs]')?.parentElement?.setAttribute('data-dsc-conversation-tabs-row','');
  };
  const markSettings=()=>{
    const panel=document.querySelector('[data-shortcut-modal="settings"]');if(!panel||panel.hasAttribute('data-dsc-settings'))return;
    const nav=panel.querySelector('nav'),content=nav?.nextElementSibling;if(!content||content.children.length<2)return;
    panel.setAttribute('data-dsc-settings','');content.setAttribute('data-dsc-settings-content','');
    const header=content.children[0],options=content.children[1];header.setAttribute('data-dsc-settings-header','');options.setAttribute('data-dsc-settings-options','');
    const back=document.createElement('button');back.type='button';back.className='dsc-settings-back';back.textContent='‹ 返回设置';
    back.addEventListener('click',()=>{panel.removeAttribute('data-dsc-settings-detail');nav.querySelector('[aria-current="true"]')?.focus();});header.prepend(back);
    nav.addEventListener('click',event=>{const item=event.target.closest('button');if(!item)return;panel.setAttribute('data-dsc-settings-detail','');back.textContent='‹ '+item.textContent.trim();back.focus();});
  };
  const markFilePickers=()=>{
    for(const input of document.querySelectorAll('[data-composer-card] input[type="file"]')) {
      const button=input.parentElement?.querySelector('button[aria-haspopup="listbox"],button[data-dsc-file-picker]');
      if(!button)continue;
      if(!button.hasAttribute('data-dsc-file-picker'))button.dataset.dscOriginalLabel=button.getAttribute('aria-label')||'';
      button.setAttribute('data-dsc-file-picker','');
      const mobile=media.matches||native;
      button.setAttribute('aria-label',mobile?'添加附件':button.dataset.dscOriginalLabel);
      button.setAttribute('aria-haspopup',mobile?'dialog':'listbox');
    }
  };
  const folderSelector = '[data-slot="conversation.session.header.utilities"] [data-open-target="directory"] button[aria-label]:not([aria-haspopup="menu"])';
  const folderLabel = '浏览电脑文件';
  const originalFolderLabels = new WeakMap();
  const markWorkspaceFolders = () => {
    const mobile = media.matches || native;
    for (const button of document.querySelectorAll(folderSelector)) {
      const label = button.getAttribute('aria-label');
      if (mobile && label !== folderLabel) {
        originalFolderLabels.set(button, label);
        button.setAttribute('aria-label', folderLabel);
      } else if (!mobile && originalFolderLabels.has(button)) {
        if (label === folderLabel) button.setAttribute('aria-label', originalFolderLabels.get(button));
        originalFolderLabels.delete(button);
      }
    }
  };
  document.addEventListener('click',event=>{
    if(!(media.matches||native))return;
    const folder = event.target.closest?.(folderSelector);
    if (folder) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!folder.disabled) controls.openWorkspaceFiles?.(folder);
      return;
    }
    const button=event.target.closest?.('button[data-dsc-file-picker]');
    const input=button?.parentElement?.querySelector('input[type="file"]');
    if(!button||!input||button.disabled||input.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    document.activeElement?.blur();input.click();
  },true);
  media.addEventListener('change',markFilePickers);
  media.addEventListener('change',markWorkspaceFolders);
  const mount = () => {
    if (banner || !document.body) return;
    banner = document.createElement('div'); banner.className = 'dsc-status'; banner.hidden = true; banner.setAttribute('role', 'status');
    const dot = document.createElement('span'); dot.className = 'dsc-status-dot'; dot.setAttribute('aria-hidden', 'true');
    caption = document.createElement('span'); retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重试';
    retry.addEventListener('click', () => {
      if (banner.dataset.state === 'auth-required') location.assign('/mobile-access/login?return=' + encodeURIComponent(location.pathname + location.search));
      else void window.__DSH_FOREVERWEB_ACCESS__?.resume('user-retry');
    });
    banner.append(dot, caption, retry); document.body.append(banner);
    const markFrame=()=>{
      const overlay=document.querySelector('[data-shell-overlay]');if(!overlay)return false;
      frame=overlay.parentElement;
      const columns=[...frame.children].filter(node=>node.tagName==='DIV'&&!node.hasAttribute('data-sidebar-mask'));
      const sidebar=columns.find(node=>node.querySelector('[data-slot="sidebar"]'));
      const center=columns.find(node=>node.querySelector('[data-slot="main"]'));
      if(!sidebar||!center)return false;
      frame.setAttribute('data-dsc-frame','');
      for(const column of columns){column.removeAttribute('data-dsc-sidebar');column.removeAttribute('data-dsc-center');}
      sidebar.setAttribute('data-dsc-sidebar','');center.setAttribute('data-dsc-center','');
      return true;
    };
    if(!markFrame()){const observer=new MutationObserver(()=>{if(markFrame())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),60000);}
    document.addEventListener('click',event=>{
      if(!(media.matches||native)||!frame||frame.hasAttribute('data-sidebar-collapsed'))return;
      const row=event.target.closest?.('[data-row-key^="session:"]');
      if(row&&row.closest('[data-dsc-sidebar]')&&!event.target.closest('button')) window.__DSH_CONNECT_UI__.closeSidebar();
    });
    let queued=false;
    new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;markSettings();markConversationHeader();markFilePickers();markWorkspaceFolders();});}).observe(document.body,{childList:true,subtree:true});
    markSettings();markConversationHeader();markFilePickers();markWorkspaceFolders();
  };
  const state = () => navigator.onLine === false ? 'offline'
    : ['invalid','revoked','expired'].includes(access?.device?.state) || access?.lastError?.action === 'pair' ? 'auth-required'
    : transport === 'connected' && access?.session?.state === 'valid' ? 'connected' : 'connecting';
  const update = () => {
    mount(); const next = state();
    if (native && next !== lastBridge) {
      try { window.HarmonyConnector.connectionChanged(next); lastBridge = next; } catch (_) {}
    }
    clearTimeout(timer);
    if (next === 'connected') { if (banner) banner.hidden = true; return; }
    timer = setTimeout(() => {
      mount(); if (!banner) return; banner.dataset.state = next;
      caption.textContent = ({ offline: '网络已断开，联网后继续', 'auth-required': '需要重新配对这台设备', connecting: '正在恢复电脑连接…' })[next];
      retry.textContent = next === 'auth-required' ? '去配对' : '重试'; retry.hidden = next === 'offline'; banner.hidden = false;
    }, next === 'connecting' ? 3500 : 0);
  };
  window.__DSH_CONNECT_UI__ = Object.freeze({ configure(value) { controls = value; }, setTransport(value) { transport = value; update(); }, resume() {
    layout();
    if (foregroundTask) return foregroundTask;
    const task = Promise.resolve().then(() => window.__DSH_FOREVERWEB_ACCESS__?.resume('native-foreground')).then(() => { update(); })
      .catch(() => { update(); }).finally(() => { if (foregroundTask === task) foregroundTask = undefined; });
    foregroundTask = task; return task;
  }, closeSidebar() {
    if(frame&&!frame.hasAttribute('data-sidebar-collapsed')&&(media.matches||native)) controls.toggleSidebar?.();
  }, back() {
    const menu = [...document.querySelectorAll('[role="menu"]')].findLast(element => element.getClientRects().length && getComputedStyle(element).visibility === 'visible');
    if (menu) { menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 'consumed'; }
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility === 'visible');
    const settings=document.querySelector('[data-shortcut-modal="settings"][data-dsc-settings-detail]');
    if(settings&&dialogs.at(-1)===settings){settings.removeAttribute('data-dsc-settings-detail');settings.querySelector('nav [aria-current="true"]')?.focus();return 'consumed';}
    if (dialogs.length) { dialogs.at(-1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 'consumed'; }
    if(frame&&!frame.hasAttribute('data-sidebar-collapsed')){controls.toggleSidebar?.();return 'consumed';}
    if(frame&&(!frame.hasAttribute('data-rightbar-collapsed')||frame.hasAttribute('data-rightbar-fullscreen'))){controls.closeRightbar?.();return 'consumed';}
    return 'root';
  } });
  window.addEventListener('dsh-foreverweb:access-state', event => { access = event.detail; update(); });
  window.addEventListener('online', update); window.addEventListener('offline', update);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, { once: true }); else update();
})();
