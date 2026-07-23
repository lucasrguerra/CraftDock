import { api } from '../socket.js';

const CATEGORIES = [
  {
    title: 'Jogabilidade & Regras',
    icon: `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    fields: [
      {
        key: 'difficulty',
        label: 'Dificuldade',
        type: 'enum',
        values: [
          { val: 'peaceful', label: 'Pacífico' },
          { val: 'easy', label: 'Fácil' },
          { val: 'normal', label: 'Normal' },
          { val: 'hard', label: 'Difícil' },
        ],
        description: 'Define o nível de dificuldade do jogo, controlando dano de monstros, fome e geração de mobs hostis.',
      },
      {
        key: 'gamemode',
        label: 'Modo de Jogo Padrão',
        type: 'enum',
        values: [
          { val: 'survival', label: 'Sobrevivência' },
          { val: 'creative', label: 'Criativo' },
          { val: 'adventure', label: 'Aventura' },
          { val: 'spectator', label: 'Espectador' },
        ],
        description: 'Determina o modo de jogo atribuído aos novos jogadores que se conectarem ao mundo.',
      },

      {
        key: 'pvp',
        label: 'Habilitar PvP (Combate)',
        type: 'boolean',
        description: 'Permite que jogadores ataquem e causem dano a outros jogadores no servidor.',
      },
      {
        key: 'keep-inventory',
        label: 'Manter Itens ao Morrer (Keep Inventory)',
        type: 'boolean',
        description: 'Quando ativado, os jogadores não perdem inventário nem pontos de experiência ao morrer.',
      },
      {
        key: 'hardcore',
        label: 'Modo Hardcore',
        type: 'boolean',
        description: 'Dificuldade travada no máximo e morte permanente (jogadores entram em modo espectador após morrer).',
      },
      {
        key: 'allow-flight',
        label: 'Permitir Voar (Flight)',
        type: 'boolean',
        description: 'Permite voo no modo Sobrevivência se o jogador possuir um mod instalado, evitando que o servidor o desconecte por "kick for flying".',
      },
      {
        key: 'force-gamemode',
        label: 'Forçar Modo de Jogo ao Entrar',
        type: 'boolean',
        description: 'Força o jogador a redefinir seu modo para o padrão do servidor toda vez que se reconectar.',
      },
    ],
  },
  {
    title: 'Mundo & Entidades',
    icon: `<svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a2.5 2.5 0 002.5-2.5V11a2 2 0 012-2h1.055M11 20.055V18a2 2 0 00-2-2h-1a2 2 0 00-2 2v2.055"></path></svg>`,
    fields: [
      {
        key: 'allow-nether',
        label: 'Permitir Dimensão Nether',
        type: 'boolean',
        description: 'Habilita ou desabilita a criação e teletransporte através de portais do Nether.',
      },
      {
        key: 'enable-command-block',
        label: 'Ativar Blocos de Comando',
        type: 'boolean',
        description: 'Permite a execução de comandos dentro de Blocos de Comando (Command Blocks).',
      },
      {
        key: 'spawn-monsters',
        label: 'Gerar Monstros (Hostis)',
        type: 'boolean',
        description: 'Controla se criaturas hostis (Creepers, Zumbis, Esqueletos) aparecem naturalmente no mundo.',
      },
      {
        key: 'spawn-animals',
        label: 'Gerar Animais (Pacíficos)',
        type: 'boolean',
        description: 'Controla se animais (Vacas, Ovelhas, Galinhas) surgem no mundo.',
      },
      {
        key: 'spawn-npcs',
        label: 'Gerar NPCs / Aldeões',
        type: 'boolean',
        description: 'Controla a criação e permanência de Villagers (Aldeões) nas vilas.',
      },
    ],
  },

  {
    title: 'Desempenho, Limites e Apresentação',
    icon: `<svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`,
    fields: [
      {
        key: 'max-players',
        label: 'Limite Máximo de Jogadores',
        type: 'int',
        description: 'Número máximo de conexões simultâneas permitidas no servidor.',
      },
      {
        key: 'view-distance',
        label: 'Distância de Visão (Chunks)',
        type: 'int',
        description: 'Quantidade de chunks enviadas para o cliente do jogador em um raio em redor dele.',
      },
      {
        key: 'simulation-distance',
        label: 'Distância de Simulação (Chunks)',
        type: 'int',
        description: 'Raio de chunks em que blocos, vegetação e entidades permanecem fisicamente ativos e processando.',
      },
      {
        key: 'spawn-protection',
        label: 'Proteção do Spawn (Blocos)',
        type: 'int',
        description: 'Raio de blocos ao redor do ponto de spawn onde apenas Operadores (OP) podem construir ou quebrar.',
      },
      {
        key: 'motd',
        label: 'Mensagem do Dia (MOTD)',
        type: 'string',
        description: 'Texto de exibição do servidor na lista de mundos dos clientes.',
      },
    ],
  },
];

