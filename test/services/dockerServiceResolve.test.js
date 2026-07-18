import { describe, it, expect, vi } from 'vitest';
import os from 'node:os';
import { createDockerService } from '../../src/services/dockerService.js';

const config = { mcContainerName: 'craftdock-mc-server', mcServiceName: 'minecraft-server' };

// Simulates Coolify: the MC container has an auto-generated name (not
// craftdock-mc-server) but carries the compose service/project labels. The panel
// container (os.hostname()) shares the same project.
function mockCoolifyDocker() {
  const selfId = os.hostname();
  const mcData = { State: { Status: 'running' }, Config: { Env: ['TYPE=BEDROCK'] } };
  const byId = {
    [selfId]: { inspect: vi.fn().mockResolvedValue({ Config: { Labels: { 'com.docker.compose.project': 'proj' } } }) },
    mcid: { inspect: vi.fn().mockResolvedValue(mcData), start: vi.fn().mockResolvedValue() },
  };
  return {
    byId,
    listContainers: vi.fn().mockResolvedValue([
      {
        Names: ['/minecraft-server-proj-abc123'],
        Id: 'mcid',
        Labels: { 'com.docker.compose.service': 'minecraft-server', 'com.docker.compose.project': 'proj' },
      },
    ]),
    getContainer: vi.fn((id) => byId[id] || { inspect: vi.fn().mockRejectedValue(new Error('no such container')) }),
  };
}

describe('dockerService container resolution', () => {
  it('resolves the MC container by compose service label when the name does not match', async () => {
    const docker = mockCoolifyDocker();
    const svc = createDockerService(config, docker);
    const info = await svc.inspect();
    expect(info).toMatchObject({ found: true, state: 'running', type: 'BEDROCK' });
  });

  it('scopes the label match to the panel own compose project', async () => {
    const docker = mockCoolifyDocker();
    // Same service label but a DIFFERENT project — must NOT match.
    docker.listContainers.mockResolvedValue([
      {
        Names: ['/minecraft-server-other-xyz'],
        Id: 'mcid',
        Labels: { 'com.docker.compose.service': 'minecraft-server', 'com.docker.compose.project': 'other-project' },
      },
    ]);
    const svc = createDockerService(config, docker);
    const info = await svc.inspect();
    expect(info).toEqual({ found: false, state: 'not_found', type: null });
  });
});
