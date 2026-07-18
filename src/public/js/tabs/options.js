import { api } from '../socket.js';

const FIELDS = [
  { key: 'difficulty', label: 'Dificuldade', type: 'enum', values: ['peaceful', 'easy', 'normal', 'hard'] },
  { key: 'gamemode', label: 'Modo de Jogo', type: 'enum', values: ['survival', 'creative', 'adventure', 'spectator'] },
  { key: 'pvp', label: 'Habilitar PvP', type: 'boolean' },
  { key: 'allow-flight', label: 'Permitir Voar', type: 'boolean' },
  { key: 'hardcore', label: 'Modo Hardcore', type: 'boolean' },
  { key: 'max-players', label: 'Limite de Jogadores', type: 'int' },
  { key: 'view-distance', label: 'Distância de Visão', type: 'int' },
  { key: 'motd', label: 'Mensagem do Dia (MOTD)', type: 'string' },
];

export function renderOptions(root) {
  root.innerHTML = `
    <div class="max-w-xl w-full mx-auto bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2 mb-6 pb-3 border-b border-slate-800/60">
        <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        Configurações do Servidor
      </h2>

      <form id="opts" class="space-y-4">
        <div class="text-center text-xs text-slate-500 py-4">Carregando propriedades...</div>
      </form>
      
      <div class="mt-6 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span class="text-xs text-amber-500 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Requer reinicialização do servidor.
        </span>
        <div id="optMsg" class="text-xs font-semibold"></div>
      </div>
    </div>`;

  function renderField(f, value) {
    if (f.type === 'enum') {
      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1">
          <span class="text-sm font-medium text-slate-300">${f.label || f.key}</span>
          <select name="${f.key}" class="w-full sm:w-48 px-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200">
            ${f.values.map((v) => `<option value="${v}" ${v === value ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>`;
    }
    
    if (f.type === 'boolean') {
      const isChecked = value === 'true';
      return `
        <div class="flex items-center justify-between py-2.5">
          <span class="text-sm font-medium text-slate-300">${f.label || f.key}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="${f.key}" ${isChecked ? 'checked' : ''} class="sr-only peer">
            <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-slate-900 peer-checked:after:border-transparent"></div>
          </label>
        </div>`;
    }

    const inputType = f.type === 'int' ? 'number' : 'text';
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1">
        <span class="text-sm font-medium text-slate-300">${f.label || f.key}</span>
        <input type="${inputType}" name="${f.key}" value="${value ?? ''}" class="w-full sm:w-48 px-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200" />
      </div>`;
  }

  api('/api/properties').then((data) => {
    if (!data) return;
    const props = data.properties || {};
    const form = root.querySelector('#opts');
    
    form.innerHTML = FIELDS.map((f) => renderField(f, props[f.key])).join('') + `
      <div class="pt-4">
        <button class="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all duration-200 text-sm">
          Salvar Configurações
        </button>
      </div>`;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const patch = {};
      for (const f of FIELDS) {
        const el = form.elements[f.key];
        patch[f.key] = f.type === 'boolean' ? String(el.checked) : el.value;
      }
      
      const res = await api('/api/properties', { method: 'PUT', body: { properties: patch } });
      const msg = root.querySelector('#optMsg');
      
      if (res?.ok) {
        msg.textContent = 'Salvo com sucesso!';
        msg.className = 'text-emerald-400 text-sm mt-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg';
      } else {
        msg.textContent = `Erro no campo: ${res?.field || 'geral'}`;
        msg.className = 'text-red-400 text-sm mt-1 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg';
      }
    };
  });
}
