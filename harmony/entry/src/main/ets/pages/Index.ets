import { common } from '@kit.AbilityKit';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { scanBarcode, scanCore } from '@kit.ScanKit';
import { url } from '@kit.ArkTS';
import { Computer, ComputerStore, parseAddress, connectorPermission } from '../model/ComputerStore';
import { FileSupport } from '../model/FileSupport';
import { APP_VERSION } from '../model/Version';
import { PairingIntro, ComputerCover, ConnectionLoading, ConnectionIssue } from '../components/ConnectionViews';

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
  @State private uploadVisible: boolean = false;
  @State private pickerBusy: boolean = false;
  @State private autoConnect: boolean = true;
  @State private nameInput: string = '';
  @State private addressInput: string = '';
  @State private activeName: string = '';
  @State private phase: string = 'idle';
  @State private connectionState: string = 'connecting';
  @State private message: string = '';
  @State private pageWidth: number = 390;
  @State private primaryId: string = '';
  @State private othersExpanded: boolean = false;
  @State private nameExpanded: boolean = false;
  @State private helpVisible: boolean = false;
  @State private editingId: string = '';
  @State private editName: string = '';
  @StorageLink('dshLaunchUrl') @Watch('consumeLaunch') private launchUrl: string = '';
  @StorageLink('dshStatusInset') private topInset: number = 0;
  @StorageLink('dshBottomInset') private bottomInset: number = 0;
  @StorageLink('dshLeftInset') private leftInset: number = 0;
  @StorageLink('dshRightInset') private rightInset: number = 0;
  @StorageLink('dshForeground') @Watch('resumeConnection') private foreground: number = 0;
  private webController: webview.WebviewController = new webview.WebviewController();
  private store?: ComputerStore;
  private files?: FileSupport;
  @State private activeUrl: string = '';
  private initialUrl: string = '';
  private savedAddress: string = '';
  private currentOrigin: string = '';
  private attached: boolean = false;
  @State private loaded: boolean = false;
  private startup: boolean = true;
  private attempt: number = 0;
  private timer: number = -1;
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
    this.store.loadAutoConnect().then((enabled: boolean) => { this.autoConnect = enabled; return this.store!.loadPrimaryComputer(); }).then((id: string) => { this.primaryId = id; return this.store!.load(); }).then((rows: Computer[]) => {
      this.computers = rows; this.loaded = true;
      if (this.launchUrl) { this.consumeLaunch(); return; }
      if (!this.startup || !this.autoConnect || this.adding) { this.managerVisible = true; return; }
      this.startup = false;
      if (rows.length > 0) { const latest = this.latestComputer(); if (latest.lastConnectedAt > 0) { this.openAddress(latest.address, latest.name); return; } }
      this.managerVisible = true;
    }).catch(() => { this.loaded = true; this.managerVisible = true; this.message = '暂时无法读取已保存的电脑，可以重新添加。'; });
  }
  aboutToDisappear(): void { this.clearTimer(); this.finishFiles([]); this.files?.dispose(); }
  private clearTimer(): void { if (this.timer >= 0) clearTimeout(this.timer); this.timer = -1; }
  private waitForConnection(): void {
    this.clearTimer(); const current = this.attempt;
    this.timer = setTimeout(() => {
      if (current !== this.attempt || this.phase !== 'connecting') return;
      this.phase = 'failed'; this.managerVisible = true; this.message = '还没有连接上电脑。请确认电脑与 DSH 已打开，然后重试。';
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
      const known = this.computers.find((computer: Computer) => computer.address === parsed.saved);
      const hostname = new url.URL(parsed.origin).hostname;
      this.activeName = name.trim() || known?.name || (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' ? '我的电脑' : hostname.split('.')[0]);
      this.phase = 'connecting'; this.connectionState = 'connecting'; this.message = '';
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
      const current = this.attempt;
      if (this.phase !== 'ready') { this.phase = 'connecting'; this.waitForConnection(); }
      const result = await this.webController.runJavaScript('window.__DSH_CONNECT_UI__ ? (window.__DSH_CONNECT_UI__.setTransport(window.__DSH_CONNECT_TRANSPORT__ || "connecting"), "available") : "missing-connector"');
      if (current !== this.attempt) return;
      if (result.includes('missing-connector')) { this.clearTimer(); this.phase = 'failed'; this.managerVisible = true; this.message = '请先在电脑端更新 DSH Connect 到 1.0.0，再连接这台电脑。'; }
    } catch (_) {}
  }
  private trustedPage(): boolean { try { return new url.URL(this.webController.getUrl()).origin === this.currentOrigin; } catch (_) { return false; } }
  private resumeConnection(): void {
    if (!this.attached || !this.trustedPage()) return;
    this.webController.runJavaScript('window.__DSH_CONNECT_UI__?.resume(); "requested"').catch(() => {});
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
    Row({ space: 9 }) {
      if (this.adding || this.settingsVisible || this.helpVisible || this.editingId || this.phase === 'ready') {
        Button({ type: ButtonType.Circle }) { SymbolGlyph($r('sys.symbol.chevron_left')).fontSize(20).fontColor([$r('app.color.ink')]) }.width(40).height(44).backgroundColor(Color.Transparent).accessibilityText('返回').onClick(() => {
          if (this.adding || this.settingsVisible || this.helpVisible || this.editingId) { this.adding = false; this.settingsVisible = false; this.helpVisible = false; this.editingId = ''; this.message = ''; }
          else { this.managerVisible = false; this.resumeConnection(); }
        })
      } else {
        Image($r('app.media.cn_mark')).width(32).height(32).accessibilityText('DSH Connect')
      }
      Text(this.editingId ? '电脑名称' : this.helpVisible ? '连接帮助' : this.adding ? '添加电脑' : this.settingsVisible ? '连接设置' : this.computers.length ? '电脑与连接' : 'DSH Connect').fontSize(19).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).layoutWeight(1)
      if (!this.adding && !this.settingsVisible && !this.helpVisible && !this.editingId) {
        if (this.computers.length > 0) {
          Button('+').width(42).height(44).fontSize(26).fontColor($r('app.color.ink')).backgroundColor(Color.Transparent).accessibilityText('添加电脑').onClick(() => { this.openAdd(); })
          Button({ type: ButtonType.Circle }) { SymbolGlyph($r('sys.symbol.gearshape')).fontSize(21).fontColor([$r('app.color.ink')]) }.width(42).height(44).backgroundColor(Color.Transparent).accessibilityText('连接设置').onClick(() => { this.startup = false; this.settingsVisible = true; this.message = ''; })
        } else {
          Button('帮助').height(44).fontSize(13).fontColor($r('app.color.muted')).backgroundColor(Color.Transparent).onClick(() => { this.helpVisible = true; this.message = ''; })
        }
      }
    }.width('100%').margin({ bottom: 18 })
  }
  @Builder private computerRow(computer: Computer) {
    Row({ space: 8 }) {
      Button({ type: ButtonType.Normal }) {
        Row({ space: 12 }) {
          SymbolGlyph($r('sys.symbol.computer')).fontSize(22).fontColor([$r('app.color.ink')])
          Column({ space: 5 }) {
            Text(computer.name).fontSize(13).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
            Text(this.computerStatus(computer)).fontSize(11).fontColor($r('app.color.muted'))
          }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        }.width('100%')
      }.layoutWeight(1).height(62).padding(0).backgroundColor(Color.Transparent).accessibilityText('连接' + computer.name).onClick(() => { this.continueComputer(computer); })
      Button({ type: ButtonType.Circle }) { SymbolGlyph($r('sys.symbol.more')).fontSize(19).fontColor([$r('app.color.muted')]) }.width(44).height(44).backgroundColor(Color.Transparent).accessibilityText('管理' + computer.name).onClick(() => { this.manageComputer(computer); })
    }.width('100%').padding({ left: 16, right: 10 }).borderRadius(18).backgroundColor($r('app.color.surface'))
  }
  @Builder private home() {
    if (this.computers.length === 0) {
      PairingIntro({ onScan: () => { this.scan(); }, onUseLink: () => { this.openAdd(); }, onHelp: () => { this.helpVisible = true; this.message = ''; } })
    } else {
      Column({ space: 0 }) {
        ComputerCover({ computerName: this.mainComputer().name, status: this.computerStatus(this.mainComputer()), actionLabel: this.phase === 'ready' && this.savedAddress === this.mainComputer().address ? '返回 DeepSeek Harness' : '连接主电脑', onContinue: () => { this.continueComputer(this.mainComputer()); }, onManage: () => { this.manageComputer(this.mainComputer()); } })
        Column() {
          Row() {
            Column({ space: 5 }) { Text('重新打开').fontSize(12).fontColor($r('app.color.ink')); Text('恢复原工作页面').fontSize(11).fontColor($r('app.color.muted')) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            Text(this.autoConnect ? '自动恢复' : '手动连接').fontSize(11).fontColor($r('app.color.muted'))
          }.width('100%').height(64)
          Divider().color($r('app.color.line'))
          Row() {
            Column({ space: 5 }) { Text('从后台回来').fontSize(12).fontColor($r('app.color.ink')); Text('保留当前会话与输入内容').fontSize(11).fontColor($r('app.color.muted')) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            Text('继续原位置').fontSize(11).fontColor($r('app.color.muted'))
          }.width('100%').height(64)
        }.width('100%').padding({ left: 16, right: 16 }).borderRadius(20).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface')).margin({ top: 18 })
        if (this.computers.length > 1) {
          Button('其他电脑（' + (this.computers.length - 1).toString() + '） ' + (this.othersExpanded ? '⌃' : '⌄')).height(48).width('100%').fontSize(12).fontColor($r('app.color.muted')).backgroundColor(Color.Transparent).margin({ top: 12 }).onClick(() => { this.othersExpanded = !this.othersExpanded; })
          if (this.othersExpanded) { ForEach(this.computers.filter((item: Computer) => item.id !== this.mainComputer().id), (item: Computer) => { this.computerRow(item) }, (item: Computer) => item.id) }
        }
        Button('配对与连接帮助  ›').height(44).padding(0).fontSize(12).fontColor('#4D6BFE').backgroundColor(Color.Transparent).margin({ top: 12 }).onClick(() => { this.helpVisible = true; this.message = ''; })
      }.width('100%').alignItems(HorizontalAlign.Start)
    }
  }
  @Builder private addForm() {
    Column({ space: 0 }) {
      Text('只需配对一次').fontSize(11).fontColor($r('app.color.muted')).width('100%').margin({ bottom: 10 })
      Text('连接你的电脑').fontSize(27).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
      Text('使用电脑插件生成的配对码或完整链接。').fontSize(13).lineHeight(22).fontColor($r('app.color.muted')).width('100%').margin({ top: 10, bottom: 24 })
      Column({ space: 0 }) {
        Row({ space: 11 }) {
          Image($r('app.media.cn_mark')).width(38).height(38).accessibilityText('DSH Connect')
          Column({ space: 4 }) { Text('DSH Connect').fontSize(15).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')); Text('电脑连接').fontSize(11).fontColor($r('app.color.muted')) }.alignItems(HorizontalAlign.Start)
        }.width('100%').margin({ bottom: 18 })
        Divider().color($r('app.color.line')).margin({ bottom: 18 })
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
      Row({ space: 12 }) {
        Image($r('app.media.cn_mark')).width(42).height(42).accessibilityText('DSH Connect')
        Column({ space: 5 }) { Text('DSH Connect').fontSize(17).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')); Text(APP_VERSION).fontSize(12).fontColor($r('app.color.muted')) }.alignItems(HorizontalAlign.Start)
      }.width('100%').padding({ bottom: 8 })
      Row({ space: 16 }) {
        Column({ space: 6 }) { Text('自动恢复工作页面').fontSize(14).fontColor($r('app.color.ink')); Text(this.computers.length ? this.latestComputer().name : '添加电脑后即可使用').fontSize(12).fontColor($r('app.color.muted')) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.autoConnect }).selectedColor('#4D6BFE').onChange((enabled: boolean) => { this.autoConnect = enabled; this.store?.saveAutoConnect(enabled).catch(() => { this.message = '设置暂时未能保存。'; }); })
      }.width('100%').padding(20).borderRadius(20).backgroundColor($r('app.color.surface'))
      Text('重新打开时恢复工作页面。切回应用时保留会话与草稿。').fontSize(12).lineHeight(21).fontColor($r('app.color.muted')).width('100%')
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
      }
      if (this.managerVisible && this.loaded) {
        Scroll() {
          Column() {
            this.header()
            if (this.message) { Text(this.message).fontSize(13).lineHeight(22).fontColor($r('app.color.ink')).padding(16).width('100%').backgroundColor($r('app.color.surface')).borderRadius(16).margin({ bottom: 20 }) }
            if (this.editingId) { this.renameForm() } else if (this.helpVisible) { this.help() } else if (this.settingsVisible) { this.settings() } else if (this.adding) { this.addForm() } else { this.home() }
          }.constraintSize({ maxWidth: 560 }).width('100%').padding({ left: 24, right: 24, top: 12, bottom: 24 })
        }.width('100%').height('100%').align(Alignment.Top).scrollBar(BarState.Off).backgroundColor($r('app.color.connector_background'))
      }
      if (!this.loaded || !this.managerVisible && this.phase === 'connecting') {
        ConnectionLoading({ computerName: this.activeName, onBack: () => { this.clearTimer(); this.managerVisible = true; } })
      }
      if (this.managerVisible && this.phase === 'failed' && !this.adding && !this.settingsVisible && !this.helpVisible && !this.editingId) {
        Column() {
          ConnectionIssue({ detail: this.message, onRetry: () => { this.openAddress(this.activeUrl, this.activeName); }, onBack: () => { this.phase = 'idle'; this.message = ''; } })
        }.width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor($r('app.color.connector_background'))
      }
    }.width('100%').height('100%').padding({ top: this.topInset, bottom: this.bottomInset, left: this.leftInset, right: this.rightInset }).backgroundColor(this.managerVisible || this.phase === 'connecting' ? $r('app.color.connector_background') : $r('app.color.surface'))
      .onAreaChange((_previous: Area, area: Area) => { this.pageWidth = Number(area.width); })
      .bindSheet($$this.uploadVisible, this.uploadSheet(), { height: SheetSize.FIT_CONTENT, showClose: true, backgroundColor: $r('app.color.surface'), onDisappear: () => { this.finishFiles([]); } })
  }
}
