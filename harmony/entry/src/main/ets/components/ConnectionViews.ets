@Component
export struct ComputerCover {
  @Prop computerName: string = '我的电脑';
  @Prop cardHeight: number = 286;
  @Prop adding: boolean = false;
  onContinue: () => void = () => {};
  build() {
    Button({ type: ButtonType.Normal }) {
      Column() {
        if (this.adding) {
          Blank().layoutWeight(1)
          Stack() { SymbolGlyph($r('sys.symbol.plus')).fontSize(36).fontColor([$r('app.color.muted')]) }.width(76).height(76).backgroundColor($r('app.color.surface_alt')).borderRadius(24)
          Text('添加电脑').fontSize(19).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).margin({ top: 20 })
          Blank().layoutWeight(1)
        } else {
          Text(this.computerName).fontSize(21).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).width('100%').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).padding({ left: 24, right: 24, top: 26 })
          Stack() {
            Image($r('app.media.computer_cover')).width('124%').height('100%').objectFit(ImageFit.Contain).accessibilityText('电脑上的 DSH Connect')
          }.width('100%').layoutWeight(1).clip(true).padding({ bottom: 16 })
        }
      }.width('100%').height('100%').borderRadius(28).clip(true).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface'))
    }.width('100%').height(this.cardHeight).padding(0).borderRadius(28).backgroundColor(Color.Transparent).accessibilityText(this.adding ? '添加电脑' : '连接' + this.computerName).onClick(this.onContinue)
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
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
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
