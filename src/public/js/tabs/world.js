import { api } from '../socket.js';

export function renderWorld(root) {
  root.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mx-auto">
      
      <!-- Download Card -->
      <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div class="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            </div>
            <h3 class="font-bold text-slate-200">Baixar mundo</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">Faça o download do seu mapa atual compactado em formato <strong>.zip</strong>.</p>
          <div class="text-xs text-amber-500/90 flex items-start gap-1 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 mb-6">
            <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <span>Recomendado desligar o servidor para evitar corrupção de arquivos.</span>
          </div>
        </div>
        <a href="/api/world/download" class="w-full text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/10 active:scale-[0.98]">
          Baixar .zip do Mundo
        </a>
      </div>

      <!-- Upload Card -->
      <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div class="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            </div>
            <h3 class="font-bold text-slate-200">Subir novo mundo</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">Substitua o mapa do servidor enviando um arquivo <strong>.zip</strong> contendo o novo mundo.</p>
          
          <div class="space-y-3 mb-6">
            <input id="worldFile" type="file" accept=".zip" class="hidden" />
            <label id="fileLabel" for="worldFile" class="w-full flex flex-col items-center justify-center border border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-4 bg-slate-950/40 hover:bg-slate-950/80 transition-all duration-250 cursor-pointer text-center group">
              <svg class="w-6 h-6 text-slate-500 group-hover:text-emerald-400 mb-1 transition-all" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              <span id="fileName" class="text-xs text-slate-400 font-medium truncate w-full px-2">Selecionar arquivo .zip</span>
            </label>
          </div>
        </div>
        
        <div>
          <button id="uploadBtn" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all duration-200">
            Enviar e Substituir
          </button>
          <p id="upMsg" class="text-xs text-center mt-2.5 min-h-[1.25rem]"></p>
        </div>
      </div>

      <!-- Regen Card -->
      <div class="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div class="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </div>
            <h3 class="font-bold text-slate-200">Regerar mundo</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">Esta ação apaga permanentemente o mundo ativo e força a criação de um mapa novo.</p>
          <div class="text-xs text-rose-500/90 flex items-start gap-1 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 mb-6 font-medium">
            <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <span>Esta operação é IRREVERSÍVEL. Faça backup antes.</span>
          </div>
        </div>
        <button id="regenBtn" class="w-full py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-700 border border-rose-500/20 hover:border-rose-600 text-rose-400 hover:text-white font-semibold text-sm transition-all duration-200 active:scale-[0.98]">
          Apagar e Gerar Novo
        </button>
      </div>

    </div>`;

  // File picker handler
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
    if (!confirm('Isto APAGA o mundo atual. Continuar?')) return;
    if (!confirm('Tem certeza absoluta? Não há como desfazer.')) return;
    await api('/api/world/regen', { method: 'POST' });
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
}
