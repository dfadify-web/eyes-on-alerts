// Eyes on Alerts — lógica en el servidor: sigue el stream real de Eyes on Claude y lanza avisos
// (página, sonido y, si lo activas, push al móvil vía ntfy). Funciona aunque la pestaña esté cerrada.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const CONFIG = path.join(CLAUDE_DIR, 'eyes-on-claude', 'eyes-on-alerts.json');
const DEFAULTS = {
  rules: { turnDone: true, needsYou: true, subagentDone: false, toolError: true, longTool: true },
  longToolMin: 5,
  ntfy: { enabled: false, server: 'https://ntfy.sh', topic: `eyes-on-claude-${crypto.randomBytes(6).toString('hex')}` },
};
let config = load();
const alerts = [];
const streams = new Set();
const titles = new Map(), cwds = new Map(), turnStart = new Map(), running = new Map(), lastErr = new Map();
let live = false;

function load() {
  try { const c = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); return { ...DEFAULTS, ...c, rules: { ...DEFAULTS.rules, ...c.rules }, ntfy: { ...DEFAULTS.ntfy, ...c.ntfy } }; }
  catch { save(DEFAULTS); return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function save(c) { try { fs.mkdirSync(path.dirname(CONFIG), { recursive: true }); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2)); } catch {} }

const name = (s) => titles.get(s) || (cwds.get(s) ? path.basename(cwds.get(s)) : String(s).slice(0, 8));
const dur = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

async function deliver(a) {
  a.id = crypto.randomBytes(4).toString('hex'); a.ts = Date.now();
  alerts.unshift(a); alerts.length = Math.min(alerts.length, 200);
  const data = `data: ${JSON.stringify({ type: 'alert', alert: a })}\n\n`;
  for (const r of streams) r.write(data);
  const n = config.ntfy;
  if (n.enabled && n.topic) {
    try {
      const r = await fetch(`${n.server.replace(/\/+$/, '')}/${encodeURIComponent(n.topic)}`, {
        method: 'POST', body: a.body || a.title,
        headers: { Title: encodeURIComponent(a.title).length === a.title.length ? a.title : `=?UTF-8?B?${Buffer.from(a.title).toString('base64')}?=`, Tags: a.tag || 'eyes', Priority: a.priority || '3' },
      });
      a.pushed = r.ok;
    } catch { a.pushed = false; }
    for (const r of streams) r.write(`data: ${JSON.stringify({ type: 'pushed', id: a.id, ok: a.pushed })}\n\n`);
  }
}

function onEvent(ev) {
  if (ev.kind === '__history__') { live = false; for (const e of ev.events) onEvent(e); live = true; return; }
  if (ev.kind === 'lane' && ev.lane === 'main') { if (ev.title) titles.set(ev.session, ev.title); if (ev.cwd) cwds.set(ev.session, ev.cwd); return; }
  if (ev.kind === 'user' && ev.lane === 'main') { turnStart.set(ev.session, ev.ts); return; }
  if (ev.kind === 'tool_use') { running.set(ev.toolUseId, { ts: ev.ts, name: ev.name, session: ev.session, lane: ev.lane, cmd: ev.input?.description || ev.input?.command || ev.input?.file_path || '' }); return; }
  if (ev.kind === 'tool_result') {
    const r = running.get(ev.toolUseId); running.delete(ev.toolUseId);
    if (live && ev.isError && config.rules.toolError && r && Date.now() - (lastErr.get(ev.session) || 0) > 20000) {
      lastErr.set(ev.session, Date.now());
      deliver({ rule: 'toolError', title: `✗ ${r.name} failed · ${name(ev.session)}`, body: String(ev.text || '').slice(0, 280), tag: 'warning', session: ev.session });
    }
    return;
  }
  if (!live) return;
  if (ev.kind === 'status' && ev.status === 'idle' && ev.lane === 'main' && config.rules.turnDone) {
    const st = turnStart.get(ev.session);
    deliver({ rule: 'turnDone', title: `✓ Claude finished · ${name(ev.session)}`, body: st ? `Turn took ${dur(ev.ts - st)}` : 'Turn finished', tag: 'white_check_mark', session: ev.session });
  }
  if (ev.kind === 'status' && ev.status === 'done' && ev.lane !== 'main' && config.rules.subagentDone) {
    deliver({ rule: 'subagentDone', title: `Subagent finished · ${name(ev.session)}`, body: ev.lane.slice(0, 8), tag: 'robot', session: ev.session });
  }
  // Notification de Claude Code: pide permiso o espera tu respuesta
  if (ev.kind === 'notice' && config.rules.needsYou && /permission|waiting for your input|needs your|attention|approve|permiso|esperando/i.test(ev.text || '')) {
    deliver({ rule: 'needsYou', title: `⚠ Claude needs you · ${name(ev.session)}`, body: ev.text, tag: 'raising_hand', priority: '4', session: ev.session });
  }
}

setInterval(() => {
  if (!config.rules.longTool) return;
  const lim = config.longToolMin * 60000;
  for (const [id, r] of running) {
    const age = Date.now() - r.ts;
    if (!r.warned && age > lim && age < 3 * 3600e3) {
      r.warned = true;
      deliver({ rule: 'longTool', title: `⏱ ${r.name} running for ${dur(age)} · ${name(r.session)}`, body: String(r.cmd).slice(0, 200), tag: 'hourglass', session: r.session });
    }
  }
}, 10000).unref();

const readBody = (req) => new Promise((res) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => res(b)); });
const json = (res, obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

module.exports = {
  start({ followEyes }) { followEyes(onEvent); },
  async handle(req, res, url) {
    const p = url.pathname;
    if (p === '/api/state') return json(res, { config, alerts }), true;
    if (p === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': hi\n\n'); streams.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => { clearInterval(ping); streams.delete(res); });
      return true;
    }
    if (p === '/api/config' && req.method === 'POST') {
      try {
        const c = JSON.parse(await readBody(req));
        config = { ...config, ...c, rules: { ...config.rules, ...(c.rules || {}) }, ntfy: { ...config.ntfy, ...(c.ntfy || {}) } };
        config.longToolMin = Math.max(1, Math.min(240, Number(config.longToolMin) || 5));
        save(config); json(res, { ok: true, config });
      } catch { res.writeHead(400).end(); }
      return true;
    }
    if (p === '/api/test' && req.method === 'POST') {
      await deliver({ rule: 'test', title: '🔔 Eyes on Alerts test', body: 'If you see this on your phone, push works.', tag: 'bell' });
      json(res, { ok: true, alert: alerts[0] });
      return true;
    }
    if (p === '/api/clear' && req.method === 'POST') { alerts.length = 0; json(res, { ok: true }); return true; }
    return false;
  },
};
