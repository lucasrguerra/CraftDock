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

  it('extracts armor (head/chest/legs/feet) and offhand from their own NBT lists', () => {
    const d = normalizeBedrock({
      Armor: [
        { Name: 'minecraft:iron_helmet', Count: 1 },
        { Name: 'minecraft:iron_chestplate', Count: 1 },
        { Name: '', Count: 0 },
        { Name: 'minecraft:leather_boots', Count: 1 },
        { Name: '', Count: 0 }, // 5th body slot on some versions — ignored
      ],
      Offhand: [{ Name: 'minecraft:shield', Count: 1 }],
    });
    expect(d.armor).toEqual({
      head: { name: 'minecraft:iron_helmet', count: 1 },
      chest: { name: 'minecraft:iron_chestplate', count: 1 },
      legs: null,
      feet: { name: 'minecraft:leather_boots', count: 1 },
    });
    expect(d.offhand).toEqual({ name: 'minecraft:shield', count: 1 });
  });

  it('yields empty armor/offhand when the lists are absent or empty-named', () => {
    const d = normalizeBedrock({});
    expect(d.armor).toEqual({ head: null, chest: null, legs: null, feet: null });
    expect(d.offhand).toBeNull();
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

  it('splits armor (slots 100-103) and offhand (-106) out of the java Inventory list', () => {
    const d = normalizeJava({
      Inventory: [
        { Slot: 0, id: 'minecraft:dirt', Count: 64 },
        { Slot: 100, id: 'minecraft:iron_boots', Count: 1 },
        { Slot: 101, id: 'minecraft:iron_leggings', Count: 1 },
        { Slot: 102, id: 'minecraft:iron_chestplate', Count: 1 },
        { Slot: 103, id: 'minecraft:iron_helmet', Count: 1 },
        { Slot: -106, id: 'minecraft:shield', Count: 1 },
      ],
    });
    // armor/offhand are NOT part of the regular inventory grid
    expect(d.inventory).toEqual([{ slot: 0, name: 'minecraft:dirt', count: 64 }]);
    expect(d.armor).toEqual({
      head: { name: 'minecraft:iron_helmet', count: 1 },
      chest: { name: 'minecraft:iron_chestplate', count: 1 },
      legs: { name: 'minecraft:iron_leggings', count: 1 },
      feet: { name: 'minecraft:iron_boots', count: 1 },
    });
    expect(d.offhand).toEqual({ name: 'minecraft:shield', count: 1 });
  });
});
