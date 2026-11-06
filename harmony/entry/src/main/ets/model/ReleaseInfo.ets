import { http } from '@kit.NetworkKit';
import { APP_VERSION } from './Version';

export const RELEASE_URL: string = 'https://github.com/LUMIAO9527/DSH-Connect/releases/latest';
export const PROJECT_URL: string = 'https://github.com/LUMIAO9527/DSH-Connect';

interface ReleaseDocument {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
}
export class ReleaseResult {
  version: string = '';
  available: boolean = false;
}
function compareVersion(left: string, right: string): number {
  const a: string[] = left.split('.'); const b: string[] = right.split('.');
  for (let index: number = 0; index < 3; index++) {
    const difference: number = Number(a[index]) - Number(b[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}
export async function checkRelease(): Promise<ReleaseResult> {
  const request: http.HttpRequest = http.createHttp();
  try {
    const response: http.HttpResponse = await request.request('https://api.github.com/repos/LUMIAO9527/DSH-Connect/releases/latest', {
      method: http.RequestMethod.GET, expectDataType: http.HttpDataType.STRING,
      header: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'DSH-Connect/' + APP_VERSION },
      connectTimeout: 10000, readTimeout: 10000, maxLimit: 262144
    });
    if (response.responseCode !== 200 || typeof response.result !== 'string' || response.result.length > 262144) throw new Error('release_unavailable');
    const document: ReleaseDocument = JSON.parse(response.result) as ReleaseDocument;
    if (document.draft || document.prerelease || typeof document.tag_name !== 'string' || !/^v\d+\.\d+\.\d+$/.test(document.tag_name)) throw new Error('release_invalid');
    const result: ReleaseResult = new ReleaseResult(); result.version = document.tag_name.substring(1);
    result.available = compareVersion(result.version, APP_VERSION) > 0;
    return result;
  } finally { request.destroy(); }
}
