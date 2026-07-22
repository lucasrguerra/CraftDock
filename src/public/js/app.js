import { api } from './socket.js';
import { renderStatus } from './tabs/status.js';
import { renderConsole } from './tabs/console.js';
import { renderPlayers } from './tabs/players.js';
import { renderOptions } from './tabs/options.js';
import { renderWorld } from './tabs/world.js';

const TABS = [
  { id: 'status', label: 'Início', render: renderStatus },
  { id: 'console', label: 'Console', render: renderConsole },
  { id: 'players', label: 'Jogadores', render: renderPlayers },
  { id: 'options', label: 'Opções', render: renderOptions },
  { id: 'world', label: 'Mundo', render: renderWorld },
];

let cleanup = null;

function showTab(id) {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === id));
  
  const panels = document.getElementById('panels');
  panels.innerHTML = '';
  
  // Create a container with fade-in effect
  const wrapper = document.createElement('div');
  wrapper.className = 'fade-in flex-grow flex flex-col';
  panels.appendChild(wrapper);
  
  const tab = TABS.find((t) => t.id === id);
  cleanup = tab.render(wrapper) || null;
}

function initTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.tab = tab.id;
    btn.textContent = tab.label;
    btn.onclick = () => showTab(tab.id);
    nav.appendChild(btn);
  }
  showTab('status');
}

async function boot() {
  try {
    const me = await api('/api/auth/me');
    if (me?.authed) {
      document.getElementById('app').classList.remove('hidden');
      initTabs();
    } else {
      document.getElementById('login').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Boot error:', err);
    document.getElementById('login').classList.remove('hidden');
  }
}

document.getElementById('loginBtn').onclick = async () => {
  const password = document.getElementById('password').value;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    window.location.reload();
  } else {
    const errorEl = document.getElementById('loginError');
    errorEl.classList.remove('hidden');
  }
};

document.getElementById('logoutBtn').onclick = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.reload();
};

boot();
