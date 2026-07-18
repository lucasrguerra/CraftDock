import { api } from '../socket.js';

export function renderMap(root) {
  root.innerHTML = `
    <div id="mapWrap" class="w-full max-w-6xl mx-auto flex items-center justify-center py-20 text-slate-500">
      <div class="flex flex-col items-center gap-3">
        <svg class="animate-spin h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm font-medium">Buscando configurações do mapa...</span>
      </div>
    </div>`;

  api('/api/client-config').then((cfg) => {
    const wrap = root.querySelector('#mapWrap');
    if (cfg?.mapUrl) {
      wrap.className = 'w-full max-w-7xl mx-auto h-[80vh] bg-slate-950/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md';
      wrap.innerHTML = `<iframe src="${cfg.mapUrl}" class="w-full h-full" style="border:0" allow="fullscreen"></iframe>`;
    } else {
      wrap.className = 'w-full max-w-2xl mx-auto py-8';
      wrap.innerHTML = `
        <div class="bg-slate-900/40 border border-slate-800/80 p-8 rounded-2xl backdrop-blur-md">
          <div class="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800/60">
            <div class="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 5.447-2.724A1 1 0 0121 3.118v10.764a1 1 0 01-.553.894L15 20l-6-3z"></path></svg>
            </div>
            <h3 class="font-bold text-slate-200">Mapa não configurado</h3>
          </div>
          <p class="text-slate-300 text-sm leading-relaxed mb-4">
            Instale um plugin de mapeamento tridimensional no servidor (como o <strong>BlueMap</strong> ou <strong>Pl3xMap</strong>)
            e defina a variável de ambiente <code>MAP_URL</code> apontando para a porta web correspondente.
          </p>
          <div class="bg-slate-950/60 border border-slate-850 p-4 rounded-xl font-mono text-xs text-slate-400 space-y-1 mb-2">
            <div># Exemplo no docker-compose.yaml</div>
            <div class="text-emerald-500">- MAP_URL=http://seuservidor.com:8100</div>
          </div>
          <p class="text-slate-500 text-xs">
            Certifique-se de que o serviço de mapas permite embedding de terceiros e não bloqueia iframes via cabeçalho <code>X-Frame-Options: DENY</code>.
          </p>
        </div>`;
    }
  });
}
