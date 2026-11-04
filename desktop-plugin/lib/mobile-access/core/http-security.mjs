// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { addressAllowed, isLoopbackAddress, RequestTrustPolicy } from './network.mjs';
import { DESKTOP_ADMIN_HEADER, DESKTOP_ADMIN_MARKER, WEB_ADMIN_HEADER, WEB_ADMIN_MARKER, isLocalAdminHostname } from './local-admin-host.mjs';
export const DEVICE_COOKIE = 'dsh_ma_device';
export const SESSION_COOKIE = 'dsh_ma_session';
export const CSRF_COOKIE = 'dsh_ma_csrf';
export const CSRF_HEADER = 'x-dsh-mobile-csrf';
export const LOCAL_ADMIN_PREFIX = '/api/mobile-access';
export const AUTH_PREFIX = '/mobile-access';
export const WS_PATHS = new Set([
    '/api/events.mux',
    '/api/events.host',
    '/api/remote.mux',
    '/sidebar/ws/terminal'
]);
export class HttpError extends Error {
    status;
    code;
    constructor(status, code){
        super(code), this.status = status, this.code = code;
        this.name = 'HttpError';
    }
}
export function parseRequestTarget(raw) {
    if (raw === undefined || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f\u007f]/u.test(raw)) {
        throw new HttpError(400, 'bad_request');
    }
    let parsed;
    let decodedPathname;
    try {
        parsed = new URL(raw, 'http://gateway.invalid');
        decodedPathname = decodeURIComponent(parsed.pathname);
    } catch  {
        throw new HttpError(400, 'bad_request');
    }
    if (decodedPathname.includes('\\') || decodedPathname.startsWith('//') || /[\u0000-\u001f\u007f]/u.test(decodedPathname)) {
        throw new HttpError(400, 'bad_request');
    }
    return Object.freeze({
        raw,
        pathname: parsed.pathname,
        decodedPathname,
        search: parsed.search
    });
}
const PROXIED_FRAME_SRC = "frame-src 'self' blob: https: http:";
export function setSecurityHeaders(response, tls, framing = 'gateway', documentRoot) {
    const proxied = framing === 'proxied';
    // Only the explicit mobile document mount may restore DSH's root document
    // base. The caller can supply only a root URL; CSP confines bases to that
    // exact origin (CSP's trailing-slash source also permits same-origin paths).
    // Other directives stay unchanged. The first injected base fixes the root.
    let baseSource = "'none'";
    if (documentRoot !== undefined) {
        const root = new URL(documentRoot);
        if (!proxied || !['http:', 'https:'].includes(root.protocol) || root.href !== root.origin + '/') {
            throw new Error('Invalid gateway document root');
        }
        baseSource = root.href;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        `base-uri ${baseSource}`,
        "object-src 'none'",
        proxied ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        ...proxied ? [
            "media-src 'self' blob:"
        ] : [],
        ...proxied ? [
            PROXIED_FRAME_SRC
        ] : []
    ].join('; '));
    const microphone = proxied ? 'microphone=(self)' : 'microphone=()';
    response.setHeader('Permissions-Policy', `camera=(), ${microphone}, geolocation=(), payment=(), usb=()`);
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', proxied ? 'SAMEORIGIN' : 'DENY');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (tls) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
}
export function sendJson(response, status, value, tls) {
    if (response.headersSent || response.destroyed) return;
    setSecurityHeaders(response, tls);
    const body = `${JSON.stringify(value)}\n`;
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    response.end(body);
}
export function sendFailure(response, status, code, tls) {
    sendJson(response, status, {
        error: code
    }, tls);
}
export async function readJsonObject(request, maximumBytes) {
    const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'application/json') throw new HttpError(415, 'unsupported_media_type');
    const declared = request.headers['content-length'];
    if (declared !== undefined) {
        if (!/^\d+$/u.test(declared) || Number(declared) > maximumBytes) throw new HttpError(413, 'payload_too_large');
    }
    const chunks = [];
    let total = 0;
    for await (const chunk of request){
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maximumBytes) throw new HttpError(413, 'payload_too_large');
        chunks.push(buffer);
    }
    let parsed;
    try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch  {
        throw new HttpError(400, 'bad_request');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new HttpError(400, 'bad_request');
    return parsed;
}
export function parseCookies(header) {
    if (header === undefined) return new Map();
    if (header.length > 8192) return undefined;
    const cookies = new Map();
    for (const part of header.split(';')){
        const equals = part.indexOf('=');
        if (equals <= 0) return undefined;
        const name = part.slice(0, equals).trim();
        const value = part.slice(equals + 1).trim();
        if (!/^[!#$%&'*+\-.^_`|~\dA-Za-z]+$/u.test(name) || !/^[\w\-.~+/=]*$/u.test(value) || cookies.has(name)) {
            return undefined;
        }
        cookies.set(name, value);
    }
    return cookies;
}
export function cookie(name, value, options) {
    const parts = [
        `${name}=${value}`,
        `Path=${options.path}`,
        `Max-Age=${String(Math.max(0, Math.floor(options.maxAgeSeconds)))}`,
        'SameSite=Strict',
        'Priority=High'
    ];
    if (options.tls) parts.push('Secure');
    if (options.httpOnly) parts.push('HttpOnly');
    return parts.join('; ');
}
export function assertExternalTrust(request, policy, requireOrigin) {
    if (!addressAllowed(request.socket.remoteAddress, policy.cidrs) || !policy.acceptsHost(request.headers.host)) {
        throw new HttpError(403, 'forbidden');
    }
    const origin = request.headers.origin;
    if (origin !== undefined && !policy.acceptsOrigin(origin)) throw new HttpError(403, 'forbidden');
    const site = request.headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin' && site !== 'same-site' && site !== 'cross-site' && site !== 'none') throw new HttpError(403, 'forbidden');
    if (requireOrigin && !policy.acceptsOrigin(origin)) throw new HttpError(403, 'forbidden');
}
function localAuthority(header) {
    if (header === undefined || /[/?#@\\]/u.test(header)) return undefined;
    try {
        const url = new URL(`http://${header}`);
        if (url.pathname !== '/' || url.username !== '' || url.password !== '') return undefined;
        return {
            hostname: url.hostname,
            authority: url.host.toLowerCase()
        };
    } catch  {
        return undefined;
    }
}
export function assertLocalAdminTrust(request, requireBrowserOrigin, authenticateDesktop = ()=>false, adminAllowedCidrs = []) {
    const peer = request.socket.remoteAddress;
    const loopback = peer !== undefined && isLoopbackAddress(peer);
    if (!loopback && !addressAllowed(peer, adminAllowedCidrs)) {
        throw new HttpError(403, 'forbidden');
    }
    const host = localAuthority(request.headers.host);
    if (host === undefined || !isLocalAdminHostname(host.hostname)) {
        throw new HttpError(403, 'forbidden');
    }
    if (request.method === 'OPTIONS') throw new HttpError(403, 'forbidden');
    const site = request.headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'forbidden');
    const origin = request.headers.origin;
    if (origin !== undefined) {
        try {
            const parsed = new URL(origin);
            if (parsed.host.toLowerCase() !== host.authority || parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                throw new HttpError(403, 'forbidden');
            }
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(403, 'forbidden');
        }
    }
    const desktopForward = site === undefined && request.headers[DESKTOP_ADMIN_HEADER] === DESKTOP_ADMIN_MARKER;
    const contentType = request.headers['content-type'];
    const webRequest = request.method === 'POST' && (site === undefined || site === 'same-origin') && request.headers[WEB_ADMIN_HEADER] === WEB_ADMIN_MARKER && request.headers[DESKTOP_ADMIN_HEADER] === undefined && typeof contentType === 'string' && contentType.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
    if (requireBrowserOrigin && origin === undefined && !webRequest && !(desktopForward && authenticateDesktop())) {
        throw new HttpError(403, 'forbidden');
    }
    if (requireBrowserOrigin && site !== undefined && site !== 'same-origin') {
        throw new HttpError(403, 'forbidden');
    }
    if (!loopback && !authenticateDesktop()) throw new HttpError(401, 'admin_authentication_required');
}
