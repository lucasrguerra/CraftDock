export function renderConsole(root) {
  root.innerHTML = `
    <div class="flex-grow flex flex-col h-[70vh] max-w-5xl w-full mx-auto bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      <!-- Terminal Header -->
      <div class="px-4 py-3 bg-slate-900/60 border-b border-slate-850 flex items-center justify-between text-xs font-semibold text-slate-400 tracking-wider">
        <div class="flex items-center gap-2">
          <div class="flex gap-1.5">
            <span class="w-3.5 h-3.5 rounded-full bg-rose-500/20 border border-rose-500/40"></span>
            <span class="w-3.5 h-3.5 rounded-full bg-amber-500/20 border border-amber-500/40"></span>
            <span class="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40"></span>
          </div>
          <span class="ml-2 font-mono">interactive_console.sh</span>
        </div>
        <span class="text-emerald-500 uppercase tracking-widest font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Conectado</span>
      </div>

      <!-- Logs Area -->
      <div id="console" class="flex-grow overflow-y-auto p-4 font-mono text-slate-350 text-sm selection:bg-emerald-500/20 selection:text-emerald-300"></div>

      <!-- Command Bar -->
      <form id="cmdForm" class="p-3 bg-slate-900/45 border-t border-slate-850 flex gap-2 items-center">
        <span class="font-mono text-emerald-500 font-bold pl-2 select-none">&gt;</span>
        <input id="cmd" class="flex-1 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-sm transition-all duration-200" placeholder="Comando (ex: list)" autocomplete="off" />
        <button class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all duration-200 text-sm">
          Enviar
        </button>
      </form>
    </div>`;

  const consoleEl = root.querySelector('#console');
  const MAX = 500;
  
  const append = (text) => {
    // Sanitize chunk styling a bit if necessary or just write raw
    // Convert newlines to breaks or use textContent
    consoleEl.textContent += text;
    const lines = consoleEl.textContent.split('\n');
    if (lines.length > MAX) {
      consoleEl.textContent = lines.slice(-MAX).join('\n');
    }
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  const socket = io('/logs');
  socket.on('log', append);
  socket.on('connect_error', () => append('\n[craftdock] conexão perdida\n'));

  root.querySelector('#cmdForm').onsubmit = (e) => {
    e.preventDefault();
    const input = root.querySelector('#cmd');
    const val = input.value.trim();
    if (val) {
      socket.emit('command', val);
      input.value = '';
    }
  };

  return () => socket.disconnect();
}
