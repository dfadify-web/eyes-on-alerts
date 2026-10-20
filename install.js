#!/usr/bin/env node
// Instalador de una extensión de Eyes on Claude.
//   npx -y github:dfadify-web/<repo>              install (or update)
//   npx -y github:dfadify-web/<repo> --uninstall  remove it
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const M = require('./eoc-extension.json');
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const EXT_DIR = path.join(CLAUDE_DIR, 'eyes-on-claude', 'extensions', M.id);
const EYES_PORT = Number(process.env.EYES_PORT) || 7777;
const KEEP = ['public', 'server.js', 'plugin.js', 'eoc-extension.json', 'package.json', 'install.js', 'LICENSE', 'README.md'];
const uninstall = process.argv.includes('--uninstall');
const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);

const post = (port, route) => new Promise((resolve) => {
  const req = http.request({ host: '127.0.0.1', port, path: route, method: 'POST', timeout: 4000 }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', () => resolve(0)); req.on('timeout', () => { req.destroy(); resolve(0); });
  req.end();
});

(async () => {
  await post(M.port, '/shutdown');
  if (uninstall) { fs.rmSync(EXT_DIR, { recursive: true, force: true }); ok(`Removed ${EXT_DIR}`); return; }
  if (path.resolve(__dirname) !== path.resolve(EXT_DIR)) {
    fs.rmSync(EXT_DIR, { recursive: true, force: true });
    fs.mkdirSync(EXT_DIR, { recursive: true });
    for (const f of KEEP) if (fs.existsSync(path.join(__dirname, f))) fs.cpSync(path.join(__dirname, f), path.join(EXT_DIR, f), { recursive: true });
  }
  ok(`${M.name} installed in ${EXT_DIR}`);
  await new Promise((r) => setTimeout(r, 300));
  if ((await post(EYES_PORT, `/extensions/${M.id}/start`)) === 200) ok(`Running: http://localhost:${EYES_PORT}/#ext/${M.id}`);
  else console.log(`\nOpen Eyes on Claude (v2.3+) → Extensions → ${M.name}.\n`);
})();
