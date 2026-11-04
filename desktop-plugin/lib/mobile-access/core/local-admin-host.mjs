// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
export const DESKTOP_ADMIN_HEADER = 'x-dsh-mobile-desktop-admin';
export const DESKTOP_ADMIN_MARKER = 'dsh-app://app';
export const WEB_ADMIN_HEADER = 'x-dsh-mobile-web-admin';
export const WEB_ADMIN_MARKER = 'same-origin-json';
export function localAdminRequestHeaders(init, location) {
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    headers.delete(DESKTOP_ADMIN_HEADER);
    headers.delete(WEB_ADMIN_HEADER);
    if (init?.method?.toUpperCase() === 'POST' && location.protocol === 'dsh-app:' && location.hostname === 'app') {
        headers.set(DESKTOP_ADMIN_HEADER, DESKTOP_ADMIN_MARKER);
    } else if (init?.method?.toUpperCase() === 'POST' && (location.protocol === 'http:' || location.protocol === 'https:') && isLocalAdminHostname(location.hostname) && headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json') {
        headers.set(WEB_ADMIN_HEADER, WEB_ADMIN_MARKER);
    }
    return headers;
}
function unwrapBrackets(hostname) {
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}
function parseIpv4(hostname) {
    const parts = hostname.split('.');
    if (parts.length !== 4) return undefined;
    const octets = [];
    for (const part of parts){
        if (!/^(?:0|[1-9]\d{0,2})$/u.test(part)) return undefined;
        const value = Number(part);
        if (value > 255) return undefined;
        octets.push(value);
    }
    return octets;
}
function isLoopbackIpv4(octets) {
    return octets[0] === 127;
}
function isPrivateIpv4(octets) {
    return octets[0] === 10 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168;
}
function isLinkLocalIpv4(octets) {
    return octets[0] === 169 && octets[1] === 254;
}
export function isLocalAdminHostname(hostname) {
    const host = unwrapBrackets(hostname).trim().toLowerCase();
    if (host === 'localhost' || host === '::1') return true;
    const octets = parseIpv4(host);
    if (octets === undefined) return false;
    return isLoopbackIpv4(octets) || isPrivateIpv4(octets) || isLinkLocalIpv4(octets);
}
export function isDesktopAdminSurface(hostname, search = '', frontend, protocol = '') {
    const query = search.startsWith('?') ? search.slice(1) : search;
    return (protocol === 'dsh-app:' ? hostname === 'app' : (protocol === '' || protocol === 'http:' || protocol === 'https:') && isLocalAdminHostname(hostname)) && frontend !== 'dedicated' && !new URLSearchParams(query).has('dsh-mobile-preview');
}
