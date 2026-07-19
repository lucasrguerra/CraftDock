import fsp from 'node:fs/promises';
import path from 'node:path';
import { PLAYER_NAME_REGEX } from '../adapters/serverAdapter.js';

export async function getPlayersFromLogs(dockerService) {
  const players = [];
  try {
    const container = await dockerService.getContainer();
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
      tail: 100000
    });
    
    const logsText = logBuffer.toString('utf8');
    const cleanText = logsText.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    
    // Match Bedrock: "Player connected: Lucasrguerra, xuid: 2535407895138987" or "Player Spawned: Lucasrguerra xuid: ..."
    const bedrockRegex = /Player(?: connected| Spawned):\s*([^,\s]+)/gi;
    let match;
    while ((match = bedrockRegex.exec(cleanText)) !== null) {
      const name = match[1].trim();
      if (name && PLAYER_NAME_REGEX.test(name) && !players.includes(name)) {
        players.push(name);
      }
    }

    // Match Java: "Lucasrguerra joined the game"
    const javaRegex = /(\w+)\s+joined the game/gi;
    while ((match = javaRegex.exec(cleanText)) !== null) {
      const name = match[1].trim();
      if (name && PLAYER_NAME_REGEX.test(name) && !players.includes(name)) {
        players.push(name);
      }
    }
  } catch (err) {
    // ignore
  }
  return players;
}

export async function getHistoricalPlayers(worldPath, edition, dockerService) {
  const historyFile = path.join(worldPath, 'craftdock_players_history.json');
  const oldHistoryFile = path.join(path.dirname(worldPath), 'craftdock_players_history.json');
  
  let history = [];
  let loaded = false;

  try {
    const data = await fsp.readFile(historyFile, 'utf8');
    history = JSON.parse(data);
    loaded = true;
  } catch {
    // Try migrating from old path
    try {
      const data = await fsp.readFile(oldHistoryFile, 'utf8');
      history = JSON.parse(data);
      loaded = true;
      // Write it to new path and delete from old path
      await fsp.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8');
      await fsp.rm(oldHistoryFile, { force: true });
    } catch {}
  }

  if (!Array.isArray(history)) {
    history = [];
  }

  // Sanitize existing history to strip any pre-existing garbage
  history = history.filter((s) => typeof s === 'string' && PLAYER_NAME_REGEX.test(s));

  if (dockerService) {
    const logPlayers = await getPlayersFromLogs(dockerService);
    for (const name of logPlayers) {
      if (name && PLAYER_NAME_REGEX.test(name) && !history.includes(name)) {
        history.push(name);
      }
    }
  }

  if (edition === 'java') {
    try {
      const usercachePath = path.join(path.dirname(worldPath), 'usercache.json');
      const data = await fsp.readFile(usercachePath, 'utf8');
      const cache = JSON.parse(data);
      if (Array.isArray(cache)) {
        for (const entry of cache) {
          if (entry && entry.name && PLAYER_NAME_REGEX.test(entry.name) && !history.includes(entry.name)) {
            history.push(entry.name);
          }
        }
      }
    } catch {}
  }
  
  return history;
}

export async function updatePlayerHistory(worldPath, edition, onlinePlayers, dockerService) {
  const history = await getHistoricalPlayers(worldPath, edition, dockerService);
  let updated = false;
  
  if (Array.isArray(onlinePlayers)) {
    for (const name of onlinePlayers) {
      if (name && PLAYER_NAME_REGEX.test(name) && !history.includes(name)) {
        history.push(name);
        updated = true;
      }
    }
  }

  // Always write if we have players, or if we cleaned up existing garbage
  const historyFile = path.join(worldPath, 'craftdock_players_history.json');
  try {
    await fsp.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8');
  } catch {}

  return history;
}
