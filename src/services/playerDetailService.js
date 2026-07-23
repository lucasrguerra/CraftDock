// Orchestrates a fresh, safe read of one player's data from the world save.
//
// Flow (getDetail(xuid)):
//   1. Resolve the gamertag from the directory (xuid is the canonical key; for
//      Java the key is the player's UUID).
//   2. Determine online (listPlayers) and whether the server is running.
//   3. Bedrock: while online, learn the identity bridge (querytarget uniqueId →
//      LevelDB UniqueID); resolve the LevelDB uuid. If never bridged → needsBridge.
//      Read under a `save hold` snapshot when the server is running.
//   4. Java: force `save-all flush` when the target is online, then read the .dat.
//
// Collaborators are injected so the whole flow is unit-testable.

const SUPPORTED = { health: true, food: true, inventory: true };

async function withSnapshot(adapter, fn) {
  const held = await adapter.saveHold();
  try {
    return await fn();
  } finally {
    if (held) {
      await adapter.saveResume();
    }
  }
}


export function createPlayerDetailService({
  config, appState, dockerService, readDirectory, createFileAdapter, createBridge,
}) {
  const dataRoot = config.mcDataPath;

  async function getDetail(xuid) {
    const dir = await readDirectory(dataRoot);
    const entry = dir[xuid];
    if (!entry) return null;
    const name = entry.name;

    const adapter = await appState.getAdapter();
    const edition = adapter._edition;
    const list = await adapter.listPlayers();
    const online = Array.isArray(list?.players) && list.players.includes(name);
    const serverRunning = (await dockerService.inspect()).state === 'running';
    const fileAdapter = createFileAdapter(edition, config);

    let data;
    if (edition === 'bedrock') {
      const bridge = createBridge({ dataRoot, fileAdapter });

      // Bridge lookup → live querytarget learn (online only) → single-player
      // world fallback. Identical whether or not we're inside a snapshot.
      const resolveUuid = async () => {
        let uuid = await bridge.resolveLeveldbUuid(xuid);
        if (!uuid && online) {
          const uniqueId = await adapter.queryUniqueId(name);
          if (uniqueId) await bridge.learn({ xuid, name, uniqueId });
          uuid = await bridge.resolveLeveldbUuid(xuid);
        }
        if (!uuid && typeof fileAdapter.listServerUuids === 'function') {
          try {
            const uuids = await fileAdapter.listServerUuids();
            if (Array.isArray(uuids) && uuids.length === 1) {
              uuid = uuids[0];
              await bridge.learn({ xuid, name, fallbackUuid: uuid });
            }
          } catch { /* ignore fallback error */ }
        }
        return uuid;
      };

      const readViaUuid = async () => {
        // Resolve inside the snapshot (when held) to avoid LevelDB lock conflicts.
        const leveldbUuid = await resolveUuid();
        return leveldbUuid ? { leveldbUuid, data: await fileAdapter.readPlayer(leveldbUuid) } : null;
      };

      const result = serverRunning
        ? await withSnapshot(adapter, readViaUuid)
        : await readViaUuid();

      if (!result) {
        return { xuid, name, online, needsBridge: true, supported: SUPPORTED };
      }
      data = result.data;
    } else {
      const uuid = entry.xuid || xuid; // Java directory key is the player UUID
      if (online && serverRunning) await adapter.forceSave();
      data = await fileAdapter.readPlayer(uuid);
    }

    if (!data) {
      return { xuid, name, online, needsBridge: false, empty: true, position: null, supported: SUPPORTED };
    }
    return { xuid, name, online, needsBridge: false, supported: SUPPORTED, ...data };
  }

  return { getDetail };
}
