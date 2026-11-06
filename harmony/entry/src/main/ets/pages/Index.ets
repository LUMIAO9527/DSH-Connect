import { common } from '@kit.AbilityKit';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { scanBarcode, scanCore } from '@kit.ScanKit';
import { url } from '@kit.ArkTS';
import { Computer, ComputerStore, parseAddress, connectorPermission } from '../model/ComputerStore';
import { FileSupport } from '../model/FileSupport';
import { APP_VERSION } from '../model/Version';
import { checkRelease, RELEASE_URL, PROJECT_URL, ReleaseResult } from '../model/ReleaseInfo';
import { ComputerCover, ConnectionLoading, ConnectionIssue } from '../components/ConnectionViews';

class ConnectorBridge {
  private show: () => void;
  private changed: (state: string) => void;
  constructor(show: () => void, changed: (state: string) => void) { this.show = show; this.changed = changed; }
  showComputers(): void { this.show(); }
  connectionChanged(state: string): void { this.changed(state); }
}

@Entry
@Component
struct Index {
  @State private computers: Computer[] = [];
  @State private managerVisible: boolean = false;
  @State private adding: boolean = false;
  @State private settingsVisible: boolean = false;
  @State private updateChecking: boolean = false;
  @State private updateAvailable: boolean = false;
  @State private updateMessage: string = '检查是否有新版本';
  @State private uploadVisible: boolean = false;
  @State private pickerBusy: boolean = false;
  @State private autoConnect: boolean = true;
  @State private resumeToWorkspace: boolean = true;
  @State private selectedComputerId: string = '';
  @State private nameInput: string = '';
  @State private addressInput: string = '';
  @State private activeName: string = '';
  @State private phase: string = 'idle';
  @State private connectionState: string = 'connecting';
  @State private message: string = '';
  @State private pageWidth: number = 390;
  @State private pageHeight: number = 780;
  @State private primaryId: string = '';
  @State private nameExpanded: boolean = false;
  @State private helpVisible: boolean = false;
  @State private editingId: string = '';
  @State private editName: string = '';
  @StorageLink('dshLaunchUrl') @Watch('consumeLaunch') private launchUrl: string = '';
  @StorageLink('dshBottomInset') private bottomInset: number = 0;
  @StorageLink('dshForeground') @Watch('foregroundChanged') private foreground: number = 0;
  private webController: webview.WebviewController = new webview.WebviewController();
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
  private bridge: ConnectorBridge = new ConnectorBridge(() => { this.managerVisible = true; }, (state: string) => { this.onConnection(state); });

