// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { AccessError } from './access.mjs';
import { CSRF_COOKIE, DEVICE_COOKIE, HttpError, SESSION_COOKIE } from './http-security.mjs';
export const HOST_SESSION_COOKIE = '__Host-dsh_ma_session';
export const HOST_CSRF_COOKIE = '__Host-dsh_ma_csrf';
export const HOST_DEVICE_COOKIE = '__Host-dsh_ma_device_id';
const AUTH_COOKIE_NAMES = new Set([
    SESSION_COOKIE,
    DEVICE_COOKIE,
    CSRF_COOKIE,
    HOST_SESSION_COOKIE,
    HOST_CSRF_COOKIE,
    HOST_DEVICE_COOKIE
]);
export function browserAuthCookies(header) {
    if (header === undefined) return new Map();
    if (header.length > 8192) throw new HttpError(401, 'authentication_failed');
    const cookies = new Map();
    for (const part of header.split(';')){
        const equals = part.indexOf('=');
        if (equals <= 0) continue;
        const name = part.slice(0, equals).trim();
        if (!AUTH_COOKIE_NAMES.has(name)) continue;
        const values = cookies.get(name) ?? [];
        cookies.set(name, values);
        const value = part.slice(equals + 1).trim();
        if (!/^[\w\-.~+/=]{1,512}$/u.test(value) || values.includes(value)) continue;
        values.push(value);
    }
    return cookies;
}
export function authenticatedCookie(values, authenticate, accepts = ()=>true) {
    let selected;
    for (const value of values){
        let result;
        try {
            result = authenticate(value);
        } catch (error) {
            if (error instanceof AccessError && error.status === 401) continue;
            throw error;
        }
        if (!accepts(result)) continue;
        if (selected !== undefined) throw new HttpError(401, 'authentication_failed');
        selected = {
            value,
            result
        };
    }
    if (selected === undefined) throw new HttpError(401, 'authentication_failed');
    return selected;
}
