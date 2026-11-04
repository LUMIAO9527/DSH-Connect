// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { resolveAuthPageLocale } from './auth-pages.mjs';
const UI_LOCALE_COOKIE = 'dsh_ma_ui_locale';
export function readBrowserUiLocale(cookieHeader) {
    if (cookieHeader === undefined || cookieHeader.length > 8192) return undefined;
    let locale;
    for (const part of cookieHeader.split(';')){
        const separator = part.indexOf('=');
        const name = (separator === -1 ? part : part.slice(0, separator)).trim();
        if (name !== UI_LOCALE_COOKIE) continue;
        const value = separator === -1 ? '' : part.slice(separator + 1).trim();
        if (locale !== undefined || value !== 'en' && value !== 'zh' && value !== 'it') return undefined;
        locale = value;
    }
    return locale;
}
export function resolveBrowserUiLocale(cookieHeader, acceptLanguage) {
    return readBrowserUiLocale(cookieHeader) ?? resolveAuthPageLocale(acceptLanguage);
}
export function browserUiLocaleCookie(locale, secure) {
    return `${UI_LOCALE_COOKIE}=${locale}; Path=/mobile-access; Max-Age=31536000; SameSite=Lax${secure ? '; Secure' : ''}`;
}
