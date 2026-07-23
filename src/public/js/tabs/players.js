import { api } from '../socket.js';

const PAGE_SIZE = 25;

export function renderPlayers(root) {
  root.innerHTML = `
    <div class="space-y-6 max-w-4xl w-full mx-auto">

      <!-- Allowlist Toggle Banner -->
      <div id="allowlist-banner" class="bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-md flex items-center justify-between">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          <span class="text-sm font-medium text-slate-200">Allowlist</span>
          <span id="allowlist-badge" class="text-xs font-bold px-2.5 py-0.5 rounded-full transition-all duration-300"></span>
        </div>
        <button id="allowlist-toggle" class="relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-500">
          <span class="sr-only">Toggle Allowlist</span>
          <span id="allowlist-knob" class="inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-all duration-300"></span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        <!-- Directory Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md">
          <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
            <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Jogadores do Mundo
            </h2>
            <span id="player-count" class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/50 text-slate-400">0 online</span>
          </div>

          <div class="relative mb-3">
            <svg class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"></path></svg>
            <input id="player-search" type="text" placeholder="Filtrar por nome..." class="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200" />
          </div>

          <ul id="directory" class="space-y-2 min-h-[20vh] max-h-[50vh] overflow-y-auto pr-1">
            <li class="text-slate-400 text-sm italic py-4 text-center">Carregando...</li>
          </ul>

          <div id="pagination" class="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-400"></div>
        </div>

        <!-- Management Panel -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/60">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            Gerenciamento
          </h2>
          <div id="mgmt" class="space-y-4">
            <p class="text-slate-400 text-sm italic py-4 text-center">Carregando permissões...</p>
          </div>
        </div>

      </div>

      <!-- Whitelist Members Card -->
      <div id="whitelist-card" class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md hidden">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
            Jogadores na Whitelist
          </h2>
          <span id="whitelist-count" class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/50 text-slate-400">0</span>
        </div>
        <div id="whitelist-list" class="flex flex-wrap gap-2"></div>
      </div>

      <!-- Detail modal root -->
      <div id="detail-modal"></div>
    </div>`;

  let capabilities = new Set();
  let currentWhitelistEnabled = false;
  let page = 1;
  let query = '';

  const action = (act, body) => api(`/api/players/${act}`, { method: 'POST', body }).then(refresh);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function mgmtForm(act, label, placeholder = 'Nome do jogador') {
    if (!capabilities.has(act)) return '';
    return `
      <form data-act="${act}" class="flex gap-2">
        <input name="name" required placeholder="${placeholder}" class="flex-grow px-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200" />
        <button class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 text-sm font-medium transition-all duration-200 active:scale-[0.98]">
          ${label}
        </button>
      </form>`;
  }

  function updateAllowlistBanner(enabled) {
    currentWhitelistEnabled = enabled;
    const badge = root.querySelector('#allowlist-badge');
    const toggle = root.querySelector('#allowlist-toggle');
    const knob = root.querySelector('#allowlist-knob');
    if (enabled) {
      badge.textContent = 'ON';
      badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 transition-all duration-300';
      toggle.className = toggle.className.replace(/bg-\S+/g, '') + ' bg-emerald-600';
      knob.style.transform = 'translateX(1.25rem)';
    } else {
      badge.textContent = 'OFF';
      badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30 transition-all duration-300';
      toggle.className = toggle.className.replace(/bg-\S+/g, '') + ' bg-slate-700';
      knob.style.transform = 'translateX(0.25rem)';
    }
  }

  // --- Directory (server-side paginated) ---
  async function loadDirectory() {
    const data = await api(`/api/players/directory?page=${page}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(query)}`);
    if (!data) return;
    const list = root.querySelector('#directory');
    const items = data.items || [];

    list.innerHTML = items.length
      ? items.map((e) => {
          const initials = esc(e.name.substring(0, 2).toUpperCase());
          const canInspect = !!e.xuid;
          const dot = e.online
            ? `<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>`
            : '';
          const avatar = e.online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/40 text-slate-500';
          const nameCls = e.online ? 'text-slate-200' : 'text-slate-400';
          const statusLine = `${e.online ? '<span class="text-emerald-400 font-semibold">Online</span>' : '<span class="text-slate-500">Offline</span>'}${e.xuid ? ` · <span class="text-slate-500 font-mono">${esc(e.xuid)}</span>` : ''}`;
          const inspectBtn = canInspect
            ? `<button data-detail="${esc(e.xuid)}" data-name="${esc(e.name)}" class="text-xs px-3 py-1.5 bg-slate-700/40 hover:bg-slate-600 border border-slate-600/40 hover:border-slate-500 text-slate-200 rounded-lg font-medium transition-all duration-200 active:scale-[0.96]">Detalhes</button>`
            : '';
          const onlineBtns = e.online
            ? `<button data-tp="${esc(e.name)}" class="text-xs px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-slate-950 rounded-lg font-medium transition-all duration-200 active:scale-[0.96]">Teleportar</button>
               <button data-kick="${esc(e.name)}" class="text-xs px-3 py-1.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white rounded-lg font-medium transition-all duration-200 active:scale-[0.96]">Expulsar</button>`
            : '';
          return `
            <li class="flex items-center justify-between gap-2 bg-slate-950/40 border border-slate-800 p-3 rounded-xl hover:border-slate-700 transition-all duration-200 ${e.online ? '' : 'opacity-80'}">
              <div class="flex items-center gap-3 min-w-0">
                <div class="relative h-8 w-8 rounded-lg ${avatar} flex items-center justify-center font-bold text-xs select-none shrink-0">${initials}${dot}</div>
                <div class="flex flex-col min-w-0">
                  <span class="font-medium ${nameCls} text-sm truncate">${esc(e.name)}</span>
                  <span class="text-[10px] truncate">${statusLine}</span>
                </div>
              </div>
              <div class="flex gap-1.5 shrink-0">${inspectBtn}${onlineBtns}</div>
            </li>`;
        }).join('')
      : `<div class="flex flex-col items-center justify-center py-8 text-slate-500">
           <svg class="w-8 h-8 opacity-40 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
           <span class="text-xs">${query ? 'Nenhum jogador corresponde ao filtro' : 'Nenhum jogador encontrado'}</span>
         </div>`;

    // Pagination controls
    const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
    const pag = root.querySelector('#pagination');
    pag.innerHTML = `
      <button data-page="prev" class="px-3 py-1.5 rounded-lg border border-slate-700/60 ${data.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}" ${data.page <= 1 ? 'disabled' : ''}>‹ Anterior</button>
      <span>Página ${data.page} de ${totalPages} · ${data.total || 0} jogador${(data.total || 0) === 1 ? '' : 'es'}</span>
      <button data-page="next" class="px-3 py-1.5 rounded-lg border border-slate-700/60 ${data.page >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}" ${data.page >= totalPages ? 'disabled' : ''}>Próxima ›</button>`;

    pag.querySelector('[data-page="prev"]').onclick = () => { if (page > 1) { page--; loadDirectory(); } };
    pag.querySelector('[data-page="next"]').onclick = () => { if (page < totalPages) { page++; loadDirectory(); } };

    list.querySelectorAll('[data-kick]').forEach((b) => { b.onclick = () => action('kick', { name: b.dataset.kick }); });
    list.querySelectorAll('[data-tp]').forEach((b) => {
      b.onclick = () => { const t = prompt('Teleportar para (jogador ou coordenadas x y z):'); if (t) action('teleport', { name: b.dataset.tp, target: t }); };
    });
    list.querySelectorAll('[data-detail]').forEach((b) => { b.onclick = () => openDetail(b.dataset.detail, b.dataset.name); });
  }

  // --- Detail modal ---
  let modalTimer = null;
  function closeModal() {
    if (modalTimer) { clearInterval(modalTimer); modalTimer = null; }
    root.querySelector('#detail-modal').innerHTML = '';
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  function bar(label, value, max, colorClass) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return `
      <div>
        <div class="flex justify-between text-[11px] text-slate-400 mb-1"><span>${label}</span><span>${value} / ${max}</span></div>
        <div class="h-2.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full ${colorClass} rounded-full transition-all duration-300" style="width:${pct}%"></div></div>
      </div>`;
  }

  // --- Minecraft-style inventory rendering ---
  // Slot layout follows the game: 0-8 hotbar, 9-35 main grid (3 rows of 9).
  const ICON_BASE = '/assets/mc/items';
  const shortName = (n) => String(n || '').replace(/^minecraft:/, '');
  const prettyName = (n) => shortName(n).replace(/_/g, ' ');

  function slotHtml(it, { placeholder = '' } = {}) {
    const inner = it && it.name
      ? `<img src="${ICON_BASE}/${esc(shortName(it.name))}.png" alt="" loading="lazy"
             class="w-7 h-7 [image-rendering:pixelated]"
             onerror="this.outerHTML='<span class=\\'mc-slot-fallback\\'>${esc(prettyName(it.name)).replace(/'/g, '&#39;')}</span>'">
         ${it.count > 1 ? `<span class="mc-count">${it.count}</span>` : ''}`
      : placeholder;
    const title = it && it.name ? ` title="${esc(prettyName(it.name))}${it.count > 1 ? ` ×${it.count}` : ''}"` : '';
    return `<div class="mc-slot"${title}>${inner}</div>`;
  }

  function inventoryHtml(d) {
    const bySlot = new Map((d.inventory || []).filter((i) => i && i.name).map((i) => [i.slot, i]));
    const row = (from, to) => {
      let cells = '';
      for (let s = from; s <= to; s++) cells += slotHtml(bySlot.get(s));
      return `<div class="grid grid-cols-9 gap-[3px]">${cells}</div>`;
    };
    const armor = d.armor || {};
    const armorIcons = { head: '🪖', chest: '🦺', legs: '👖', feet: '🥾' };
    const equipment = ['head', 'chest', 'legs', 'feet']
      .map((k) => slotHtml(armor[k], { placeholder: `<span class="mc-slot-ph">${armorIcons[k]}</span>` }))
      .join('');
    return `
      <div class="mc-inv select-none">
        <div class="flex items-center justify-between mb-2.5">
          <div class="flex gap-[3px]">${equipment}</div>
          <div class="flex items-center gap-[3px]">
            <span class="text-[10px] text-[#404040] font-semibold mr-1">Escudo</span>
            ${slotHtml(d.offhand, { placeholder: '<span class="mc-slot-ph">🛡️</span>' })}
          </div>
        </div>
        ${row(9, 17)}${row(18, 26)}${row(27, 35)}
        <div class="mt-2">${row(0, 8)}</div>
      </div>
      <style>
        .mc-inv { background:#c6c6c6; border-radius:6px; padding:10px;
                  border-top:2px solid #fff; border-left:2px solid #fff;
                  border-right:2px solid #555; border-bottom:2px solid #555; width:fit-content; margin:0 auto; }
        .mc-inv .grid + .grid { margin-top: 3px; }
        .mc-slot { position:relative; width:36px; height:36px; background:#8b8b8b;
                   border-top:2px solid #373737; border-left:2px solid #373737;
                   border-bottom:2px solid #fff; border-right:2px solid #fff;
                   display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .mc-count { position:absolute; right:1px; bottom:-1px; font-size:12px; font-weight:700;
                    color:#fff; text-shadow:1px 1px 0 #3f3f3f; line-height:1; pointer-events:none; }
        .mc-slot-fallback { font-size:7px; line-height:1.1; color:#2f2f2f; text-align:center;
                            word-break:break-word; padding:1px; font-weight:600; }
        .mc-slot-ph { opacity:.35; font-size:14px; filter:grayscale(1); }
      </style>`;
  }

  function renderModalBody(d, name) {
    if (d.needsBridge) {
      return `<p class="text-sm text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">Abra este jogador uma vez enquanto ele está <b>online</b> para vincular os dados do save (o Bedrock não liga o nome ao arquivo até o primeiro acesso observado).</p>`;
    }
    if (d.empty || !d.position) {
      return `<p class="text-sm text-slate-400 italic py-4">Sem dados salvos para este jogador ainda.</p>`;
    }
    const dimLabel = { overworld: 'Overworld', nether: 'Nether', end: 'End' }[d.dimension] || d.dimension;
    const p = d.position;
    const invGrid = inventoryHtml(d);

    return `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
            <div class="text-[11px] text-slate-500 mb-1">Posição</div>
            <div class="text-sm text-slate-200 font-mono">${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}</div>
            <div class="text-[11px] text-slate-400 mt-1">${dimLabel}</div>
          </div>
          <div class="bg-slate-950/50 border border-slate-800 rounded-xl p-3 space-y-2 flex flex-col justify-center">
            ${d.health ? bar('Vida', Math.round(d.health.current * 10) / 10, d.health.max, 'bg-red-500') : ''}
            ${typeof d.food === 'number' ? bar('Fome', d.food, 20, 'bg-amber-500') : ''}
          </div>
        </div>
        <div>
          <div class="text-[11px] text-slate-500 mb-2">Inventário${d.xp ? ` · <span class="text-slate-400">Nível ${d.xp.level}</span>` : ''}${d.gamemode ? ` · <span class="text-slate-400 capitalize">${esc(d.gamemode)}</span>` : ''}</div>
          <div class="overflow-x-auto">${invGrid}</div>
        </div>
      </div>`;
  }

  async function openDetail(xuid, name) {
    const host = root.querySelector('#detail-modal');
    const shell = (body, footer = '') => `
      <div data-backdrop class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="w-full max-w-lg bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm select-none">${esc(name.substring(0, 2).toUpperCase())}</div>
              <div class="min-w-0">
                <div class="font-bold text-slate-100 truncate">${esc(name)}</div>
                <div class="text-[10px] text-slate-500 font-mono truncate">${esc(xuid)}</div>
              </div>
            </div>
            <button data-close class="text-slate-500 hover:text-slate-200 transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>
          <div class="p-5">${body}</div>
          <div class="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/40">${footer}</div>
        </div>
      </div>`;

    host.innerHTML = shell('<p class="text-sm text-slate-400 italic py-6 text-center">Carregando dados do save...</p>');
    document.addEventListener('keydown', onEsc);

    const wire = () => {
      host.querySelector('[data-close]').onclick = closeModal;
      host.querySelector('[data-backdrop]').onclick = (ev) => { if (ev.target === ev.currentTarget) closeModal(); };
      const rb = host.querySelector('[data-refresh]');
      if (rb) rb.onclick = () => load();
    };
    wire();

    async function load() {
      const d = await api(`/api/players/detail?xuid=${encodeURIComponent(xuid)}`);
      if (!d) { host.innerHTML = shell('<p class="text-sm text-red-400 py-4">Falha ao ler os dados do jogador.</p>', footerHtml('')); wire(); return; }
      host.innerHTML = shell(renderModalBody(d, name), footerHtml(d));
      wire();
    }
    function footerHtml(d) {
      const online = d && d.online ? '<span class="text-[11px] text-emerald-400 font-semibold">● Online</span>' : '<span class="text-[11px] text-slate-500">Offline</span>';
      const saved = d && d.savedAt ? `<span class="text-[11px] text-slate-500">atualizado às ${new Date(d.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` : '<span></span>';
      return `${online}${saved}<button data-refresh class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 transition-all">Atualizar</button>`;
    }
    await load();
  }

  // --- Whitelist + management (from /api/players) ---
  async function refresh() {
    const data = await api('/api/players');
    if (!data) return;
    capabilities = new Set(data.capabilities);

    updateAllowlistBanner(data.whitelistEnabled);
    const toggleBtn = root.querySelector('#allowlist-toggle');
    toggleBtn.onclick = () => action(currentWhitelistEnabled ? 'whitelistOff' : 'whitelistOn', {});

    root.querySelector('#player-count').textContent = `${data.players?.online || 0}/${data.players?.max || 20} online`;

    // Management forms
    const mgmt = root.querySelector('#mgmt');
    let formsHtml = '';
    if (capabilities.has('whitelistAdd')) formsHtml += mgmtForm('whitelistAdd', 'Whitelist +', 'Adicionar jogador à Whitelist');
    if (capabilities.has('whitelistRemove')) formsHtml += mgmtForm('whitelistRemove', 'Whitelist −', 'Remover jogador da Whitelist');
    if (capabilities.has('ban')) formsHtml += mgmtForm('ban', 'Banir', 'Nome do jogador para banir');
    if (capabilities.has('op')) formsHtml += mgmtForm('op', 'Tornar Op (Admin)', 'Nome do jogador');
    if (!formsHtml) formsHtml = `<p class="text-xs text-slate-500 italic py-2">Nenhum controle de privilégios suportado nesta edição do Minecraft.</p>`;
    mgmt.innerHTML = formsHtml;
    root.querySelectorAll('#mgmt form').forEach((f) => {
      f.onsubmit = (e) => {
        e.preventDefault();
        const input = f.querySelector('input[name="name"]');
        action(f.dataset.act, { name: input.value });
        input.value = '';
      };
    });

    // Whitelist members
    const whitelistCard = root.querySelector('#whitelist-card');
    const whitelistList = root.querySelector('#whitelist-list');
    const whitelistCount = root.querySelector('#whitelist-count');
    const whitelist = data.whitelist || [];
    if (whitelist.length > 0) {
      whitelistCard.classList.remove('hidden');
      whitelistCount.textContent = whitelist.length;
      whitelistList.innerHTML = whitelist.map((name) => `
        <div class="flex items-center gap-2 bg-slate-950/50 border border-slate-800/60 px-3 py-1.5 rounded-xl group hover:border-amber-500/30 transition-all duration-200">
          <div class="h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-[10px] select-none">${esc(name.substring(0, 2).toUpperCase())}</div>
          <span class="text-sm text-slate-300 font-medium">${esc(name)}</span>
          ${capabilities.has('whitelistRemove') ? `<button data-wl-remove="${esc(name)}" class="ml-1 text-slate-600 hover:text-red-400 transition-colors duration-200 opacity-0 group-hover:opacity-100" title="Remover da Whitelist"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>` : ''}
        </div>`).join('');
      whitelistList.querySelectorAll('[data-wl-remove]').forEach((b) => { b.onclick = () => action('whitelistRemove', { name: b.dataset.wlRemove }); });
    } else {
      whitelistCard.classList.add('hidden');
    }
  }

  // Search → server-side query, debounced, resets to page 1.
  let searchTimer = null;
  root.querySelector('#player-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = e.target.value.trim(); page = 1; loadDirectory(); }, 300);
  });

  refresh();
  loadDirectory();
  const timer = setInterval(() => { refresh(); loadDirectory(); }, 5000);
  return () => { clearInterval(timer); closeModal(); };
}
