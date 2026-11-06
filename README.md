<p align="center"><img src="branding/cn-mark.svg" width="88" alt="DSH Connect"></p>
<h1 align="center">DSH Connect</h1>
<p align="center">把电脑上的 DeepSeek Harness，带在身边。</p>

DSH Connect 让你通过鸿蒙应用或浏览器，继续使用电脑上的完整 DeepSeek Harness：会话、工作区、文件、模型、工具与任务共用同一份数据。模型调用和工具执行由连接的电脑完成。

**维护源码为 1.0.17。** 鸿蒙应用与电脑插件统一命名为 **DSH Connect**，插件包名为 `dsh-connect`。

## 选择打开方式

| 方式 | 适合的使用习惯 | 入口 |
| --- | --- | --- |
| 鸿蒙应用 | 记住多台电脑、扫码连接、使用系统相机／相册／文件入口 | [鸿蒙应用说明](harmony/README.md) |
| 浏览器 | 打开链接即可使用，适合不想安装应用的设备 | [电脑插件说明](desktop-plugin/README.md) |

连接后的完整工作区由电脑上的 DSH 提供，手机使用 Harness 自带的会话栏、侧栏和页签。应用首页和连接管理使用 ArkUI，工作区由 ArkWeb 承载。浏览器入口提供移动排版和连接恢复。

## 页面

<p align="center"><img src="docs/images/home.jpg" width="245" alt="首次使用"><img src="docs/images/computers.jpg" width="245" alt="已保存电脑"><img src="docs/images/add.jpg" width="245" alt="添加电脑"></p>

页面来自官方 SDK 的原生渲染，使用演示电脑数据。[查看页面图册](artifacts/DSH-Connect-1.0.14-preview.html)。

## 下载

已发布版本从 [Releases](https://github.com/LUMIAO9527/DSH-Connect/releases/latest) 获取。本地 1.0.14 构建位于 `artifacts/`：

- `dsh-connect-1.0.14.tgz`：安装在电脑 DSH 中的插件。
- `DSH-Connect-1.0.14-unsigned.hap`：鸿蒙应用的未签名 release 构建，需要配置自己的开发签名后安装。
- `DSH-Connect-1.0.14-source.zip`：完整源码、构建脚本和说明。
- `DSH-Connect-1.0.14-icon.svg`：固定黑底白字的 Cn 矢量图标。
- `SHA256SUMS.txt`：文件校验和。

HAP 目前需要 DevEco 开发签名，尚未提供应用市场的通用安装包。首次体验也可以先使用浏览器入口。

## 连接方式

当前源码支持鸿蒙应用在私有局域网内扫码直连。电脑上的 DSH Connect 自动选择可用的局域网地址，二维码用于配对并验证电脑身份。

跨网支持内置 HTTPS 中继及已有固定 HTTPS 入口，鸿蒙应用和浏览器均可使用。内置中继需部署公网服务并配置电脑的中继凭据。连接与部署配置见 [电脑插件 README](desktop-plugin/README.md)。

## 主要体验

- 首页点击电脑卡片即可进入工作区；左右滑动切换电脑，末尾的同尺寸卡片用于添加电脑。设置位于右上角，帮助跳转按钮位于底部；添加电脑使用原生底部面板。
- 冷启动恢复最近使用的电脑和原工作页面；从后台回来保留当前会话和草稿。恢复行为与电脑管理集中在设置中。
- 手机使用紧凑的标题和页签、会话抽屉与分组设置；文件夹在手机内浏览电脑文件，“＋”直接选择附件。
- 使用鸿蒙原生沉浸式安全区和键盘避让，背景延伸到系统手势条下方；输入框下方保留 Token／上下文信息，上方保留排队消息与扩展位置。
- Cn 图标采用圆角底板和圆润笔画，启动图标、应用、电脑封面和网页入口均固定黑底白字。

[首次使用、更新、卸载与数据说明](docs/LIFECYCLE.md)

## 升级与数据

更新时保留原固定地址、端口和设备状态目录。已有的浏览器 Cookie 和设备授权继续使用；新插件会优先使用自己的已有状态，并在旧版默认状态存在时原地复用。采用自定义状态目录的安装继续填写原路径。

更新入口位于「设置 → DSH Connect → 版本更新」。插件校验官方安装包，再交给 DSH 管理安装；失败时恢复上一版。旧名称下的连接配置会继续识别。不会自动重放消息、审批或其他写请求。

## 开发与验证

```powershell
npm ci --ignore-scripts
npm run check
npm test
./branding/Build-Brand.ps1 -Check
./Build-Release.ps1 -ToolsRoot <已有官方HarmonyOS工具链目录> -JavaHome <已有Java目录>
```

源码结构：`harmony/` 为鸿蒙客户端，`desktop-plugin/` 为电脑插件，`branding/` 为 Cn 图形源及派生资源生成脚本，`tools/` 为发布检查。根目录的 npm 入口指向同一个电脑插件，便于从仓库安装；Release TGZ 是推荐的固定版本入口。

验证基线、已运行检查和待验收项目见 [验证记录](docs/VALIDATION.md)。未签名 HAP、SDK 页面预览和真机测试分别记录。原生文件全流程、长时间锁屏和切网需要在具体设备上验收。

## 许可与来源

本项目采用 [Apache-2.0](LICENSE)。部分连接与认证代码改编自 `dsh-mobile 0.6.18`，保留上游声明与许可证，见 [第三方说明](desktop-plugin/lib/mobile-access/NOTICE)。轻量鸿蒙外壳的思路参考 [SakuraNeko/Deepseek-Harmony](https://github.com/SakuraNeko/Deepseek-Harmony)。