  aboutToAppear(): void {
    this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.store = new ComputerStore(context);
    this.files = new FileSupport(context, (text: string) => { this.getUIContext().getPromptAction().showToast({ message: text }); });
    this.store.loadAutoConnect().then((enabled: boolean) => { this.autoConnect = enabled; return this.store!.loadResumeToWorkspace(); }).then((enabled: boolean) => { this.resumeToWorkspace = enabled; return this.store!.loadPrimaryComputer(); }).then((id: string) => { this.primaryId = id; return this.store!.load(); }).then((rows: Computer[]) => {
      this.computers = rows; this.loaded = true;
      if (this.launchUrl) { this.consumeLaunch(); return; }
      if (!this.startup || !this.autoConnect || this.adding) { this.managerVisible = true; return; }
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
      this.phase = 'failed'; this.managerVisible = true;
      this.message = this.connectorAvailable ? '还没有连接上电脑。请确认电脑与 DSH 已打开，然后重试。' : '此地址没有提供可用的 DSH Connect 工作区。请在电脑设置中重新生成配对链接。';
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
      this.adding = false; this.settingsVisible = false; this.helpVisible = false; this.editingId = ''; this.managerVisible = false;
      if (this.attached) this.loadActive();
    } catch (_) { this.message = '请填写电脑端生成的完整 HTTPS 配对链接。'; this.managerVisible = true; }
  }
  private registerBridge(): void {
    if (!this.attached || !this.currentOrigin) return;
    try { this.webController.deleteJavaScriptRegister('HarmonyConnector'); } catch (_) {}
    this.webController.registerJavaScriptProxy(this.bridge, 'HarmonyConnector', ['showComputers', 'connectionChanged'], [], connectorPermission(this.currentOrigin));
  }
  private loadActive(): void {
    try {
      this.registerBridge(); this.webController.loadUrl(this.activeUrl); this.waitForConnection();
    } catch (_) { this.managerVisible = true; this.message = '页面暂时无法打开，请重试。'; }
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
    if (!this.resumeToWorkspace) { this.managerVisible = true; return; }
    this.resumeConnection();
  }
  private async changeAutoConnect(enabled: boolean): Promise<void> {
    const previous = this.autoConnect; this.autoConnect = enabled;
    try { await this.store?.saveAutoConnect(enabled); }
    catch (_) { this.autoConnect = previous; this.getUIContext().getPromptAction().showToast({ message: '设置未能保存，请重试。' }); }
  }
  private async changeResumeToWorkspace(enabled: boolean): Promise<void> {
    const previous = this.resumeToWorkspace; this.resumeToWorkspace = enabled;
    try { await this.store?.saveResumeToWorkspace(enabled); }
    catch (_) { this.resumeToWorkspace = previous; this.getUIContext().getPromptAction().showToast({ message: '设置未能保存，请重试。' }); }
  }
  private continueComputer(computer: Computer): void {
    this.startup = false;
    if (this.attached && this.phase === 'ready' && this.savedAddress === computer.address && this.trustedPage()) {
      this.managerVisible = false; this.message = ''; this.resumeConnection(); return;
    }
    this.openAddress(computer.address, computer.name);
  }
  private computerStatus(computer: Computer): string {
    if (!this.activeUrl || this.savedAddress !== computer.address) return '点击连接';
    if (this.phase === 'ready') return this.connectionState === 'connected' ? '已连接 · 继续工作' : this.connectionState === 'offline' ? '网络已断开 · 返回工作区' : '恢复连接中 · 返回工作区';
    return this.phase === 'pairing' ? '等待配对' : '点击连接';
  }
  private finishFiles(items: string[]): void { this.fileRequest++; const callback = this.pendingFiles; this.pendingFiles = null; this.uploadVisible = false; this.pickerBusy = false; if (callback) callback(items); }
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
    const rows = this.computers.filter((item: Computer) => item.id !== computer.id);
    try {
      await this.store?.save(rows); this.computers = rows;
      if (this.primaryId === computer.id) { const next = rows.length ? this.mainComputer().id : ''; await this.store?.savePrimaryComputer(next); this.primaryId = next; }
    } catch (_) { this.message = '暂时无法移除，请重试。'; }
  }
  private confirmForget(computer: Computer): void {
    this.getUIContext().showAlertDialog({ title: '移除这台电脑？', message: '电脑上的会话会保留。以后可以重新扫码添加。', primaryButton: { value: '取消', action: () => {} }, secondaryButton: { value: '移除', action: () => { this.forget(computer); } } });
  }
  onBackPress(): boolean {
    if (this.uploadVisible) { this.finishFiles([]); return true; }
    if (this.adding || this.settingsVisible || this.helpVisible || this.editingId) { this.adding = false; this.settingsVisible = false; this.helpVisible = false; this.editingId = ''; this.message = ''; return true; }
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
    const index = this.computers.findIndex((item: Computer) => item.id === this.selectedComputerId);
    if (index >= 0) return index;
    const primary = this.computers.findIndex((item: Computer) => item.id === this.mainComputer().id);
    return primary >= 0 ? primary : 0;
  }
  private selectedComputer(): Computer { return this.computers[this.selectedIndex()] || this.mainComputer(); }
  private computerCardHeight(): number { return Math.min(360, Math.max(250, this.pageHeight - 446)); }
  private latestComputer(): Computer {
    let latest: Computer = this.computers[0] || new Computer('', '我的电脑', '');
    for (const item of this.computers) if (item.lastConnectedAt > latest.lastConnectedAt) latest = item;
    return latest;
  }
  private openAdd(): void { this.startup = false; this.adding = true; this.helpVisible = false; this.settingsVisible = false; this.message = ''; this.nameExpanded = false; }
  private async manageComputer(computer: Computer): Promise<void> {
    try {
      const result = await this.getUIContext().getPromptAction().showActionMenu({ title: computer.name, buttons: [
        { text: this.mainComputer().id === computer.id ? '当前主电脑' : '设为主电脑', color: $r('app.color.ink') },
        { text: '重命名', color: $r('app.color.ink') }, { text: '移除这台电脑', color: '#D45151' }
      ] });
      if (result.index === 0) {
        try { await this.store?.savePrimaryComputer(computer.id); this.primaryId = computer.id; }
        catch (_) { this.message = '主电脑暂时未能保存，请重试。'; }
      }
      else if (result.index === 1) { this.editingId = computer.id; this.editName = computer.name; this.message = ''; }
      else if (result.index === 2) this.confirmForget(computer);
    } catch (_) {}
  }
  private async saveName(): Promise<void> {
    const value = this.editName.trim(); if (!value) return;
    const rows = this.computers.map((item: Computer) => new Computer(item.id, item.id === this.editingId ? value : item.name, item.address, item.lastConnectedAt));
    try {
      await this.store?.save(rows); this.computers = rows;
      const renamed = rows.find((item: Computer) => item.id === this.editingId);
      if (renamed && renamed.address === this.savedAddress) this.activeName = renamed.name;
      this.editingId = '';
    } catch (_) { this.message = '名称暂时未能保存，请重试。'; }
  }
  @Builder private header() {
    Row({ space: 6 }) {
      if (this.adding || this.settingsVisible || this.helpVisible || this.editingId) {
        Button({ type: ButtonType.Circle }) { SymbolGlyph($r('sys.symbol.chevron_left')).fontSize(20).fontColor([$r('app.color.ink')]) }.width(44).height(44).padding(0).flexShrink(0).backgroundColor(Color.Transparent).accessibilityText('返回').onClick(() => {
          if (this.adding || this.settingsVisible || this.helpVisible || this.editingId) { this.adding = false; this.settingsVisible = false; this.helpVisible = false; this.editingId = ''; this.message = ''; }
          else { this.managerVisible = false; this.resumeConnection(); }
        })
      }
      Image($r('app.media.cn_mark')).width(30).height(30).flexShrink(0).accessibilityText('DSH Connect')
      Text('DSH Connect').fontSize(18).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      if (!this.adding && !this.settingsVisible && !this.helpVisible && !this.editingId) {
        Button({ type: ButtonType.Circle }) { Text('+').fontSize(27).fontColor($r('app.color.ink')) }.width(44).height(44).padding(0).flexShrink(0).backgroundColor(Color.Transparent).accessibilityText('添加电脑').onClick(() => { this.openAdd(); })
        Button({ type: ButtonType.Circle }) { SymbolGlyph($r('sys.symbol.gearshape')).fontSize(21).fontColor([$r('app.color.ink')]) }.width(44).height(44).padding(0).flexShrink(0).backgroundColor(Color.Transparent).accessibilityText('连接设置').onClick(() => { this.startup = false; this.settingsVisible = true; this.message = ''; })
      }
    }.width('100%').margin({ bottom: 20 })
  }
  @Builder private recoveryOptions() {
    Column() {
      Row({ space: 10 }) {
        Column({ space: 5 }) {
          Text('重新打开').fontSize(13).fontColor($r('app.color.ink'))
          Text('恢复最近的工作页面').fontSize(11).fontColor($r('app.color.muted'))
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Select([{ value: '自动恢复' }, { value: '先选电脑' }]).selected(this.autoConnect ? 0 : 1).value(this.autoConnect ? '自动恢复' : '先选电脑').font({ size: 12 }).fontColor($r('app.color.ink')).optionFont({ size: 14 }).optionFontColor($r('app.color.ink')).selectedOptionFontColor('#4D6BFE').menuBackgroundColor($r('app.color.surface')).backgroundColor(Color.Transparent).width(128).height(44).accessibilityText('重新打开应用').onSelect((index: number) => { this.changeAutoConnect(index === 0); })
      }.width('100%').padding({ top: 10, bottom: 10 })
      Divider().color($r('app.color.line'))
      Row({ space: 10 }) {
        Column({ space: 5 }) {
          Text('从后台回来').fontSize(13).fontColor($r('app.color.ink'))
          Text('保留当前会话与草稿').fontSize(11).fontColor($r('app.color.muted'))
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Select([{ value: '继续原位置' }, { value: '先选电脑' }]).selected(this.resumeToWorkspace ? 0 : 1).value(this.resumeToWorkspace ? '继续原位置' : '先选电脑').font({ size: 12 }).fontColor($r('app.color.ink')).optionFont({ size: 14 }).optionFontColor($r('app.color.ink')).selectedOptionFontColor('#4D6BFE').menuBackgroundColor($r('app.color.surface')).backgroundColor(Color.Transparent).width(128).height(44).accessibilityText('从后台返回应用').onSelect((index: number) => { this.changeResumeToWorkspace(index === 0); })
      }.width('100%').padding({ top: 10, bottom: 10 })
    }.width('100%').padding({ left: 16, right: 10 }).borderRadius(20).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface'))
  }
  @Builder private home() {
    Column({ space: 0 }) {
        Text('我的电脑').fontSize(25).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
        Text(this.computers.length === 0 ? '添加电脑，连接你的 DeepSeek Harness。' : this.computers.length > 1 ? '左右滑动，选择要连接的电脑。' : '已保存的连接，随时继续。').fontSize(12).fontColor($r('app.color.muted')).width('100%').margin({ top: 7, bottom: 20 })
        if (this.computers.length === 0) {
          ComputerCover({ computerName: '添加第一台电脑', cardHeight: this.computerCardHeight(), unpaired: true, onContinue: () => { this.openAdd(); } })
        } else {
        Swiper() {
          ForEach(this.computers, (computer: Computer) => {
            ComputerCover({ computerName: computer.name, cardHeight: this.computerCardHeight(), onContinue: () => { this.continueComputer(computer); }, onManage: () => { this.manageComputer(computer); } })
          }, (computer: Computer) => computer.id)
        }.index(this.selectedIndex()).loop(false).indicator(this.computers.length > 1 ? Indicator.dot().itemWidth(6).itemHeight(6).selectedItemWidth(18).selectedItemHeight(6).color($r('app.color.line')).selectedColor('#4D6BFE') : false).disableSwipe(this.computers.length < 2).width('100%').height(this.computerCardHeight() + (this.computers.length > 1 ? 28 : 0)).onChange((index: number) => { if (this.computers[index]) this.selectedComputerId = this.computers[index].id; })
        }
        if (this.computers.length === 0) {
          Button('添加电脑').height(50).width('100%').borderRadius(15).fontSize(14).fontWeight(FontWeight.Medium).backgroundColor('#4D6BFE').fontColor(Color.White).margin({ top: 16, bottom: 18 }).onClick(() => { this.openAdd(); })
          Text('在电脑「设置 → DSH Connect」中生成配对码，扫码或粘贴链接即可添加。').fontSize(12).lineHeight(21).fontColor($r('app.color.muted')).width('100%')
        } else {
        Button(this.phase === 'ready' && this.savedAddress === this.selectedComputer().address ? '返回工作区' : '连接电脑').height(50).width('100%').borderRadius(15).fontSize(14).fontWeight(FontWeight.Medium).backgroundColor('#4D6BFE').fontColor(Color.White).margin({ top: 16, bottom: 18 }).accessibilityText('连接' + this.selectedComputer().name).onClick(() => { this.continueComputer(this.selectedComputer()); })
        this.recoveryOptions()
        }
        Button('配对与连接帮助  ›').height(44).padding(0).fontSize(12).fontColor('#4D6BFE').backgroundColor(Color.Transparent).margin({ top: 12 }).onClick(() => { this.helpVisible = true; this.message = ''; })
      }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private addForm() {
    Column({ space: 0 }) {
      Text('添加电脑').fontSize(25).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
      Text('使用电脑插件生成的配对码或完整链接。').fontSize(13).lineHeight(22).fontColor($r('app.color.muted')).width('100%').margin({ top: 10, bottom: 24 })
      Column({ space: 0 }) {
        Button({ type: ButtonType.Normal }) {
          Row({ space: 10 }) {
            SymbolGlyph($r('sys.symbol.computer')).fontSize(23).fontColor([$r('app.color.ink')])
            Column({ space: 5 }) { Text('扫描电脑二维码').fontSize(13).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')); Text('在电脑的 DSH Connect 设置中获取').fontSize(10).fontColor($r('app.color.muted')) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            SymbolGlyph($r('sys.symbol.chevron_right')).fontSize(13).fontColor([$r('app.color.muted')])
          }.width('100%')
        }.height(72).width('100%').padding(13).borderRadius(16).backgroundColor($r('app.color.surface_alt')).accessibilityText('扫描电脑二维码').onClick(() => { this.scan(); })
        Text('或使用配对链接').fontSize(12).fontColor($r('app.color.ink')).width('100%').margin({ top: 22, bottom: 10 })
        TextArea({ text: this.addressInput, placeholder: '粘贴完整配对链接' }).fontSize(14).placeholderFont({ size: 13 }).height(88).borderRadius(13).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.connector_background')).fontColor($r('app.color.ink')).accessibilityText('电脑连接地址').maxLength(8192).onChange((value: string) => { this.addressInput = value; })
        Button((this.nameExpanded ? '−  ' : '+  ') + '电脑名称（选填）').height(46).padding(0).fontSize(11).fontColor($r('app.color.muted')).backgroundColor(Color.Transparent).onClick(() => { this.nameExpanded = !this.nameExpanded; })
        if (this.nameExpanded) { TextInput({ text: this.nameInput, placeholder: '我的电脑' }).fontSize(14).placeholderFont({ size: 13 }).height(48).borderRadius(13).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.connector_background')).fontColor($r('app.color.ink')).accessibilityText('电脑名称').maxLength(40).margin({ bottom: 14 }).onChange((value: string) => { this.nameInput = value; }) }
        Button('连接并记住').height(50).width('100%').borderRadius(15).fontSize(14).fontWeight(FontWeight.Medium).fontColor(Color.White).backgroundColor('#4D6BFE').enabled(this.addressInput.trim().length > 0).onClick(() => { this.openAddress(this.addressInput, this.nameInput); })
      }.width('100%').padding(20).borderRadius(24).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface')).alignItems(HorizontalAlign.Start)
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private settings() {
    Column({ space: 18 }) {
      Text('连接设置').fontSize(25).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
      Text('版本 ' + APP_VERSION).fontSize(12).fontColor($r('app.color.muted')).width('100%')
      this.recoveryOptions()
      Column({ space: 12 }) {
        Text('版本更新').fontSize(14).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).width('100%')
        Text(this.updateMessage).fontSize(12).lineHeight(21).fontColor($r('app.color.muted')).width('100%')
        Button(this.updateChecking ? '正在检查…' : this.updateAvailable ? '查看新版' : '检查更新').width('100%').height(44).borderRadius(14).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface_alt')).enabled(!this.updateChecking).onClick(() => { if (this.updateAvailable) this.openProject(true); else this.checkUpdate(); })
        Text('从发布页获取适配当前设备的安装包。覆盖安装会保留已保存的电脑。').fontSize(11).lineHeight(20).fontColor($r('app.color.muted')).width('100%')
      }.width('100%').padding(20).borderRadius(20).backgroundColor($r('app.color.surface'))
      Column({ space: 12 }) {
        Text('使用与卸载').fontSize(14).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).width('100%')
        Button('首次连接说明').width('100%').height(42).borderRadius(14).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface_alt')).onClick(() => { this.settingsVisible = false; this.helpVisible = true; })
        Button('项目与问题反馈').width('100%').height(42).borderRadius(14).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface_alt')).onClick(() => { this.openProject(false); })
        Text('卸载：在手机桌面长按 DSH Connect 图标，选择卸载。本机保存的电脑连接和登录状态会被移除；电脑上的 DSH 工作区和文件仍由 DSH 管理。').fontSize(11).lineHeight(20).fontColor($r('app.color.muted')).width('100%')
      }.width('100%').padding(20).borderRadius(20).backgroundColor($r('app.color.surface'))
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private help() {
    Column({ space: 22 }) {
      Text('在电脑上准备配对').fontSize(25).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
      Column({ space: 22 }) {
        Text('1  打开电脑上的 DeepSeek Harness。').fontSize(14).lineHeight(24).fontColor($r('app.color.ink')).width('100%')
        Text('2  进入「设置 → DSH Connect」，生成配对二维码或链接。').fontSize(14).lineHeight(24).fontColor($r('app.color.ink')).width('100%')
        Text('3  在手机上扫描二维码，或粘贴完整配对链接。').fontSize(14).lineHeight(24).fontColor($r('app.color.ink')).width('100%')
      }.width('100%').padding(22).borderRadius(24).backgroundColor($r('app.color.surface'))
      Button('扫描电脑二维码').height(50).width('100%').borderRadius(15).fontSize(14).fontColor(Color.White).backgroundColor('#4D6BFE').onClick(() => { this.scan(); })
      Button('使用配对链接').height(48).width('100%').borderRadius(15).fontSize(13).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface')).onClick(() => { this.openAdd(); })
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private renameForm() {
    Column({ space: 18 }) {
      Text('电脑名称').fontSize(25).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
      TextInput({ text: this.editName, placeholder: '电脑名称' }).fontSize(14).height(52).borderRadius(14).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface')).maxLength(40).accessibilityText('电脑名称').onChange((value: string) => { this.editName = value; })
      Button('保存名称').height(50).width('100%').borderRadius(15).fontSize(14).fontColor(Color.White).backgroundColor('#4D6BFE').enabled(this.editName.trim().length > 0).onClick(() => { this.saveName(); })
    }.width('100%')
  }
  @Builder private uploadSheet() {
    Column({ space: 12 }) {
      Text('添加附件').fontSize(18).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).width('100%').margin({ bottom: 10 })
      Button('拍照').height(52).width('100%').borderRadius(16).backgroundColor($r('app.color.surface_alt')).fontColor($r('app.color.ink')).onClick(() => { this.chooseFiles('camera'); })
      Button('从相册选择').height(52).width('100%').borderRadius(16).backgroundColor($r('app.color.surface_alt')).fontColor($r('app.color.ink')).onClick(() => { this.chooseFiles('album'); })
      Button('浏览文件').height(52).width('100%').borderRadius(16).backgroundColor($r('app.color.surface_alt')).fontColor($r('app.color.ink')).onClick(() => { this.chooseFiles('documents'); })
      Button('取消').height(48).width('100%').backgroundColor(Color.Transparent).fontColor($r('app.color.muted')).onClick(() => { this.finishFiles([]); })
    }.padding({ left: 24, right: 24, top: 14, bottom: this.bottomInset + 18 }).width('100%')
  }
  build() {
    Stack() {
      if (this.activeUrl.length > 0) {
      Web({ src: this.initialUrl, controller: this.webController })
        .javaScriptAccess(true).domStorageAccess(true).fileAccess(false).mixedMode(MixedMode.None).darkMode(WebDarkMode.Auto)
        .horizontalScrollBarAccess(false)
        .onControllerAttached(() => {
          this.attached = true;
          try { this.webController.setCustomUserAgent(this.webController.getUserAgent() + ' DSH-Connect/' + APP_VERSION); this.files?.downloads(this.webController); } catch (_) {}
          this.registerBridge(); this.waitForConnection();
        })
        .onPageEnd((event) => { this.documentLoaded(event?.url || ''); })
        .onPageBegin(() => { this.mainHttpError = 0; })
        .onHttpErrorReceive((event) => {
          if (!event?.request.isMainFrame()) return;
          this.mainHttpError = event.response.getResponseCode();
          this.clearTimer(); this.phase = 'failed'; this.managerVisible = true;
          this.message = this.mainHttpError >= 500 ? '电脑服务暂时不可用，请稍后重试。' : '页面暂时无法打开，请重新连接。';
        })
        .onShowFileSelector((event) => {
          if (!event) return false;
          if (!this.trustedPage()) { event.result.handleFileList([]); return true; }
          this.finishFiles([]); this.pendingFiles = (items: string[]) => { event.result.handleFileList(items); };
          this.accepts = event.fileSelector.getAcceptType(); this.multiple = event.fileSelector.getMode() === FileSelectorMode.FileOpenMultipleMode;
          this.uploadVisible = true; return true;
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
          this.clearTimer(); this.phase = 'failed'; this.managerVisible = true; this.message = '暂时无法访问这台电脑，请检查网络后重试。';
        })
        .onRenderExited(() => { this.clearTimer(); this.phase = 'failed'; this.managerVisible = true; this.message = '页面已停止运行，点击电脑卡片重新打开。'; })
        .width('100%').height('100%')
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
      }
      if (this.managerVisible && this.loaded) {
        Scroll() {
          Column() {
            this.header()
            if (this.message) { Text(this.message).fontSize(13).lineHeight(22).fontColor($r('app.color.ink')).padding(16).width('100%').backgroundColor($r('app.color.surface')).borderRadius(16).margin({ bottom: 20 }) }
            if (this.editingId) { this.renameForm() } else if (this.helpVisible) { this.help() } else if (this.settingsVisible) { this.settings() } else if (this.adding) { this.addForm() } else { this.home() }
          }.constraintSize({ maxWidth: 560 }).width('100%').padding({ left: 20, right: 20, top: 12, bottom: 24 })
        }.width('100%').height('100%').align(Alignment.Top).scrollBar(BarState.Off).backgroundColor($r('app.color.connector_background'))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
      }
      if (!this.loaded || !this.managerVisible && this.phase === 'connecting') {
        ConnectionLoading({ computerName: this.activeName, onBack: () => { this.clearTimer(); this.managerVisible = true; } })
      }
      if (this.managerVisible && this.phase === 'failed' && !this.adding && !this.settingsVisible && !this.helpVisible && !this.editingId) {
        Column() {
          ConnectionIssue({ detail: this.message, onRetry: () => { this.openAddress(this.retryAddress || this.activeUrl, this.activeName); }, onBack: () => { this.phase = 'idle'; this.message = ''; } })
        }.width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor($r('app.color.connector_background'))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
      }
    }.width('100%').height('100%').backgroundColor(this.managerVisible || this.phase === 'connecting' ? $r('app.color.connector_background') : $r('app.color.surface'))
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      .onAreaChange((_previous: Area, area: Area) => { this.pageWidth = Number(area.width); this.pageHeight = Number(area.height); })
      .bindSheet($$this.uploadVisible, this.uploadSheet(), { height: SheetSize.FIT_CONTENT, showClose: true, backgroundColor: $r('app.color.surface'), onDisappear: () => { this.finishFiles([]); } })
  }
}
