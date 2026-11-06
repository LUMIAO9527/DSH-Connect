import { createPrivateKey, generateKeyPair, randomBytes, randomUUID, X509Certificate } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { isIPv4 } from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { addressAllowed, parseCidr } from './core/network.mjs';
import { restrictPrivateFile } from './core/private-file.mjs';

const privateCidrs = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'].map(parseCidr);
const virtualAdapter = /tailscale|vpn|loopback|virtual|vethernet|vmware|hyper-v|wsl|wireguard|zerotier|docker|\btun\d*\b|\btap\d*\b/i;

export function isPrivateSubnet(host, subnet) {
  return isIPv4(host) && subnet.bits === 32 && addressAllowed(host, [subnet])
    && privateCidrs.some(range => subnet.prefix >= range.prefix && addressAllowed(host, [range]));
}

export function localNetworkAddress(interfaces = networkInterfaces()) {
  const candidates = new Map();
  for (const [adapter, addresses] of Object.entries(interfaces)) {
    if (virtualAdapter.test(adapter)) continue;
    for (const entry of addresses ?? []) {
      if (entry.internal || !isIPv4(entry.address) || !entry.cidr) continue;
      const prefix = Number(entry.cidr.split('/')[1]);
      const range = privateCidrs.find(cidr => addressAllowed(entry.address, [cidr]));
      if (!range || !Number.isInteger(prefix) || prefix < range.prefix || prefix > 30) continue;
      const octets = entry.address.split('.').map(Number);
      const network = octets.map((octet, index) => {
        const bits = Math.max(0, Math.min(8, prefix - index * 8));
        return octet & (256 - 2 ** (8 - bits));
      });
      candidates.set(entry.address, { host: entry.address, cidr: network.join('.') + '/' + prefix });
    }
  }
  return candidates.size === 1 ? candidates.values().next().value : undefined;
}

export async function createLanCertificate(host) {
  if (!isIPv4(host)) throw new Error('LAN certificate requires an IPv4 address');
  const { default: forge } = await import('node-forge');
  const { publicKey, privateKey } = await promisify(generateKeyPair)('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = forge.pki.publicKeyFromPem(publicKey);
  certificate.serialNumber = '01' + randomBytes(15).toString('hex');
  certificate.validity.notBefore = new Date(Date.now() - 86400000);
  certificate.validity.notAfter = new Date(Date.now() + 5 * 365 * 86400000);
  const subject = [{ name: 'commonName', value: host }];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 7, ip: host }] },
  ]);
  certificate.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());
  return { key: privateKey, cert: forge.pki.certificateToPem(certificate) };
}

export async function localNetworkIdentity(file, host) {
  let saved;
  try {
    const metadata = await lstat(file);
    if (!metadata.isFile() || metadata.size > 16384) throw new Error('Invalid LAN identity file');
    await restrictPrivateFile(file);
    saved = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const current = saved && new X509Certificate(saved.cert);
  if (current && !current.checkPrivateKey(createPrivateKey(saved.key))) throw new Error('LAN identity key does not match its certificate');
  if (!current || !current.checkIP(host) || Date.parse(current.validTo) <= Date.now()) {
    saved = await createLanCertificate(host);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const temporary = file + '.' + randomUUID() + '.tmp';
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await restrictPrivateFile(temporary);
      await handle.writeFile(JSON.stringify(saved));
      await handle.sync();
      await handle.close();
      await rename(temporary, file);
    } finally {
      await handle.close();
      await rm(temporary, { force: true });
    }
  }
  return { ...saved, fingerprint: new X509Certificate(saved.cert).fingerprint256.replaceAll(':', '').toLowerCase() };
}
