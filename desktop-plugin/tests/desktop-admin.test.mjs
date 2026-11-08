import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../index.js';

test('authenticated desktop forwarded POST can generate a pairing link without Origin or Fetch-Site', async t => {
  const cleanups = [];
  const temporary = fileURLToPath(new URL('../../_wip/tests/', import.meta.url));
  await mkdir(temporary, { recursive: true });
  const directory = await mkdtemp(join(temporary, 'foreverweb-desktop-'));
  let route;
  const host = http.createServer((req, res) => {
    Promise.resolve(route.handler(req, res)).catch(error => { res.writeHead(500); res.end(error.name); });
  });
  await new Promise(resolve => host.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${host.address().port}`;
  const ctx = {
    effect: setup => { const cleanup = setup(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
    webServer: { getOrigin: () => origin, register(value) { route = value; return () => {}; } },
    connection: {
      requestRejection(request) {
        assert.ok(request?.headers, 'desktop authentication must receive the current request');
        return request.headers.cookie === 'dsh-auth-fixture=valid' ? undefined : 'authentication_required';
      },
      authenticatedUrl: () => origin + '/?token=fixture',
    },
    on() {}, logger: () => ({ info() {}, warn() {} }),
  };
  t.after(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await new Promise(resolve => host.close(resolve));
    assert.equal(dirname(resolve(directory)), resolve(temporary));
    await rm(directory, { recursive: true, force: true });
  });
  await apply(ctx, { publicOrigin: 'https://foreverweb.test', listenPort: 0, stateDirectory: directory });
  const post = (path, headers) => new Promise((resolve, reject) => {
    const body = JSON.stringify({});
    const request = http.request({ hostname: '127.0.0.1', port: host.address().port, path, method: 'POST',
      headers: { ...headers, 'content-length': Buffer.byteLength(body) } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, json: async () => JSON.parse(Buffer.concat(chunks)) }));
    });
    request.once('error', reject); request.end(body);
  });
  const headers = { cookie: 'dsh-auth-fixture=valid', 'content-type': 'application/json', 'x-dsh-mobile-desktop-admin': 'dsh-app://app' };
  const response = await post('/api/foreverweb/pairing/open', headers);
  assert.equal(response.status, 201);
  const paired = await response.json();
  assert.match(paired.pairUrl, /^https:\/\/foreverweb\.test\/mobile-access\/pair#instance=[a-f0-9]{64}&token=[A-Za-z0-9_-]{43}$/);
  assert.match(paired.qrSvg, /^<svg/);
  const anonymous = await post('/api/foreverweb/pairing/open', { 'content-type': 'application/json' });
  assert.equal(anonymous.status, 401);
  const unmarked = await post('/api/foreverweb/pairing/open', { cookie: headers.cookie, 'content-type': 'application/json' });
  assert.equal(unmarked.status, 403);
});
