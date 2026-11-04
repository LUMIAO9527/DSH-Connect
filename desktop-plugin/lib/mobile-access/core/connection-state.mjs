// DSH Connect connection projections. These describe gateway observations only;
// DSH remains the owner of connection generations, task state and stream repair.
export const CONNECTION_PROTOCOL_VERSION = 1;
export const CONNECTION_CAPABILITIES = Object.freeze([
  'access-state-v1', 'persistent-host-identity', 'scoped-errors-v1',
  'document-access-bootstrap', 'browser-pairing', 'no-request-replay',
  'bounded-compressed-queues'
]);

export function connectionFailure(status, code, scope = 'gateway') {
  if (code.startsWith('upstream_')) scope = 'host';
  if (code === 'device_expired' || code === 'device_revoked') scope = 'device';
  let action = 'retry';
  let retryable = status >= 500 || status === 429;
  if (scope === 'device' && status === 401) { action = 'pair'; retryable = false; }
  else if (scope === 'session' && status === 401) { action = 'renew'; retryable = true; }
  else if (scope === 'pairing') { action = 'check-pairing'; retryable = false; }
  else if (scope === 'host') { action = 'check-host'; retryable = true; }
  else if (scope === 'csrf') { action = 'refresh-session'; retryable = false; }
  else if (status === 429) action = 'wait';
  else if (status < 500) { action = 'check-request'; retryable = false; }
  return Object.freeze({ protocolVersion: CONNECTION_PROTOCOL_VERSION, scope, code, retryable, action });
}

export function scopeFailure(error, scope) {
  if (error && typeof error === 'object') error.connectionScope = scope;
  return error;
}

// No request URLs, messages, tokens or exception text are retained here.
export class ConnectionDiagnostics {
  constructor(limit = 64) { this.limit = limit; this.entries = []; this.sequence = 0; }
  record(kind, detail = {}) {
    const entry = { sequence: ++this.sequence, at: Date.now(), kind: String(kind).slice(0, 48) };
    for (const key of ['scope', 'code', 'branch', 'connectionId']) {
      if (typeof detail[key] === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(detail[key])) entry[key] = detail[key];
    }
    for (const key of ['status', 'queuedBytes', 'closeCode']) {
      if (Number.isSafeInteger(detail[key]) && detail[key] >= 0) entry[key] = detail[key];
    }
    this.entries.push(Object.freeze(entry));
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
  }
  snapshot() { return { sequence: this.sequence, entries: [...this.entries] }; }
}

// Reserved bytes include both relay directions and in-flight sends. Returning
// an idempotent release function lets close/error/send callbacks share cleanup.
export class ConnectionQueueBudget {
  constructor(perDevice, total) { this.perDevice = perDevice; this.limit = total; this.total = 0; this.peak = 0; this.devices = new Map(); }
  reserve(deviceId, bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new RangeError('Invalid queued byte count');
    const used = this.devices.get(deviceId) ?? 0;
    if (bytes > this.perDevice - used || bytes > this.limit - this.total) return undefined;
    this.devices.set(deviceId, used + bytes); this.total += bytes; this.peak = Math.max(this.peak, this.total);
    let released = false;
    return () => {
      if (released) return; released = true;
      const remaining = (this.devices.get(deviceId) ?? 0) - bytes;
      if (remaining > 0) this.devices.set(deviceId, remaining); else this.devices.delete(deviceId);
      this.total -= bytes;
    };
  }
  snapshot() { return { queuedBytes: this.total, peakQueuedBytes: this.peak, devices: this.devices.size,
    maxDeviceQueuedBytes: this.perDevice, maxTotalQueuedBytes: this.limit }; }
}
