import { describe, it, expect } from 'vitest';
import { createNewGame } from './state';
import { buildCoop, careForHen, completeOrder, gather, giveBerry, greet } from './village';
import { shipAll } from './actions';
import { endDay } from './day';
import { serialize, deserialize } from './save';
import { center, cellAt, route, sites, walkable } from '../presentation/ground';
import { FIELD } from '../data/map';

describe('village progression', () => {
  it('gathers each resource once per day, builds a coop, and pays for shipped eggs once', () => {
    const s = createNewGame();
    gather(s, 'wood');
    gather(s, 'wood');
    gather(s, 'stone');
    gather(s, 'berry');
    expect(s.village.wood).toBe(3);
    buildCoop(s);
    expect(s.village.coop).toBe(true);
    expect(s.village.stone).toBe(0);
    careForHen(s);
    careForHen(s);
    expect(s.village.berry).toBe(2);
    endDay(s, false);
    careForHen(s);
    expect(s.village.eggs).toBe(1);
    expect(shipAll(s)).toBe(1);
    expect(shipAll(s)).toBe(0);
    expect(endDay(s, false).total).toBe(35);
    expect(endDay(s, false).total).toBe(0);
  });
  it('limits talk, gifts, and order rewards independently each day', () => {
    const s = createNewGame();
    gather(s, 'berry');
    greet(s, 'mali');
    greet(s, 'mali');
    giveBerry(s, 'mali');
    giveBerry(s, 'mali');
    expect(s.village.people.mali.points).toBe(3);
    s.produce.morningGlory = 3;
    completeOrder(s);
    completeOrder(s);
    expect(s.money).toBe(270);
    expect(s.produce.morningGlory).toBe(1);
    endDay(s, false);
    completeOrder(s);
    expect(s.money).toBe(340);
    expect(s.village.berry).toBe(0);
  });
  it('initializes older farms and saves social and crafting progress together', () => {
    const s = createNewGame();
    const legacy = JSON.parse(serialize(s));
    delete legacy.village;
    expect(deserialize(JSON.stringify(legacy))?.village).toEqual(s.village);
    greet(s, 'chai');
    gather(s, 'wood');
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it('connects each village interaction and maps every plot to its original save tile', () => {
    for (const site of Object.values(sites)) {
      expect(walkable(site.foot), site.label).toBe(true);
      expect(route({ x: 740, y: 413 }, site.foot).length, site.label).toBeGreaterThan(0);
    }
    for (let row = FIELD.row; row < FIELD.row + FIELD.h; row++)
      for (let col = FIELD.col; col < FIELD.col + FIELD.w; col++) {
        expect(cellAt(center({ row, col }))).toEqual({ row, col });
      }
  });
});
