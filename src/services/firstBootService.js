import fsp from 'node:fs/promises';
import path from 'node:path';

// One-time defaults applied the FIRST time CraftDock sees a data volume.
// Currently: force the whitelist off, so a brand-new server always starts open.
// A marker file at the data root (sibling of the other craftdock_* metadata)
// records that initialization happened — plain restarts never touch anything,
// preserving whatever the admin toggled afterwards.

export const MARKER_FILE = 'craftdock_initialized.json';

const WHITELIST_KEYS = { bedrock: ['allow-list'], java: ['white-list'] };

export async function ensureFirstBootDefaults({ config, propertiesService, logger }) {
  const marker = path.join(config.mcDataPath, MARKER_FILE);
  try {
    await fsp.access(marker);
    return; // not the first boot
  } catch { /* marker absent → first boot */ }

  try {
    const keys = WHITELIST_KEYS[config.mcEdition] || [...WHITELIST_KEYS.bedrock, ...WHITELIST_KEYS.java];
    const patch = Object.fromEntries(keys.map((k) => [k, 'false']));
    await propertiesService.update(patch);

    await fsp.writeFile(marker, JSON.stringify({ initializedAt: new Date().toISOString(), applied: patch }, null, 2), 'utf8');
    await fsp.chmod(marker, 0o666).catch(() => {});
    logger?.info('first boot: whitelist disabled by default', { keys });
  } catch (err) {
    // Best-effort: log and leave the marker unwritten so the next boot retries.
    logger?.warn('first-boot defaults failed', { error: err?.message });
  }
}
