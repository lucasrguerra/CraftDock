import { api } from '../socket.js';

export function renderStatus(root) {
  root.innerHTML = `
    <div class="space-y-6 max-w-4xl mx-auto w-full">
      <!-- Status Summary Panel -->
      <div class="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative flex h-3 w-3">
            <span id="state-ping" class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"></span>
            <span id="state-dot" class="relative inline-flex rounded-full h-3 w-3"></span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span id="state" class="text-lg font-semibold capitalize text-slate-200">Carregando...</span>
              <span id="edition" class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50"></span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">Status do servidor em tempo real</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button data-act="start" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-slate-950 font-medium transition-all duration-300 shadow-lg shadow-emerald-500/5 hover:shadow-emerald-500/20 active:scale-[0.98]">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
            Ligar
          </button>
          <button data-act="stop" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/10 hover:bg-amber-600 border border-amber-500/20 hover:border-amber-500 text-amber-400 hover:text-slate-950 font-medium transition-all duration-300 active:scale-[0.98]">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
            Desligar
          </button>
          <button data-act="restart" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-slate-950 font-medium transition-all duration-300 active:scale-[0.98]">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
            Reiniciar
          </button>
          <button data-act="kill" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-700 border border-rose-500/20 hover:border-rose-600 text-rose-400 hover:text-white font-medium transition-all duration-300 active:scale-[0.98]">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
            Forçar Parada
          </button>
        </div>
      </div>

      <!-- Resource Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- CPU Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Processador</span>
            <div class="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
            </div>
          </div>
          <div id="cpu" class="text-3xl font-bold tracking-tight text-slate-100">–</div>
          <p class="text-xs text-slate-500 mt-1">Uso de CPU do container</p>
        </div>

        <!-- Memory Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Memória RAM</span>
            <div class="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
          </div>
          <div id="mem" class="text-3xl font-bold tracking-tight text-slate-100">–</div>
          <p class="text-xs text-slate-500 mt-1">Utilização da memória física</p>
        </div>

        <!-- Players Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Jogadores</span>
            <div class="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </div>
          </div>
          <div id="players" class="text-3xl font-bold tracking-tight text-slate-100">–</div>
          <p class="text-xs text-slate-500 mt-1">Conectados atualmente</p>
        </div>
      </div>
    </div>`;

  root.querySelectorAll('button[data-act]').forEach((b) => {
    b.onclick = () => api(`/api/status/${b.dataset.act}`, { method: 'POST' });
  });

  const socket = io('/status');
  const pingEl = root.querySelector('#state-ping');
  const dotEl = root.querySelector('#state-dot');

  socket.on('status', (s) => {
    const stateEl = root.querySelector('#state');
    stateEl.textContent = s.state;
    root.querySelector('#edition').textContent = s.edition ? `Edição: ${s.edition}` : '';
    root.querySelector('#cpu').textContent = s.state === 'running' ? `${s.cpuPct}%` : '–';
    root.querySelector('#mem').textContent = s.state === 'running' ? `${s.memUsedMb} MB` : '–';
    root.querySelector('#players').textContent = s.players ? `${s.players.online}/${s.players.max}` : '–';

    // Color code ping & dot based on state
    if (s.state === 'running') {
      pingEl.className = 'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-500';
      dotEl.className = 'relative inline-flex rounded-full h-3 w-3 bg-emerald-500';
      stateEl.className = 'text-lg font-semibold capitalize text-emerald-400';
    } else if (s.state === 'starting' || s.state === 'stopping' || s.state === 'restarting') {
      pingEl.className = 'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-500';
      dotEl.className = 'relative inline-flex rounded-full h-3 w-3 bg-amber-500';
      stateEl.className = 'text-lg font-semibold capitalize text-amber-400';
    } else {
      pingEl.className = 'absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-500';
      dotEl.className = 'relative inline-flex rounded-full h-3 w-3 bg-rose-500';
      stateEl.className = 'text-lg font-semibold capitalize text-rose-400';
    }
  });

  return () => socket.disconnect();
}
