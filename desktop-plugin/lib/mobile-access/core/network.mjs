// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
import { connect } from 'node:net';
import { isIP } from './ip.mjs';
function parseIpv4(address) {
    const parts = address.split('.');
    if (parts.length !== 4) throw new Error(`invalid IPv4 address ${JSON.stringify(address)}`);
    let value = 0n;
    for (const part of parts){
        if (!/^\d{1,3}$/u.test(part)) throw new Error(`invalid IPv4 address ${JSON.stringify(address)}`);
        const octet = Number(part);
        if (octet > 255) throw new Error(`invalid IPv4 address ${JSON.stringify(address)}`);
        value = value << 8n | BigInt(octet);
    }
    return value;
}
function parseIpv6Part(part, address) {
    if (part.includes('.')) {
        const ipv4 = parseIpv4(part);
        return [
            Number(ipv4 >> 16n & 0xffffn),
            Number(ipv4 & 0xffffn)
        ];
    }
    if (!/^[\da-f]{1,4}$/iu.test(part)) throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
    return [
        Number.parseInt(part, 16)
    ];
}
function parseIpv6(address) {
    const withoutZone = address.split('%', 1)[0] ?? address;
    if (withoutZone.split('::').length > 2) throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
    const [leftText, rightText] = withoutZone.split('::');
    const left = leftText === '' ? [] : leftText.split(':').flatMap((part)=>parseIpv6Part(part, address));
    const right = rightText === undefined || rightText === '' ? [] : rightText.split(':').flatMap((part)=>parseIpv6Part(part, address));
    const omitted = 8 - left.length - right.length;
    if (rightText === undefined ? omitted !== 0 : omitted < 1) {
        throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
    }
    const groups = [
        ...left,
        ...Array.from({
            length: omitted
        }, ()=>0),
        ...right
    ];
    if (groups.length !== 8) throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
    return groups.reduce((value, group)=>value << 16n | BigInt(group), 0n);
}
function mappedIpv4(address) {
    const match = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(address);
    return match?.[1];
}
function parseIp(address) {
    const unwrapped = address.startsWith('[') && address.endsWith(']') ? address.slice(1, -1) : address;
    const mapped = mappedIpv4(unwrapped);
    if (mapped !== undefined) return {
        bits: 32,
        value: parseIpv4(mapped)
    };
    const version = isIP(unwrapped.split('%', 1)[0] ?? unwrapped);
    if (version === 4) return {
        bits: 32,
        value: parseIpv4(unwrapped)
    };
    if (version === 6) return {
        bits: 128,
        value: parseIpv6(unwrapped)
    };
    throw new Error(`invalid IP address ${JSON.stringify(address)}`);
}
export function parseCidr(source) {
    const slash = source.lastIndexOf('/');
    if (slash <= 0 || slash === source.length - 1) throw new Error(`invalid CIDR ${JSON.stringify(source)}`);
    const address = source.slice(0, slash);
    const parsed = parseIp(address);
    const prefixText = source.slice(slash + 1);
    if (!/^\d{1,3}$/u.test(prefixText)) throw new Error(`invalid CIDR ${JSON.stringify(source)}`);
    const prefix = Number(prefixText);
    if (prefix > parsed.bits) throw new Error(`invalid CIDR ${JSON.stringify(source)}`);
    const hostBits = BigInt(parsed.bits - prefix);
    const mask = hostBits === BigInt(parsed.bits) ? 0n : (1n << BigInt(parsed.bits)) - 1n ^ (1n << hostBits) - 1n;
    const network = parsed.value & mask;
    if (network !== parsed.value) {
        throw new Error(`CIDR ${JSON.stringify(source)} has host bits set`);
    }
    return Object.freeze({
        bits: parsed.bits,
        network,
        prefix,
        source
    });
}
export function addressAllowed(address, cidrs) {
    if (address === undefined) return false;
    let parsed;
    try {
        parsed = parseIp(address);
    } catch  {
        return false;
    }
    return cidrs.some((cidr)=>{
        if (cidr.bits !== parsed.bits) return false;
        const hostBits = BigInt(cidr.bits - cidr.prefix);
        const mask = hostBits === BigInt(cidr.bits) ? 0n : (1n << BigInt(cidr.bits)) - 1n ^ (1n << hostBits) - 1n;
        return (parsed.value & mask) === cidr.network;
    });
}
export function isLoopbackAddress(address) {
    try {
        const parsed = parseIp(address);
        if (parsed.bits === 32) return parsed.value >> 24n === 127n;
        return parsed.value === 1n;
    } catch  {
        return false;
    }
}
const NON_ROUTABLE_IPV4_RANGES = Object.freeze([
    [
        0x00000000n,
        8
    ],
    [
        0x0a000000n,
        8
    ],
    [
        0x64400000n,
        10
    ],
    [
        0x7f000000n,
        8
    ],
    [
        0xa9fe0000n,
        16
    ],
    [
        0xac100000n,
        12
    ],
    [
        0xc0000000n,
        24
    ],
    [
        0xc0000200n,
        24
    ],
    [
        0xc01fc400n,
        24
    ],
    [
        0xc034c100n,
        24
    ],
    [
        0xc0586300n,
        24
    ],
    [
        0xc0a80000n,
        16
    ],
    [
        0xc0af3000n,
        24
    ],
    [
        0xc6120000n,
        15
    ],
    [
        0xc6336400n,
        24
    ],
    [
        0xcb007100n,
        24
    ],
    [
        0xe0000000n,
        4
    ],
    [
        0xf0000000n,
        4
    ]
]);
function parseStrictIpv4Octets(address) {
    const parts = address.split('.');
    if (parts.length !== 4) return undefined;
    const octets = [];
    for (const part of parts){
        if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return undefined;
        const octet = Number(part);
        if (octet > 255) return undefined;
        octets.push(octet);
    }
    return octets;
}
export function isGloballyRoutableIpv4(address) {
    const octets = parseStrictIpv4Octets(address);
    if (octets === undefined) return false;
    const value = BigInt(octets[0]) << 24n | BigInt(octets[1]) << 16n | BigInt(octets[2]) << 8n | BigInt(octets[3]);
    return !NON_ROUTABLE_IPV4_RANGES.some(([network, prefix])=>{
        if (prefix === 0) return true;
        const hostBits = BigInt(32 - prefix);
        const mask = (1n << 32n) - 1n ^ (1n << hostBits) - 1n;
        return (value & mask) === network;
    });
}
export function parseAuthority(source) {
    if (source.trim() !== source || source.length === 0 || /[/?#@\\]/u.test(source)) {
        throw new Error(`invalid public authority ${JSON.stringify(source)}`);
    }
    let url;
    try {
        url = new URL(`https://${source}`);
    } catch  {
        throw new Error(`invalid public authority ${JSON.stringify(source)}`);
    }
    if (url.username !== '' || url.password !== '' || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
        throw new Error(`invalid public authority ${JSON.stringify(source)}`);
    }
    const explicitPort = /\]:\d+$/u.test(source) || !source.startsWith('[') && /:\d+$/u.test(source);
    const hostname = url.hostname.toLowerCase();
    const port = explicitPort ? Number(url.port === '' ? 443 : url.port) : undefined;
    if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
        throw new Error(`invalid public authority ${JSON.stringify(source)}`);
    }
    return port === undefined ? Object.freeze({
        hostname
    }) : Object.freeze({
        hostname,
        port
    });
}
function formatHostname(hostname) {
    return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}
