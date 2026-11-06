import { common } from '@kit.AbilityKit';
import { curves, KeyboardAvoidMode } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { scanBarcode, scanCore } from '@kit.ScanKit';
import { url } from '@kit.ArkTS';
import { Computer, ComputerStore, parseAddress, connectorPermission } from '../model/ComputerStore';
import { FileSupport } from '../model/FileSupport';
import { APP_VERSION } from '../model/Version';
import { checkRelease, RELEASE_URL, PROJECT_URL, ReleaseResult } from '../model/ReleaseInfo';
import { ComputerCover, ConnectionLoading } from '../components/ConnectionViews';

enum ConnectPanel { Settings, Help, Add, Rename, Remove, ConnectionError, Attachments }

class ConnectorBridge {
  private show: () => void;
  private changed: (state: string) => void;
  private toolbar: () => boolean;
  constructor(show: () => void, changed: (state: string) => void, toolbar: () => boolean) {
    this.show = show; this.changed = changed; this.toolbar = toolbar;
  }
  showComputers(): void { this.show(); }
  connectionChanged(state: string): void { this.changed(state); }
  workspaceToolbarReady(): boolean { return this.toolbar(); }
}

@Entry
@Component
struct Index {
  @State private computers: Computer[] = [];
  @State private managerVisible: boolean = false;
  @State private panel: ConnectPanel = ConnectPanel.Settings;
  @State private panelVisible: boolean = false;
  @State private updateChecking: boolean = false;
  @State private updateAvailable: boolean = false;
  @State private updateMessage: string = '检查是否有新版本';
  @State private pickerBusy: boolean = false;
  @State private autoConnect: boolean = true;
  @State private resumeToWorkspace: boolean = true;
  @State private savingAutoConnect: boolean = false;
  @State private savingResumeToWorkspace: boolean = false;
  @State private selectedComputerId: string = '';
  @State private addressInput: string = '';
  @State private linkFocused: boolean = false;
  @State private activeName: string = '';
  @State private phase: string = 'idle';
  @State private connectionState: string = 'connecting';
  @State private workspaceToolbarVisible: boolean = false;
  @State private message: string = '';
  @State private pageWidth: number = 390;
  @State private pageHeight: number = 780;
  @State private primaryId: string = '';
  @State private editingId: string = '';
  @State private editName: string = '';
  @State private removalTarget: Computer = new Computer('', '', '');
  @State private removing: boolean = false;
  @StorageLink('dshLaunchUrl') @Watch('consumeLaunch') private launchUrl: string = '';
  @StorageLink('dshBottomInset') private bottomInset: number = 0;
  @StorageLink('dshKeyboardVisible') private keyboardVisible: boolean = false;
  @StorageLink('dshForeground') @Watch('foregroundChanged') private foreground: number = 0;
  private webController: webview.WebviewController = new webview.WebviewController();
  private panelScroller: Scroller = new Scroller();
  private panelHistory: ConnectPanel[] = [];
  private store?: ComputerStore;
  private files?: FileSupport;
  @State private activeUrl: string = '';
  private initialUrl: string = '';
  private savedAddress: string = '';
  private retryAddress: string = '';
  private currentOrigin: string = '';
  private attached: boolean = false;
  @State private loaded: boolean = false;
  private startup: boolean = true;
  private attempt: number = 0;
  private timer: number = -1;
  private probeTimer: number = -1;
  private connectorAvailable: boolean = false;
  private mainHttpError: number = 0;
  private pendingFiles: ((items: Array<string>) => void) | null = null;
  private accepts: string[] = [];
  private multiple: boolean = false;
  private fileRequest: number = 0;
  private bridge: ConnectorBridge = new ConnectorBridge(
    () => { this.managerVisible = true; },
    (state: string) => { this.onConnection(state); },
    () => {
      if (!this.trustedPage()) return false;
      this.workspaceToolbarVisible = true;
      return true;
    }
  );

