# DSH Connect 电脑插件

为电脑上的 DeepSeek Harness 提供设备配对、浏览器入口和连接恢复。手机浏览器打开链接即可使用，会话、文件、工作区、模型和工具都由电脑上的 DSH 提供。

## 安装

从 [Releases](https://github.com/LUMIAO9527/DSH-Connect/releases/latest) 下载安装包，在 DSH「插件 → 添加插件」中安装并启用 **DSH Connect**。

DSH CLI 可用 `dsh plugin --profile web add <安装包绝对路径>`。仓库根目录也提供同一个插件的 npm 入口，固定版本更新推荐 Release TGZ。

## 连接配置

默认启用同网直连：插件选择可用的私有 IPv4 地址，在该子网提供 HTTPS 配对入口，扫码时校验电脑证书。电脑更换局域网地址后需要重新配对。

| 配置项 | 默认值 | 用途 |
| --- | --- | --- |
| `publicOrigin` | 留空 | 固定 HTTPS 源，如 `https://dsh.example.com`；只填源，不带路径、账号或查询参数。 |
| `localNetwork` | `true` | 在可用的私有局域网中提供手机浏览器直连。 |
| `relayConfigFile` | 留空 | 由中继服务运营方签发的电脑凭据文件绝对路径。 |
| `listenPort` | `3446` | 同网 HTTPS 与跨网回环网关使用的端口。 |
| `stateDirectory` | 自动选择 | 设备授权状态目录。新安装使用 `DSH_HOME/dsh-connect`；升级时原地复用已有目录，自定义路径优先。 |
| `deviceLifetimeDays` | `90` | 新设备授权的有效天数，范围 1–366。 |
| `sessionLifetimeHours` | `8` | 短会话小时数，范围 1–24；自动续期不超过设备授权期限。 |

已有 HTTPS 入口可直接使用：代理把根路径的 HTTP 和 WebSocket 请求转发到 `http://127.0.0.1:3446`，并保留公开 Host。

### 内置中继部署

电脑端随插件运行，运营方需提供公网域名和有效证书。当前没有默认公网中继。

- 中继控制域名为 `relay.example.com`，每台电脑使用独立的 `<route>.example.com`；DNS 与证书覆盖 `*.example.com`。
- 运行 `node tools/serve-relay.mjs relay.json` 启动中继，配置包含 `origin`、`certFile`、`keyFile`、`seedFile` 与监听 `host`。
- 运行 `node tools/serve-relay.mjs relay.json --issue computer.json` 签发单台电脑凭据，把该文件路径填入 `relayConfigFile`；存在固定 `publicOrigin` 时优先使用。

## 设置页

- **永久链接**：日常入口。复制地址存为书签，或点「配对链接」生成一次性配对链接与二维码。
- **临时链接**：临时分享用，10 分钟内有效且只能使用一次。

两种链接共用一个链接框和二维码框。

## 配对

1. 打开「设置 → DSH Connect → 永久链接」，点「配对链接」。
2. 手机扫码，或在浏览器打开配对链接；也可把链接粘贴到配对页输入框，或手动输入 43 位配对码。
3. 每个新浏览器分别配对；链接十分钟内单次有效，重新生成会替换尚未使用的旧链接。
4. 配对后浏览器记住授权，之后用永久链接打开即可恢复。
5. 在同一设置页查看设备或撤销授权；新设备配对后约 5 秒会自动出现在列表里。

已配对设备可操作这台电脑的工作区和工具，配对链接只发给信任的人。

## 持续使用

浏览器前台按到期时间续期，返回前台或网络恢复时重新检查授权；网关重启后已有授权可换取新的短会话。消息、审批等写请求不会自动重放。电脑、DSH、HTTPS 通道和网络需要保持运行。

移动界面采用全宽会话、抽屉和设置二级页面；侧栏与主区按 DSH 的语义槽位定位。

## 排查

健康检查 `GET /mobile-access/health` 用于确认网关可达；管理和配对生成只接受已登录的本机请求。

遇到问题依次检查固定 HTTPS 入口、设备授权、电脑 DSH 状态和 WebSocket。诊断日志包含有限状态与分类，分享前移除配对链接、Cookie 和令牌。

## 开发与许可

在工程根运行 `npm ci --ignore-scripts`、`npm run check` 和 `npm test`；`branding/Build-Brand.ps1` 更新公共标识，`Build-Release.ps1` 构建并验证交付包。详见工程根 [README](../README.md)。

Apache-2.0；部分代码改编自 `dsh-mobile 0.6.18`，来源与许可证见 `lib/mobile-access/NOTICE`、`lib/mobile-access/LICENSE`。