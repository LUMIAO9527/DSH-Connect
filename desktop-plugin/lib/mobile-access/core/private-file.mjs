// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { chmod } from 'node:fs/promises';
import { win32 } from 'node:path';
import { performance } from 'node:perf_hooks';
import { execFileText as execFile } from './exec-file.mjs';
let userSidTask;
function commandFailureDetails(error) {
    if (error === null || typeof error !== 'object') return {};
    let descriptors;
    try {
        descriptors = Object.getOwnPropertyDescriptors(error);
    } catch (_error) {
        return {};
    }
    const code = descriptors.code?.value;
    const signal = descriptors.signal?.value;
    const killed = descriptors.killed?.value;
    return {
        ...code === null || typeof code === 'number' && Number.isSafeInteger(code) || typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(code) ? {
            code
        } : {},
        ...signal === null || typeof signal === 'string' && /^SIG[A-Z0-9]{1,16}$/u.test(signal) ? {
            signal
        } : {},
        ...typeof killed === 'boolean' ? {
            killed
        } : {}
    };
}
export class PrivateFilePermissionError extends Error {
    stage;
    elapsedMs;
    code;
    signal;
    killed;
    constructor(stage, elapsedMs, error){
        const details = commandFailureDetails(error);
        const fields = [
            ...details.code === undefined ? [] : [
                `code=${String(details.code)}`
            ],
            ...details.signal === undefined ? [] : [
                `signal=${String(details.signal)}`
            ],
            ...details.killed === undefined ? [] : [
                `killed=${String(details.killed)}`
            ]
        ];
        const summary = `Windows private-file ${stage} failed after ${String(elapsedMs)} ms${fields.length === 0 ? '' : ` (${fields.join(', ')})`}`;
        const cause = Object.assign(new Error('Windows permission operation failed'), details);
        super(summary, {
            cause
        }), this.stage = stage, this.elapsedMs = elapsedMs;
        this.name = 'PrivateFilePermissionError';
        this.code = details.code;
        this.signal = details.signal;
        this.killed = details.killed;
    }
}
async function permissionOperation(stage, operation) {
    const started = performance.now();
    try {
        return await operation();
    } catch (error) {
        throw new PrivateFilePermissionError(stage, Math.max(0, Math.round(performance.now() - started)), error);
    }
}
function windowsSystemTool(name) {
    const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
    if (systemRoot === undefined || !win32.isAbsolute(systemRoot)) {
        throw Object.assign(new Error('Windows system root is unavailable'), {
            code: 'WINDOWS_SYSTEM_ROOT_UNAVAILABLE'
        });
    }
    return win32.join(systemRoot, 'System32', name);
}
async function currentWindowsUserSid() {
    userSidTask ??= permissionOperation('sid-query', async ()=>{
        const { stdout } = await execFile(windowsSystemTool('whoami.exe'), [
            '/user',
            '/fo',
            'csv',
            '/nh'
        ], {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 10_000
        });
        const match = /,"(S-\d(?:-\d+)+)"\s*$/u.exec(stdout.trim());
        if (match?.[1] === undefined) throw Object.assign(new Error('unable to resolve the current Windows user SID'), {
            code: 'WINDOWS_USER_SID_INVALID'
        });
        return match[1];
    }).catch((error)=>{
        userSidTask = undefined;
        throw error;
    });
    return userSidTask;
}
export async function restrictPrivateFile(file, mode = 0o600) {
    await chmod(file, mode);
    if (process.platform !== 'win32') return;
    const userSid = await currentWindowsUserSid();
    await permissionOperation('acl-apply', ()=>execFile(windowsSystemTool('icacls.exe'), [
            file,
            '/inheritance:r',
            '/grant:r',
            `*${userSid}:(F)`,
            '*S-1-5-18:(F)',
            '*S-1-5-32-544:(F)',
            '/remove:g',
            '*S-1-1-0',
            '*S-1-5-11',
            '*S-1-5-32-545'
        ], {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 10_000
        }));
}
