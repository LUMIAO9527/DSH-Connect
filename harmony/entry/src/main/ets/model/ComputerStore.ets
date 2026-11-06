import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { url } from '@kit.ArkTS';

export class Computer {
  id: string = '';
  name: string = '';
  address: string = '';
  lastConnectedAt: number = 0;
  constructor(id: string, name: string, address: string, lastConnectedAt: number = 0) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.lastConnectedAt = lastConnectedAt;
  }
}

export class ConnectionAddress {
  entry: string;
  saved: string;
  origin: string;
  constructor(entry: string, saved: string, origin: string) {
    this.entry = entry;
    this.saved = saved;
    this.origin = origin;
  }
}

class ProxyUrlPermission {
  scheme: string;
  host: string;
  port: string;
  path: string = '';
  constructor(origin: string) {
    const parsed = new url.URL(origin);
    this.scheme = parsed.protocol.replace(':', '');
    this.host = parsed.hostname;
    // ArkWeb matches the URL's explicit port; HTTPS origins normally omit it.
    this.port = parsed.port;
  }
}

class ProxyPermission {
  urlPermissionList: ProxyUrlPermission[];
  constructor(origin: string) { this.urlPermissionList = [new ProxyUrlPermission(origin)]; }
}

class ProxyPermissionConfig {
  javascriptProxyPermission: ProxyPermission;
  constructor(origin: string) { this.javascriptProxyPermission = new ProxyPermission(origin); }
}

export function connectorPermission(origin: string): string {
  return JSON.stringify(new ProxyPermissionConfig(origin));
}

export function parseAddress(input: string): ConnectionAddress {
  const value = input.trim();
  if (value.length === 0 || value.length > 8192 || /[\u0000-\u0020\u007f]/.test(value)) {
    throw new Error('请输入完整的 DSH 连接地址。');
  }
  const parsed = new url.URL(value);
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new Error('连接地址不能包含用户名或密码。');
  }
  const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) {
    throw new Error('请使用 HTTPS 地址。HTTP 仅支持本机调试入口。');
  }
  const origin = parsed.origin;
  const saved = origin + '/';
  return new ConnectionAddress(parsed.toString(), saved, origin);
}

export class ComputerStore {
  private context: common.UIAbilityContext;
  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async load(): Promise<Computer[]> {
    try {
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    const value = await store.get('devices', '[]');
    if (typeof value !== 'string' || value.length > 131072) return [];
    const rows = JSON.parse(value) as Computer[];
    if (!Array.isArray(rows)) return [];
    const clean: Computer[] = [];
    for (let index = 0; index < rows.length && clean.length < 20; index++) {
      const row = rows[index];
      if (!row || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.address !== 'string') continue;
      try {
        const address = parseAddress(row.address);
        clean.push(new Computer(row.id, row.name.slice(0, 40), address.saved, typeof row.lastConnectedAt === 'number' ? row.lastConnectedAt : 0));
      } catch (_) {}
    }
    return clean;
    } catch (_) { throw new Error('computer_store_read_failed'); }
  }

  async save(rows: Computer[]): Promise<void> {
    try {
    const clean: Computer[] = rows.map((row: Computer) => new Computer(row.id, row.name, parseAddress(row.address).saved, row.lastConnectedAt));
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    await store.put('devices', JSON.stringify(clean));
    await store.flush();
    } catch (_) { throw new Error('computer_store_write_failed'); }
  }

  async loadAutoConnect(): Promise<boolean> {
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    return await store.get('autoConnect', true) !== false;
  }
  async saveAutoConnect(value: boolean): Promise<void> {
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    await store.put('autoConnect', value); await store.flush();
  }
  async loadResumeToWorkspace(): Promise<boolean> {
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    return await store.get('resumeToWorkspace', true) !== false;
  }
  async saveResumeToWorkspace(value: boolean): Promise<void> {
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    await store.put('resumeToWorkspace', value); await store.flush();
  }
  async loadPrimaryComputer(): Promise<string> {
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    const value = await store.get('primaryComputer', '');
    return typeof value === 'string' && value.length <= 128 ? value : '';
  }
  async savePrimaryComputer(id: string): Promise<void> {
    const store = await preferences.getPreferences(this.context, { name: 'computers' });
    await store.put('primaryComputer', id); await store.flush();
  }
}
