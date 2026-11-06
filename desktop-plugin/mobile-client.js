(() => {
  if (!document.querySelector('meta[name="dsh-foreverweb-gateway"][content="authenticated"]') || window.__DSH_CONNECT_UI__) return;
  const media = window.matchMedia('(max-width: 900px)');
  const native = /DSH-Connect\//.test(navigator.userAgent) && !!window.HarmonyConnector;
  if (media.matches || native) {
    const root = document.documentElement;
    root.setAttribute('data-dsc-starting', '');
    setTimeout(() => root.removeAttribute('data-dsc-starting'), 45000);
  }
  let transport = window.__DSH_CONNECT_TRANSPORT__ || 'connecting', access = window.__DSH_FOREVERWEB_ACCESS__?.getSnapshot(), timer, lastBridge = '', controls = {}, frame;
  let foregroundTask;
  const style = document.createElement('style'); style.id = 'dsh-connect-mobile-style';
  style.textContent = window.__DSH_CONNECT_MOBILE_STYLE__ || ''; delete window.__DSH_CONNECT_MOBILE_STYLE__;
  document.head.append(style);
  const root = document.documentElement;
  root.setAttribute('data-dsh-connect-surface', native ? 'harmony' : 'browser');
  const setLayoutValue = (name, value) => {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  };
  const layout = () => {
    const mobile = media.matches || native;
    if (root.hasAttribute('data-dsh-connect-mobile') !== mobile) root.toggleAttribute('data-dsh-connect-mobile', mobile);
    const view = window.visualViewport;
    // ArkUI resizes the Web surface with the IME. Browsers may instead resize only
    // the visual viewport, so only that case needs a CSS viewport override.
    setLayoutValue('--dsc-viewport', view && Math.abs(window.innerHeight - view.height) > 1 ? `${view.height}px` : '100dvh');
    // ArkWeb and browsers expose the actual overlap with the system gesture area.
    // Only interactive content avoids it; page and drawer backgrounds extend underneath.
    setLayoutValue('--dsc-inset-bottom', view && window.innerHeight - view.height > 120 ? '0px' : 'env(safe-area-inset-bottom,0px)');
    if (media.matches || native) {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        const content = viewport.getAttribute('content') || 'width=device-width,initial-scale=1';
        if (!/(?:^|,)\s*viewport-fit\s*=\s*cover(?:,|$)/i.test(content)) viewport.setAttribute('content', content.replace(/(?:^|,)\s*viewport-fit\s*=[^,]*/gi, '') + ',viewport-fit=cover');
      }
    }
  };
  let layoutQueued = false;
  const queueLayout = () => {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; layout(); });
  };
  layout(); media.addEventListener('change', layout); window.addEventListener('resize', queueLayout); window.visualViewport?.addEventListener('resize', queueLayout);
  const drawerState = () => {
    if (!(media.matches || native) || !frame?.hasAttribute('data-sidebar-drawer')) return;
    if (!frame.hasAttribute('data-sidebar-collapsed')) return 'left';
    if (!frame.hasAttribute('data-rightbar-collapsed') || frame.hasAttribute('data-rightbar-fullscreen')) return 'right';
    return 'closed';
  };
  const drawerOpener = side => {
    const button = frame.querySelector(side === 'left' ? '[data-sidebar-opener]' : '[data-sidebar-right-expand]');
    if (button && !button.disabled && !button.closest('[inert]') &&
        button.getClientRects().length && getComputedStyle(button).visibility === 'visible') return button;
  };
  // Leave the system gesture strip clear and accept horizontal swipes across the page.
  const systemEdge = 18, swipeIntent = 6, swipeDistance = 56, swipeTime = 1800;
  const swipeExclusion = 'input,textarea,select,[inert],[contenteditable],[role="menu"],[role="listbox"],[role="slider"],[data-composer-card],[data-conversation-tabs],[data-slot="conversation.session.header.actions"],pre,table,[data-message-attachments]';
  const tapTargets = 'a,button,label,summary,[role="button"],[role="link"]';
  const canStartSwipe = (target, drawer) => {
    if (!target.closest || target.closest(swipeExclusion)) return false;
    const dialog = target.closest('[role="dialog"]');
    if (drawer === 'closed') return !dialog && !target.closest(tapTargets);
    if (drawer === 'left') {
      return !!target.closest('[data-dsc-sidebar],[data-sidebar-mask]') &&
        (!dialog || dialog.getAttribute('data-shortcut-modal') === 'sidebar');
    }
    return !!target.closest('[data-rightbar-col]') && (!dialog || dialog.hasAttribute('data-sidebar-right-panel'));
  };
  const hasHorizontalScroll = target => {
    for (let node = target; node && node !== frame; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth + 1 && /^(auto|scroll)$/.test(getComputedStyle(node).overflowX)) return true;
    }
    return false;
  };
  const hasSelection = () => window.getSelection?.()?.isCollapsed === false;
  const blurComposer = () => document.activeElement?.closest?.('[data-composer-input]')?.blur();
  const swipeOptions = { capture: true, passive: true };
  let swipe, settling;
  const stopSwipe = () => {
    if (!swipe) return;
    const start = swipe;
    swipe = undefined;
    document.removeEventListener('touchmove', trackSwipe, true);
    return start;
  };
  const matchesDrawer = start => {
    const current = drawerState();
    const motion = start.motion;
    if (!motion) return current === start.drawer;
    return frame === motion.frame && frame.contains(motion.pane) &&
      (current === start.drawer || (motion.opening && current === motion.side));
  };
  const swipeAction = (drawer, direction) => {
    if (drawer === 'closed') {
      const button = drawerOpener(direction);
      return button && (() => button.click());
    }
    if (drawer !== direction) return drawer === 'left' ? controls.toggleSidebar : controls.closeRightbar;
  };
  const paintSwipe = motion => {
    if (motion.painted === motion.offset) return;
    motion.painted = motion.offset;
    motion.pane.style.translate = `${motion.offset}px`;
    if (motion.mask) motion.mask.style.opacity = String(1 - Math.abs(motion.offset / motion.edge));
  };
  const startMotion = (start, dx) => {
    const direction = dx > 0 ? 'left' : 'right';
    const action = swipeAction(start.drawer, direction);
    if (!action) return;
    const side = start.drawer === 'closed' ? direction : start.drawer;
    const pane = frame.querySelector(side === 'left' ? '[data-dsc-sidebar]' : '[data-rightbar-col]');
    if (!pane) return true;
    const width = pane.getBoundingClientRect().width || (side === 'right' ? frame.clientWidth : 0);
    if (!width) return true;
    const edge = side === 'left' ? -width : width;
    const mask = side === 'left' ? frame.querySelector('[data-sidebar-mask]') : null;
    const initial = start.drawer === 'closed' ? edge : 0;
    const motion = { frame, pane, mask, side, edge, initial, offset: initial, action,
      opening: start.drawer === 'closed',
      translate: pane.style.translate, opacity: mask?.style.opacity, pending: false };
    start.motion = motion;
    moveSwipe(motion, dx);
    paintSwipe(motion);
    pane.setAttribute('data-dsc-swipe', side);
    mask?.setAttribute('data-dsc-swipe-mask', '');
    // Let Harness and its plugins select and render the current sidebar.
    if (motion.opening) {
      if (native) blurComposer();
      action();
    }
    return motion;
  };
  const moveSwipe = (motion, dx) => {
    motion.offset = Math.max(Math.min(0, motion.edge), Math.min(Math.max(0, motion.edge), motion.initial + dx));
  };
  const clearMotion = motion => {
    motion.pane.style.translate = motion.translate || '';
    motion.pane.removeAttribute('data-dsc-swipe');
    if (motion.mask) {
      motion.mask.style.opacity = motion.opacity || '';
      motion.mask.removeAttribute('data-dsc-swipe-mask');
    }
    if (settling === motion) settling = undefined;
  };
  const settleSwipe = (start, commit, speed = 0) => {
    const motion = start?.motion;
    if (!motion) return;
    if (!matchesDrawer(start)) { clearMotion(motion); return; }
    const commitDrawer = () => {
      const expected = motion.opening ? motion.side : start.drawer;
      if (drawerState() !== expected || frame !== motion.frame || !frame.contains(motion.pane)) return false;
      if (motion.opening) {
        if (commit) return false;
        const close = motion.side === 'left' ? controls.toggleSidebar : controls.closeRightbar;
        if (!close) return false;
        close();
      } else {
        if (!commit) return false;
        motion.action();
      }
      return true;
    };
    const from = motion.painted, to = commit ? (start.drawer === 'closed' ? 0 : motion.edge) : motion.initial;
    if (!motion.pane.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearMotion(motion);
      commitDrawer();
      return;
    }
    settling = motion;
    const distance = Math.abs(to - from) / Math.abs(motion.edge);
    const duration = distance < .01 ? 0 : Math.max(75, 200 * distance / (1 + Math.min(1.25, speed)));
    const timing = { duration, easing: 'cubic-bezier(.2,.75,.24,1)', fill: 'forwards' };
    const paneMotion = motion.pane.animate(
      [from, to].map(offset => ({ translate: `${offset}px` })), timing);
    const maskMotion = motion.mask?.animate(
      [from, to].map(offset => ({ opacity: 1 - Math.abs(offset / motion.edge) })), timing);
    void Promise.allSettled([paneMotion.finished, maskMotion?.finished]).then(() => {
      motion.offset = to;
      paintSwipe(motion);
      paneMotion.cancel();
      maskMotion?.cancel();
      // Hold the last painted position until Harness applies its drawer state.
      if (commitDrawer()) {
        requestAnimationFrame(() => requestAnimationFrame(() => clearMotion(motion)));
      } else clearMotion(motion);
    });
  };
  const trackSwipe = event => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || touch.identifier !== swipe.id || !matchesDrawer(swipe)) {
      settleSwipe(stopSwipe(), false);
      return;
    }
    const dx = touch.clientX - swipe.x, horizontal = Math.abs(dx);
    const vertical = Math.abs(touch.clientY - swipe.y);
    const elapsed = event.timeStamp - swipe.lastTime;
    if (elapsed > 0) {
      swipe.velocity = elapsed < 80 ? 0.4 * swipe.velocity + 0.6 * (touch.clientX - swipe.lastX) / elapsed : 0;
      swipe.lastX = touch.clientX;
      swipe.lastTime = event.timeStamp;
    }
    if (!swipe.motion) {
      if (vertical > 16 && vertical >= horizontal) { stopSwipe(); return; }
      if (horizontal < swipeIntent || horizontal < vertical * 1.6) return;
      if (hasHorizontalScroll(swipe.target) || hasSelection() || !startMotion(swipe, dx)) stopSwipe();
      return;
    }
    const motion = swipe.motion;
    moveSwipe(motion, dx);
    if (!motion.pending) {
      motion.pending = true;
      requestAnimationFrame(() => {
        motion.pending = false;
        if (swipe?.motion === motion) paintSwipe(motion);
      });
    }
  };
  document.addEventListener('touchstart', event => {
    if (settling) return;
    const previous = stopSwipe();
    if (previous?.motion) { settleSwipe(previous, false); return; }
    const drawer = drawerState();
    if (!drawer || event.touches.length !== 1 || !frame.contains(event.target)) return;
    const touch = event.touches[0], x = touch.clientX;
    if (x < systemEdge || window.innerWidth - x < systemEdge || window.visualViewport?.scale > 1.01 ||
        !canStartSwipe(event.target, drawer) || hasSelection()) return;
    swipe = { id: touch.identifier, x, y: touch.clientY, time: event.timeStamp, target: event.target, drawer,
      lastX: x, lastTime: event.timeStamp, velocity: 0 };
    document.addEventListener('touchmove', trackSwipe, swipeOptions);
  }, swipeOptions);
  document.addEventListener('touchend', event => {
    const start = stopSwipe();
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch || touch.identifier !== start.id || event.touches.length ||
        !matchesDrawer(start) || !frame.contains(start.target)) {
      settleSwipe(start, false);
      return;
    }
    const dx = touch.clientX - start.x, direction = dx > 0 ? 'left' : 'right';
    const horizontal = Math.abs(dx), vertical = Math.abs(touch.clientY - start.y);
    const action = start.motion?.opening ? start.motion.action : swipeAction(start.drawer, direction);
    const speed = event.timeStamp - start.lastTime < 75 ? Math.max(0, start.velocity * Math.sign(dx)) : 0;
    const farEnough = horizontal >= swipeDistance || (horizontal >= 28 && speed >= 0.45 && horizontal + speed * 48 >= swipeDistance);
    const commit = farEnough && horizontal >= vertical * 1.6 && action && !hasSelection() &&
      (start.motion ? start.motion.side === (start.drawer === 'closed' ? direction : start.drawer)
        : event.timeStamp - start.time <= swipeTime && !hasHorizontalScroll(start.target));
    if (start.motion || commit) event.preventDefault();
    if (start.motion) settleSwipe(start, commit, commit ? speed : 0);
    else if (commit) {
      if (native) blurComposer();
      action();
    }
  }, { capture: true, passive: false });
  document.addEventListener('touchcancel', () => settleSwipe(stopSwipe(), false), swipeOptions);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pressControls = 'button,a[href],[role="button"],[role="tab"],[role="menuitem"],[role="option"],[role="switch"]';
  let press, releasing;
  const releasePress = event => {
    if (!press || event.pointerId !== press.id) return;
    const { animation } = press;
    press = undefined;
    if (!(animation.currentTime > 0)) { animation.cancel(); return; }
    releasing?.cancel();
    releasing = animation;
    animation.onfinish = () => {
      if (releasing === animation) releasing = undefined;
      animation.cancel();
    };
    animation.reverse();
  };
  document.addEventListener('pointerdown', event => {
    if (reduceMotion.matches || !event.isPrimary || event.button !== 0) return;
    const control = event.target.closest?.(pressControls);
    if (!control?.animate || control.closest('[inert],:disabled,[aria-disabled="true"]') ||
        !control.closest('[data-dsc-frame],.dsc-status,[role="dialog"],[role="menu"],[role="listbox"]')) return;
    press?.animation.cancel();
    releasing?.cancel();
    const animation = control.animate([{ scale: '1' }, { scale: '.97' }],
      { duration: 85, easing: 'ease-out', fill: 'forwards', composite: 'add' });
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, animation };
  }, swipeOptions);
  document.addEventListener('pointermove', event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 9) releasePress(event);
  }, swipeOptions);
  document.addEventListener('pointerup', releasePress, swipeOptions);
  document.addEventListener('pointercancel', releasePress, swipeOptions);
  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches) return;
    press?.animation.cancel();
    releasing?.cancel();
    press = releasing = undefined;
  });
  let banner, caption, retry;
  const headerSlot = '[data-slot="conversation.session.header"]';
  const tabsSelector = '[data-conversation-tabs]';
  const composerSelector = '[data-composer-card]';
  const adaptedSlots = `${headerSlot},${tabsSelector},${composerSelector}`;
  const turnSelector = '[data-chat-turn]';
  const renderedTurns = new WeakSet();
  const markTurnImages = turn => {
    for (const image of turn.querySelectorAll?.('img:not([loading])') || []) {
      image.loading = 'lazy';
      image.decoding = 'async';
    }
  };
  const markTurnRendering = batch => {
    if (!(media.matches || native) || !window.CSS?.supports('content-visibility', 'auto')) return;
    // Measure only the turns that just arrived. A full rescan is reserved for a
    // layout-mode change, where every retained turn has to be re-seeded.
    const turns = (batch?.length ? batch : [...document.querySelectorAll(`[data-conversation-scroll] ${turnSelector}`)])
      .filter(turn => turn.isConnected !== false && !renderedTurns.has(turn) && !turn.parentElement?.closest?.(turnSelector));
    if (!turns.length) return;
    // Seed every retained turn from its measured height before changing rendering.
    // The browser then remembers the current size while the turn is on screen.
    const heights = turns.map(turn => turn.getBoundingClientRect().height);
    turns.forEach((turn, index) => {
      if (!heights[index]) return;
      turn.style.setProperty('--dsc-turn-height', `${heights[index]}px`);
      turn.setAttribute('data-dsc-turn-rendering', '');
      renderedTurns.add(turn);
      markTurnImages(turn);
    });
  };
  let turnsQueued = false, pendingTurns = [], fullTurnScan = false;
  const queueTurnRendering = turns => {
    if (!(media.matches || native) || !window.CSS?.supports('content-visibility', 'auto')) return;
    if (turns) pendingTurns.push(...turns); else fullTurnScan = true;
    if (turnsQueued) return;
    turnsQueued = true;
    requestAnimationFrame(() => {
      turnsQueued = false;
      const batch = fullTurnScan ? undefined : pendingTurns;
      pendingTurns = []; fullTurnScan = false;
      markTurnRendering(batch);
    });
  };
  media.addEventListener('change', () => queueTurnRendering());
  const markKeyboardPolicy = () => {
    if (!native || !navigator.virtualKeyboard) return;
    for (const editor of document.querySelectorAll('[data-composer-input][contenteditable]')) {
      if (editor.virtualKeyboardPolicy !== 'manual') editor.virtualKeyboardPolicy = 'manual';
    }
  };
  document.addEventListener('click', event => {
    if (!native || !event.isTrusted || !navigator.virtualKeyboard) return;
    const editor = event.target.closest?.('[data-composer-input][contenteditable]');
    if (editor && editor.contains(document.activeElement)) navigator.virtualKeyboard.show();
  });
  const markConversationHeader=()=>{
    const slot=document.querySelector(headerSlot);
    const header=slot?.parentElement, row=slot?.firstElementChild;
    if(header?.tagName!=='HEADER'||!row)return;
    header.toggleAttribute('data-dsc-conversation-header',true);
    row.toggleAttribute('data-dsc-conversation-title-row',true);
    row.firstElementChild?.toggleAttribute('data-dsc-conversation-title',true);
    header.querySelector(tabsSelector)?.parentElement?.toggleAttribute('data-dsc-conversation-tabs-row',true);
  };
  const markFilePickers=()=>{
    const mobile=media.matches||native;
    for(const input of document.querySelectorAll(`${composerSelector} input[type="file"]`)) {
      const button=input.parentElement?.querySelector('button[aria-haspopup="listbox"],button[data-dsc-file-picker]');
      if(!button)continue;
      if(!button.hasAttribute('data-dsc-file-picker')){
        button.dataset.dscOriginalLabel=button.getAttribute('aria-label')||'';
        button.setAttribute('data-dsc-file-picker','');
      }
      const label=mobile?'添加附件':button.dataset.dscOriginalLabel;
      const popup=mobile?'dialog':'listbox';
      if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
      if(button.getAttribute('aria-haspopup')!==popup)button.setAttribute('aria-haspopup',popup);
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
    const markControls = () => { markConversationHeader(); markFilePickers(); markWorkspaceFolders(); markKeyboardPolicy(); };
    let queued = false;
    new MutationObserver(records => {
      // Collect the turns that actually appeared so the next frame measures them
      // alone instead of rescanning every retained turn in the conversation.
      const addedTurns = [];
      for (const { addedNodes } of records) {
        for (const node of [...addedNodes]) {
          if (node.nodeType !== 1 || typeof node.matches !== 'function') continue;
          if (node.matches(turnSelector)) addedTurns.push(node);
          else if (typeof node.querySelectorAll === 'function') addedTurns.push(...node.querySelectorAll(turnSelector));
        }
      }
      if (addedTurns.length) queueTurnRendering(addedTurns);
      if (queued || !records.some(({ target, addedNodes }) => [...addedNodes].some(node =>
        node.nodeType === 1 && (target.closest(adaptedSlots) || node.matches(adaptedSlots) || node.querySelector(adaptedSlots))
      ))) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; markControls(); });
    }).observe(document.body, { childList: true, subtree: true });
    markControls();
    queueTurnRendering();
  };
  const state = () => ['invalid','revoked','expired'].includes(access?.device?.state) || access?.lastError?.action === 'pair' ? 'auth-required'
    : navigator.onLine === false ? 'offline'
    : transport === 'connected' && access?.session?.state === 'valid' ? 'connected' : 'connecting';
  let accessBlockedFrame, lastState = '';
  const update = () => {
    mount(); const next = state();
    // Access events fire in bursts; only a real state change redraws the notice.
    if (next === lastState) return;
    lastState = next;
    if (next === 'auth-required') {
      if (frame && !frame.hasAttribute('inert')) { frame.setAttribute('inert', ''); accessBlockedFrame = frame; }
    } else if (accessBlockedFrame) {
      accessBlockedFrame.removeAttribute('inert');
      accessBlockedFrame = undefined;
    }
    if (native && next !== lastBridge) {
      try { window.HarmonyConnector.connectionChanged(next); lastBridge = next; } catch (_) {}
    }
    clearTimeout(timer);
    if (next === 'connected') { if (banner) banner.hidden = true; return; }
    timer = setTimeout(() => {
      mount(); if (!banner) return; banner.dataset.state = next;
      caption.textContent = ({ offline: '网络已断开', 'auth-required': '需要重新配对这台设备', connecting: '正在重新连接…' })[next];
      retry.textContent = next === 'auth-required' ? '去配对' : '重试'; retry.hidden = next === 'offline'; banner.hidden = false;
    }, next === 'connecting' ? 3500 : 0);
  };
  window.__DSH_CONNECT_UI__ = Object.freeze({ configure(value) { controls = value; }, setTransport(value) { transport = value; update(); }, resume() {
    layout();
    if (foregroundTask) return foregroundTask;
    const task = Promise.resolve().then(() => window.__DSH_FOREVERWEB_ACCESS__?.resume('native-foreground')).then(() => { update(); })
      .catch(() => { update(); }).finally(() => { if (foregroundTask === task) foregroundTask = undefined; });
    foregroundTask = task; return task;
  }, keyboardDismissed() {
    if (native) blurComposer();
  }, closeSidebar() {
    if(frame&&!frame.hasAttribute('data-sidebar-collapsed')&&(media.matches||native)) controls.toggleSidebar?.();
  }, back() {
    const menu = [...document.querySelectorAll('[role="menu"]')].findLast(element => element.getClientRects().length && getComputedStyle(element).visibility === 'visible');
    if (menu) { menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 'consumed'; }
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility === 'visible');
    if (dialogs.length) { dialogs.at(-1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 'consumed'; }
    if(frame&&!frame.hasAttribute('data-sidebar-collapsed')){controls.toggleSidebar?.();return 'consumed';}
    if(frame&&(!frame.hasAttribute('data-rightbar-collapsed')||frame.hasAttribute('data-rightbar-fullscreen'))){controls.closeRightbar?.();return 'consumed';}
    return 'root';
  } });
  window.addEventListener('dsh-foreverweb:access-state', event => { access = event.detail; update(); });
  window.addEventListener('online', update); window.addEventListener('offline', update);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, { once: true }); else update();
})();
