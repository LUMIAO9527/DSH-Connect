// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { restrictPrivateFile } from './private-file.mjs';
function assertInteger(value, name) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`device state ${name} must be a non-negative integer`);
    }
}
function parseDevice(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('device state contains an invalid device');
    const record = value;
    if (typeof record.id !== 'string' || !/^[a-f\d]{32}$/u.test(record.id)) throw new Error('device state contains an invalid id');
    if (typeof record.label !== 'string' || record.label.length < 1 || record.label.length > 64 || /[\u0000-\u001f\u007f]/u.test(record.label)) {
        throw new Error('device state contains an invalid label');
    }
    if (typeof record.tokenDigest !== 'string' || !/^[a-f\d]{64}$/u.test(record.tokenDigest)) {
        throw new Error('device state contains an invalid credential digest');
    }
    if (record.nativeInstanceId !== undefined && (typeof record.nativeInstanceId !== 'string' || !/^[a-f\d]{64}$/u.test(record.nativeInstanceId))) {
        throw new Error('device state contains an invalid native instance id');
    }
    assertInteger(record.createdAt, 'createdAt');
    assertInteger(record.expiresAt, 'expiresAt');
    assertInteger(record.lastSeenAt, 'lastSeenAt');
    if (record.revokedAt !== undefined) assertInteger(record.revokedAt, 'revokedAt');
    if (record.expiresAt <= record.createdAt || record.lastSeenAt < record.createdAt) {
        throw new Error('device state contains inconsistent timestamps');
    }
    return Object.freeze({
        id: record.id,
        label: record.label,
        tokenDigest: record.tokenDigest,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        lastSeenAt: record.lastSeenAt,
        ...record.nativeInstanceId === undefined ? {} : {
            nativeInstanceId: record.nativeInstanceId
        },
        ...record.revokedAt === undefined ? {} : {
            revokedAt: record.revokedAt
        }
    });
}
export function parseDeviceSnapshot(value, maximumDevices = 256) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('device state must be an object');
    const snapshot = value;
    if (snapshot.version !== 1 && snapshot.version !== 2 || !Array.isArray(snapshot.devices) || snapshot.devices.length > maximumDevices) {
        throw new Error('device state has an unsupported version or device count');
    }
    const devices = snapshot.devices.map(parseDevice);
    if (snapshot.hostId !== undefined && (typeof snapshot.hostId !== 'string' || !/^[a-f\d]{64}$/u.test(snapshot.hostId))) {
        throw new Error('device state contains an invalid host identity');
    }
    if (new Set(devices.map((device)=>device.id)).size !== devices.length || new Set(devices.map((device)=>device.tokenDigest)).size !== devices.length) {
        throw new Error('device state contains duplicate device identities');
    }
    return Object.freeze({
        version: snapshot.version,
        ...snapshot.hostId === undefined ? {} : { hostId: snapshot.hostId },
        devices: Object.freeze(devices)
    });
}
function snapshotForSave(snapshot, maximumDevices) {
    const validated = parseDeviceSnapshot(snapshot, maximumDevices);
    return Object.freeze({
        version: 2,
        ...validated.hostId === undefined ? {} : { hostId: validated.hostId },
        devices: validated.devices
    });
}
export class JsonDeviceStore {
    file;
    maximumDevices;
    constructor(file, maximumDevices = 256){
        this.file = file;
        this.maximumDevices = maximumDevices;
    }
    async load() {
        let stat;
        try {
            stat = await lstat(this.file);
        } catch (error) {
            if (error.code === 'ENOENT') return Object.freeze({
                version: 1,
                devices: Object.freeze([])
            });
            throw error;
        }
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) {
            throw new Error('device state must be a regular file no larger than 1 MiB');
        }
        await restrictPrivateFile(this.file);
        let parsed;
        try {
            parsed = JSON.parse(await readFile(this.file, 'utf8'));
        } catch (error) {
            throw new Error('device state is not valid JSON', {
                cause: error
            });
        }
        return parseDeviceSnapshot(parsed, this.maximumDevices);
    }
    async save(snapshot) {
        const validated = snapshotForSave(snapshot, this.maximumDevices);
        const directory = dirname(this.file);
        await mkdir(directory, {
            recursive: true,
            mode: 0o700
        });
        try {
            const current = await lstat(this.file);
            if (!current.isFile() || current.isSymbolicLink()) throw new Error('device state target must remain a regular file');
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        const temporary = join(directory, `.${basename(this.file)}.${randomBytes(12).toString('hex')}.tmp`);
        try {
            await writeFile(temporary, `${JSON.stringify(validated)}\n`, {
                encoding: 'utf8',
                flag: 'wx',
                mode: 0o600
            });
            await rename(temporary, this.file);
            await restrictPrivateFile(this.file);
        } catch (error) {
            try {
                await rm(temporary, {
                    force: true
                });
            } catch (cleanupError) {
                throw new AggregateError([
                    error,
                    cleanupError
                ], 'device state write and temporary cleanup both failed');
            }
            throw error;
        }
    }
}
export class MemoryDeviceStore {
    snapshot;
    constructor(initial = {
        version: 1,
        devices: []
    }){
        this.snapshot = parseDeviceSnapshot(initial);
    }
    async load() {
        return structuredClone(this.snapshot);
    }
    async save(snapshot) {
        this.snapshot = structuredClone(snapshotForSave(snapshot));
    }
    inspect() {
        return structuredClone(this.snapshot);
    }
}
