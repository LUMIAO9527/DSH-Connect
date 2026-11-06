import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import z from '@deepseek-ai/schemastery';
import { stateDirectoryFor, configurationFor, connectionFields, validateOrigin } from './lib/configuration.mjs';
import { updateController } from './lib/updates.mjs';
import { DSHConnectGateway, VERSION } from './lib/mobile-access/connection.mjs';
import { localNetworkAddress, localNetworkIdentity } from './lib/mobile-access/lan.mjs';
import { readRelaySettings, startRelayAgent } from './lib/mobile-access/relay.mjs';
import { assertLocalAdminTrust, sendJson, readJsonObject } from './lib/mobile-access/core/http-security.mjs';

export const name = 'dsh-connect';
export const inject = ['webServer', 'connection'];
export const Config = z.object({
  publicOrigin: z.string().default('').description('固定 HTTPS 访问地址，例如 https://dsh.example.com；由 HTTPS 反向代理转发到本机网关。'),
  localNetwork: z.boolean().default(true).description('允许同一私有网络上的鸿蒙应用扫码直连。'),
  relayConfigFile: z.string().default('').description('跨网中继凭据文件的绝对路径，由服务运营方提供。'),
  listenPort: z.number().min(1024).max(65535).step(1).default(3446).description('DSH Connect 网关端口。'),
  stateDirectory: z.string().default('').description('配对状态的绝对目录；留空自动选择数据目录，升级时沿用已有目录。'),
  deviceLifetimeDays: z.number().min(1).max(366).step(1).default(90).description('新配对设备的授权天数；现有授权的截止时间保持不变。'),
  sessionLifetimeHours: z.number().min(1).max(24).step(1).default(8).description('短登录会话小时数，浏览器自动续期。'),
});

