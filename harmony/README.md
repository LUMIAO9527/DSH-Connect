# DSH Connect 鸿蒙应用

维护源码版本 1.0.17。通过鸿蒙手机或平板，继续使用电脑上的完整 DeepSeek Harness。首页、电脑管理与系统交互使用 ArkUI，连接后的工作区由 ArkWeb 展示。

## 安装

本地 `artifacts/` 保存已有 release 构建，已发布版本见项目 Release。公开 HAP 需要配置匹配的开发签名后安装。

正式包名为 `com.lumiao.dshconnect`，当前源码版本代码为 10017。已有同包名安装升级时，需使用匹配签名以保留应用数据。设备专用调试包沿用原应用身份与签名。

## 连接电脑

在电脑的 DSH Connect 设置中生成同网或跨网配对二维码。应用内扫码或粘贴链接即可连接，系统链接 `dshconnect://connect?url=…` 也可以唤起应用。同网二维码用于验证电脑证书。

配对成功后保存电脑入口和授权。同网直连也保存电脑证书指纹。应用和浏览器分别保存授权，之后共用电脑上的同一份数据。

首页以电脑名称和大幅封面展示卡片，点击进入工作区；左右滑动切换，末尾为同尺寸的添加电脑卡片。设置位于右上角，帮助位于底部居中。设置中可调整恢复行为，管理主电脑、名称及移除电脑。

从后台返回、从首页继续同一电脑时，复用已打开的工作区，保留会话和草稿。模型和工具由电脑上的 DSH 提供，电脑与 HTTPS 通道需保持可达。

## 系统界面

应用使用 ArkUI 原生安全区布局；ArkWeb 通过 expandSafeArea 向底部系统手势区延伸背景，网页操作内容通过系统提供的 env(safe-area-inset-bottom) 避让。键盘使用原生 RESIZE。输入框下方保留 Token／上下文统计，上方保留 DSH 的排队和扩展内容。Cn 图标由 `branding/cn-mark.svg` 统一生成，启动图、页面、封面和网页入口均固定黑底白字。

相机、相册、文档选择和下载保存通过系统入口接入。各项完整流程需在具体设备上验收，当前边界见 [验证记录](../docs/VALIDATION.md)。

## 构建

需要已有官方 HarmonyOS Command Line Tools／SDK 及 Java 环境。默认工具链目录为项目 `_wip/tools/sdk26/command-line-tools`；也可传入自己的路径：

```powershell
./Build-Hap.ps1 -ToolsRoot <官方工具链目录> -JavaHome <Java目录>
```

脚本先生成品牌资源，再复制源码到 `_wip/build/harmony`，默认构建 release HAP，`debug=false`，不自动配置签名。产物位于根目录 `artifacts/`，缓存与编译输出留在 `_wip`。显式 `-DeviceDebug` 仅用于本地调试构建。

兼容配置 API 24、目标 API 26，以 `build-profile.json5` 为准。原生桥只向用户选定电脑的精确源暴露连接状态与电脑入口，不向任意网页开放文件操作。
