// Presentation adapted from the supplied D “随身桌面” design. System insets and connection state belong to Index.
@Component
export struct PairingIntro {
  onScan: () => void = () => {};
  onUseLink: () => void = () => {};
  onHelp: () => void = () => {};
  build() {
    Column({ space: 0 }) {
      Text('连接你的主电脑').fontSize(11).fontColor($r('app.color.muted')).width('100%').margin({ bottom: 10 })
      Text('把电脑，\n带在身边。').fontSize(29).lineHeight(41).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
      Text('连接电脑上的 DeepSeek Harness。\n一次配对，以后打开直接使用。').fontSize(13).lineHeight(23).fontColor($r('app.color.muted')).width('100%').margin({ top: 10, bottom: 24 })
      Column() {
        Row() {
          Text('你的主电脑').fontSize(12).fontColor($r('app.color.ink')).layoutWeight(1)
          Text('等待配对').fontSize(10).fontColor($r('app.color.muted')).padding({ left: 9, right: 9, top: 5, bottom: 5 }).borderRadius(7).backgroundColor($r('app.color.surface_alt'))
        }.width('100%').padding({ left: 18, right: 18, top: 16 })
        Image($r('app.media.computer_cover')).width('100%').height(158).objectFit(ImageFit.Contain).accessibilityText('电脑上的 DSH Connect')
        Text('电脑保持运行，手机随时接入。').fontSize(11).fontColor($r('app.color.muted')).margin({ bottom: 18 })
      }.width('100%').borderRadius(27).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface'))
      Button('扫描电脑二维码').height(50).width('100%').borderRadius(15).fontSize(14).fontWeight(FontWeight.Medium).fontColor(Color.White).backgroundColor('#4D6BFE').margin({ top: 16 }).onClick(this.onScan)
      Button('使用配对链接').height(48).width('100%').borderRadius(15).fontSize(13).fontColor($r('app.color.ink')).backgroundColor($r('app.color.surface')).border({ width: 1, color: $r('app.color.line') }).margin({ top: 10 }).onClick(this.onUseLink)
      Text('在电脑「设置 → DSH Connect」中生成配对码。').fontSize(11).lineHeight(19).fontColor($r('app.color.muted')).width('100%').margin({ top: 13 })
      Button('查看电脑端步骤  ›').height(42).padding(0).fontSize(12).fontColor('#4D6BFE').backgroundColor(Color.Transparent).onClick(this.onHelp)
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct ComputerCover {
  @Prop computerName: string = '我的电脑';
  @Prop status: string = '点击连接';
  @Prop actionLabel: string = '连接主电脑';
  onContinue: () => void = () => {};
  onManage: () => void = () => {};
  build() {
    Column({ space: 0 }) {
      Text('我的主电脑').fontSize(27).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink')).width('100%')
      Text('已保存的连接，随时继续。').fontSize(12).fontColor($r('app.color.muted')).width('100%').margin({ top: 7, bottom: 22 })
      Column() {
        Row() {
          Text('主电脑').fontSize(12).fontColor($r('app.color.ink')).layoutWeight(1)
          Button({ type: ButtonType.Circle }) { SymbolGlyph($r('sys.symbol.more')).fontSize(20).fontColor([$r('app.color.muted')]) }.width(44).height(44).backgroundColor(Color.Transparent).accessibilityText('管理' + this.computerName).onClick(this.onManage)
        }.width('100%').padding({ left: 18, right: 10, top: 6 })
        Image($r('app.media.computer_cover')).width('100%').height(182).objectFit(ImageFit.Contain).accessibilityText('电脑上的 DSH Connect')
        Row({ space: 10 }) {
          Column({ space: 6 }) {
            Text(this.computerName).fontSize(21).fontWeight(FontWeight.Medium).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).fontColor($r('app.color.ink')).width('100%')
            Text(this.status).fontSize(11).fontColor($r('app.color.muted')).width('100%')
          }.layoutWeight(1).alignItems(HorizontalAlign.Start)
          Image($r('app.media.cn_mark')).width(28).height(28).accessibilityText('DSH Connect')
        }.width('100%').padding({ left: 20, right: 20, bottom: 22 })
      }.width('100%').borderRadius(27).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface'))
      Button(this.actionLabel).height(50).width('100%').borderRadius(15).fontSize(14).fontWeight(FontWeight.Medium).backgroundColor('#4D6BFE').fontColor(Color.White).margin({ top: 16 }).onClick(this.onContinue)
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct ConnectionLoading {
  @Prop computerName: string = '';
  onBack: () => void = () => {};
  build() {
    Column({ space: 18 }) {
      Image($r('app.media.cn_mark')).width(64).height(64).accessibilityText('DSH Connect')
      Text('DSH Connect').fontSize(21).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink'))
      LoadingProgress().width(28).height(28).color('#4D6BFE')
      Text(this.computerName ? '正在连接' + this.computerName : '正在打开工作区').fontSize(14).fontColor($r('app.color.muted')).textAlign(TextAlign.Center)
      Button('查看我的电脑').height(48).fontSize(13).fontColor($r('app.color.muted')).backgroundColor(Color.Transparent).onClick(this.onBack)
    }.width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor($r('app.color.connector_background'))
  }
}

@Component
export struct ConnectionIssue {
  @Prop detail: string = '';
  onRetry: () => void = () => {};
  onBack: () => void = () => {};
  build() {
    Column({ space: 18 }) {
      Image($r('app.media.cn_mark')).width(56).height(56).accessibilityText('DSH Connect')
      Text('暂时无法连接').fontSize(22).fontWeight(FontWeight.Bold).fontColor($r('app.color.ink'))
      Text(this.detail).fontSize(13).lineHeight(22).textAlign(TextAlign.Center).fontColor($r('app.color.muted')).width('100%')
      Button('重新连接').height(50).width('100%').borderRadius(15).fontSize(14).backgroundColor('#4D6BFE').fontColor(Color.White).onClick(this.onRetry)
      Button('查看我的电脑').height(48).width('100%').fontSize(13).fontColor($r('app.color.muted')).backgroundColor(Color.Transparent).onClick(this.onBack)
    }.width('100%').constraintSize({ maxWidth: 420 }).padding(28)
  }
}
