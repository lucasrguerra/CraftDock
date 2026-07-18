import { api } from '../socket.js';

// mcseedmap.net is embeddable (no X-Frame-Options) and renders the REAL biome/
// structure map from the seed. URL: https://mcseedmap.net/<lang>/<version>/<seed>
const DEFAULT_VERSION = { bedrock: '26.30.0-Bedrock', java: '1.21-Java' };

function mapUrlFor(seed, edition, mapVersion) {
  const version = mapVersion || DEFAULT_VERSION[edition] || DEFAULT_VERSION.java;
  return `https://mcseedmap.net/pt/${version}/${encodeURIComponent(seed)}`;
}

export function renderMap(root) {
  root.innerHTML = `
    <div class="flex flex-col h-[82vh] w-full max-w-7xl mx-auto gap-3">
      <!-- Seed bar -->
      <div class="flex flex-wrap items-center gap-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl px-4 py-3 backdrop-blur-md">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Seed do mundo</span>
        <code id="seedVal" class="font-mono text-sm text-emerald-400 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1">carregando…</code>
        <button id="copySeed" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 transition-all disabled:opacity-40" disabled>Copiar</button>
        <a id="openMap" href="#" target="_blank" rel="noopener" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-slate-950 transition-all pointer-events-none opacity-40">Abrir no mcseedmap ↗</a>
        <span id="edition" class="ml-auto text-xs text-slate-500"></span>
      </div>

      <!-- Embedded map -->
      <div class="flex-grow relative bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        <div id="mapPlaceholder" class="absolute inset-0 flex items-center justify-center text-center p-6">
          <div class="text-slate-500 text-sm">
            <p class="mb-1">Aguardando a seed do servidor…</p>
            <p class="text-xs text-slate-600">O mapa aparece quando o servidor estiver ligado e a seed for lida.</p>
          </div>
        </div>
        <iframe id="mapFrame" class="w-full h-full hidden" style="border:0" referrerpolicy="no-referrer"></iframe>
      </div>
    </div>`;

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
