<p align="center"><img src="branding/cn-mark.svg" width="88" alt="DSH Connect"></p>
<h1 align="center">DSH Connect</h1>
<p align="center">把电脑上的 DeepSeek Harness，带在身边。</p>

<p align="center">
  <a href="https://github.com/LUMIAO9527/DSH-Connect/releases/latest"><img src="https://img.shields.io/badge/release-1.0.18-4d6bfe" alt="release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-2ea44f" alt="license"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20browser-0078D4" alt="platform">
</p>

DSH Connect 让你用手机浏览器继续使用电脑上的完整 DeepSeek Harness：会话、工作区、文件、模型、工具与任务共用同一份数据。模型调用和工具执行由连接的电脑完成，手机只负责显示和操作。

**维护源码为 1.0.18。** 只提供浏览器入口，插件包名为 `dsh-connect`。

## 界面

<p align="center">
  <img src="docs/images/splash.png" width="220" alt="启动画面">
  <img src="docs/images/pair-mobile.jpg" width="220" alt="手机配对">
</p>

启动画面是白底黑鲸鱼加 DeepSeekHarness，一次淡入后进入工作区。配对页只出现一次，之后打开链接会直接恢复。

## 打开方式

在手机浏览器打开电脑给出的链接即可，无需安装应用。连接后的完整工作区由电脑上的 DSH 提供，手机使用 Harness 自带的会话栏、侧栏和页签；插件负责移动排版、配对、连接恢复和传输。

同一个浏览器记住一台电脑，多台电脑就是多个链接。

## 两种链接

| 类型 | 用途 | 有效期 |
| --- | --- | --- |
| 永久链接 | 日常入口，存为书签或添加到主屏幕 | 长期 |
| 临时链接 | 发给别人临时使用 | 10 分钟，只能使用一次 |

永久链接里点「配对链接」会生成一次性配对链接和二维码，新设备扫码完成授权后即可长期使用。

## 下载

从 [Releases](https://github.com/LUMIAO9527/DSH-Connect/releases/latest) 获取：

- `dsh-connect-版本.tgz`：安装在电脑 DSH 中的插件。
- `DSH-Connect-版本-source.zip`：完整源码与构建脚本。
- `DSH-Connect-版本-icon.svg`：Cn 矢量图标。
- `SHA256SUMS.txt`：文件校验和。

## 连接方式

同一局域网内，电脑插件自动选择可用的局域网地址并提供二维码，扫码即完成配对并校验电脑身份。跨网使用内置 HTTPS 中继或固定的 HTTPS 入口。内置中继需要部署公网服务并配置电脑的中继凭据，连接与部署配置见 [电脑插件 README](desktop-plugin/README.md)。

## 主要体验

- 手机使用紧凑的标题和页签、会话抽屉与分组设置；文件夹在手机内浏览电脑文件，「＋」直接选择附件。
- 保留 Token／上下文信息与排队消息；连接、错误和其他对话的待处理统一用全局通知。
- 切网或回到前台自动恢复连接；文字流中断时读取快照，发送结果按原回执核对，无法核对的发送保留草稿。
- 连接状态可点开查看当前传输路径、设备名和地址。

[首次使用、更新、卸载与数据说明](docs/LIFECYCLE.md)

## 升级与数据

更新时保留原固定地址、端口和设备状态目录。已有的浏览器 Cookie 和设备授权继续使用；新插件会优先使用自己的已有状态，并在旧版默认状态存在时原地复用。

更新入口位于「设置 → DSH Connect → 版本更新」。插件校验官方安装包，再交给 DSH 管理安装；失败时恢复上一版。不会自动重放消息、审批或其他写请求。

## 开发与验证

```powershell
npm ci --ignore-scripts
npm run check
npm test
./branding/Build-Brand.ps1 -Check
./Build-Release.ps1
```

源码结构：`desktop-plugin/` 为电脑插件与浏览器入口，`branding/` 为图形源与派生资源生成脚本，`tools/` 为发布检查。根目录的 npm 入口指向同一个电脑插件，便于从仓库安装；Release TGZ 是推荐的固定版本入口。

验证基线与待验收项目见 [验证记录](docs/VALIDATION.md) 和 [更新日志](CHANGELOG.md)。

## 许可与来源

本项目采用 [Apache-2.0](LICENSE)。部分连接与认证代码改编自 `dsh-mobile 0.6.18`，保留上游声明与许可证，见 [第三方说明](desktop-plugin/lib/mobile-access/NOTICE)。