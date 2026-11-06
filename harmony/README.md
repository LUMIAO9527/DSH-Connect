# DSH Connect 鸿蒙应用

维护版本 1.0.6。通过鸿蒙手机或平板，继续使用电脑上的完整 DeepSeek Harness。首页、电脑管理与系统交互使用 ArkUI，连接后的工作区由 ArkWeb 展示。

## 安装

本地 `artifacts/` 提供 `DSH-Connect-1.0.6-unsigned.hap`，已发布构建见项目 Release。该文件是未签名的 release 构建，需要在 DevEco 中配置自己的开发签名，并在已授权设备上安装。

正式包名为 `com.lumiao.dshconnect`，版本代码为 10006。已有同包名安装升级时，需使用匹配签名以保留应用数据。设备专用调试包沿用原应用身份与签名。

## 连接电脑

在电脑安装并配置同名 **DSH Connect** 插件，从「设置 → DSH Connect」生成配对二维码或完整 HTTPS 链接。应用内扫码或粘贴链接即可连接。支持系统链接 `dshconnect://connect?url=…` 唤起。

配对成功后保存固定电脑入口和 Cookie，不保存临时配对令牌。应用和浏览器分别保存授权，之后共用电脑上的同一份数据。

首页以电脑名称和大幅封面展示卡片，左右滑动切换电脑；菜单支持设主电脑、重命名和移除。冷启动默认恢复最近成功使用的电脑与原工作页面，首页可分别选择重新打开与后台返回时的行为。

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
