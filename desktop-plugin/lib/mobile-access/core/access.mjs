// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export class AccessError extends Error {
    status;
    code;
    constructor(status, code){
        super(code), this.status = status, this.code = code;
        this.name = 'AccessError';
    }
}
export class BoundedRateLimiter {
    limit;
    windowMs;
    maximumKeys;
    buckets = new Map();
    constructor(limit, windowMs, maximumKeys){
        this.limit = limit;
        this.windowMs = windowMs;
        this.maximumKeys = maximumKeys;
    }
    take(key, now) {
        for (const [candidate, bucket] of this.buckets){
            if (bucket.resetAt <= now) this.buckets.delete(candidate);
        }
        const current = this.buckets.get(key);
        if (current === undefined) {
            if (this.buckets.size >= this.maximumKeys) return false;
            this.buckets.set(key, {
                count: 1,
                resetAt: now + this.windowMs
            });
            return true;
        }
        if (current.count >= this.limit) return false;
        current.count += 1;
        return true;
    }
    retainKeys(eligible) {
        for (const key of this.buckets.keys()){
            if (!eligible.has(key)) this.buckets.delete(key);
        }
    }
    get size() {
        return this.buckets.size;
    }
}
function opaqueToken() {
    return randomBytes(32).toString('base64url');
}
function digest(value) {
    return createHash('sha256').update(value, 'utf8').digest();
}
function digestHex(value) {
    return digest(value).toString('hex');
}
function matchesDigest(value, expected) {
    return timingSafeEqual(digest(value), expected);
}
function normalizeLabel(value) {
    const label = (value ?? 'Mobile device').normalize('NFC').trim();
    if (label.length < 1 || label.length > 64 || /[\u0000-\u001f\u007f]/u.test(label)) {
        throw new AccessError(400, 'invalid_request');
    }
    return label;
}
function publicDevice(device) {
    return Object.freeze({
        id: device.id,
        label: device.label,
        createdAt: device.createdAt,
        expiresAt: device.expiresAt,
        lastSeenAt: device.lastSeenAt,
        ...device.revokedAt === undefined ? {} : {
            revokedAt: device.revokedAt
        }
    });
}
export class AccessController {
    store;
    options;
    now;
    pairLimiter;
    devices = [];
    pairingWindow;
    pairPending = false;
    sessions = new Map();
    sessionEndedListeners = new Set();
    mutation = Promise.resolve();
    initialized = false;
    hostId;
    closing = false;
    closeTask;
    constructor(store, options){
        this.store = store;
        this.options = options;
        this.now = options.now ?? Date.now;
        this.pairLimiter = new BoundedRateLimiter(options.maxPairingAttempts, options.rateLimitWindowMs, options.maxRateLimitKeys);
    }
    async initialize() {
        if (this.initialized || this.closing) throw new Error('access controller cannot be initialized again');
        const snapshot = await this.store.load();
        const devices = snapshot.devices.filter((device)=>device.revokedAt === undefined);
        if (devices.length > this.options.maxDevices) throw new Error('device state exceeds configured maxDevices');
        // Persist identity with the device store so moving that store does not
        // silently turn a paired computer into a different host. Preserve the
        // old native identity when upgrading an existing installation.
        this.hostId = snapshot.hostId ?? devices.find(device => device.nativeInstanceId)?.nativeInstanceId
            ?? this.options.legacyInstanceId ?? this.options.pairingInstanceId ?? randomBytes(32).toString('hex');
        if (devices.length !== snapshot.devices.length || snapshot.hostId === undefined) await this.store.save(this.snapshot(devices));
        this.devices = devices;
        this.initialized = true;
    }
    requireInitialized() {
        if (!this.initialized || this.closing) throw new Error('access controller is not available');
    }
    async exclusive(operation) {
        const prior = this.mutation;
        let release;
        this.mutation = new Promise((resolve)=>{
            release = resolve;
        });
        await prior;
        try {
            return await operation();
        } finally{
            release();
        }
    }
    snapshot(devices) {
        return Object.freeze({
            version: 2,
            hostId: this.hostId,
            devices: Object.freeze([
                ...devices
            ])
        });
    }
    nativeIdentity(device) {
        const nativeInstanceId = device.nativeInstanceId ?? this.options.legacyInstanceId ?? this.options.pairingInstanceId;
        return nativeInstanceId === undefined ? {} : {
            nativeInstanceId
        };
    }
    emitSessionEnded(session, reason) {
        const authorization = Object.freeze({
            sessionKey: session.key,
            deviceId: session.deviceId,
            expiresAt: session.expiresAt
        });
        for (const listener of this.sessionEndedListeners)listener(authorization, reason);
    }
    removeSession(key, reason) {
        const session = this.sessions.get(key);
        if (session === undefined) return;
        this.sessions.delete(key);
        this.emitSessionEnded(session, reason);
    }
    pruneSessions(now) {
        for (const [key, session] of this.sessions){
            if (session.expiresAt <= now) this.removeSession(key, 'expired');
        }
    }
    createSession(device, now) {
        this.pruneSessions(now);
        if (this.sessions.size >= this.options.maxSessions) {
            const oldest = [
                ...this.sessions.values()
            ].sort((left, right)=>left.createdAt - right.createdAt)[0];
            if (oldest !== undefined) this.removeSession(oldest.key, 'evicted');
        }
        const sessionToken = opaqueToken();
        const csrfToken = opaqueToken();
        const key = digestHex(sessionToken);
        const record = Object.freeze({
            key,
            deviceId: device.id,
            csrfDigest: digest(csrfToken),
            createdAt: now,
            expiresAt: Math.min(now + this.options.sessionTtlMs, device.expiresAt)
        });
        this.sessions.set(key, record);
        return Object.freeze({
            ...this.nativeIdentity(device),
            deviceId: device.id,
            deviceExpiresAt: device.expiresAt,
            sessionToken,
            csrfToken,
            sessionExpiresAt: record.expiresAt
        });
    }
    async openPairing(requestedTtlMs) {
        this.requireInitialized();
        return this.exclusive(async ()=>{
            const ttl = requestedTtlMs ?? this.options.pairingTtlMs;
            if (!Number.isSafeInteger(ttl) || ttl < 10_000 || ttl > this.options.pairingTtlMs) {
                throw new AccessError(400, 'invalid_request');
            }
            const token = opaqueToken();
            const expiresAt = this.now() + ttl;
            this.pairingWindow = Object.freeze({
                digest: digest(token),
                expiresAt
            });
            return Object.freeze({
                token,
                expiresAt
            });
        });
    }
    rejectPairingAttempt(sourceKey, now) {
        if (!this.pairLimiter.take(sourceKey, now)) throw new AccessError(429, 'rate_limited');
        throw new AccessError(401, 'authentication_failed');
    }
    async pair(sourceKey, token, label) {
        this.requireInitialized();
        const initialNow = this.now();
        const initialWindow = this.pairingWindow;
        if (token.length > 512 || initialWindow === undefined || initialWindow.expiresAt <= initialNow || !matchesDigest(token, initialWindow.digest)) {
            this.rejectPairingAttempt(sourceKey, initialNow);
        }
        if (this.pairPending) throw new AccessError(429, 'rate_limited');
        this.pairPending = true;
        try {
            return await this.exclusive(async ()=>{
                const now = this.now();
                const window = this.pairingWindow;
                if (window === undefined || window.expiresAt <= now || !matchesDigest(token, window.digest)) {
                    if (window !== undefined && window.expiresAt <= now) this.pairingWindow = undefined;
                    this.rejectPairingAttempt(sourceKey, now);
                }
                this.pairingWindow = undefined;
                const active = this.devices.filter((device)=>device.revokedAt === undefined && device.expiresAt > now);
                if (active.length >= this.options.maxDevices) throw new AccessError(409, 'device_limit');
                const deviceToken = opaqueToken();
                const device = Object.freeze({
                    id: randomBytes(16).toString('hex'),
                    label: normalizeLabel(label),
                    tokenDigest: digestHex(deviceToken),
                    createdAt: now,
                    expiresAt: now + this.options.deviceTtlMs,
                    lastSeenAt: now,
                    ...this.options.pairingInstanceId === undefined ? {} : {
                        nativeInstanceId: this.options.pairingInstanceId
                    }
                });
                const retained = this.devices.filter((candidate)=>candidate.revokedAt === undefined && candidate.expiresAt > now);
                const next = [
                    ...retained,
                    device
                ];
                await this.store.save(this.snapshot(next));
                this.devices = next;
                const session = this.createSession(device, now);
                return Object.freeze({
                    ...session,
                    deviceToken,
                    deviceExpiresAt: device.expiresAt
                });
            });
        } finally{
            this.pairPending = false;
        }
    }
    async renew(deviceToken) {
        this.requireInitialized();
        return this.exclusive(async ()=>{
            const now = this.now();
            const device = this.requireDevice(deviceToken, now);
            const index = this.devices.indexOf(device);
            const updated = Object.freeze({
                ...device,
                lastSeenAt: now
            });
            const next = [
                ...this.devices
            ];
            next[index] = updated;
            await this.store.save(this.snapshot(next));
            this.devices = next;
            return this.createSession(device, now);
        });
    }
    async probe(deviceToken) {
        this.requireInitialized();
        return this.exclusive(async ()=>{
            const now = this.now();
            const device = this.requireDevice(deviceToken, now);
            const index = this.devices.indexOf(device);
            const updated = Object.freeze({
                ...device,
                lastSeenAt: now
            });
            const next = [
                ...this.devices
            ];
            next[index] = updated;
            await this.store.save(this.snapshot(next));
            this.devices = next;
            return Object.freeze({
                ...this.nativeIdentity(device),
                deviceId: device.id,
                deviceExpiresAt: device.expiresAt
            });
        });
    }
    authorizeDevice(deviceToken) {
        this.requireInitialized();
        const device = this.requireDevice(deviceToken, this.now());
        return Object.freeze({
            ...this.nativeIdentity(device),
            deviceId: device.id,
            deviceExpiresAt: device.expiresAt
        });
    }
    requireDevice(deviceToken, now) {
        if (deviceToken.length > 512) throw new AccessError(401, 'authentication_failed');
        const tokenDigest = digest(deviceToken);
        const device = this.devices.find((candidate)=>timingSafeEqual(Buffer.from(candidate.tokenDigest, 'hex'), tokenDigest));
        if (device === undefined) throw new AccessError(401, 'authentication_failed');
        if (device.revokedAt !== undefined) throw new AccessError(401, 'device_revoked');
        if (device.expiresAt <= now) throw new AccessError(401, 'device_expired');
        return device;
    }
    authorizeSession(sessionToken) {
        this.requireInitialized();
        if (sessionToken.length > 512) throw new AccessError(401, 'authentication_failed');
        const now = this.now();
        this.pruneSessions(now);
        const key = digestHex(sessionToken);
        const session = this.sessions.get(key);
        const device = session === undefined ? undefined : this.devices.find((candidate)=>candidate.id === session.deviceId);
        if (session === undefined || device === undefined || device.revokedAt !== undefined || device.expiresAt <= now) {
            if (session !== undefined) this.removeSession(session.key, 'expired');
            throw new AccessError(401, 'authentication_failed');
        }
        return Object.freeze({
            sessionKey: key,
            deviceId: session.deviceId,
            deviceExpiresAt: device.expiresAt,
            expiresAt: session.expiresAt
        });
    }
    assertCsrf(authorization, csrfToken) {
        const session = this.sessions.get(authorization.sessionKey);
        if (session === undefined || csrfToken === undefined || csrfToken.length > 512 || !matchesDigest(csrfToken, session.csrfDigest)) {
            throw new AccessError(403, 'forbidden');
        }
    }
    logout(authorization) {
        this.removeSession(authorization.sessionKey, 'logout');
    }
    async revokeDevice(deviceId) {
        this.requireInitialized();
        return this.exclusive(async ()=>{
            const next = this.devices.filter((device)=>device.id !== deviceId);
            if (next.length === this.devices.length) return false;
            await this.store.save(this.snapshot(next));
            this.devices = next;
            for (const [key, session] of this.sessions){
                if (session.deviceId === deviceId) this.removeSession(key, 'revoked');
            }
            return true;
        });
    }
    async resetDevices() {
        this.requireInitialized();
        await this.exclusive(async ()=>{
            await this.store.save(this.snapshot([]));
            this.devices = [];
            for (const key of [
                ...this.sessions.keys()
            ])this.removeSession(key, 'revoked');
            this.pairingWindow = undefined;
        });
    }
    listDevices() {
        this.requireInitialized();
        return Object.freeze(this.devices.map(publicDevice));
    }
    pairingStatus() {
        this.requireInitialized();
        const window = this.pairingWindow;
        if (window === undefined || window.expiresAt <= this.now()) {
            this.pairingWindow = undefined;
            return Object.freeze({
                open: false
            });
        }
        return Object.freeze({
            open: true,
            expiresAt: window.expiresAt
        });
    }
    onSessionEnded(listener) {
        this.sessionEndedListeners.add(listener);
        return ()=>{
            this.sessionEndedListeners.delete(listener);
        };
    }
    close() {
        if (this.closeTask !== undefined) return this.closeTask;
        this.closing = true;
        this.closeTask = this.finishClose();
        return this.closeTask;
    }
    async finishClose() {
        await this.mutation;
        this.pairingWindow = undefined;
        for (const key of [
            ...this.sessions.keys()
        ])this.removeSession(key, 'expired');
        this.sessionEndedListeners.clear();
        this.initialized = false;
    }
    metrics() {
        return Object.freeze({
            sessions: this.sessions.size,
            rateLimitKeys: this.pairLimiter.size
        });
    }
}
