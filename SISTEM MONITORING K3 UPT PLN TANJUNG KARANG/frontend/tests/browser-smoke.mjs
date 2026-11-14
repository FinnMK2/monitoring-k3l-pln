// Run against a production build. All Apps Script calls use a local fixture.
// Uses the installed Chromium browser; no browser or npm downloads are needed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const results = join(root, 'test-results');
const browserPath = process.env.K3L_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
assert.ok(browserPath, 'Set K3L_TEST_BROWSER to an installed Chromium browser');
assert.ok(existsSync(join(dist, 'index.html')), 'Run npm run build first');
mkdirSync(results, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)];
  res.writeHead(200, { 'Content-Type': type || 'application/octet-stream' });
  res.end(readFileSync(file));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = mkdtempSync(join(tmpdir(), 'k3l-smoke-'));
const browser = spawn(browserPath, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws;
let send;
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(portFile) && i < 100; i++) await delay(100);
  assert.ok(existsSync(portFile), 'Browser debugging endpoint did not start');
  const port = readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await once(ws, 'open');
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    const item = pending.get(message.id);
    if (item) {
      pending.delete(message.id);
      message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result);
    }
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error('Timed out: ' + expression);
  };
  const click = async selector => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
    const rect = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      element.scrollIntoView({ block: 'center' });
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...rect, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rect, button: 'left', clickCount: 1 });
    await delay(80);
  };
  const clickText = async text => {
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(element => {
        const label = element.cloneNode(true);
        label.querySelectorAll('.material-symbols-outlined').forEach(icon => icon.remove());
        return label.textContent.trim() === ${JSON.stringify(text)} && element.getBoundingClientRect().width > 0;
      });
      if (!button) throw new Error('Button missing: ' + ${JSON.stringify(text)});
      button.setAttribute('data-smoke-click', 'yes');
    })()`);
    await click('[data-smoke-click="yes"]');
    await evaluate(`document.querySelector('[data-smoke-click="yes"]')?.removeAttribute('data-smoke-click')`);
  };
  const fill = async (selector, value) => {
    await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    })()`);
    await delay(80);
  };
  const screenshot = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(results, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${function () {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('k3l_dark_mode', 'false');
    window.fixtureYears = JSON.parse(sessionStorage.getItem('fixtureYears') || '["2026","2027"]');
    window.fixtureCalls = [];
    window.failYears = 'Permintaan GET tidak valid';
    window.failCreate = false;
    window.fetch = async (url, options = {}) => {
      const params = options.body ? JSON.parse(options.body) : Object.fromEntries(new URL(url, location.origin).searchParams);
      window.fixtureCalls.push(params);
      await new Promise(resolve => setTimeout(resolve, 80));
      let result;
      if (params.action === 'login') result = { status: 'success', role: 'admin' };
      else if (params.action === 'list_years') {
        if (window.failYears === 'network') throw new TypeError('Failed to fetch');
        result = window.failYears ? { status: 'error', message: window.failYears } : { status: 'success', years: [...window.fixtureYears] };
      }
      else if (params.action === 'read') result = { status: 'success', year: params.year, sheetId: Number(params.year), data: [] };
      else if (params.action === 'create_year') {
        if (window.failCreate) result = { status: 'error', message: 'Gagal menyimpan tahun.' };
        else {
          const created = !window.fixtureYears.includes(params.year);
          if (created) window.fixtureYears.push(params.year);
          sessionStorage.setItem('fixtureYears', JSON.stringify(window.fixtureYears));
          result = { status: 'success', created, year: params.year, sheetId: Number(params.year) };
        }
      } else throw new Error('Unexpected API request: ' + params.action);
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    };
  }.toString()})();` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin });
  await waitFor(`!!document.querySelector('input[type="email"]')`);
  assert.equal(await evaluate(`localStorage.getItem('isLoggedIn')`), null);
  assert.equal(await evaluate(`fixtureCalls.length`), 0);
  await fill('input[type="email"]', 'fixture@example.test');
  await fill('input[type="password"]', 'fixture-password');
  await click('button[type="submit"]');
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Apps Script yang digunakan belum mendukung daftar tahun')`);
  assert.equal(await evaluate(`fixtureCalls.some(call => call.action === 'read')`), false, 'Do not invent years when the deployment lacks list_years');
  await evaluate(`window.failYears = false`);
  await clickText('Coba lagi');
  await waitFor(`document.querySelector('[aria-label="Tahun pemantauan"]')?.options.length === 2`);
  await waitFor(`!document.querySelector('[role="alert"]')`);
  await evaluate(`window.failYears = 'network'; window.dispatchEvent(new Event('focus'))`);
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Periksa koneksi atau akses Google Sheets')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Tahun pemantauan"]').options.length`), 2, 'Keep previously verified years during a connection failure');
  await evaluate(`window.failYears = false`);
  await clickText('Coba lagi');
  await waitFor(`!document.querySelector('[role="alert"]')`);
  console.log('PASS years: old deployment guidance, network error, retry recovery, no invented years');
  assert.equal(await evaluate(`document.querySelector('#main-sidebar').inert`), true);
  await click('[aria-controls="main-sidebar"]');
  await delay(350);
  await clickText('Pemantauan Kegiatan');
  await waitFor(`document.querySelector('#main-sidebar').inert`);
  await click('[aria-controls="main-sidebar"]');
  await delay(350);
  await click('[aria-label="Tahun pemantauan"]');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(`document.querySelector('#main-sidebar').inert`);
  await clickText('+ Tahun');
  await waitFor(`document.querySelector('#existing-year')?.options.length === 3 && !document.querySelector('#existing-year').disabled`);
  await fill('#existing-year', '2027');
  await waitFor(`document.querySelector('[aria-label="Tahun pemantauan"]').value === '2027' && !document.querySelector('[role="dialog"]')`);
  await clickText('+ Tahun');
  await waitFor(`!document.querySelector('#existing-year')?.disabled`);
  await fill('#new-year', '2028');
  await clickText('Duplikat Rencana');
  await waitFor(`document.body.textContent.includes('Konfirmasi Tambah Tahun')`);
  assert.equal(await evaluate(`fixtureCalls.filter(call => call.action === 'create_year').length`), 0);
  await clickText('Tidak');
  assert.equal(await evaluate(`fixtureCalls.filter(call => call.action === 'create_year').length`), 0);
  await clickText('Duplikat Rencana');
  await waitFor(`document.body.textContent.includes('Konfirmasi Tambah Tahun')`);
  await screenshot('desktop-confirmation');
  await clickText('Iya, Duplikat Rencana');
  await waitFor(`document.querySelector('[aria-label="Tahun pemantauan"]').value === '2028' && !document.querySelector('[role="dialog"]')`);
  assert.deepEqual(await evaluate(`fixtureCalls.filter(call => call.action === 'create_year')`), [{ action: 'create_year', year: '2028', sourceYear: '2027' }]);
  await click('[aria-controls="main-sidebar"]');
  await delay(350);
  await clickText('Riwayat Aktivitas');
  await waitFor(`document.querySelector('a[href*="gid=2028"]') !== null`);
  console.log('PASS desktop: fresh login, sidebar, existing years, confirmation, duplication, correct Spreadsheet tab');

  await send('Page.reload');
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Apps Script yang digunakan belum mendukung daftar tahun')`);
  assert.equal(await evaluate(`!!document.querySelector('input[type="email"]')`), false, 'Refreshing an admin session must not show login');
  assert.deepEqual(await evaluate(`JSON.parse(sessionStorage.getItem('k3l_session'))`), { role: 'admin' }, 'Persist only the role, never the password');
  assert.equal(await evaluate(`fixtureCalls.some(call => call.action === 'login')`), false, 'Do not replay credentials on refresh');
  await evaluate(`window.failYears = false`);
  await clickText('Coba lagi');
  await waitFor(`document.querySelector('[aria-label="Tahun pemantauan"]')?.options.length === 3`);
  assert.equal(await evaluate(`document.querySelector('#main-sidebar').inert`), true);
  await evaluate(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
  await delay(100);
  assert.equal(await evaluate(`!!document.querySelector('input[type="email"]')`), false, 'History restoration must preserve an active admin session');
  await click('[aria-label="Buka profil"]');
  await clickText('Keluar Akun');
  await waitFor(`!!document.querySelector('input[type="email"]')`);
  assert.equal(await evaluate(`sessionStorage.getItem('k3l_session')`), null);
  await send('Page.reload');
  await waitFor(`!!document.querySelector('input[type="email"]')`);
  assert.equal(await evaluate(`fixtureCalls.length`), 0, 'Refresh after logout must not restore the previous session');
  console.log('PASS session: admin survives refresh and history restoration, logout survives refresh, no saved credentials');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await clickText('Masuk sebagai Tamu (Lihat Saja)');
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Hubungi administrator')`);
  await evaluate(`window.failYears = false`);
  await clickText('Coba lagi');
  await waitFor(`document.querySelector('[aria-label="Tahun pemantauan"]')?.options.length === 3`);
  await delay(350);
  assert.ok(await evaluate(`document.querySelector('#main-sidebar').getBoundingClientRect().right <= 0`));
  await click('[aria-controls="main-sidebar"]');
  await delay(350);
  await clickText('Daftar Kegiatan');
  await waitFor(`document.querySelector('#main-sidebar').inert`);
  await delay(350);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'Mobile must not overflow horizontally');
  await screenshot('mobile-sidebar-closed');
  await send('Page.reload');
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Hubungi administrator')`);
  assert.deepEqual(await evaluate(`JSON.parse(sessionStorage.getItem('k3l_session'))`), { role: 'guest' });
  assert.equal(await evaluate(`!!document.querySelector('input[type="email"]')`), false, 'Refreshing a guest session must not show login');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(button => button.textContent.includes('+ Tahun'))`), false, 'Restored guests must not gain admin controls');
  await evaluate(`window.failYears = false`);
  await clickText('Coba lagi');
  await waitFor(`document.querySelector('[aria-label="Tahun pemantauan"]')?.options.length === 3`);
  await evaluate(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
  await delay(100);
  assert.equal(await evaluate(`!!document.querySelector('input[type="email"]')`), false, 'History restoration must preserve a guest session');
  await evaluate(`sessionStorage.removeItem('k3l_session'); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
  await waitFor(`!!document.querySelector('input[type="email"]')`);
  for (const invalidSession of ['invalid-json', '{"role":"superadmin"}']) {
    await evaluate(`sessionStorage.setItem('k3l_session', ${JSON.stringify(invalidSession)})`);
    await send('Page.reload');
    await waitFor(`!!document.querySelector('input[type="email"]')`);
    assert.equal(await evaluate(`fixtureCalls.length`), 0, 'Invalid sessions must not start authenticated data loading');
  }
  console.log('PASS mobile: guest refresh preserves role, sidebar closes, history respects cleared sessions, invalid sessions require login');
  assert.deepEqual(exceptions, [], 'No uncaught browser errors');
} finally {
  if (send && ws?.readyState === WebSocket.OPEN) await send('Browser.close').catch(() => {});
  ws?.close();
  if (browser.exitCode === null) {
    await Promise.race([once(browser, 'exit'), delay(3000)]);
    if (browser.exitCode === null) browser.kill();
  }
  server.close();
  const expectedPrefix = resolve(tmpdir()) + sep + 'k3l-smoke-';
  if (resolve(profile).startsWith(expectedPrefix)) {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
