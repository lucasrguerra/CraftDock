import { api } from '../socket.js';

// mcseedmap.net is embeddable (no X-Frame-Options) and renders the REAL biome/
// structure map from the seed. URL: https://mcseedmap.net/<lang>/<version>/<seed>
const DEFAULT_VERSION = { bedrock: '26.30.0-Bedrock', java: '1.21-Java' };

function mapUrlFor(seed, edition, mapVersion) {
  const version = mapVersion || DEFAULT_VERSION[edition] || DEFAULT_VERSION.java;
  return `https://mcseedmap.net/pt/${version}/${encodeURIComponent(seed)}`;
}

export function renderWorld(root) {
  root.innerHTML = `
    <div class="space-y-6 max-w-6xl w-full mx-auto">

      <!-- World Management Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        
        <!-- Download Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md flex flex-col">
          <div class="flex-grow">
            <div class="flex items-center gap-3 mb-3">
              <div class="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </div>
              <h3 class="font-bold text-slate-200">Baixar mundo</h3>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed mb-4">Faça o download do seu mapa atual compactado em formato <strong>.zip</strong>.</p>
            <div class="text-xs text-amber-500/90 flex items-start gap-1 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 mb-4">
              <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <span>Recomendado desligar o servidor para evitar corrupção de arquivos.</span>
            </div>
          </div>
          <a href="/api/world/download" class="block w-full text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/10 active:scale-[0.98]">
            Baixar .zip do Mundo
          </a>
        </div>

        <!-- Upload Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md flex flex-col">
          <div class="flex-grow flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-3 mb-3">
                <div class="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                </div>
                <h3 class="font-bold text-slate-200">Subir novo mundo</h3>
              </div>
              <p class="text-xs text-slate-400 leading-relaxed mb-4">Substitua o mapa do servidor enviando um arquivo <strong>.zip</strong> contendo o novo mundo.</p>
              
              <div class="mb-4">
                <input id="worldFile" type="file" accept=".zip" class="hidden" />
                <label id="fileLabel" for="worldFile" class="w-full flex flex-col items-center justify-center border border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-4 bg-slate-950/40 hover:bg-slate-950/80 transition-all duration-250 cursor-pointer text-center group">
                  <svg class="w-6 h-6 text-slate-500 group-hover:text-emerald-400 mb-1 transition-all" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                  <span id="fileName" class="text-xs text-slate-400 font-medium truncate w-full px-2">Selecionar arquivo .zip</span>
                </label>
              </div>
            </div>
            <p id="upMsg" class="text-xs text-center mb-4 min-h-[1.25rem]"></p>
          </div>
          
          <button id="uploadBtn" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all duration-200">
            Enviar e Substituir
          </button>
        </div>

        <!-- Regen Card -->
        <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md flex flex-col">
          <div class="flex-grow flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-3 mb-3">
                <div class="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </div>
                <h3 class="font-bold text-slate-200">Regerar mundo</h3>
              </div>
              <p class="text-xs text-slate-400 leading-relaxed mb-4">Esta ação apaga permanentemente o mundo ativo e força a criação de um mapa novo.</p>
              
              <div class="mb-4">
                <label for="regenSeed" class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Seed personalizada (opcional)</label>
                <input id="regenSeed" type="text" placeholder="Deixe em branco para aleatória" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-650 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all duration-200" />
              </div>
            </div>
            
            <div class="text-xs text-rose-500/90 flex items-start gap-1 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 mb-4 font-medium">
              <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <span>Esta operação é IRREVERSÍVEL. Faça backup antes.</span>
            </div>
          </div>
          <button id="regenBtn" class="w-full py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-700 border border-rose-500/20 hover:border-rose-600 text-rose-400 hover:text-white font-semibold text-sm transition-all duration-200 active:scale-[0.98]">
            Apagar e Gerar Novo
          </button>
        </div>

      </div>

      <!-- Seed Map Section -->
      <div class="space-y-3">
        <!-- Seed bar -->
        <div class="flex flex-wrap items-center gap-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl px-4 py-3 backdrop-blur-md">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Seed do mundo</span>
          </div>
          <code id="seedVal" class="font-mono text-sm text-emerald-400 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1">carregando…</code>
          <button id="copySeed" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 transition-all disabled:opacity-40" disabled>Copiar</button>
          <a id="openMap" href="#" target="_blank" rel="noopener" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-slate-950 transition-all pointer-events-none opacity-40">Abrir no mcseedmap ↗</a>
          <span id="edition" class="ml-auto text-xs text-slate-500"></span>
        </div>

        <!-- Embedded map -->
        <div class="relative bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden" style="height: 55vh">
          <div id="mapPlaceholder" class="absolute inset-0 flex items-center justify-center text-center p-6">
            <div class="text-slate-500 text-sm">
              <svg class="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"></path></svg>
              <p class="mb-1">Aguardando a seed do servidor…</p>
              <p class="text-xs text-slate-600">O mapa aparece quando o servidor estiver ligado e a seed for lida.</p>
            </div>
          </div>
          <iframe id="mapFrame" class="w-full h-full hidden" style="border:0" referrerpolicy="no-referrer"></iframe>
        </div>
      </div>

    </div>`;

  // --- World management handlers ---

  const fileInput = root.querySelector('#worldFile');
  const fileName = root.querySelector('#fileName');
  fileInput.onchange = () => {
    if (fileInput.files.length) {
      fileName.textContent = fileInput.files[0].name;
      fileName.classList.remove('text-slate-400');
      fileName.classList.add('text-emerald-400', 'font-semibold');
    } else {
      fileName.textContent = 'Selecionar arquivo .zip';
      fileName.classList.remove('text-emerald-400', 'font-semibold');
      fileName.classList.add('text-slate-400');
    }
  };

  root.querySelector('#regenBtn').onclick = async () => {
    const seed = root.querySelector('#regenSeed').value.trim();
    if (!confirm('Isto APAGA o mundo atual. Continuar?')) return;
    if (!confirm('Tem certeza absoluta? Não há como desfazer.')) return;
    await api('/api/world/regen', { method: 'POST', body: { seed } });
    alert('Novo mundo sendo gerado. O servidor irá reiniciar.');
  };

  root.querySelector('#uploadBtn').onclick = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirm('Isto substitui o mundo atual pelo novo arquivo enviado. Continuar?')) return;
    const msg = root.querySelector('#upMsg');
    msg.textContent = 'Enviando...';
    msg.className = 'text-xs text-center mt-2.5 text-blue-400 font-semibold';
    
    const fd = new FormData();
    fd.append('world', file);
    
    try {
      const res = await fetch('/api/world/upload', { method: 'POST', body: fd });
      if (res.ok) {
        msg.textContent = 'Mundo importado. Servidor reiniciando.';
        msg.className = 'text-xs text-center mt-2.5 text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 py-1.5 rounded-lg';
        fileInput.value = '';
        fileName.textContent = 'Selecionar arquivo .zip';
        fileName.classList.remove('text-emerald-400', 'font-semibold');
        fileName.classList.add('text-slate-400');
      } else {
        msg.textContent = 'Falha: arquivo inválido.';
        msg.className = 'text-xs text-center mt-2.5 text-rose-450 font-semibold bg-rose-500/10 border border-rose-500/20 py-1.5 rounded-lg';
      }
    } catch {
      msg.textContent = 'Falha de conexão ao enviar.';
      msg.className = 'text-xs text-center mt-2.5 text-rose-450 font-semibold bg-rose-500/10 border border-rose-500/20 py-1.5 rounded-lg';
    }
  };

  // --- Seed map handlers ---

  const seedEl = root.querySelector('#seedVal');
  const copyBtn = root.querySelector('#copySeed');
  const openLink = root.querySelector('#openMap');
  const editionEl = root.querySelector('#edition');
  const frame = root.querySelector('#mapFrame');
  const placeholder = root.querySelector('#mapPlaceholder');

  let currentSeed = null;
  let edition = 'java';
  let mapVersion = '';

  function applySeed(seed) {
    if (seed == null || seed === '' || String(seed) === currentSeed) return;
    currentSeed = String(seed);
    seedEl.textContent = currentSeed;
    copyBtn.disabled = false;

    const url = mapUrlFor(currentSeed, edition, mapVersion);
    openLink.href = url;
    openLink.classList.remove('pointer-events-none', 'opacity-40');

    // Only (re)load the iframe when the seed actually changes, so panning/zoom
    // inside mcseedmap isn't reset on every status tick.
    frame.src = url;
    frame.classList.remove('hidden');
    placeholder.classList.add('hidden');
  }

  copyBtn.onclick = async () => {
    if (!currentSeed) return;
    try {
      await navigator.clipboard.writeText(currentSeed);
      copyBtn.textContent = 'Copiado!';
      setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 1500);
    } catch { /* clipboard blocked */ }
  };

  // Initial config (seed + edition + optional version override).
  api('/api/client-config').then((cfg) => {
    if (!cfg) return;
    if (cfg.edition) edition = cfg.edition;
    if (cfg.mapVersion) mapVersion = cfg.mapVersion;
    editionEl.textContent = cfg.edition ? `Edição: ${cfg.edition}` : '';
    if (cfg.seed) applySeed(cfg.seed);
  });

  // Keep listening — the seed becomes available once the server is running.
  const socket = io('/status');
  socket.on('status', (s) => {
    if (s.type) edition = s.type.toUpperCase() === 'BEDROCK' ? 'bedrock' : 'java';
    editionEl.textContent = s.edition ? `Edição: ${s.edition}` : editionEl.textContent;
    if (s.seed) applySeed(s.seed);
  });

  return () => socket.disconnect();
}
