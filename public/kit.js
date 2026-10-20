// Kit común de las extensiones de Eyes on Claude: tema, idioma, utilidades y stream en vivo.
(() => {
  const P = new URLSearchParams(location.search);
  const LANG = (P.get('lang') || navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const applyTheme = (t) => { document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'; };
  applyTheme(P.get('theme') || store.get('eoc.ext.theme', 'dark'));
  addEventListener('message', (e) => { if (e.data?.type === 'eoc:theme') { applyTheme(e.data.theme); store.set('eoc.ext.theme', e.data.theme); dispatchEvent(new Event('eoc:theme')); } });
  document.documentElement.lang = LANG;
  if (P.has('embed')) document.documentElement.classList.add('embed');

  const ICON = {
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    read: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    write: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 3 4 14h7l-1 7 9-11h-7z"/>', agent: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>', send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>', check: '<path d="m5 12 5 5L20 7"/>', terminal: '<path d="m5 8 4 4-4 4M12 17h7"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>', pause: '<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ICON.bolt}</svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtTok = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));
  const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`; };
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString(LANG === 'es' ? 'es-ES' : undefined, { hour12: false });
  const base = (p) => (p ? String(p).split(/[\\/]/).filter(Boolean).pop() : '');
  const toolLabel = (name) => (name.startsWith('mcp__') ? (() => { const p = name.split('__'); return { server: p[1].replace(/^claude_ai_|^plugin_[^_]+_/, ''), tool: p.slice(2).join('__') }; })() : { server: '', tool: name });
  const isBrowser = (n) => /claude-in-chrome|playwright|puppeteer|browser|chrome|computer/i.test(n);
  function category(n) {
    if (/^(Bash|PowerShell|BashOutput|Monitor)$/.test(n)) return 'shell';
    if (/^(Read|Glob|Grep|LS|NotebookRead)$/.test(n)) return 'read';
    if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(n)) return 'write';
    if (/^(WebFetch|WebSearch)$/.test(n)) return 'web';
    if (isBrowser(n)) return 'browser';
    if (/^(Agent|Task|SendMessage|TaskStop)$/.test(n)) return 'agent';
    if (/^(TodoWrite|TaskCreate|TaskUpdate|EnterPlanMode|ExitPlanMode|Skill)$/.test(n)) return 'plan';
    if (n.startsWith('mcp__')) return 'mcp';
    return 'other';
  }
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // Stream real de Eyes on Claude (vía el proxy /api/events de la extensión)
  function connect({ onEvent, onReset, onReplayed, pill }) {
    let es;
    const set = (ok, txt) => { if (pill) { pill.className = `pill ${ok ? 'ok' : 'bad'}`; pill.innerHTML = `<i></i>${txt}`; } };
    const open = () => {
      es = new EventSource('api/events');
      es.onopen = () => set(true, LANG === 'es' ? 'en directo' : 'live');
      es.onerror = () => { set(false, LANG === 'es' ? 'esperando a Eyes on Claude…' : 'waiting for Eyes on Claude…'); };
      es.onmessage = (m) => {
        const ev = JSON.parse(m.data);
        if (ev.kind === '__history__') { onReset?.(); for (const e of ev.events) onEvent(e, true); onReplayed?.(); return; }
        if (ev.kind === '__clear__') { onReset?.(); onReplayed?.(); return; }
        onEvent(ev, false);
      };
    };
    set(false, '…');
    open();
  }

  // Tooltip flotante compartido
  const tip = document.createElement('div'); tip.className = 'tip'; document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));
  const showTip = (e, html) => { tip.innerHTML = html; tip.style.display = 'block'; const r = tip.getBoundingClientRect(); tip.style.left = `${Math.min(innerWidth - r.width - 8, e.clientX + 14)}px`; tip.style.top = `${Math.min(innerHeight - r.height - 8, e.clientY + 14)}px`; };
  const hideTip = () => (tip.style.display = 'none');

  window.EOC = { LANG, P, store, icon, esc, fmtTok, fmtDur, fmtTime, base, toolLabel, category, css, connect, showTip, hideTip, T: (dict) => (k, ...a) => { const v = (dict[LANG] || dict.en)[k] ?? dict.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; } };
})();
