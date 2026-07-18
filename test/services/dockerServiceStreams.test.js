// test/services/dockerServiceStreams.test.js
import { describe, it, expect, vi } from 'vitest';
import { createDockerService } from '../../src/services/dockerService.js';

function mockDocker() {
  const container = {
    inspect: vi.fn().mockResolvedValue({ State: {}, Config: { Env: [] } }),
    logs: vi.fn().mockResolvedValue('LOGSTREAM'),
    attach: vi.fn().mockResolvedValue('ATTACHSTREAM'),
  };
  return {
    _container: container,
    listContainers: vi.fn().mockResolvedValue([{ Names: ['/mc'], Id: 'x' }]),
    getContainer: vi.fn().mockReturnValue(container),
  };
}

describe('dockerService streams', () => {
  it('logStream requests a following log stream with tail', async () => {
    const docker = mockDocker();
    const svc = createDockerService({ mcContainerName: 'mc' }, docker);
    const stream = await svc.logStream();
    expect(stream).toBe('LOGSTREAM');
    expect(docker._container.logs).toHaveBeenCalledWith(
      expect.objectContaining({ follow: true, stdout: true, stderr: true })
    );
  });

  it('attach requests a duplex stream with stdin', async () => {
    const docker = mockDocker();
    const svc = createDockerService({ mcContainerName: 'mc' }, docker);
    const stream = await svc.attach();
    expect(stream).toBe('ATTACHSTREAM');
    expect(docker._container.attach).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true, stdin: true })
    );
  });
});
