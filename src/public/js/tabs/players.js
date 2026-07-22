import { api } from '../socket.js';

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
        
        <!-- Online Players Card -->
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

          <ul id="online" class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            <li class="text-slate-400 text-sm italic py-4 text-center">Carregando...</li>
          </ul>
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
        <div id="whitelist-list" class="flex flex-wrap gap-2">
        </div>
      </div>

    </div>`;

  let capabilities = new Set();
  let currentWhitelistEnabled = false;
  let lastData = null;

  const action = (act, body) => api(`/api/players/${act}`, { method: 'POST', body }).then(refresh);

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

  // Builds the player list from online players + the persisted XUID directory,
  // filtered by the search box. Called on every refresh and on each keystroke.
  function renderPlayerList() {
    if (!lastData) return;
    const online = root.querySelector('#online');
    const countEl = root.querySelector('#player-count');
    if (!online) return;

    const onlineNames = lastData.players.players || [];
    const directory = lastData.players.directory || [];
    const byName = new Map(directory.map((e) => [e.name, e]));

    // Union of currently-online names and everyone in the directory. XUID is the
    // canonical identity; online players are matched to their XUID by name.
    const names = new Set([...onlineNames, ...directory.map((e) => e.name)]);
    let entries = [...names].map((name) => ({
      name,
      xuid: byName.get(name)?.xuid || null,
      isOnline: onlineNames.includes(name),
    }));

    const q = (root.querySelector('#player-search')?.value || '').trim().toLowerCase();
    if (q) entries = entries.filter((e) => e.name.toLowerCase().includes(q));

    entries.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    countEl.textContent = `${onlineNames.length}/${lastData.players.max || 20} online`;

    online.innerHTML = entries.length
      ? entries.map((e) => {
          const initials = e.name.substring(0, 2).toUpperCase();
          const xuidTag = e.xuid
            ? `<span class="text-[10px] text-slate-500 font-mono" title="XUID">${e.xuid}</span>`
            : '';
          if (e.isOnline) {
            return `
              <li class="flex items-center justify-between bg-slate-950/40 border border-slate-800 p-3 rounded-xl hover:border-slate-700 transition-all duration-200">
                <div class="flex items-center gap-3">
                  <div class="relative h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs select-none">
                    ${initials}
                    <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-medium text-slate-200 text-sm">${e.name}</span>
                    <span class="text-[10px] text-emerald-400 font-semibold">Online${e.xuid ? ' · ' : ''}${e.xuid ? `<span class="text-slate-500 font-mono font-normal">${e.xuid}</span>` : ''}</span>
                  </div>
                </div>
                <div class="flex gap-1.5">
                  <button data-tp="${e.name}" class="text-xs px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-slate-950 rounded-lg font-medium transition-all duration-250 active:scale-[0.96]">
                    Teleportar
                  </button>
                  <button data-kick="${e.name}" class="text-xs px-3 py-1.5 bg-red-600/10 hover:bg-red-650 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white rounded-lg font-medium transition-all duration-250 active:scale-[0.96]">
                    Expulsar
                  </button>
                </div>
              </li>`;
          }
          return `
              <li class="flex items-center justify-between bg-slate-950/20 border border-slate-900/60 p-3 rounded-xl opacity-60">
                <div class="flex items-center gap-3">
                  <div class="h-8 w-8 rounded-lg bg-slate-800/40 text-slate-500 flex items-center justify-center font-bold text-xs select-none">
                    ${initials}
                  </div>
                  <div class="flex flex-col">
                    <span class="font-medium text-slate-400 text-sm">${e.name}</span>
                    <span class="text-[10px] text-slate-500">Offline${e.xuid ? ' · ' : ''}${xuidTag}</span>
                  </div>
                </div>
                <div class="flex gap-1.5"></div>
              </li>`;
        }).join('')
      : `
          <div class="flex flex-col items-center justify-center py-8 text-slate-500">
            <svg class="w-8 h-8 opacity-40 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"></path></svg>
            <span class="text-xs">${q ? 'Nenhum jogador corresponde ao filtro' : 'Nenhum jogador encontrado'}</span>
          </div>`;

    online.querySelectorAll('[data-kick]').forEach((b) => {
      b.onclick = () => action('kick', { name: b.dataset.kick });
    });
    online.querySelectorAll('[data-tp]').forEach((b) => {
      b.onclick = () => {
        const target = prompt('Teleportar para (jogador ou coordenadas x y z):');
        if (target) action('teleport', { name: b.dataset.tp, target });
      };
    });
  }

  async function refresh() {
    const data = await api('/api/players');
    if (!data) return;
    capabilities = new Set(data.capabilities);
    
    // --- Allowlist banner ---
    updateAllowlistBanner(data.whitelistEnabled);

    const toggleBtn = root.querySelector('#allowlist-toggle');
    toggleBtn.onclick = () => {
      const act = currentWhitelistEnabled ? 'whitelistOff' : 'whitelistOn';
      action(act, {});
    };

    // --- Known players (online + XUID directory), filterable by name ---
    lastData = data;
    renderPlayerList();

    // --- Management forms ---
    const mgmt = root.querySelector('#mgmt');
    let formsHtml = '';
    
    if (capabilities.has('whitelistAdd')) formsHtml += mgmtForm('whitelistAdd', 'Whitelist +', 'Adicionar jogador à Whitelist');
    if (capabilities.has('whitelistRemove')) formsHtml += mgmtForm('whitelistRemove', 'Whitelist −', 'Remover jogador da Whitelist');
    if (capabilities.has('ban')) formsHtml += mgmtForm('ban', 'Banir', 'Nome do jogador para banir');
    if (capabilities.has('op')) formsHtml += mgmtForm('op', 'Tornar Op (Admin)', 'Nome do jogador');
    
    if (!formsHtml) {
      formsHtml = `<p class="text-xs text-slate-500 italic py-2">Nenhum controle de privilégios suportado nesta edição do Minecraft.</p>`;
    }
    
    mgmt.innerHTML = formsHtml;

    root.querySelectorAll('#mgmt form').forEach((f) => {
      f.onsubmit = (e) => {
        e.preventDefault();
        const input = f.querySelector('input[name="name"]');
        action(f.dataset.act, { name: input.value });
        input.value = '';
      };
    });

    // --- Whitelist members ---
    const whitelistCard = root.querySelector('#whitelist-card');
    const whitelistList = root.querySelector('#whitelist-list');
    const whitelistCount = root.querySelector('#whitelist-count');
    const whitelist = data.whitelist || [];

    if (whitelist.length > 0) {
      whitelistCard.classList.remove('hidden');
      whitelistCount.textContent = whitelist.length;
      whitelistList.innerHTML = whitelist.map((name) => `
        <div class="flex items-center gap-2 bg-slate-950/50 border border-slate-800/60 px-3 py-1.5 rounded-xl group hover:border-amber-500/30 transition-all duration-200">
          <div class="h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-[10px] select-none">
            ${name.substring(0, 2).toUpperCase()}
          </div>
          <span class="text-sm text-slate-300 font-medium">${name}</span>
          ${capabilities.has('whitelistRemove') ? `
            <button data-wl-remove="${name}" class="ml-1 text-slate-600 hover:text-red-400 transition-colors duration-200 opacity-0 group-hover:opacity-100" title="Remover da Whitelist">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          ` : ''}
        </div>`).join('');

      whitelistList.querySelectorAll('[data-wl-remove]').forEach((b) => {
        b.onclick = () => action('whitelistRemove', { name: b.dataset.wlRemove });
      });
    } else {
      whitelistCard.classList.add('hidden');
    }
  }

  // Re-filter instantly on each keystroke, without waiting for the next refresh.
  root.querySelector('#player-search').addEventListener('input', renderPlayerList);

  refresh();
  const timer = setInterval(refresh, 5000);
  return () => clearInterval(timer);
}
