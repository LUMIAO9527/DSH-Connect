import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import z from '@deepseek-ai/schemastery';
import { stateDirectoryFor, configurationFor, connectionFields, validateOrigin } from './lib/configuration.mjs';
import { updateController } from './lib/updates.mjs';
import { DSHConnectGateway, VERSION } from './lib/mobile-access/connection.mjs';
import { assertLocalAdminTrust, sendJson, readJsonObject } from './lib/mobile-access/core/http-security.mjs';

export const name = 'dsh-connect';
export const inject = ['webServer', 'connection'];
export const Config = z.object({
  publicOrigin: z.string().default('').description('固定 HTTPS 访问地址，例如 https://dsh.example.com；由 HTTPS 反向代理转发到本机网关。'),
  listenPort: z.number().min(1024).max(65535).step(1).default(3446).description('本机网关端口，仅监听 127.0.0.1。'),
  stateDirectory: z.string().default('').description('配对状态的绝对目录；留空自动选择数据目录，升级时沿用已有目录。'),
  deviceLifetimeDays: z.number().min(1).max(366).step(1).default(90).description('新配对设备的授权天数；现有授权的截止时间保持不变。'),
  sessionLifetimeHours: z.number().min(1).max(24).step(1).default(8).description('短登录会话小时数，浏览器自动续期。'),
});

export async function apply(ctx, config = {}) {
  config = await configurationFor(ctx, config);
  const adminPath = '/api/foreverweb';
  const root = dirname(fileURLToPath(import.meta.url));
  let gateway;
  let configurationError;
  const stateDirectory = await stateDirectoryFor(process.env.DSH_HOME || join(homedir(), '.dsh'), config.stateDirectory);
  const updates = updateController(ctx, stateDirectory, config);
  if (config.publicOrigin) {
    try {
      if (!isAbsolute(stateDirectory)) throw new Error('配对状态目录必须是绝对路径。');
      gateway = new DSHConnectGateway({
        listenHost: '127.0.0.1', listenPort: config.listenPort ?? 3446,
        upstreamOrigin: ctx.webServer.getOrigin(), publicOrigin: config.publicOrigin,
        stateFile: join(stateDirectory, 'devices.json'),
        deviceTtlMs: (config.deviceLifetimeDays ?? 90) * 86400000,
        sessionTtlMs: (config.sessionLifetimeHours ?? 8) * 3600000,
      }, { authenticatedUrl: () => ctx.connection.authenticatedUrl(ctx.webServer.getOrigin()) });
      ctx.effect(() => () => gateway.close(), 'DSH Connect gateway lifetime');
      await gateway.start();
      const bootstrap = await readFile(join(root, 'gateway-bootstrap.js'), 'utf8');
      const mobileStyle = await readFile(join(root, 'mobile.css'), 'utf8');
      const mobileClient = await readFile(join(root, 'mobile-client.js'), 'utf8');
      const brand = await readFile(join(root, 'brand.svg'), 'utf8');
      ctx.on('webserver/index-inject', table => table.push({ kind: 'script', placement: 'head',
        text: bootstrap + '\nwindow.__DSH_CONNECT_MOBILE_STYLE__=' + JSON.stringify(mobileStyle) + ';\nwindow.__DSH_CONNECT_BRAND__=' + JSON.stringify(brand) + ';\n' + mobileClient }));
    } catch (error) {
      await gateway?.close();
      gateway = undefined;
      // Never log the supplied URL or credentials from an invalid configuration.
      configurationError = error?.code === 'EADDRINUSE' ? '本机网关端口已被占用，请检查插件配置。' : '连接服务未启动，请检查固定 HTTPS 地址、状态目录和端口配置。';
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
            message: '填写这台电脑的 HTTPS 访问地址，启用后即可连接手机。' }, false);
          return;
        }
      }
      if (!admin) { sendJson(response, 503, { error: 'configuration_required' }, false); return; }
      await admin.handler(request, response);
    },
  }), 'DSH Connect pairing management');
  if (gateway) ctx.logger(name).info('DSH Connect %s ready on loopback port %d.', VERSION, gateway.address().port);
}
