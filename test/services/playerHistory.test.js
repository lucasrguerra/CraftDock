import { describe, it, expect, vi } from 'vitest';
import fsp from 'node:fs/promises';
import { getHistoricalPlayers, updatePlayerHistory } from '../../src/services/playerHistory.js';

vi.mock('node:fs/promises');

describe('playerHistory', () => {
  it('reads history from craftdock_players_history.json and usercache.json', async () => {
    vi.mocked(fsp.readFile).mockImplementation(async (filePath) => {
      if (filePath.endsWith('craftdock_players_history.json')) {
        return JSON.stringify(['steve']);
      }
      if (filePath.endsWith('usercache.json')) {
        return JSON.stringify([{ name: 'alex' }, { name: 'steve' }]);
      }
      throw new Error('ENOENT');
    });

    const history = await getHistoricalPlayers('/data', 'java');
    expect(history).toEqual(['steve', 'alex']);
  });

  it('updates history file when new players join', async () => {
    let writtenData = null;
    vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify(['steve']));
    vi.mocked(fsp.writeFile).mockImplementation(async (filePath, data) => {
      writtenData = data;
    });

    const history = await updatePlayerHistory('/data', 'bedrock', ['steve', 'alex']);
    expect(history).toEqual(['steve', 'alex']);
    expect(JSON.parse(writtenData)).toEqual(['steve', 'alex']);
  });
});
