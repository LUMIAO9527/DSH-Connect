(() => {
  // Authentication and transport recovery only; the Host renders its normal UI.
  if (!document.querySelector('meta[name="dsh-foreverweb-gateway"][content="authenticated"]')) return;
  if (window.__DSH_FOREVERWEB_ACCESS__) return;
  const recovery = window.__DSH_CONNECTION_RECOVERY__ || {};
  window.__DSH_CONNECTION_RECOVERY__ = { ...recovery,
    generationReadyTimeoutMs: Math.max(recovery.generationReadyTimeoutMs || 0, 60000) };

  const nativeFetch = window.fetch.bind(window);
  const RENEW_DEADLINE_MS = 8000;
  const PROBE_DEADLINE_MS = 5000;
  const RETRY_MS = 5000;
  const listeners = new Set();
  let authGeneration = 0, renewSequence = 0, intentSequence = 0, hostObservationRevision = 0;
  let renewTask, probeTask, resumeTask, scheduledRenew;
  let retryAt = 0, recoverAfter = 0, lastProbeAt = 0, serverOffset = 0;
  let mustRefresh = false, identityBlocked = false, freshProbePending = false;
  // The old authenticated marker proves this document passed authorization,
  // even when an older gateway did not supply an expiry snapshot. Such a page
  // never parks its first request behind an unnecessary renew operation.
  let nextRenew = Date.now() + 30000;
  let state = Object.freeze({ protocolVersion: 1, authGeneration: 0, updatedAt: Date.now(),
    device: Object.freeze({ state: 'valid' }), session: Object.freeze({ state: 'valid' }),
    host: Object.freeze({ state: 'unknown' }), lastError: null });
  const serverNow = () => Date.now() + serverOffset;
  const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  const event = (name, detail) => {
    if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  };
  const publish = patch => {
    state = Object.freeze({ ...state, ...patch, authGeneration, updatedAt: Date.now(),
      device: Object.freeze({ ...(patch.device || state.device) }),
      session: Object.freeze({ ...(patch.session || state.session) }),
      host: Object.freeze({ ...(patch.host || state.host) }),
      lastError: patch.lastError === undefined ? state.lastError : patch.lastError && Object.freeze({ ...patch.lastError }) });
    for (const listener of [...listeners]) { try { listener(state); } catch (_) {} }
    event('dsh-foreverweb:access-state', state);
  };
  const failure = (scope, code, retryable = true, action = 'retry') => ({ protocolVersion: 1, scope, code, retryable, action });
  function scheduleRenewal() {
    clearTimeout(scheduledRenew); scheduledRenew = undefined;
    if (document.hidden || state.device.state !== 'valid' || !Number.isFinite(state.session.expiresAt)) return;
    scheduledRenew = setTimeout(() => {
      scheduledRenew = undefined;
      if (!document.hidden) void renew();
    }, Math.max(1000, Math.min(nextRenew - serverNow(), 2147483647)));
  }
  const responseFailure = (response, fallbackScope) => {
    const scope = response.headers.get('x-dsh-foreverweb-error-scope') || fallbackScope;
    const code = response.headers.get('x-dsh-foreverweb-error-code') || (response.status === 401 ? 'authentication_failed' : 'connection_unavailable');
    const action = scope === 'device' && response.status === 401 ? 'pair' : scope === 'host' ? 'check-host'
      : scope === 'csrf' ? 'refresh-session' : response.status === 429 ? 'wait'
      : response.status >= 500 ? 'retry' : scope === 'session' && response.status === 401 ? 'renew' : 'check-request';
    return failure(scope, code, ['retry', 'renew', 'wait', 'check-host'].includes(action), action);
  };
  const applySnapshot = (value, expectedHostRevision) => {
    if (identityBlocked) return false;
    if (!value || value.protocolVersion !== 1 || !value.session || !value.device) return false;
    if (state.hostId && value.hostId && value.hostId !== state.hostId) {
      identityBlocked = true;
      publish({ host: { state: 'changed' }, lastError: failure('host', 'host_identity_changed', false, 'review-host') });
      return false;
    }
    if (Number.isFinite(value.serverTime)) serverOffset = value.serverTime - Date.now();
    // A status/renew response may have been captured before a newer Host error
    // or recovery observation. It can still update access credentials without
    // replacing that newer Host observation or its error state.
    const currentHost = expectedHostRevision === undefined || expectedHostRevision === hostObservationRevision;
    const nextHost = currentHost && ['unknown', 'reachable', 'unavailable', 'authentication-failed'].includes(value.host?.state) ? value.host : state.host;
    if (currentHost) hostObservationRevision++;
    const expiresAt = Number(value.session.expiresAt);
    if (Number.isFinite(expiresAt)) {
      nextRenew = expiresAt - Math.min(300000, Math.max(1000, (expiresAt - serverNow()) / 10));
      mustRefresh = expiresAt <= serverNow();
    }
    publish({ ...(typeof value.hostId === 'string' ? { hostId: value.hostId } : {}),
      ...(typeof value.connectorInstanceId === 'string' ? { connectorInstanceId: value.connectorInstanceId } : {}),
      ...(typeof value.pluginVersion === 'string' ? { pluginVersion: value.pluginVersion } : {}),
      ...(Array.isArray(value.capabilities) ? { capabilities: Object.freeze(value.capabilities.filter(item => typeof item === 'string').slice(0, 32)) } : {}),
      serverTime: value.serverTime, device: { state: value.device.state === 'invalid' ? 'invalid' : 'valid',
        ...(Number.isFinite(value.device.expiresAt) ? { expiresAt: value.device.expiresAt } : {}) },
      session: { state: mustRefresh ? 'expired' : 'valid', ...(Number.isFinite(expiresAt) ? { expiresAt } : {}) },
      host: nextHost, lastError: currentHost ? null : state.lastError });
    scheduleRenewal();
    return true;
  };
  try {
    const initial = document.getElementById?.('dsh-foreverweb-access-state');
    if (initial) applySnapshot(JSON.parse(initial.textContent));
  } catch (_) { /* A missing legacy snapshot must not prevent the original UI. */ }
  const csrf = () => {
    for (const key of ['__Host-dsh_ma_csrf', 'dsh_ma_csrf']) {
      const values = document.cookie.split(';').map(row => row.trim()).filter(row => row.startsWith(key + '='));
      if (values.length === 1) return values[0].slice(key.length + 1);
    }
    return '';
  };
  const expired = () => mustRefresh || (Number.isFinite(state.session.expiresAt) && state.session.expiresAt <= serverNow());
  const waitFor = (task, signal) => {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    if (!signal) return task;
    return new Promise((resolve, reject) => {
      const cleanup = () => signal.removeEventListener('abort', onAbort);
      const onAbort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      signal.addEventListener('abort', onAbort, { once: true });
      task.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
  };
  const renew = () => {
    if (renewTask) return renewTask;
    if (identityBlocked || state.device.state === 'invalid' || Date.now() < retryAt) return Promise.resolve(false);
    if (offline()) {
      publish({ lastError: failure('network', 'offline', true, 'wait-online') });
      return Promise.resolve(false);
    }
    const sequence = ++renewSequence;
    const expectedHostRevision = hostObservationRevision;
    clearTimeout(scheduledRenew); scheduledRenew = undefined;
    const controller = new AbortController();
    let done = false, timer, resolve;
    const self = new Promise(complete => { resolve = complete; });
    renewTask = self;
    const settle = value => {
      if (done) return; done = true; clearTimeout(timer);
      if (renewTask === self) renewTask = undefined;
      resolve(value);
    };
    const failed = (error, terminal = false, delay = RETRY_MS) => {
      if (done || sequence !== renewSequence) return;
      if (identityBlocked) return settle(false);
      retryAt = Date.now() + delay;
      if (terminal) mustRefresh = true;
      publish({ device: terminal ? { ...state.device, state: 'invalid' } : state.device,
        session: { ...state.session, state: expired() ? 'expired' : 'valid' }, lastError: error });
      settle(false);
    };
    publish({ session: { ...state.session, state: 'refreshing' } });
    timer = setTimeout(() => {
      if (done || sequence !== renewSequence) return;
      failed(failure('network', 'renew_timeout'));
      renewSequence++; controller.abort();
    }, RENEW_DEADLINE_MS);
    Promise.resolve().then(() => nativeFetch('/mobile-access/auth/renew', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}', signal: controller.signal
    })).then(async response => {
      if (done || sequence !== renewSequence) return;
      if (identityBlocked) return settle(false);
      if (!response.ok) {
        const error = responseFailure(response, 'device');
        const seconds = Number(response.headers.get('retry-after'));
        return failed(error, response.status === 401 && error.scope === 'device',
          response.status === 429 && seconds > 0 ? Math.max(RETRY_MS, Math.min(seconds * 1000, 3600000)) : RETRY_MS);
      }
      const result = await response.json();
      if (done || sequence !== renewSequence) return;
      if (identityBlocked) return settle(false);
      if (!Number.isFinite(result.sessionExpiresAt)) return failed(failure('gateway', 'invalid_renew_response', false, 'check-version'));
      if (state.hostId && result.connection?.hostId && state.hostId !== result.connection.hostId) {
        applySnapshot(result.connection); return settle(false);
      }
      authGeneration++; mustRefresh = false; retryAt = 0;
      if (!applySnapshot(result.connection, expectedHostRevision)) applySnapshot({ protocolVersion: 1, serverTime: Date.now(),
        device: { state: 'valid', expiresAt: result.deviceExpiresAt ?? state.device.expiresAt },
        session: { state: 'valid', expiresAt: result.sessionExpiresAt }, host: state.host }, expectedHostRevision);
      settle(true);
    }).catch(() => failed(failure('network', offline() ? 'offline' : 'renew_unavailable', true, offline() ? 'wait-online' : 'retry')));
    return self;
  };

  const probe = (fresh = false) => {
    if (probeTask) return probeTask;
    if (identityBlocked || state.device.state === 'invalid') return Promise.resolve(false);
    if (!fresh && Date.now() - lastProbeAt < 2000) return Promise.resolve(!expired());
    const generation = authGeneration;
    const expectedHostRevision = hostObservationRevision;
    const controller = new AbortController();
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => { controller.abort();
      if (generation === authGeneration) publish({ lastError: failure('network', 'status_timeout') }); resolve(false);
    }, PROBE_DEADLINE_MS); });
    let settled = false;
    const task = Promise.race([timeout, Promise.resolve().then(() => nativeFetch('/mobile-access/status', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal
    })).then(async response => {
      if (settled || generation !== authGeneration) return !expired();
      if (response.status === 401) {
        mustRefresh = true; publish({ session: { ...state.session, state: 'expired' } });
        clearTimeout(timer); return renew();
      }
      // Older gateways do not implement the optional status endpoint.
      if (response.status === 404) { lastProbeAt = Date.now(); return !expired(); }
      if (!response.ok) { publish({ lastError: responseFailure(response, 'gateway') }); return false; }
      const value = await response.json();
      if (settled || generation !== authGeneration) return !expired();
      lastProbeAt = Date.now(); return applySnapshot(value, expectedHostRevision);
    }).catch(() => {
      if (!settled && generation === authGeneration) publish({ lastError: failure('network', offline() ? 'offline' : 'status_unavailable', true, offline() ? 'wait-online' : 'retry') });
      return false;
    })]).finally(() => { settled = true; clearTimeout(timer); if (probeTask === task) probeTask = undefined; });
    probeTask = task;
    return task;
  };
  const resume = (reason = 'manual') => {
    // A DSH-owned transition to connected is newer than a status request that
    // may already be in flight. Coalesce that intent into one trailing access
    // probe; it never starts or restarts DSH's transport.
    if (reason === 'transport-connected') freshProbePending = true;
    if (resumeTask) return resumeTask;
    const recoveryId = Date.now().toString(36) + '-' + (++intentSequence).toString(36);
    const intent = { recoveryId, reason: String(reason).slice(0, 48), scope: 'access' };
    event('dsh-foreverweb:recovery-intent', { ...intent, phase: 'checking', authGeneration });
    const task = Promise.resolve().then(async () => {
      let ready = false;
      do {
        const fresh = freshProbePending; freshProbePending = false;
        if (offline()) { publish({ lastError: failure('network', 'offline', true, 'wait-online') }); ready = false; }
        else if (expired() || serverNow() >= nextRenew) ready = await renew();
        else ready = await probe(fresh);
      } while (freshProbePending && !identityBlocked && state.device.state === 'valid' && !offline());
      ready = ready && !identityBlocked && state.device.state === 'valid' && !expired();
      if (ready) scheduleRenewal();
      event('dsh-foreverweb:recovery-intent', { ...intent, phase: ready ? 'ready' : 'blocked', authGeneration });
      return { ...intent, ready, snapshot: state };
    }).finally(() => { if (resumeTask === task) resumeTask = undefined; });
    resumeTask = task; return task;
  };
  const blockedResponse = () => {
    const error = state.lastError || failure('session', 'session_unavailable', true, 'renew');
    return new Response(JSON.stringify({ error: error.code, connection: error, dispatched: false }), {
      status: identityBlocked ? 409 : state.device.state === 'invalid' ? 401 : 503,
      headers: { 'content-type': 'application/json', 'x-dsh-foreverweb-error-scope': error.scope,
        'x-dsh-foreverweb-error-code': error.code, 'x-dsh-foreverweb-request-dispatched': 'no' }
    });
  };
  window.fetch = async (input, init) => {
    const source = input instanceof Request ? input : undefined;
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : source.url, document.baseURI || location.href);
    if (target.origin !== location.origin || target.pathname.startsWith('/mobile-access/auth/')) return nativeFetch(input, init);
    const method = String(init?.method || source?.method || 'GET').toUpperCase();
    const hasSignal = !!init && typeof init === 'object' && 'signal' in init && init.signal !== undefined;
    const signal = hasSignal ? init.signal : (source?.signal || null);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (identityBlocked || state.device.state === 'invalid') return blockedResponse();
    if (expired()) {
      await waitFor(renew(), signal);
      if (identityBlocked || state.device.state === 'invalid' || expired()) return blockedResponse();
    } else if (serverNow() >= nextRenew) {
      // Proactive renewal cannot delay requests using a still-valid session.
      void renew();
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const headers = new Headers(init?.headers || source?.headers);
    if (method !== 'GET' && method !== 'HEAD') { const token = csrf(); if (token) headers.set('x-dsh-mobile-csrf', token); }
    const dispatchedGeneration = authGeneration;
    const expectedHostRevision = hostObservationRevision;
    let response;
    try { response = await nativeFetch(input, { ...init, headers }); }
    catch (error) {
      if (!identityBlocked && !signal?.aborted && dispatchedGeneration === authGeneration) {
        publish({ lastError: failure('network', offline() ? 'offline' : 'request_unavailable', true, offline() ? 'wait-online' : 'retry') });
      }
      throw error;
    }
    const scope = response.headers.get('x-dsh-foreverweb-error-scope');
    if (identityBlocked) return response;
    if (scope === 'host') {
      if (dispatchedGeneration === authGeneration && expectedHostRevision === hostObservationRevision) {
        hostObservationRevision++;
        publish({ host: { state: response.status === 401 ? 'authentication-failed' : 'unavailable', observedAt: serverNow() },
          lastError: responseFailure(response, 'host') });
      }
    } else if (scope === 'device' && response.status === 401 && dispatchedGeneration === authGeneration) {
      mustRefresh = true; clearTimeout(scheduledRenew);
      publish({ device: { ...state.device, state: 'invalid' }, session: { ...state.session, state: 'expired' },
        lastError: responseFailure(response, 'device') });
    } else if (response.status === 401 && dispatchedGeneration === authGeneration && Date.now() >= recoverAfter) {
      recoverAfter = Date.now() + RETRY_MS; mustRefresh = true;
      publish({ session: { ...state.session, state: 'expired' } });
      await waitFor(renew(), signal);
    } else if (scope && response.status >= 400) publish({ lastError: responseFailure(response, scope) });
    // A response lost after admission may represent an executed mutation.
    // Never resend this Request/body, including after a successful renewal.
    return response;
  };
  window.__DSH_FOREVERWEB_ACCESS__ = Object.freeze({ version: 1, getSnapshot: () => state, resume,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Access-state listener must be a function');
      if (listeners.size >= 64) throw new RangeError('Access-state listener limit');
      listeners.add(listener); return () => listeners.delete(listener);
    } });
  if (!window.__DSH_TRANSPORT__) window.__DSH_TRANSPORT__ = { fetch: (input, init) => window.fetch(input, init), ownsHost: true };
  if (!window.__DSH_FILE_UPLOAD__) window.__DSH_FILE_UPLOAD__ = { fetch: (input, init) => window.fetch(input, init) };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void resume('foreground');
    else { clearTimeout(scheduledRenew); scheduledRenew = undefined; }
  });
  window.addEventListener('online', () => { retryAt = 0; void resume('online'); });
  window.addEventListener('offline', () => publish({ lastError: failure('network', 'offline', true, 'wait-online') }));
  publish({});
})();
