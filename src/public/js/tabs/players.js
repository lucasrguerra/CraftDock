import { api } from '../socket.js';

const PAGE_SIZE = 25;

export function renderPlayers(root) {
  root.innerHTML = `
    <div class="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">

      <!-- Directory: the main content -->
      <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md min-w-0">
        <div class="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-slate-800/60">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2 mr-auto">
            <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            Jogadores do Mundo
          </h2>
          <span id="player-count" class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">0 online</span>
          <div class="relative w-full sm:w-64">
            <svg class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"></path></svg>
            <input id="player-search" type="text" placeholder="Filtrar por nome..." class="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200" />
          </div>
        </div>

        <ul id="directory" class="space-y-2 min-h-[30vh]">
          <li class="text-slate-400 text-sm italic py-4 text-center">Carregando...</li>
        </ul>

        <div id="pagination" class="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-400"></div>
      </div>

      <!-- Allowlist: everything about it in ONE card -->
      <div class="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md lg:sticky lg:top-6">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            Allowlist
          </h2>
          <button id="allowlist-toggle" class="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-500">
            <span class="sr-only">Ativar/desativar Allowlist</span>
            <span id="allowlist-knob" class="inline-block h-4 w-4 rounded-full bg-white shadow-md transform transition-all duration-300" style="transform:translateX(0.25rem)"></span>
          </button>
        </div>
        <p id="allowlist-hint" class="text-[11px] text-slate-500 mb-4"></p>

        <form id="allowlist-add" class="hidden gap-2 mb-4">
          <input name="name" required placeholder="Adicionar jogador..." class="flex-grow min-w-0 px-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all duration-200" />
          <button class="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-sm font-bold transition-all duration-200 active:scale-[0.96]" title="Adicionar à allowlist">+</button>
        </form>

        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Membros</span>
          <span id="allowlist-count" class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/50 text-slate-400">0</span>
        </div>
        <ul id="allowlist-list" class="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
          <li class="text-slate-500 text-xs italic py-2">Carregando...</li>
        </ul>
      </div>

      <!-- Detail modal root -->
      <div id="detail-modal"></div>
    </div>`;

  let capabilities = new Set();
  let currentWhitelistEnabled = false;
  let page = 1;
  let query = '';

  const action = (act, body) => api(`/api/players/${act}`, { method: 'POST', body }).then(() => { refresh(); loadDirectory(); });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // --- Directory (server-side paginated) ---

  // Per-player actions instead of type-a-name forms: primary buttons inline,
  // privilege actions (op/deop/ban) behind a native <details> kebab menu.
  function rowActions(e) {
    const iconBtn = (data, title, cls, path) => `
      <button ${data} title="${title}" class="p-1.5 rounded-lg border transition-all duration-200 active:scale-[0.94] ${cls}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"></path></svg>
      </button>`;

    const detail = e.xuid
      ? `<button data-detail="${esc(e.xuid)}" data-name="${esc(e.name)}" class="text-xs px-3 py-1.5 bg-slate-700/40 hover:bg-slate-600 border border-slate-600/40 hover:border-slate-500 text-slate-200 rounded-lg font-medium transition-all duration-200 active:scale-[0.96]">Detalhes</button>`
      : '';
    const online = e.online
      ? iconBtn(`data-tp="${esc(e.name)}"`, 'Teleportar', 'bg-blue-600/10 hover:bg-blue-600 border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-slate-950', 'M13 10V3L4 14h7v7l9-11h-7z')
      + iconBtn(`data-kick="${esc(e.name)}"`, 'Expulsar', 'bg-red-600/10 hover:bg-red-600 border-red-500/20 hover:border-red-600 text-red-400 hover:text-white', 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1')
      : '';

    const menuItem = (act, label, danger = false) => capabilities.has(act)
      ? `<button data-menu-act="${act}" data-menu-name="${esc(e.name)}" class="w-full text-left px-3 py-2 text-xs ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-slate-800'} transition-colors">${label}</button>`
      : '';
    const items = menuItem('op', 'Tornar OP') + menuItem('deop', 'Remover OP') + menuItem('ban', 'Banir jogador', true);
    const menu = items
      ? `<details class="relative" data-kebab>
           <summary class="list-none cursor-pointer p-1.5 rounded-lg border border-slate-700/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all [&::-webkit-details-marker]:hidden" title="Mais ações">
             <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
           </summary>
           <div class="absolute right-0 mt-1 w-40 py-1 bg-slate-900 border border-slate-700/70 rounded-xl shadow-2xl z-20 overflow-hidden">${items}</div>
         </details>`
      : '';
    return detail + online + menu;
  }

  async function loadDirectory() {
    const data = await api(`/api/players/directory?page=${page}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(query)}`);
    if (!data) return;
    const list = root.querySelector('#directory');
    // Don't re-render under an open kebab menu (the 5s poll would close it).
    if (list.querySelector('[data-kebab][open]')) return;
    const items = data.items || [];

    list.innerHTML = items.length
      ? items.map((e) => {
          const initials = esc(e.name.substring(0, 2).toUpperCase());
          const dot = e.online
            ? `<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>`
            : '';
          const avatar = e.online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/40 text-slate-500';
          const nameCls = e.online ? 'text-slate-200' : 'text-slate-400';
          const statusLine = `${e.online ? '<span class="text-emerald-400 font-semibold">Online</span>' : '<span class="text-slate-500">Offline</span>'}${e.xuid ? ` · <span class="text-slate-500 font-mono">${esc(e.xuid)}</span>` : ''}`;
          return `
            <li class="flex items-center justify-between gap-3 bg-slate-950/40 border border-slate-800 px-4 py-3 rounded-xl hover:border-slate-700 transition-all duration-200 ${e.online ? '' : 'opacity-80'}">
              <div class="flex items-center gap-3 min-w-0">
                <div class="relative h-9 w-9 rounded-lg ${avatar} flex items-center justify-center font-bold text-xs select-none shrink-0">${initials}${dot}</div>
                <div class="flex flex-col min-w-0">
                  <span class="font-medium ${nameCls} text-sm truncate">${esc(e.name)}</span>
                  <span class="text-[10px] truncate">${statusLine}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">${rowActions(e)}</div>
            </li>`;
        }).join('')
      : `<div class="flex flex-col items-center justify-center py-10 text-slate-500">
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
    list.querySelectorAll('[data-menu-act]').forEach((b) => {
      b.onclick = () => {
        const { menuAct, menuName } = b.dataset;
        b.closest('details')?.removeAttribute('open');
        if (menuAct === 'ban' && !confirm(`Banir ${menuName} permanentemente do servidor?`)) return;
        action(menuAct, { name: menuName });
      };
    });
    // Only one kebab menu open at a time; close on outside click.
    list.querySelectorAll('[data-kebab]').forEach((d) => {
      d.addEventListener('toggle', () => {
        if (d.open) list.querySelectorAll('[data-kebab][open]').forEach((o) => { if (o !== d) o.removeAttribute('open'); });
      });
    });
  }
  root.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-kebab]')) root.querySelectorAll('[data-kebab][open]').forEach((o) => o.removeAttribute('open'));
  });

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

  // --- Allowlist card (single home for toggle + add + members) ---
  function renderAllowlist(data) {
    currentWhitelistEnabled = data.whitelistEnabled;
    const toggle = root.querySelector('#allowlist-toggle');
    const knob = root.querySelector('#allowlist-knob');
    const hint = root.querySelector('#allowlist-hint');
    toggle.classList.toggle('bg-emerald-600', currentWhitelistEnabled);
    toggle.classList.toggle('bg-slate-700', !currentWhitelistEnabled);
    knob.style.transform = currentWhitelistEnabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)';
    hint.textContent = currentWhitelistEnabled
      ? 'Ativa — apenas os membros abaixo podem entrar.'
      : 'Desativada — qualquer jogador pode entrar no servidor.';
    toggle.onclick = () => action(currentWhitelistEnabled ? 'whitelistOff' : 'whitelistOn', {});

    const addForm = root.querySelector('#allowlist-add');
    addForm.classList.toggle('hidden', !capabilities.has('whitelistAdd'));
    addForm.classList.toggle('flex', capabilities.has('whitelistAdd'));
    addForm.onsubmit = (e) => {
      e.preventDefault();
      const input = addForm.querySelector('input[name="name"]');
      if (input.value.trim()) action('whitelistAdd', { name: input.value.trim() });
      input.value = '';
    };

    const list = root.querySelector('#allowlist-list');
    const members = data.whitelist || [];
    root.querySelector('#allowlist-count').textContent = members.length;
    list.innerHTML = members.length
      ? members.map((name) => `
          <li class="flex items-center gap-2.5 bg-slate-950/50 border border-slate-800/60 px-3 py-2 rounded-xl group hover:border-amber-500/30 transition-all duration-200">
            <div class="h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-[10px] select-none shrink-0">${esc(name.substring(0, 2).toUpperCase())}</div>
            <span class="text-sm text-slate-300 font-medium truncate mr-auto">${esc(name)}</span>
            ${capabilities.has('whitelistRemove') ? `<button data-wl-remove="${esc(name)}" class="text-slate-600 hover:text-red-400 transition-colors duration-200 opacity-0 group-hover:opacity-100 shrink-0" title="Remover da allowlist"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>` : ''}
          </li>`).join('')
      : '<li class="text-slate-500 text-xs italic py-2">Nenhum jogador na allowlist.</li>';
    list.querySelectorAll('[data-wl-remove]').forEach((b) => { b.onclick = () => action('whitelistRemove', { name: b.dataset.wlRemove }); });
  }

  async function refresh() {
    const data = await api('/api/players');
    if (!data) return;
    capabilities = new Set(data.capabilities);
    root.querySelector('#player-count').textContent = `${data.players?.online || 0}/${data.players?.max || 20} online`;
    renderAllowlist(data);
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
