import { describe, it, expect, vi } from 'vitest';
import { createDockerService } from '../../src/services/dockerService.js';

const statsSample = {
  cpu_stats: {
    cpu_usage: { total_usage: 2000000000 },
    system_cpu_usage: 20000000000,
    online_cpus: 2,
  },
  precpu_stats: {
    cpu_usage: { total_usage: 1000000000 },
    system_cpu_usage: 10000000000,
  },
  memory_stats: { usage: 536870912, limit: 1073741824 }, // 512MB / 1GB
};

function mockDocker() {
  const container = {
    inspect: vi.fn().mockResolvedValue({ State: { Status: 'running' }, Config: { Env: [] } }),
    stats: vi.fn().mockResolvedValue(statsSample),
  };
  return {
    listContainers: vi.fn().mockResolvedValue([{ Names: ['/mc'], Id: 'x' }]),
    getContainer: vi.fn().mockReturnValue(container),
  };
}

describe('dockerService.stats', () => {
  it('computes cpu and memory percentages', async () => {
    const svc = createDockerService({ mcContainerName: 'mc' }, mockDocker());
    const s = await svc.stats();
    // cpuDelta=1e9, sysDelta=1e10 -> 0.1 * 2 cpus * 100 = 20%
    expect(s.cpuPct).toBeCloseTo(20, 1);
    expect(s.memUsedMb).toBeCloseTo(512, 0);
    expect(s.memPct).toBeCloseTo(50, 1);
  });

  it('returns zeros for a malformed/empty stats payload (e.g. stopped container)', async () => {
    const docker = mockDocker();
    docker.getContainer().stats.mockResolvedValue({
      cpu_stats: {},
      precpu_stats: {},
      memory_stats: {},
    });
    const svc = createDockerService({ mcContainerName: 'mc' }, docker);
    const s = await svc.stats();
    expect(s).toEqual({ cpuPct: 0, memUsedMb: 0, memPct: 0 });
  });

  it('returns zeros for a completely empty stats payload', async () => {
    const docker = mockDocker();
    docker.getContainer().stats.mockResolvedValue({});
    const svc = createDockerService({ mcContainerName: 'mc' }, docker);
    const s = await svc.stats();
    expect(s).toEqual({ cpuPct: 0, memUsedMb: 0, memPct: 0 });
  });
});