export async function apply(ctx, config = {}) {
  config = await configurationFor(ctx, config);
  const adminPath = '/api/foreverweb';
  const root = dirname(fileURLToPath(import.meta.url));
  let gateway;
  let relayAgent;
  let relay;
  let lan;
  let configurationError;
  const stateDirectory = await stateDirectoryFor(process.env.DSH_HOME || join(homedir(), '.dsh'), config.stateDirectory);
  const updates = updateController(ctx, stateDirectory, config);
  if (!config.publicOrigin && config.relayConfigFile) {
    try { relay = await readRelaySettings(config.relayConfigFile); }
    catch { configurationError = '跨网中继配置无法读取。'; }
  }
  const publicOrigin = config.publicOrigin || relay?.origin;
  const localAddress = config.localNetwork !== false && !publicOrigin?.startsWith('http:') && localNetworkAddress();
  if (localAddress && isAbsolute(stateDirectory)) {
    try { lan = { ...localAddress, ...await localNetworkIdentity(join(stateDirectory, 'lan-identity.json'), localAddress.host) }; }
    catch { configurationError = '同网连接的电脑身份无法读取。'; }
  }
  let networkRefresh;
  if (publicOrigin || lan || config.localNetwork !== false) {
    try {
      if (!isAbsolute(stateDirectory)) throw new Error('配对状态目录必须是绝对路径。');
      gateway = new DSHConnectGateway({
        listenHost: '127.0.0.1', listenPort: config.listenPort ?? 3446,
        upstreamOrigin: ctx.webServer.getOrigin(), publicOrigin, lan,
        stateFile: join(stateDirectory, 'devices.json'),
        deviceTtlMs: (config.deviceLifetimeDays ?? 90) * 86400000,
        sessionTtlMs: (config.sessionLifetimeHours ?? 8) * 3600000,
      }, { authenticatedUrl: () => ctx.connection.authenticatedUrl(ctx.webServer.getOrigin()),
        remoteReady: () => !relay || relayAgent?.online === true, configurationEditable: () => Boolean(ctx.get?.('configEditor')) });
      await gateway.start();
      if (relay) relayAgent = startRelayAgent({ settings: relay, gatewayPort: gateway.address().port });
      const running = gateway;
      let refreshing = false;
      const refreshNetwork = async () => {
        if (refreshing || running.closing || config.localNetwork === false || publicOrigin?.startsWith('http:')) return;
        const address = localNetworkAddress();
        if (address?.host === running.config.lan?.host && address?.cidr === running.config.lan?.cidr && (!address || running.lanOrigin)) return;
        refreshing = true;
        try {
          const identity = address ? { ...address, ...await localNetworkIdentity(join(stateDirectory, 'lan-identity.json'), address.host) } : undefined;
          await running.configureLan(identity);
        } catch { ctx.logger(name).warn('同网连接暂不可用，正在重新检测网络。'); }
        finally { refreshing = false; }
      };
      if (config.localNetwork !== false) {
        networkRefresh = setInterval(() => { void refreshNetwork(); }, 5000);
        networkRefresh.unref();
      }
      ctx.effect(() => async () => { clearInterval(networkRefresh); relayAgent?.close(); await running.close(); }, 'DSH Connect gateway lifetime');
      const bootstrap = await readFile(join(root, 'gateway-bootstrap.js'), 'utf8');
      const mobileStyle = await readFile(join(root, 'mobile.css'), 'utf8');
      const mobileClient = await readFile(join(root, 'mobile-client.js'), 'utf8');
      const brand = await readFile(join(root, 'brand.svg'), 'utf8');
      ctx.on('webserver/index-inject', table => table.push({ kind: 'script', placement: 'head',
        text: bootstrap + '\nwindow.__DSH_CONNECT_MOBILE_STYLE__=' + JSON.stringify(mobileStyle) + ';\nwindow.__DSH_CONNECT_BRAND__=' + JSON.stringify(brand) + ';\n' + mobileClient }));
    } catch (error) {
      clearInterval(networkRefresh);
      relayAgent?.close();
      await gateway?.close();
      gateway = undefined;
      // Never log the supplied URL or credentials from an invalid configuration.
      configurationError = error?.code === 'EADDRINUSE' ? '本机连接端口已被占用。' : '连接服务未启动，请检查网络与连接配置。';
      ctx.logger(name).warn(configurationError);
    }
  }
  const authenticated = request => ctx.connection.requestRejection(request) === undefined;
  const admin = gateway?.localAdminRoute(adminPath, authenticated);
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: adminPath,
    handler: async (request, response) => {
      if (!authenticated(request)) { sendJson(response, 401, { error: 'authentication_required' }, false); return; }
      try { assertLocalAdminTrust(request, request.method === 'POST', () => authenticated(request)); }
      catch { sendJson(response, 403, { error: 'forbidden' }, false); return; }
      if (request.method === 'GET' && request.url === adminPath + '/updates/status') { sendJson(response, 200, updates.status(), false); return; }
      if (request.method === 'POST' && request.url === adminPath + '/updates/check') {
        try { sendJson(response, 200, await updates.check(), false); } catch { sendJson(response, 502, { error: 'update_unavailable', message: '暂时无法检查更新，请稍后重试。' }, false); } return;
      }
      if (request.method === 'POST' && request.url === adminPath + '/updates/apply') {
        try { const body = await readJsonObject(request, 4096); sendJson(response, 202, await updates.start(body.version), false); }
        catch { sendJson(response, 409, { error: 'update_not_ready', message: '更新尚未准备好，请重新检查。' }, false); } return;
      }
      if (request.method === 'POST' && request.url === adminPath + '/configuration') {
        try {
          const body = await readJsonObject(request, 4096), origin = validateOrigin(body.publicOrigin);
          const editor = ctx.get('configEditor');
          const entry = editor?.entries().find(row => row.fiber?.ctx === ctx || row.options.id === ctx.fiber?.entry?.options?.id || row.options.name === name);
          if (!entry) throw new Error('Configuration editor unavailable');
          await editor.edit(entry, raw => ({ ...connectionFields(config), ...raw, publicOrigin: origin }));
          sendJson(response, 200, { saved: true }, false);
        } catch { sendJson(response, 400, { error: 'configuration_refused', message: '地址未能保存，请检查 HTTPS 地址后重试。' }, false); } return;
      }
      if (request.method === 'GET' && request.url === adminPath + '/status') {
        if (!gateway) {
          sendJson(response, 200, { configured: false, version: VERSION, error: configurationError,
            editable: Boolean(ctx.get?.('configEditor')), listenPort: config.listenPort ?? 3446,
            message: '电脑接入家庭或办公局域网后，可生成同网配对二维码。' }, false);
          return;
        }
      }
      if (!admin) { sendJson(response, 503, { error: 'configuration_required' }, false); return; }
      await admin.handler(request, response);
    },
  }), 'DSH Connect pairing management');
  if (gateway) ctx.logger(name).info('DSH Connect %s ready.', VERSION);
}
