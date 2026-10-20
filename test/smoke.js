// Smoke test: arranca el servidor de la extensión y comprueba /status y la página.
const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const PORT = 7902;
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, EXT_PORT: String(PORT), EYES_PORT: '7897' }, stdio: 'ignore' });
const get = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => res({ status: r.statusCode, body: b })); }).on('error', rej));
(async () => {
  try {
    let st;
    for (let i = 0; i < 40 && !st; i++) { try { st = JSON.parse((await get('/status')).body); } catch { await new Promise((r) => setTimeout(r, 100)); } }
    assert.strictEqual(st.app, 'eyes-on-alerts');
    const home = await get('/');
    assert.ok(home.body.includes('Eyes on Alerts'));
    assert.strictEqual((await get('/kit.js')).status, 200);
    assert.strictEqual((await get('/api/events')).status, 502); // sin Eyes on Claude: el proxy lo dice
    const s = JSON.parse((await get('/api/state')).body);
    assert.ok(s.config.rules.turnDone !== undefined);
    console.log('✓ smoke test passed');
  } catch (err) { console.error(err); process.exitCode = 1; } finally { srv.kill(); }
})();
