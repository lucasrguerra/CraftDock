import { describe, it, expect } from 'vitest';
import { normalizeBedrock, normalizeJava, int64ToString } from '../../src/adapters/playerFile/nbtPlayer.js';

describe('int64ToString', () => {
  it('combines [high, low] int32 pair like prismarine-nbt longs', () => {
    expect(int64ToString([-2, 1])).toBe('-8589934591');
    expect(int64ToString([0, 5])).toBe('5');
  });
  it('passes through number/bigint', () => {
    expect(int64ToString(42)).toBe('42');
    expect(int64ToString(7n)).toBe('7');
  });
});

describe('normalizeBedrock', () => {
  it('extracts position, dimension, health, hunger, inventory, uniqueId', () => {
    const d = normalizeBedrock({
      Pos: [1.5, 2, 3], DimensionId: 1,
      Attributes: [
        { Name: 'minecraft:health', Current: 9.5, Max: 20 },
        { Name: 'minecraft:player.hunger', Current: 17 },
      ],
      Inventory: [
        { Slot: 0, Name: 'minecraft:iron_pickaxe', Count: 1 },
        { Slot: 1, Name: '', Count: 0 },
      ],
      PlayerGameMode: 1, PlayerLevel: 10, UniqueID: [-2, 1],
    });
    expect(d.position).toEqual({ x: 1.5, y: 2, z: 3 });
    expect(d.dimension).toBe('nether');
    expect(d.health).toEqual({ current: 9.5, max: 20 });
    expect(d.food).toBe(17);
    expect(d.inventory).toEqual([{ slot: 0, name: 'minecraft:iron_pickaxe', count: 1 }]);
    expect(d.gamemode).toBe('creative');
    expect(d.xp).toEqual({ level: 10 });
    expect(d.uniqueId).toBe('-8589934591');
  });
});

describe('normalizeJava', () => {
  it('extracts fields from a java playerdata shape', () => {
    const d = normalizeJava({
      Pos: [10.5, 64, -20.3], Dimension: 'minecraft:the_end',
      Health: 18.0, foodLevel: 15,
      Inventory: [{ Slot: 0, id: 'minecraft:dirt', Count: 64 }],
      playerGameType: 0, XpLevel: 3,
    });
    expect(d.position).toEqual({ x: 10.5, y: 64, z: -20.3 });
    expect(d.dimension).toBe('end');
    expect(d.health).toEqual({ current: 18, max: 20 });
    expect(d.food).toBe(15);
    expect(d.inventory).toEqual([{ slot: 0, name: 'minecraft:dirt', count: 64 }]);
    expect(d.gamemode).toBe('survival');
    expect(d.xp).toEqual({ level: 3 });
  });
});
