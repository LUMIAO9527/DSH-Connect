@Component
export struct ComputerCover {
  @Prop computerName: string = '我的电脑';
  @Prop cardHeight: number = 286;
  @Prop unpaired: boolean = false;
  onContinue: () => void = () => {};
  onManage: () => void = () => {};
  build() {
    Column({ space: 0 }) {
      Column() {
        Row() {
          Text(this.computerName).fontSize(17).fontWeight(FontWeight.Medium).fontColor($r('app.color.ink')).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          if (this.unpaired) {
            Text('未配对').fontSize(11).fontColor($r('app.color.muted')).padding({ left: 9, right: 9, top: 6, bottom: 6 }).borderRadius(8).backgroundColor($r('app.color.surface_alt')).margin({ right: 8 })
          } else {
            Button({ type: ButtonType.Circle }) { Text('⋯').fontSize(24).fontColor($r('app.color.muted')) }.width(44).height(44).padding(0).flexShrink(0).backgroundColor(Color.Transparent).accessibilityText('管理' + this.computerName).onClick(this.onManage)
          }
        }.width('100%').height(50).padding({ left: 18, right: 10, top: 6 })
        Image($r('app.media.computer_cover')).width('100%').height(this.cardHeight - 60).objectFit(ImageFit.Contain).accessibilityText('电脑上的 DSH Connect')
      }.width('100%').height(this.cardHeight).borderRadius(24).border({ width: 1, color: $r('app.color.line') }).backgroundColor($r('app.color.surface')).onClick(this.onContinue)
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
