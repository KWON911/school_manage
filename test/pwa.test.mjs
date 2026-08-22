import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function pngSize(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  assert.equal(buffer.readUInt32BE(0), 0x89504e47, `${relativePath} must be a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('PWA manifest declares standalone display and required icons', () => {
  const manifest = JSON.parse(read('manifest.json'));

  assert.equal(manifest.display, 'standalone');
  assert.equal(typeof manifest.name, 'string');
  assert.equal(typeof manifest.short_name, 'string');
  assert.equal(typeof manifest.theme_color, 'string');
  assert.equal(typeof manifest.background_color, 'string');
  assert.deepEqual(
    manifest.icons.map((icon) => icon.sizes),
    ['192x192', '512x512']
  );
});

test('iOS metadata points to a real 180x180 PNG touch icon', () => {
  const html = read('index.html');
  assert.match(html, /rel="apple-touch-icon"[^>]+href="\/icons\/icon-180\.png"/);
  assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style"/);
  assert.match(html, /name="apple-mobile-web-app-title"/);

  assert.deepEqual(pngSize('icons/icon-180.png'), { width: 180, height: 180 });
});

test('manifest icon files are real PNGs at their declared sizes', () => {
  assert.deepEqual(pngSize('icons/icon-192.png'), { width: 192, height: 192 });
  assert.deepEqual(pngSize('icons/icon-512.png'), { width: 512, height: 512 });
});

test('service worker refreshes a cached app asset from the network', async () => {
  const listeners = new Map();
  const cachedResponse = { source: 'cache' };
  const networkResponse = { source: 'network', clone() { return this; } };
  let fetchCalls = 0;
  const context = {
    URL,
    Promise,
    caches: {
      async match() { return cachedResponse; },
      async open() { return { async put() {} }; },
      async keys() { return []; },
      async delete() { return true; }
    },
    fetch: async () => {
      fetchCalls += 1;
      return networkResponse;
    },
    self: {
      location: { origin: 'https://school-life-info.vercel.app' },
      addEventListener(type, listener) { listeners.set(type, listener); },
      skipWaiting() {},
      clients: { claim() {} }
    }
  };
  vm.runInNewContext(read('sw.js'), context);

  let responsePromise;
  listeners.get('fetch')({
    request: { method: 'GET', url: 'https://school-life-info.vercel.app/src/styles/app.css' },
    respondWith(promise) { responsePromise = promise; }
  });

  assert.equal((await responsePromise).source, 'network');
  assert.equal(fetchCalls, 1);
});
