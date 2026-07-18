import { describe, it, expect, vi } from 'vitest';
import { createDockerService, ContainerNotFoundError } from '../../src/services/dockerService.js';

function mockDocker({ inspectData, exists = true } = {}) {
  const container = {
    start: vi.fn().mockResolvedValue(),
    stop: vi.fn().mockResolvedValue(),
    restart: vi.fn().mockResolvedValue(),
    kill: vi.fn().mockResolvedValue(),
    inspect: vi.fn().mockResolvedValue(inspectData),
  };
  return {
    _container: container,
    listContainers: vi.fn().mockResolvedValue(
      exists ? [{ Names: ['/craftdock-mc-server'], Id: 'abc' }] : []
    ),
    getContainer: vi.fn().mockReturnValue(container),
  };
}

const config = { mcContainerName: 'craftdock-mc-server' };

describe('dockerService', () => {
  it('inspect returns state and parsed TYPE', async () => {
    const docker = mockDocker({
      inspectData: {
        State: { Status: 'running' },
        Config: { Env: ['EULA=TRUE', 'TYPE=PAPER'] },
      },
    });
    const svc = createDockerService(config, docker);
    const info = await svc.inspect();
    expect(info).toMatchObject({ found: true, state: 'running', type: 'PAPER' });
  });

  it('inspect reports not_found when container is absent', async () => {
    const svc = createDockerService(config, mockDocker({ exists: false }));
    const info = await svc.inspect();
    expect(info).toEqual({ found: false, state: 'not_found', type: null });
  });

  it('start delegates to the resolved container', async () => {
    const docker = mockDocker({ inspectData: { State: {}, Config: { Env: [] } } });
    const svc = createDockerService(config, docker);
    await svc.start();
    expect(docker._container.start).toHaveBeenCalledOnce();
  });

  it('start throws ContainerNotFoundError when absent', async () => {
    const svc = createDockerService(config, mockDocker({ exists: false }));
    await expect(svc.start()).rejects.toBeInstanceOf(ContainerNotFoundError);
  });

  it('getState works when destructured (no `this` binding)', async () => {
    const docker = mockDocker({
      inspectData: { State: { Status: 'running' }, Config: { Env: [] } },
    });
    const { getState } = createDockerService(config, docker);
    await expect(getState()).resolves.toBe('running');
  });
});