export function resolveAuthority(spec, listenerPort) {
    return `${formatHostname(spec.hostname)}:${String(spec.port ?? listenerPort)}`;
}
export class RequestTrustPolicy {
    cidrs;
    authorities;
    origins;
    scheme;
    constructor(specs, listenerPort, cidrs, tls){
        this.cidrs = cidrs;
        this.scheme = tls ? 'https' : 'http';
        this.authorities = new Set(specs.map((spec)=>resolveAuthority(spec, listenerPort).toLowerCase()));
        this.origins = new Set([
            ...this.authorities
        ].map((authority)=>new URL(`${this.scheme}://${authority}`).origin.toLowerCase()));
    }
    acceptsHost(header) {
        return this.canonicalHost(header) !== undefined;
    }
    canonicalHost(header) {
        if (header === undefined || /[/?#@\\]/u.test(header)) return undefined;
        let normalized;
        try {
            const parsed = new URL(`${this.scheme}://${header}`);
            if (parsed.pathname !== '/' || parsed.username !== '' || parsed.password !== '') return undefined;
            normalized = resolveAuthority({
                hostname: parsed.hostname,
                port: Number(parsed.port || (this.scheme === 'https' ? '443' : '80'))
            }, 80).toLowerCase();
        } catch  {
            return undefined;
        }
        return this.authorities.has(normalized) ? normalized : undefined;
    }
    acceptsOrigin(header) {
        return this.canonicalOrigin(header) !== undefined;
    }
    canonicalOrigin(header) {
        if (header === undefined) return undefined;
        let normalized;
        for (const part of header.split(',')){
            const trimmed = part.trim();
            if (trimmed === 'undefined') continue;
            let candidate;
            try {
                const parsed = new URL(trimmed);
                if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '' || parsed.username !== '' || parsed.password !== '') {
                    return undefined;
                }
                candidate = parsed.origin.toLowerCase();
            } catch  {
                return undefined;
            }
            if (!this.origins.has(candidate) || normalized !== undefined) return undefined;
            normalized = candidate;
        }
        return normalized;
    }
}
export async function probeTcpReachable(host, port, timeoutMs = 1_500) {
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) return false;
    return new Promise((resolveProbe)=>{
        let finished = false;
        const socket = connect({
            host,
            port
        });
        const finish = (reachable)=>{
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            socket.destroy();
            resolveProbe(reachable);
        };
        const timer = setTimeout(()=>{
            finish(false);
        }, timeoutMs);
        timer.unref();
        socket.once('connect', ()=>{
            finish(true);
        });
        socket.once('error', ()=>{
            finish(false);
        });
        socket.once('close', ()=>{
            finish(false);
        });
    });
}