export function renderOptions(root) {
  root.innerHTML = `
    <div class="max-w-3xl w-full mx-auto bg-slate-900/50 border border-slate-800/80 p-6 md:p-8 rounded-2xl backdrop-blur-md shadow-2xl">
      <div class="flex items-center justify-between pb-4 mb-6 border-b border-slate-800/80">
        <h2 class="text-xl font-bold text-slate-100 flex items-center gap-2.5">
          <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          Configurações do Servidor
        </h2>
        <span class="text-xs font-mono text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">server.properties</span>
      </div>

      <form id="opts" class="space-y-8">
        <div class="text-center text-xs text-slate-500 py-8">Carregando propriedades do servidor...</div>
      </form>
      
      <div class="mt-8 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <span class="text-xs text-amber-400 flex items-center gap-2 bg-amber-500/10 px-3.5 py-2 rounded-xl border border-amber-500/20">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Algumas alterações exigem reinicialização do servidor.
        </span>
        <div id="optMsg" class="text-xs font-semibold"></div>
      </div>
    </div>`;

  function renderLabelWithTooltip(f) {
    return `
      <div class="flex items-center gap-1.5 group relative cursor-help">
        <span class="text-sm font-medium text-slate-300">${f.label || f.key}</span>
        <span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/50 transition-all text-[11px] font-bold leading-none">?</span>
        <!-- Tooltip box -->
        <div class="pointer-events-none absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2.5 bg-slate-950 border border-slate-700/80 text-xs text-slate-300 rounded-xl shadow-xl z-50 transition-all duration-200">
          <div class="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
            <span>${f.label || f.key}</span>
            <span class="text-[10px] text-slate-500 font-mono">(${f.key})</span>
          </div>
          <p class="leading-relaxed text-slate-300">${f.description || 'Sem descrição.'}</p>
        </div>
      </div>`;
  }

  function renderField(f, value) {
    const labelHtml = renderLabelWithTooltip(f);

    if (f.type === 'enum') {
      const optionsHtml = f.values.map((v) => {
        const val = typeof v === 'object' ? v.val : v;
        const lbl = typeof v === 'object' ? v.label : v;
        return `<option value="${val}" ${val === value ? 'selected' : ''}>${lbl}</option>`;
      }).join('');
      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 border-b border-slate-800/30 last:border-0">
          ${labelHtml}
          <select name="${f.key}" class="w-full sm:w-56 px-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200">
            ${optionsHtml}
          </select>
        </div>`;
    }

    
    if (f.type === 'boolean') {
      const isChecked = value === 'true';
      return `
        <div class="flex items-center justify-between py-2.5 border-b border-slate-800/30 last:border-0">
          ${labelHtml}
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="${f.key}" ${isChecked ? 'checked' : ''} class="sr-only peer">
            <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-slate-900 peer-checked:after:border-transparent"></div>
          </label>
        </div>`;
    }

    const inputType = f.type === 'int' ? 'number' : 'text';
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 border-b border-slate-800/30 last:border-0">
        ${labelHtml}
        <input type="${inputType}" name="${f.key}" value="${value ?? ''}" class="w-full sm:w-56 px-3 py-2 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200" />
      </div>`;
  }

  api('/api/properties').then((data) => {
    if (!data) return;
    const props = data.properties || {};
    const form = root.querySelector('#opts');
    
    let html = '';
    for (const cat of CATEGORIES) {
      html += `
        <div class="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 md:p-5">
          <h3 class="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4 pb-2 border-b border-slate-800/80">
            ${cat.icon}
            ${cat.title}
          </h3>
          <div class="space-y-1">
            ${cat.fields.map((f) => renderField(f, props[f.key])).join('')}
          </div>
        </div>`;
    }

    html += `
      <div class="pt-2">
        <button class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all duration-200 text-sm flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
          Salvar Todas as Configurações
        </button>
      </div>`;

    form.innerHTML = html;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const patch = {};
      const allFields = CATEGORIES.flatMap((c) => c.fields);
      for (const f of allFields) {
        const el = form.elements[f.key];
        if (!el) continue;
        patch[f.key] = f.type === 'boolean' ? String(el.checked) : el.value;
      }
      
      const res = await api('/api/properties', { method: 'PUT', body: { properties: patch } });
      const msg = root.querySelector('#optMsg');
      
      if (res?.ok) {
        msg.textContent = 'Configurações salvas com sucesso!';
        msg.className = 'text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl flex items-center gap-1.5';
      } else {
        msg.textContent = `Erro ao salvar o campo: ${res?.field || 'geral'}`;
        msg.className = 'text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3.5 py-2 rounded-xl flex items-center gap-1.5';
      }
    };
  });
}

