#!/usr/bin/env node
// Servidor de una extensión de Eyes on Claude (sin dependencias).
// Reenvía en vivo el stream real de Eyes (/events) a la página y sirve public/.
// Si existe plugin.js, recibe también cada evento en el servidor y puede añadir rutas /api/*.
const http = require('http');
const fs = require('fs');
const path = require('path');

const MANIFEST = require('./eoc-extension.json');
const VERSION = require('./package.json').version;
const PORT = Number(process.env.EXT_PORT) || MANIFEST.port;
const EYES_PORT = Number(process.env.EYES_PORT) || 7777;
const PUBLIC = path.join(__dirname, 'public');
const plugin = fs.existsSync(path.join(__dirname, 'plugin.js')) ? require('./plugin.js') : null;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

// Conexión propia al stream de Eyes para los plugins que trabajan en el servidor (p. ej. avisos)
function followEyes(onEvent) {
  const retry = () => setTimeout(() => followEyes(onEvent), 3000);
  const req = http.get({ host: '127.0.0.1', port: EYES_PORT, path: '/events' }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return retry(); }
    res.setEncoding('utf8');
    let buf = '';
    res.on('data', (c) => {
      buf += c;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        for (const line of block.split('\n')) if (line.startsWith('data: ')) { try { onEvent(JSON.parse(line.slice(6))); } catch {} }
      }
    });
    res.on('end', retry); res.on('error', () => {});
  });
  req.on('error', retry);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  if (p === '/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, app: MANIFEST.id, version: VERSION })); return; }
  if (p === '/shutdown' && req.method === 'POST') { res.writeHead(204).end(); setTimeout(() => process.exit(0), 50); return; }
  if (p === '/api/events') {
    // Proxy del stream de Eyes on Claude (mismo origen para la página)
    const up = http.get({ host: '127.0.0.1', port: EYES_PORT, path: '/events' }, (r) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      r.pipe(res);
    });
    up.on('error', () => { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Eyes on Claude is not running'); });
    res.on('close', () => up.destroy());
    return;
  }
  if (plugin?.handle && p.startsWith('/api/')) { if (await plugin.handle(req, res, url)) return; }
  const rel = p === '/' ? 'index.html' : decodeURIComponent(p.slice(1));
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.on('error', (e) => { if (e.code === 'EADDRINUSE') process.exit(0); throw e; });
server.listen(PORT, '127.0.0.1', () => {
  console.log(`${MANIFEST.name} en http://localhost:${PORT}`);
  if (plugin?.start) plugin.start({ followEyes, manifest: MANIFEST });
});
