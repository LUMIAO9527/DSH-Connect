import { common } from '@kit.AbilityKit';
import { webview } from '@kit.ArkWeb';
import { fileIo as fs, fileUri, picker } from '@kit.CoreFileKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { camera, cameraPicker } from '@kit.CameraKit';

export class FileSupport {
  private context: common.UIAbilityContext;
  private notify: (message: string) => void;
  private delegate: webview.WebDownloadDelegate = new webview.WebDownloadDelegate();
  private paths: Map<string, string> = new Map();
  private captures: Set<string> = new Set();
  private saving: Promise<void> = Promise.resolve();
  constructor(context: common.UIAbilityContext, notify: (message: string) => void) { this.context = context; this.notify = notify; }
  async documents(accepts: string[], multiple: boolean): Promise<string[]> {
    const options = new picker.DocumentSelectOptions(); options.maxSelectNumber = multiple ? 20 : 1;
    const extensions = accepts.filter((value: string) => /^\.[a-zA-Z0-9]+$/.test(value));
    if (extensions.length > 0) options.fileSuffixFilters = ['文件|' + extensions.join(',')];
    return await new picker.DocumentViewPicker(this.context).select(options);
  }
  async album(multiple: boolean): Promise<string[]> {
    const options = new photoAccessHelper.PhotoSelectOptions(); options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE; options.maxSelectNumber = multiple ? 20 : 1;
    const result = await new photoAccessHelper.PhotoViewPicker().select(options); return result.photoUris;
  }
  async takePhoto(): Promise<string[]> {
    const path = this.context.cacheDir + '/capture-' + Date.now().toString() + '.jpg';
    const file = fs.openSync(path, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE); fs.closeSync(file);
    try {
      const result = await cameraPicker.pick(this.context, [cameraPicker.PickerMediaType.PHOTO], { cameraPosition: camera.CameraPosition.CAMERA_POSITION_BACK, saveUri: fileUri.getUriFromPath(path) });
      if (result.resultCode === 0 && result.resultUri) { this.captures.add(path); return [result.resultUri]; }
    } catch (_) { this.remove(path); return []; }
    this.remove(path); return [];
  }
  private remove(path: string): void { try { fs.unlinkSync(path); } catch (_) {} }
  dispose(): void { this.captures.forEach((path: string) => { this.remove(path); }); this.captures.clear(); }
  downloads(controller: webview.WebviewController): void {
    const directory = this.context.cacheDir + '/downloads'; try { fs.mkdirSync(directory); } catch (_) {}
    this.delegate.onBeforeDownload((item: webview.WebDownloadItem) => {
      const name = item.getSuggestedFileName().replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'download';
      const path = directory + '/' + item.getGuid().replace(/[^a-zA-Z0-9-]/g, '') + '-' + name;
      this.paths.set(item.getGuid(), path); item.start(path);
    });
    this.delegate.onDownloadFinish((item: webview.WebDownloadItem) => {
      const path = this.paths.get(item.getGuid()); this.paths.delete(item.getGuid());
      if (path) {
        const name = item.getSuggestedFileName().replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'download';
        this.saving = this.saving.then(() => this.save(path, name));
      }
    });
    this.delegate.onDownloadFailed((item: webview.WebDownloadItem) => {
      const path = this.paths.get(item.getGuid()); if (path) this.remove(path); this.paths.delete(item.getGuid()); this.notify('下载未完成，请重试。');
    }); controller.setDownloadDelegate(this.delegate);
  }
  private async save(path: string, name: string): Promise<void> {
    let source: fs.File | null = null; let destination: fs.File | null = null;
    try {
      const options = new picker.DocumentSaveOptions(); options.newFileNames = [name];
      const result = await new picker.DocumentViewPicker(this.context).save(options); if (!result.length) return;
      source = fs.openSync(path, fs.OpenMode.READ_ONLY); destination = fs.openSync(result[0], fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      fs.copyFileSync(source.fd, destination.fd); this.notify('文件已保存。');
    } catch (_) { this.notify('文件未保存，可以重新下载。'); }
    finally {
      try { if (source) fs.closeSync(source); } catch (_) {}
      try { if (destination) fs.closeSync(destination); } catch (_) {}
      this.remove(path);
    }
  }
}
