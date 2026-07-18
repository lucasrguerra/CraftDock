import { api } from '../socket.js';

export function renderPlayers(root) {
  root.innerHTML = `
    <div class="space-y-6 max-w-4xl">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        <!-- Online Players Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md">
          <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
            <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Jogadores Online
            </h2>
            <span id="player-count" class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/50 text-slate-400">0 online</span>
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
    </div>`;

  let capabilities = new Set();

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

  async function refresh() {
    const data = await api('/api/players');
    if (!data) return;
    capabilities = new Set(data.capabilities);
    
    const online = root.querySelector('#online');
    const countEl = root.querySelector('#player-count');
    
    countEl.textContent = `${data.players.players.length}/${data.players.max} online`;
    
    online.innerHTML = data.players.players.length
      ? data.players.players.map((p) => `
          <li class="flex items-center justify-between bg-slate-950/40 border border-slate-850 p-3 rounded-xl hover:border-slate-800 transition-all duration-200">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs select-none">
                ${p.substring(0, 2).toUpperCase()}
              </div>
              <span class="font-medium text-slate-200 text-sm">${p}</span>
            </div>
            <div class="flex gap-1.5">
              <button data-tp="${p}" class="text-xs px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-slate-950 rounded-lg font-medium transition-all duration-250 active:scale-[0.96]">
                Teleportar
              </button>
              <button data-kick="${p}" class="text-xs px-3 py-1.5 bg-red-600/10 hover:bg-red-650 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white rounded-lg font-medium transition-all duration-250 active:scale-[0.96]">
                Expulsar
              </button>
            </div>
          </li>`).join('')
      : `
          <div class="flex flex-col items-center justify-center py-8 text-slate-500">
            <svg class="w-8 h-8 opacity-40 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"></path></svg>
            <span class="text-xs">Nenhum jogador online</span>
          </div>`;

    const mgmt = root.querySelector('#mgmt');
    let formsHtml = '';
    
    // Add dynamically depending on capabilities
    if (capabilities.has('whitelistAdd')) formsHtml += mgmtForm('whitelistAdd', 'Whitelist +', 'Adicionar jogador à Whitelist');
    if (capabilities.has('ban')) formsHtml += mgmtForm('ban', 'Banir', 'Nome do jogador para banir');
    if (capabilities.has('op')) formsHtml += mgmtForm('op', 'Tornar Op (Admin)', 'Nome do jogador');
    
    // If no management capabilities are exposed (e.g. bedrock supports none of these via API or restricted)
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

  refresh();
  const timer = setInterval(refresh, 5000);
  return () => clearInterval(timer);
}
