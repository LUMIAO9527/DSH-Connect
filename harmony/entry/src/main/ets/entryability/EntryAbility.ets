import { UIAbility, Want, Configuration } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { url } from '@kit.ArkTS';
import { DEVICE_DEBUG } from '../model/RuntimeMode';

export default class EntryAbility extends UIAbility {
  private mainWindow?: window.Window;
  onCreate(want: Want): void {
    try { webview.WebviewController.initializeWebEngine(); } catch (_) {}
    if (DEVICE_DEBUG) webview.WebviewController.setWebDebuggingAccess(true);
    this.acceptLaunch(want);
  }
  onNewWant(want: Want): void { this.acceptLaunch(want); }
  onForeground(): void {
    AppStorage.setOrCreate<number>('dshForeground', (AppStorage.get<number>('dshForeground') || 0) + 1);
  }
  private acceptLaunch(want: Want): void {
    let address = want.parameters?.['dshUrl'];
    if (want.uri) {
      try {
        const incoming = new url.URL(want.uri);
        if (incoming.protocol === 'dshconnect:' && incoming.hostname === 'connect') address = incoming.params.get('url') || '';
      } catch (_) {}
    }
    if (typeof address === 'string' && address.length <= 8192) AppStorage.setOrCreate<string>('dshLaunchUrl', address);
  }
  private updateInsets(): void {
    if (!this.mainWindow) return;
    try {
      const system = this.mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
      const indicator = this.mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR);
      const cutout = this.mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_CUTOUT);
      const keyboard = this.mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_KEYBOARD);
      const ui = this.mainWindow.getUIContext();
      // ArkUI owns the safe layout. Only the attachment sheet needs an explicit bottom inset.
      AppStorage.setOrCreate<number>('dshBottomInset', keyboard.bottomRect.height > 0 ? 0 : ui.px2vp(Math.max(system.bottomRect.height, indicator.bottomRect.height, cutout.bottomRect.height)));
    } catch (_) {}
  }
  private appearance(): void {
    if (!this.mainWindow) return;
    try {
      const dark = this.context.resourceManager.getConfigurationSync().colorMode === 0;
      this.mainWindow.setWindowSystemBarProperties({ statusBarColor: '#00000000', navigationBarColor: '#00000000', isStatusBarLightIcon: dark, isNavigationBarLightIcon: dark }).catch(() => {});
    } catch (_) {}
  }
  onWindowStageCreate(stage: window.WindowStage): void {
    this.mainWindow = stage.getMainWindowSync();
    // Keep the native safe-area layout; individual backgrounds and ArkWeb opt into drawing beyond it.
    this.mainWindow.setWindowLayoutFullScreen(false).then(() => { this.updateInsets(); }).catch(() => {});
    this.mainWindow.on('avoidAreaChange', () => { this.updateInsets(); }); this.updateInsets(); this.appearance();
    stage.loadContent('pages/Index', (error) => { if (error.code) console.error('DSH Connect page failed to open.'); else { this.updateInsets(); this.appearance(); } });
  }
  onConfigurationUpdate(_configuration: Configuration): void { this.appearance(); this.updateInsets(); }
}
