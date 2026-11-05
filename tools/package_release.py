"""Verify the release artifacts against maintained sources, then create a portable source ZIP."""
from pathlib import Path
import hashlib
import json
import re
import tarfile
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
assert re.fullmatch(r'\d+\.\d+\.\d+', version), 'Expected a release SemVer.'
app = json.loads((root / 'harmony/AppScope/app.json5').read_text(encoding='utf-8'))['app']
assert app['versionName'] == version
artifacts = root / 'artifacts'
hap = artifacts / f'DSH-Connect-{version}-unsigned.hap'
tgz = artifacts / f'dsh-connect-{version}.tgz'
digest = lambda content: hashlib.sha256(content).hexdigest()

with tarfile.open(tgz, 'r:gz') as archive:
    members = [entry for entry in archive.getmembers() if entry.isfile()]
    for entry in members:
        assert entry.name.startswith('package/') and '..' not in Path(entry.name).parts
        relative = entry.name.removeprefix('package/')
        assert archive.extractfile(entry).read() == (root / relative).read_bytes(), relative
    descriptor = json.loads(archive.extractfile('package/package.json').read())
    assert descriptor['name'] == 'dsh-connect' and descriptor['version'] == version and descriptor['displayName'] == 'DSH Connect'
    assert any(entry.name == 'package/desktop-plugin/lib/configuration.mjs' for entry in members)

with zipfile.ZipFile(hap) as archive:
    metadata = json.loads(archive.read('module.json'))['app']
    assert metadata['versionName'] == version and metadata['versionCode'] == app['versionCode']
    assert metadata['bundleName'] == app['bundleName'] and metadata['debug'] is False
    abc = archive.read('ets/modules.abc')
    assert b'preview-main' not in abc and b'main.example.invalid' not in abc and b'preview-other' not in abc
    checked_icons = 0
    for name in archive.namelist():
        if not name.startswith('resources/') or not name.endswith('.svg'):
            continue
        relative = name.removeprefix('resources/')
        candidates = [root / 'harmony/AppScope/resources' / relative, root / 'harmony/entry/src/main/resources' / relative]
        source = next((candidate for candidate in candidates if candidate.is_file()), None)
        assert source is not None, 'Unexpected or stale HAP asset: ' + name
        assert archive.read(name) == source.read_bytes(), name
        checked_icons += 1
    assert checked_icons >= 5

assert re.search(r'DEVICE_DEBUG\s*:\s*boolean\s*=\s*false', (root / 'harmony/entry/src/main/ets/model/RuntimeMode.ets').read_text(encoding='utf-8'))
assert 'signingConfigs' not in (root / 'harmony/build-profile.json5').read_text(encoding='utf-8')

files = [(root / name, name) for name in ['.gitattributes','.gitignore','README.md','CHANGELOG.md','LICENSE','package.json','package-lock.json','Build-Release.ps1']]
excluded = {'node_modules','oh_modules','.hvigor','.idea','.preview','_wip','build','__pycache__'}
for folder in ['harmony','desktop-plugin','branding','tools','docs','.github']:
    for source in sorted((root / folder).rglob('*')):
        relative = source.relative_to(root)
        if not source.is_file() or any(part in excluded for part in relative.parts):
            continue
        if source.name in {'local.properties','oh-package-lock.json5'}:
            continue
        assert source.suffix not in {'.p12','.p7b','.cer','.csr','.pem','.key'}, relative
        files.append((source, relative.as_posix()))
products = [hap, tgz]
for suffix, source in [('', 'cn-mark.svg'), ('-light', 'cn-mark-light.svg'), ('-dark', 'cn-mark-dark.svg')]:
    icon = artifacts / f'DSH-Connect-{version}-icon{suffix}.svg'
    icon.write_bytes((root / 'branding' / source).read_bytes())
    products.append(icon)
preview = artifacts / f'DSH-Connect-{version}-preview.html'
if preview.is_file():
    products.append(preview)
for product in products:
    files.append((product, 'artifacts/' + product.name))
inner_sums = ''.join(digest(product.read_bytes()) + '  ' + product.name + '\n' for product in products)
prefix = f'DSH-Connect-{version}/'
expected = {}
package = artifacts / f'DSH-Connect-{version}.zip'
with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for source, relative in files:
        content = source.read_bytes()
        assert prefix + relative not in expected
        archive.writestr(prefix + relative, content)
        expected[prefix + relative] = digest(content)
    archive.writestr(prefix + 'artifacts/SHA256SUMS.txt', inner_sums.encode('ascii'))
    expected[prefix + 'artifacts/SHA256SUMS.txt'] = digest(inner_sums.encode('ascii'))
with zipfile.ZipFile(package) as archive:
    assert set(archive.namelist()) == set(expected)
    for name, checksum in expected.items():
        assert digest(archive.read(name)) == checksum, name
products.append(package)
(artifacts / 'SHA256SUMS.txt').write_text(''.join(digest(product.read_bytes()) + '  ' + product.name + '\n' for product in products),encoding='ascii')
report = {'version':version,'hapDebug':metadata['debug'],'hapIconsMatched':checked_icons,'fixtureDataAbsent':True,'tgzFilesMatched':len(members),'zipEntriesMatched':len(expected),'artifacts':[{'name':product.name,'bytes':product.stat().st_size,'sha256':digest(product.read_bytes())} for product in products]}
logs = root / '_wip/release'
logs.mkdir(parents=True, exist_ok=True)
(logs / 'package-readback.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in report.items() if key!='artifacts'}))
