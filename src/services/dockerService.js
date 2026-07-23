import os from 'node:os';

export class ContainerNotFoundError extends Error {
  constructor(name) {
    super(`Container not found: ${name}`);
    this.name = 'ContainerNotFoundError';
  }
}

function parseType(env = []) {
  const entry = env.find((e) => e.startsWith('TYPE='));
  return entry ? entry.slice('TYPE='.length) : null;
}

const SERVICE_LABEL = 'com.docker.compose.service';
const PROJECT_LABEL = 'com.docker.compose.project';

function withTimeout(promise, ms, label, logger) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Docker API call timed out (${ms}ms): ${label}`);
      logger?.error('docker API timeout', { label, timeoutMs: ms });
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export function createDockerService(config, docker, logger) {
  const name = config.mcContainerName;
  const serviceName = config.mcServiceName;
  let ownProjectCache;
  let statsCache = null;
  let lastStatsTime = 0;
  let inFlightStatsPromise = null;

  // The panel's own compose project, read by self-inspecting the panel container
  // (its hostname is its container id). Used to scope the service-label fallback
  // so we never pick up a same-named service from another project.
  async function ownProject() {
    if (ownProjectCache !== undefined) return ownProjectCache;
    try {
      const self = await withTimeout(docker.getContainer(os.hostname()).inspect(), 3000, 'selfInspect', logger);
      ownProjectCache = self.Config?.Labels?.[PROJECT_LABEL] || null;
    } catch (err) {
      logger?.debug('ownProject inspect failed/skipped', { error: err.message });
      ownProjectCache = null;
    }
    return ownProjectCache;
  }

  async function resolve() {
    let list;
    try {
      list = await withTimeout(docker.listContainers({ all: true }), 5000, 'listContainers', logger);
    } catch (err) {
      logger?.error('docker listContainers failed', { error: err.message });
      throw err;
    }

    // 1. Exact container name (works locally where container_name is honored).
    let match = list.find((c) => c.Names?.some((n) => n === `/${name}` || n === name));

    // 2. Fallback: compose service label (handles Coolify's auto-generated names),
    //    scoped to the panel's own project when it can be determined.
    if (!match && serviceName) {
      const project = await ownProject();
      match = list.find((c) =>
        c.Labels?.[SERVICE_LABEL] === serviceName &&
        (!project || c.Labels?.[PROJECT_LABEL] === project));
    }

    if (!match) throw new ContainerNotFoundError(name);
    return docker.getContainer(match.Id);
  }

  async function lifecycle(method) {
    logger?.info(`docker container lifecycle: ${method}`, { name });
    const container = await resolve();
    await withTimeout(container[method](), 10000, `lifecycle:${method}`, logger);
  }

  async function inspect() {
    let container;
    try {
      container = await resolve();
    } catch (err) {
      if (err instanceof ContainerNotFoundError) {
        return { found: false, state: 'not_found', type: null };
      }
      logger?.warn('docker inspect container resolve error', { error: err.message });
      return { found: false, state: 'error', type: null };
    }
    try {
      const data = await withTimeout(container.inspect(), 5000, 'inspect', logger);
      return {
        found: true,
        state: data.State?.Status || 'unknown',
        type: parseType(data.Config?.Env),
      };
    } catch (err) {
      logger?.warn('docker container inspect error', { error: err.message });
      return { found: true, state: 'unknown', type: null };
    }
  }


  return {
    async getContainer() { return resolve(); },
    start: () => lifecycle('start'),
    stop: () => lifecycle('stop'),
    restart: () => lifecycle('restart'),
    kill: () => lifecycle('kill'),
    inspect,

    async getState() {
      return (await inspect()).state;
    },

    async stats() {
      const now = Date.now();
      if (statsCache && (now - lastStatsTime < 2000)) {
        return statsCache;
      }
      if (inFlightStatsPromise) {
        return inFlightStatsPromise;
      }

      inFlightStatsPromise = (async () => {
        try {
          const container = await resolve();
          const s = await container.stats({ stream: false });
          const cpuDelta =
            (s.cpu_stats?.cpu_usage?.total_usage ?? 0) -
            (s.precpu_stats?.cpu_usage?.total_usage ?? 0);
          const sysDelta =
            (s.cpu_stats?.system_cpu_usage ?? 0) - (s.precpu_stats?.system_cpu_usage ?? 0);
          const cpus = s.cpu_stats?.online_cpus || 1;
          const cpuPct = sysDelta > 0 ? (cpuDelta / sysDelta) * cpus * 100 : 0;
          const memUsed = s.memory_stats?.usage ?? 0;
          const memLimit = s.memory_stats?.limit || 1;

          statsCache = {
            cpuPct: Math.round(cpuPct * 10) / 10,
            memUsedMb: Math.round(memUsed / (1024 * 1024)),
            memPct: Math.round((memUsed / memLimit) * 1000) / 10,
          };
          lastStatsTime = Date.now();
          return statsCache;
        } catch {
          return statsCache || { cpuPct: 0, memUsedMb: 0, memPct: 0 };
        } finally {
          inFlightStatsPromise = null;
        }
      })();

      return inFlightStatsPromise;
    },


    async logStream(tail = 200) {
      const container = await resolve();
      return container.logs({ follow: true, stdout: true, stderr: true, tail });
    },

    async attach() {
      const container = await resolve();
      return container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    },
  };
}
