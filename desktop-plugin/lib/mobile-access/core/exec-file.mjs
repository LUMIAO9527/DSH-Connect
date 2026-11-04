// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { execFile } from 'node:child_process';
export function execFileText(file, args, options = {}) {
    return new Promise((resolve, reject)=>{
        execFile(file, [
            ...args
        ], {
            windowsHide: true,
            ...options,
            encoding: 'utf8'
        }, (error, stdout, stderr)=>{
            if (error !== null) {
                reject(error);
                return;
            }
            if (typeof stdout !== 'string' || typeof stderr !== 'string') {
                reject(new Error('subprocess returned invalid text output'));
                return;
            }
            resolve({
                stdout,
                stderr
            });
        });
    });
}
