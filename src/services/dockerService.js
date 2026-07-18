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

export function createDockerService(config, docker) {
  const name = config.mcContainerName;
  const serviceName = config.mcServiceName;
  let ownProjectCache;

  // The panel's own compose project, read by self-inspecting the panel container
  // (its hostname is its container id). Used to scope the service-label fallback
  // so we never pick up a same-named service from another project.
  async function ownProject() {
    if (ownProjectCache !== undefined) return ownProjectCache;
    try {
      const self = await docker.getContainer(os.hostname()).inspect();
      ownProjectCache = self.Config?.Labels?.[PROJECT_LABEL] || null;
    } catch {
      ownProjectCache = null;
    }
    return ownProjectCache;
  }

  async function resolve() {
    const list = await docker.listContainers({ all: true });

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
    const container = await resolve();
    await container[method]();
  }

  async function inspect() {
    let container;
    try {
      container = await resolve();
    } catch (err) {
      if (err instanceof ContainerNotFoundError) {
        return { found: false, state: 'not_found', type: null };
      }
      throw err;
    }
    const data = await container.inspect();
    return {
      found: true,
      state: data.State?.Status || 'unknown',
      type: parseType(data.Config?.Env),
    };
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
      let container;
      try {
        container = await resolve();
      } catch {
        return { cpuPct: 0, memUsedMb: 0, memPct: 0 };
      }
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
      return {
        cpuPct: Math.round(cpuPct * 10) / 10,
        memUsedMb: Math.round(memUsed / (1024 * 1024)),
        memPct: Math.round((memUsed / memLimit) * 1000) / 10,
      };
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