  aboutToAppear(): void {
    this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.store = new ComputerStore(context);
    this.files = new FileSupport(context, (text: string) => { this.getUIContext().getPromptAction().showToast({ message: text }); });
    this.store.loadAutoConnect().then((enabled: boolean) => { this.autoConnect = enabled; return this.store!.loadResumeToWorkspace(); }).then((enabled: boolean) => { this.resumeToWorkspace = enabled; return this.store!.loadPrimaryComputer(); }).then((id: string) => { this.primaryId = id; return this.store!.load(); }).then((rows: Computer[]) => {
      this.computers = rows; this.loaded = true;
      if (this.launchUrl) { this.consumeLaunch(); return; }
      if (!this.startup || !this.autoConnect || this.panelVisible) { this.managerVisible = true; return; }
      this.startup = false;
      if (rows.length > 0) { const latest = this.latestComputer(); if (latest.lastConnectedAt > 0) { this.openAddress(latest.address, latest.name); return; } }
      this.managerVisible = true;
    }).catch(() => { this.loaded = true; this.managerVisible = true; this.message = '暂时无法读取已保存的电脑，可以重新添加。'; });
  }
  aboutToDisappear(): void { this.clearTimer(); this.finishFiles([]); this.files?.dispose(); }
  private checkUpdate(): void {
    if (this.updateChecking) return;
    this.updateChecking = true; this.updateMessage = '正在检查更新…';
    checkRelease().then((result: ReleaseResult) => {
      this.updateAvailable = result.available;
      this.updateMessage = result.available ? '发现新版本 ' + result.version : '当前已是最新版本';
    }).catch(() => { this.updateMessage = '暂时无法连接 GitHub，请稍后重试。'; }).finally(() => { this.updateChecking = false; });
  }
  private async openProject(releases: boolean): Promise<void> {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    try { await context.openLink(releases ? RELEASE_URL : PROJECT_URL); } catch (_) {
      this.getUIContext().getPromptAction().showToast({ message: '暂时无法打开浏览器，请稍后重试。' });
    }
  }
  private clearTimer(): void {
    if (this.timer >= 0) clearTimeout(this.timer); this.timer = -1;
    if (this.probeTimer >= 0) clearTimeout(this.probeTimer); this.probeTimer = -1;
  }
  private waitForConnection(): void {
    this.clearTimer(); const current = this.attempt;
    this.timer = setTimeout(() => {
      if (current !== this.attempt || this.phase !== 'connecting') return;
      this.connectionFailed(this.connectorAvailable ? '还没有连接上电脑。请确认电脑与 DSH 已打开，然后重试。' : '此地址没有提供可用的 DSH Connect 工作区。请在电脑设置中重新生成配对链接。');
    }, 45000);
  }
  private consumeLaunch(): void {
    if (!this.loaded || !this.launchUrl) return;
    this.startup = false; const address = this.launchUrl; this.launchUrl = ''; this.openAddress(address, '');
  }
  private openAddress(value: string, name: string): void {
    try {
      const parsed = parseAddress(value); this.attempt++; this.clearTimer(); this.startup = false;
      this.finishFiles([]);
      if (!this.attached) this.initialUrl = parsed.entry;
      this.currentOrigin = parsed.origin; this.activeUrl = parsed.entry; this.savedAddress = parsed.saved;
      this.retryAddress = parsed.entry;
      const known = this.computers.find((computer: Computer) => computer.address === parsed.saved);
      const hostname = new url.URL(parsed.origin).hostname;
      this.activeName = name.trim() || known?.name || (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' ? '我的电脑' : hostname.split('.')[0]);
      this.phase = 'connecting'; this.connectionState = 'connecting'; this.message = ''; this.connectorAvailable = false;
      this.workspaceToolbarVisible = false;
      this.panelVisible = false; this.panelHistory = []; this.editingId = ''; this.managerVisible = false;
      if (this.attached) this.loadActive();
    } catch (_) {
      this.managerVisible = true;
      if (this.panel !== ConnectPanel.Add || !this.panelVisible) this.showPanel(ConnectPanel.Add);
      this.message = '请填写电脑端生成的完整 HTTPS 配对链接。';
    }
  }
  private registerBridge(): void {
    if (!this.attached || !this.currentOrigin) return;
    try { this.webController.deleteJavaScriptRegister('HarmonyConnector'); } catch (_) {}
    this.webController.registerJavaScriptProxy(this.bridge, 'HarmonyConnector',
      ['showComputers', 'connectionChanged', 'workspaceToolbarReady'], [], connectorPermission(this.currentOrigin));
  }
  private loadActive(): void {
    try {
      this.registerBridge(); this.webController.loadUrl(this.activeUrl); this.waitForConnection();
    } catch (_) { this.connectionFailed('页面暂时无法打开，请重试。'); }
  }
  private connectionFailed(detail: string): void {
    this.clearTimer(); this.phase = 'failed'; this.managerVisible = true;
    if (this.panelVisible && this.panel !== ConnectPanel.ConnectionError) {
      this.getUIContext().getPromptAction().showToast({ message: detail });
      return;
    }
    this.showPanel(ConnectPanel.ConnectionError); this.message = detail;
  }
  private async onConnection(state: string): Promise<void> {
    if (!this.activeUrl || this.phase === 'idle') return;
    if (state !== 'connected' && state !== 'connecting' && state !== 'offline' && state !== 'auth-required') return;
    this.connectionState = state;
    if (state === 'connected') {
      this.retryAddress = this.savedAddress;
      if (this.phase === 'ready') return;
      const current = this.attempt; this.phase = 'ready'; this.message = ''; this.clearTimer();
      try { await webview.WebCookieManager.saveCookieAsync(); } catch (_) {}
      if (current !== this.attempt) return;
      const rows = this.computers.slice(); const index = rows.findIndex((computer: Computer) => computer.address === this.savedAddress);
      const computer = new Computer(index >= 0 ? rows[index].id : Date.now().toString(), this.activeName, this.savedAddress, Date.now());
      if (index >= 0) rows[index] = computer;
      else if (rows.length < 20) rows.push(computer);
      else { this.getUIContext().getPromptAction().showToast({ message: '已连接。电脑列表已满，移除不再使用的电脑后可保存。' }); return; }
      try {
        await this.store?.save(rows); this.computers = rows;
        this.selectedComputerId = computer.id;
        if (!rows.some((item: Computer) => item.id === this.primaryId)) { await this.store?.savePrimaryComputer(computer.id); this.primaryId = computer.id; }
      } catch (_) { this.message = '已连接，电脑列表暂时未能保存。'; }
    } else if (state === 'auth-required') { this.clearTimer(); this.phase = 'pairing'; }
  }
  private async documentLoaded(page: string): Promise<void> {
    try {
      if (new url.URL(page).origin !== this.currentOrigin) return;
      if (this.mainHttpError >= 400) return;
      if (new url.URL(page).pathname.startsWith('/mobile-access/')) { this.phase = 'pairing'; this.clearTimer(); return; }
      this.retryAddress = this.savedAddress;
      const current = this.attempt;
      if (this.phase !== 'ready') { this.phase = 'connecting'; this.waitForConnection(); }
      this.probeConnector(current);
    } catch (_) {}
  }
  private probeConnector(current: number): void {
    if (current !== this.attempt || this.phase !== 'connecting' || !this.attached || !this.trustedPage()) return;
    this.webController.runJavaScript('window.__DSH_CONNECT_UI__ ? (window.__DSH_CONNECT_UI__.setTransport(window.__DSH_CONNECT_TRANSPORT__ || "connecting"), "available") : "waiting"').then((result: string) => {
      if (current !== this.attempt || this.phase !== 'connecting') return;
      if (result.includes('available')) { this.connectorAvailable = true; return; }
      this.probeTimer = setTimeout(() => { this.probeConnector(current); }, 350);
    }).catch(() => {
      if (current === this.attempt && this.phase === 'connecting') this.probeTimer = setTimeout(() => { this.probeConnector(current); }, 350);
    });
  }
  private trustedPage(): boolean { try { return new url.URL(this.webController.getUrl()).origin === this.currentOrigin; } catch (_) { return false; } }
  private resumeConnection(): void {
    if (!this.attached || !this.trustedPage()) return;
    this.webController.runJavaScript('window.__DSH_CONNECT_UI__?.resume(); "requested"').catch(() => {});
  }
  private foregroundChanged(): void {
    if (!this.loaded) return;
    if (this.pickerBusy) return;
    if (!this.resumeToWorkspace) { this.managerVisible = true; return; }
    this.resumeConnection();
  }
  private async changeAutoConnect(enabled: boolean): Promise<void> {
    if (this.savingAutoConnect) return;
    const previous = this.autoConnect; this.autoConnect = enabled; this.savingAutoConnect = true;
    try { await this.store?.saveAutoConnect(enabled); }
    catch (_) { this.autoConnect = previous; this.getUIContext().getPromptAction().showToast({ message: '设置未能保存，请重试。' }); }
    finally { this.savingAutoConnect = false; }
  }
  private async changeResumeToWorkspace(enabled: boolean): Promise<void> {
    if (this.savingResumeToWorkspace) return;
    const previous = this.resumeToWorkspace; this.resumeToWorkspace = enabled; this.savingResumeToWorkspace = true;
    try { await this.store?.saveResumeToWorkspace(enabled); }
    catch (_) { this.resumeToWorkspace = previous; this.getUIContext().getPromptAction().showToast({ message: '设置未能保存，请重试。' }); }
    finally { this.savingResumeToWorkspace = false; }
  }
  private continueComputer(computer: Computer): void {
    this.startup = false;
    if (this.attached && this.phase === 'ready' && this.savedAddress === computer.address && this.trustedPage()) {
      this.managerVisible = false; this.message = ''; this.resumeConnection(); return;
    }
    this.openAddress(computer.address, computer.name);
  }
  private finishFiles(items: string[]): void {
    this.fileRequest++; const callback = this.pendingFiles; this.pendingFiles = null; this.pickerBusy = false;
    if (this.panel === ConnectPanel.Attachments) this.panelVisible = false;
    if (callback) callback(items);
  }
  private async chooseFiles(kind: string): Promise<void> {
    if (!this.files || !this.pendingFiles || this.pickerBusy) return;
    const request = this.fileRequest; this.pickerBusy = true;
    try { const items = kind === 'camera' ? await this.files.takePhoto() : kind === 'album' ? await this.files.album(this.multiple) : await this.files.documents(this.accepts, this.multiple); if (request === this.fileRequest) this.finishFiles(items); }
    catch (_) { if (request === this.fileRequest) { this.finishFiles([]); this.getUIContext().getPromptAction().showToast({ message: '未选择文件，可以重新添加。' }); } }
  }
  private async scan(): Promise<void> {
    this.startup = false;
    try {
      const options: scanBarcode.ScanOptions = { scanTypes: [scanCore.ScanType.ALL], enableMultiMode: false, enableAlbum: true };
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      const result = await scanBarcode.startScanForResult(context, options);
      if (result.originalValue) this.openAddress(result.originalValue, '');
    } catch (_) {}
  }
  private async forget(computer: Computer): Promise<void> {
    if (this.removing) return;
    this.removing = true;
    const rows = this.computers.filter((item: Computer) => item.id !== computer.id);
    try {
      await this.store?.save(rows); this.computers = rows;
      if (this.primaryId === computer.id) { const next = rows.length ? this.mainComputer().id : ''; await this.store?.savePrimaryComputer(next); this.primaryId = next; }
      if (this.panelVisible && this.panel === ConnectPanel.Remove) this.goBackInPanel();
    } catch (_) { this.message = '暂时无法移除，请重试。'; }
    finally { this.removing = false; }
  }
  private confirmForget(computer: Computer): void {
    this.removalTarget = computer;
    this.showPanel(ConnectPanel.Remove);
  }
  onBackPress(): boolean {
    if (this.panelVisible) { this.goBackInPanel(); return true; }
    if (this.managerVisible && this.phase === 'failed') { this.phase = 'idle'; this.message = ''; return true; }
    if (this.managerVisible && this.activeUrl && this.phase === 'ready') { this.managerVisible = false; this.resumeConnection(); return true; }
    if (!this.managerVisible) {
      if (this.phase === 'pairing') { this.managerVisible = true; return true; }
      this.webController.runJavaScript('window.__DSH_CONNECT_UI__?.back() || "root"').then((result: string) => { if (result.includes('root')) this.managerVisible = true; }).catch(() => { this.managerVisible = true; }); return true;
    }
    return false;
  }
  private mainComputer(): Computer {
    const selected = this.computers.find((item: Computer) => item.id === this.primaryId);
    if (selected) return selected;
    return this.latestComputer();
  }
  private selectedIndex(): number {
    if (this.selectedComputerId === 'add-computer') return this.computers.length;
    const index = this.computers.findIndex((item: Computer) => item.id === this.selectedComputerId);
    if (index >= 0) return index;
    const primary = this.computers.findIndex((item: Computer) => item.id === this.mainComputer().id);
    return primary >= 0 ? primary : 0;
  }
  private computerCardHeight(): number { return Math.min(360, Math.max(220, Math.min(this.pageWidth, 560) - 40), this.pageHeight - 184); }
  private latestComputer(): Computer {
    let latest: Computer = this.computers[0] || new Computer('', '我的电脑', '');
    for (const item of this.computers) if (item.lastConnectedAt > latest.lastConnectedAt) latest = item;
    return latest;
  }
  private showPanel(panel: ConnectPanel): void {
    this.startup = false; this.message = '';
    if (!this.panelVisible) this.panelHistory = [];
    else if (this.panel !== panel) this.panelHistory.push(this.panel);
    this.panel = panel; this.panelVisible = true;
    this.panelScroller.scrollEdge(Edge.Top);
  }
  private restoreParentPanel(): boolean {
    const parent = this.panelHistory.pop();
    if (parent === undefined) return false;
    this.linkFocused = false; this.message = ''; this.panel = parent;
    this.panelScroller.scrollEdge(Edge.Top);
    return true;
  }
  private goBackInPanel(): void {
    if (!this.restoreParentPanel()) this.panelVisible = false;
  }
  private panelClosed(): void {
    if (this.panelVisible) return;
    if (this.panel === ConnectPanel.Attachments && this.pendingFiles) this.finishFiles([]);
    if (this.panel === ConnectPanel.ConnectionError && this.phase === 'failed') this.phase = 'idle';
    this.panelHistory = []; this.linkFocused = false; this.editingId = '';
  }
  private panelTitle(): string {
    switch (this.panel) {
      case ConnectPanel.Settings: return '设置';
      case ConnectPanel.Help: return '使用帮助';
      case ConnectPanel.Add: return '添加电脑';
      case ConnectPanel.Rename: return '电脑名称';
      case ConnectPanel.Remove: return '移除电脑';
      case ConnectPanel.ConnectionError: return '暂时无法连接';
      case ConnectPanel.Attachments: return '添加附件';
    }
  }
  private panelHeight(): SheetSize | string {
    if (this.panel === ConnectPanel.Settings) return '70%';
    if (this.keyboardVisible && this.panel === ConnectPanel.Add) return '77%';
    if (this.keyboardVisible && this.panel === ConnectPanel.Rename) return '72%';
    return SheetSize.FIT_CONTENT;
  }
  private renameComputer(computer: Computer): void {
    this.editingId = computer.id; this.editName = computer.name; this.showPanel(ConnectPanel.Rename);
  }
  private async makePrimary(computer: Computer): Promise<void> {
    try { await this.store?.savePrimaryComputer(computer.id); this.primaryId = computer.id; }
    catch (_) { this.getUIContext().getPromptAction().showToast({ message: '主电脑暂时未能保存，请重试。' }); }
  }
  private async manageComputer(computer: Computer): Promise<void> {
    try {
      const result = await this.getUIContext().getPromptAction().showActionMenu({ title: computer.name, buttons: [
        { text: this.mainComputer().id === computer.id ? '当前主电脑' : '设为主电脑', color: $r('app.color.ink') },
        { text: '重命名', color: $r('app.color.ink') }, { text: '移除这台电脑', color: '#D45151' }
      ] });
      if (result.index === 0) this.makePrimary(computer);
      else if (result.index === 1) this.renameComputer(computer);
      else if (result.index === 2) this.confirmForget(computer);
    } catch (_) {}
  }
  private async saveName(): Promise<void> {
    const id = this.editingId;
    const value = this.editName.trim();
    if (!id || !value) return;
    const rows = this.computers.map((item: Computer) => new Computer(item.id, item.id === id ? value : item.name, item.address, item.lastConnectedAt));
    try {
      await this.store?.save(rows); this.computers = rows;
      const renamed = rows.find((item: Computer) => item.id === id);
      if (renamed && renamed.address === this.savedAddress) this.activeName = renamed.name;
      if (this.panelVisible && this.panel === ConnectPanel.Rename && this.editingId === id) this.goBackInPanel();
    } catch (_) { if (this.editingId === id) this.message = '名称暂时未能保存，请重试。'; }
  }
  @Builder private header() {
    Row({ space: 6 }) {
      Image($r('app.media.cn_mark')).width(30).height(30).flexShrink(0).accessibilityText('DSH Connect')
      Text('DSH Connect').fontSize(18).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      Button({ type: ButtonType.Circle }) { SymbolGlyph($r('sys.symbol.gearshape')).fontSize(21).fontColor([$r('app.color.ink')]) }.width(44).height(44).padding(0).flexShrink(0).backgroundColor(Color.Transparent).accessibilityText('连接设置').onClick(() => { this.showPanel(ConnectPanel.Settings); })
    }.width('100%').height(48).margin({ bottom: 16 })
  }
  @Builder private recoveryOptions() {
    Column() {
      this.recoverySwitch('启动时自动连接', '连接上次使用的电脑', this.autoConnect, this.savingAutoConnect, (enabled: boolean) => { this.changeAutoConnect(enabled); })
      Divider().color($r('app.color.line')).margin({ left: 16, right: 16 }).width('auto')
      this.recoverySwitch('返回时恢复工作区', '继续当前会话和输入内容', this.resumeToWorkspace, this.savingResumeToWorkspace, (enabled: boolean) => { this.changeResumeToWorkspace(enabled); })
    }.width('100%').borderRadius(20).clip(true).backgroundColor($r('app.color.surface'))
  }
  @Builder private recoverySwitch(label: string, detail: string, enabled: boolean, saving: boolean, action: (value: boolean) => void) {
    Row({ space: 16 }) {
      Column({ space: 4 }) {
        Text(label).fontSize(16).fontColor($r('app.color.ink')).width('100%')
        Text(detail).fontSize(12).fontColor($r('app.color.muted')).width('100%')
      }.layoutWeight(1).alignItems(HorizontalAlign.Start)
      Toggle({ type: ToggleType.Switch, isOn: enabled }).selectedColor('#4D6BFE').enabled(!saving).accessibilityText(label).onChange(action)
    }.width('100%').constraintSize({ minHeight: 76 }).padding({ left: 16, right: 16, top: 12, bottom: 12 })
  }
  @Builder private home() {
    Column({ space: 0 }) {
      Column() {
        Swiper() {
          ForEach(this.computers, (computer: Computer) => {
            Column() { ComputerCover({ computerName: computer.name, cardHeight: this.computerCardHeight(), primary: computer.id === this.mainComputer().id, onContinue: () => { this.continueComputer(computer); }, onMakePrimary: () => { this.makePrimary(computer); }, onRename: () => { this.renameComputer(computer); }, onForget: () => { this.confirmForget(computer); } }) }.width('100%')
          }, (computer: Computer) => computer.id)
          Column() { ComputerCover({ adding: true, cardHeight: this.computerCardHeight(), onContinue: () => { this.showPanel(ConnectPanel.Add); } }) }.width('100%')
        }.index(this.selectedIndex()).loop(false).itemSpace(10).curve(curves.interpolatingSpring(-1, 1, 390, 38))
          .indicator(this.computers.length > 0 ? Indicator.dot().itemWidth(5).itemHeight(5).selectedItemWidth(16).selectedItemHeight(5).color($r('app.color.line')).selectedColor($r('app.color.ink')) : false)
          .width('100%').height(this.computerCardHeight() + 28)
          .onChange((index: number) => { this.selectedComputerId = this.computers[index]?.id || 'add-computer'; })
      }.width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
      Button({ type: ButtonType.Normal }) {
        Row({ space: 10 }) {
          Text('使用帮助').fontSize(13).fontColor($r('app.color.ink'))
          SymbolGlyph($r('sys.symbol.chevron_right')).fontSize(12).fontColor([$r('app.color.muted')])
        }.height(44).padding({ left: 20, right: 18 }).borderRadius(14).clip(true).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface'))
      }.height(44).padding(0).borderRadius(14).backgroundColor(Color.Transparent).margin({ top: 8, bottom: 4 }).accessibilityText('使用帮助').onClick(() => { this.showPanel(ConnectPanel.Help); })
    }.width('100%').layoutWeight(1).alignItems(HorizontalAlign.Center)
  }
  @Builder private settingRow(label: string, value: string, action: () => void) {
    Button({ type: ButtonType.Normal }) {
      Row({ space: 12 }) {
        Text(label).fontSize(15).fontColor($r('app.color.ink')).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(value).fontSize(12).fontColor($r('app.color.muted')).maxLines(1).constraintSize({ maxWidth: '46%' }).textOverflow({ overflow: TextOverflow.Ellipsis })
        SymbolGlyph($r('sys.symbol.chevron_right')).fontSize(12).fontColor([$r('app.color.muted')])
      }.width('100%')
    }.width('100%').height(58).padding({ left: 16, right: 16 }).backgroundColor(Color.Transparent).borderRadius(0).onClick(action)
  }
  @Builder private addForm() {
    Column({ space: 0 }) {
        Button({ type: ButtonType.Normal }) {
          Row({ space: 10 }) {
            SymbolGlyph($r('sys.symbol.computer')).fontSize(23).fontColor([$r('app.color.ink')])
            Text('扫描电脑二维码').fontSize(14).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).layoutWeight(1)
            SymbolGlyph($r('sys.symbol.chevron_right')).fontSize(13).fontColor([$r('app.color.muted')])
          }.width('100%')
        }.height(58).width('100%').padding(14).borderRadius(16).backgroundColor($r('app.color.surface_alt')).accessibilityText('扫描电脑二维码').onClick(() => { this.scan(); })
        Text('或输入配对链接').fontSize(12).fontColor($r('app.color.muted')).width('100%').margin({ top: 20, bottom: 10 })
        TextInput({ text: this.addressInput, placeholder: '粘贴完整配对链接' }).type(InputType.URL).enterKeyType(EnterKeyType.Go).fontSize(14).placeholderFont({ size: 13 }).height(52).borderRadius(14).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface_alt')).fontColor($r('app.color.ink')).accessibilityText('电脑连接地址').maxLength(8192).onChange((value: string) => { this.addressInput = value; }).onFocus(() => { this.linkFocused = true; this.panelScroller.scrollEdge(Edge.Bottom); }).onBlur(() => { this.linkFocused = false; }).onSubmit(() => { if (this.addressInput.trim()) this.openAddress(this.addressInput, ''); })
        Button('连接电脑').height(48).width('100%').borderRadius(15).fontSize(14).fontWeight(FontWeight.Medium).fontColor(Color.White).backgroundColor('#4D6BFE').enabled(this.addressInput.trim().length > 0).margin({ top: 18 }).onClick(() => { this.openAddress(this.addressInput, ''); })
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private settings() {
    Column({ space: 18 }) {
      Text('连接').fontSize(12).fontColor($r('app.color.muted')).width('100%').margin({ top: 4, bottom: -8 })
      this.recoveryOptions()
      Text('电脑').fontSize(12).fontColor($r('app.color.muted')).width('100%').margin({ top: 4, bottom: -8 })
      Column() {
        ForEach(this.computers, (computer: Computer) => {
          this.settingRow(computer.name, computer.id === this.mainComputer().id ? '主电脑' : '', () => { this.manageComputer(computer); })
          Divider().color($r('app.color.line')).margin({ left: 16, right: 16 }).width('auto')
        }, (computer: Computer) => computer.id)
        this.settingRow('添加电脑', '', () => { this.showPanel(ConnectPanel.Add); })
      }.width('100%').borderRadius(20).clip(true).backgroundColor($r('app.color.surface'))
      Text('关于').fontSize(12).fontColor($r('app.color.muted')).width('100%').margin({ top: 4, bottom: -8 })
      Column() {
        this.settingRow(this.updateChecking ? '正在检查…' : this.updateAvailable ? '获取新版本' : '检查更新', APP_VERSION, () => { if (this.updateAvailable) this.openProject(true); else this.checkUpdate(); })
        Divider().color($r('app.color.line')).margin({ left: 16, right: 16 }).width('auto')
        this.settingRow('问题反馈', '', () => { this.openProject(false); })
      }.width('100%').borderRadius(20).clip(true).backgroundColor($r('app.color.surface'))
      if (this.updateMessage !== '检查是否有新版本') { Text(this.updateMessage).fontSize(12).lineHeight(20).fontColor($r('app.color.muted')).width('100%') }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private nativePanel() {
    Scroll(this.panelScroller) {
      Column({ space: 12 }) {
        if (this.message && this.panel !== ConnectPanel.ConnectionError) {
          Text(this.message).fontSize(13).lineHeight(21).fontColor($r('app.color.ink')).width('100%')
        }
        if (this.panel === ConnectPanel.Settings) { this.settings() }
        else if (this.panel === ConnectPanel.Help) { this.help() }
        else if (this.panel === ConnectPanel.Add) { this.addForm() }
        else if (this.panel === ConnectPanel.Rename) { this.renameForm() }
        else if (this.panel === ConnectPanel.Remove) { this.removeForm() }
        else if (this.panel === ConnectPanel.ConnectionError) { this.connectionErrorPanel() }
        else { this.uploadSheet() }
      }.width('100%').constraintSize({ maxWidth: 560 })
        .padding({ left: 20, right: 20, top: 8, bottom: this.keyboardVisible ? 12 : Math.max(20, this.bottomInset + 4) })
    }.width('100%').height(this.panelHeight() === SheetSize.FIT_CONTENT ? 'auto' : '100%')
      .constraintSize({ maxHeight: this.panelHeight() === SheetSize.FIT_CONTENT ? this.pageHeight * 0.58 : '100%' })
      .align(Alignment.Top).scrollBar(BarState.Auto).edgeEffect(EdgeEffect.Spring)
      .onAreaChange(() => { if (this.linkFocused) this.panelScroller.scrollEdge(Edge.Bottom); })
  }
  @Builder private help() {
    Column({ space: 14 }) {
      Text('在电脑上准备配对').fontSize(16).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).width('100%')
      Column({ space: 12 }) {
        Text('1  打开电脑上的 DeepSeek Harness。').fontSize(14).lineHeight(24).fontColor($r('app.color.ink')).width('100%')
        Text('2  进入「设置 → DSH Connect」，生成配对二维码或链接。').fontSize(14).lineHeight(24).fontColor($r('app.color.ink')).width('100%')
        Text('3  在手机上扫描二维码，或粘贴完整配对链接。').fontSize(14).lineHeight(24).fontColor($r('app.color.ink')).width('100%')
      }.width('100%').padding(16).borderRadius(18).backgroundColor($r('app.color.surface_alt'))
      Button('扫描电脑二维码').height(50).width('100%').borderRadius(15).fontSize(14).fontColor(Color.White).backgroundColor('#4D6BFE').onClick(() => { this.scan(); })
      Button('使用配对链接').height(48).width('100%').borderRadius(15).fontSize(13).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface_alt')).onClick(() => { this.showPanel(ConnectPanel.Add); })
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private renameForm() {
    Column({ space: 18 }) {
      TextInput({ text: this.editName, placeholder: '电脑名称' }).fontSize(14).height(52).borderRadius(14).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface_alt')).maxLength(40).accessibilityText('电脑名称').onChange((value: string) => { this.editName = value; })
      Button('保存名称').height(50).width('100%').borderRadius(15).fontSize(14).fontColor(Color.White).backgroundColor('#4D6BFE').enabled(this.editName.trim().length > 0).onClick(() => { this.saveName(); })
    }.width('100%')
  }
  @Builder private removeForm() {
    Column({ space: 18 }) {
      Text('移除「' + this.removalTarget.name + '」后，可以重新配对添加。电脑上的会话会保留。')
        .width('100%').fontSize(14).lineHeight(23).fontColor($r('app.color.ink'))
      Row({ space: 12 }) {
        Button('取消').layoutWeight(1).height(48).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface_alt'))
          .enabled(!this.removing).onClick(() => { this.goBackInPanel(); })
        Button('移除', { role: ButtonRole.ERROR }).layoutWeight(1).height(48)
          .enabled(!this.removing).onClick(() => { this.forget(this.removalTarget); })
      }.width('100%')
    }.width('100%')
  }
  @Builder private connectionErrorPanel() {
    Column({ space: 14 }) {
      Text(this.message).width('100%').fontSize(14).lineHeight(23).fontColor($r('app.color.ink'))
      Button('重新连接').height(48).width('100%').fontColor(Color.White).backgroundColor('#4D6BFE')
        .onClick(() => { this.openAddress(this.retryAddress || this.activeUrl, this.activeName); })
    }.width('100%')
  }
  @Builder private uploadSheet() {
    Column({ space: 12 }) {
      Button('拍照').height(52).width('100%').borderRadius(16).backgroundColor($r('app.color.surface_alt')).fontColor($r('app.color.ink')).onClick(() => { this.chooseFiles('camera'); })
      Button('从相册选择').height(52).width('100%').borderRadius(16).backgroundColor($r('app.color.surface_alt')).fontColor($r('app.color.ink')).onClick(() => { this.chooseFiles('album'); })
      Button('浏览文件').height(52).width('100%').borderRadius(16).backgroundColor($r('app.color.surface_alt')).fontColor($r('app.color.ink')).onClick(() => { this.chooseFiles('documents'); })
    }.width('100%')
  }
  @Builder private workspaceToolbar() {
    Row({ space: 4 }) {
      Button({ type: ButtonType.Circle, buttonStyle: ButtonStyleMode.TEXTUAL }) {
        SymbolGlyph($r('sys.symbol.line_3_horizontal')).fontSize(19).fontColor([$r('app.color.ink')])
      }.width(44).height(44).padding(0).accessibilityText('会话与工作区')
        .onClick(() => {
          if (this.trustedPage()) this.webController.runJavaScript('window.__DSH_CONNECT_UI__?.toggleSidebar()').catch(() => {});
        })
      Text('DeepSeek Harness').layoutWeight(1).fontSize(14).fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.ink')).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      Image($r('app.media.cn_mark')).width(18).height(18).flexShrink(0).accessibilityText('DSH Connect')
      Button({ type: ButtonType.Circle, buttonStyle: ButtonStyleMode.TEXTUAL }) {
        SymbolGlyph($r('sys.symbol.computer')).fontSize(20).fontColor([$r('app.color.ink')])
      }.width(44).height(44).padding(0).accessibilityText('电脑与连接')
        .onClick(() => {
          if (this.trustedPage()) this.webController.runJavaScript('document.activeElement?.blur()').catch(() => {});
          this.managerVisible = true;
        })
    }.width('100%').height(44).alignItems(VerticalAlign.Center)
  }
  @Builder private workspaceWeb() {
    Web({ src: this.initialUrl, controller: this.webController })
        .javaScriptAccess(true).domStorageAccess(true).fileAccess(false).mixedMode(MixedMode.None).darkMode(WebDarkMode.Auto)
        .horizontalScrollBarAccess(false)
        .onControllerAttached(() => {
          this.attached = true;
          try { this.webController.setCustomUserAgent(this.webController.getUserAgent() + ' DSH-Connect/' + APP_VERSION); this.files?.downloads(this.webController); } catch (_) {}
          this.registerBridge(); this.waitForConnection();
        })
        .onPageEnd((event) => { this.documentLoaded(event?.url || ''); })
        .onPageBegin(() => { this.mainHttpError = 0; this.workspaceToolbarVisible = false; })
        .onHttpErrorReceive((event) => {
          if (!event?.request.isMainFrame()) return;
          this.mainHttpError = event.response.getResponseCode();
          this.connectionFailed(this.mainHttpError >= 500 ? '电脑服务暂时不可用，请稍后重试。' : '页面暂时无法打开，请重新连接。');
        })
        .onShowFileSelector((event) => {
          if (!event) return false;
          if (!this.trustedPage()) { event.result.handleFileList([]); return true; }
          this.finishFiles([]); this.pendingFiles = (items: string[]) => { event.result.handleFileList(items); };
          this.accepts = event.fileSelector.getAcceptType(); this.multiple = event.fileSelector.getMode() === FileSelectorMode.FileOpenMultipleMode;
          this.showPanel(ConnectPanel.Attachments); return true;
        })
        .onLoadIntercept((event) => {
          if (!event?.data.isMainFrame()) return false;
          const address = event.data.getRequestUrl(); if (address === 'about:blank') return false;
          try {
            const target = new url.URL(address); if (target.origin === this.currentOrigin) return false;
            if (target.protocol === 'https:') (this.getUIContext().getHostContext() as common.UIAbilityContext).startAbility({ action: 'ohos.want.action.viewData', entities: ['entity.system.browsable'], uri: address }).catch(() => {});
          } catch (_) {}
          return true;
        })
        .onErrorReceive((event) => {
          if (!event?.request.isMainFrame() || event.error.getErrorCode() === -3) return;
          this.connectionFailed('暂时无法访问这台电脑，请检查网络后重试。');
        })
        .onRenderExited(() => { this.connectionFailed('页面已停止运行，请重新连接。'); })
        .width('100%').layoutWeight(1)
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
  }
  build() {
    Stack() {
      if (this.activeUrl.length > 0) {
        Column() {
          if (this.workspaceToolbarVisible) {
            this.workspaceToolbar()
          }
          this.workspaceWeb()
        }.width('100%').height('100%')
          .accessibilityLevel(this.managerVisible || this.phase === 'connecting' ? 'no-hide-descendants' : 'auto')
      }
      if (!this.loaded || this.phase === 'connecting') {
        ConnectionLoading({ computerName: this.activeName, onBack: () => { this.clearTimer(); this.managerVisible = true; } })
          .accessibilityLevel(this.managerVisible ? 'no-hide-descendants' : 'auto')
          .transition(TransitionEffect.asymmetric(TransitionEffect.IDENTITY,
            TransitionEffect.opacity(0).animation({ duration: 160, curve: Curve.Friction })))
      }
      if (this.managerVisible && this.loaded) {
        Column() {
          Column() {
            this.header()
            this.home()
          }.constraintSize({ maxWidth: 560 }).width('100%').height('100%')
            .padding({ left: 20, right: 20, top: 12, bottom: this.bottomInset + 8 }).backgroundColor($r('app.color.connector_background'))
        }.width('100%').height('100%').backgroundColor($r('app.color.connector_background'))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
          .transition(TransitionEffect.asymmetric(
            TransitionEffect.translate({ y: 16 }).combine(TransitionEffect.opacity(0)).animation({ duration: 260, curve: Curve.Friction }),
            TransitionEffect.translate({ y: -12 }).combine(TransitionEffect.opacity(0)).animation({ duration: 220, curve: Curve.FastOutSlowIn })))
      }
    }.width('100%').height('100%').backgroundColor(this.managerVisible || this.phase === 'connecting' ? $r('app.color.connector_background') : $r('app.color.surface'))
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      .onAreaChange((_previous: Area, area: Area) => { this.pageWidth = Number(area.width); this.pageHeight = Number(area.height); })
      .bindSheet($$this.panelVisible, this.nativePanel(), {
        preferType: SheetType.BOTTOM,
        height: this.panelHeight(),
        title: { title: this.panelTitle() },
        showClose: true,
        backgroundColor: this.panel === ConnectPanel.Settings ? $r('app.color.connector_background') : $r('app.color.surface'),
        keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
        onWillDismiss: (action: DismissSheetAction) => {
          if ((action.reason === DismissReason.PRESS_BACK || action.reason === DismissReason.SLIDE) && this.restoreParentPanel()) return;
          action.dismiss();
        },
        onDisappear: () => { this.panelClosed(); }
      })
  }
}
