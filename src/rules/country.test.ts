import { describe, it, expect } from 'vitest';
import { createNewGame } from './state';
import { deserialize, serialize } from './save';
import { endDay } from './day';
import { feedHerd, forage, marketSeeds, regionNames, trade, type Region } from './country';
import { MARKET_CROPS } from '../data/balance';
import { FISH, FISH_IDS } from '../data/fish';
import { availableFish, rollFish, rollBiteDelayMs } from './fishing';
import { staminaCost, useTool } from './actions';
import { layouts, canWalk } from '../presentation/regions';
import { route } from '../presentation/ground';
describe('travel and country economy', () => {
  it('routes arrivals to every pin on its own map', () => {
    for (const region of Object.keys(regionNames) as Region[]) {
      const { spawn, spots } = layouts[region],
        passable = (p: { x: number; y: number }) => canWalk(region, p);
      expect(passable(spawn), region).toBe(true);
      for (const s of Object.values(spots)) {
        expect(passable(s.foot), region + ' ' + s.label).toBe(true);
        expect(route(spawn, s.foot, passable).length, region + ' ' + s.label).toBeGreaterThan(0);
      }
    }
  });
  it('assigns coast and lake species by habitat through all seasons', () => {
    const s = createNewGame();
    for (const day of [1, 15, 29])
      for (const time of [360, 720, 1080, 1430]) {
        s.day = day;
        s.minutes = time;
        expect(availableFish(s, 'sea').every((id) => FISH[id].habitat === 'sea')).toBe(true);
        expect(availableFish(s, 'lake')).toContain('carp');
        expect(availableFish(s, 'lake')).not.toContain('snapper');
        expect(FISH[rollFish(s, () => 0.5, 'sea')].habitat).toBe('sea');
      }
  });
  it('sells and plants seasonal market seeds, charges for meals and upgrades only once', () => {
    const s = createNewGame();
    s.money = 500;
    expect(marketSeeds(s)).toContain('pineapple');
    trade(s, 'seed:pineapple');
    useTool(s, { kind: 'hoe' }, 2, 4);
    expect(useTool(s, { kind: 'seed', crop: 'pineapple' }, 2, 4)).toEqual({ ok: true });
    s.stamina = 80;
    trade(s, 'meal:rice');
    expect(s.stamina).toBe(98);
    trade(s, 'gear:can');
    expect(staminaCost(s, 'water')).toBe(1);
    const balance = s.money;
    trade(s, 'gear:can');
    expect(s.money).toBe(balance);
    const wait = rollBiteDelayMs(s, () => 0);
    trade(s, 'gear:rod');
    expect(rollBiteDelayMs(s, () => 0)).toBeCloseTo(wait * 0.72);
  });
  it('credits only fed owned animals and prevents duplicate sales', () => {
    const s = createNewGame();
    s.money = 1000;
    trade(s, 'animal:cow');
    trade(s, 'animal:duck');
    trade(s, 'feed');
    feedHerd(s);
    feedHerd(s);
    expect(s.country.feed).toBe(1);
    endDay(s, false);
    expect([s.country.duckEggs, s.country.milk]).toEqual([1, 1]);
    trade(s, 'sell:milk');
    const balance = s.money;
    trade(s, 'sell:milk');
    expect(s.money).toBe(balance);
    trade(s, 'sellAnimal:cow');
    expect(s.country.cow).toBe(0);
    endDay(s, false);
    expect(s.country.milk).toBe(0);
  });
  it('keeps legacy inventories and round-trips new locations and goods', () => {
    const s = createNewGame();
    s.money = 542;
    const old = JSON.parse(serialize(s));
    delete old.country;
    for (const k of ['seeds', 'produce', 'shipping']) for (const id of MARKET_CROPS) delete old[k][id];
    for (const k of ['fish', 'fishShipping'])
      for (const id of FISH_IDS) if (FISH[id].habitat) delete old[k][id];
    expect(deserialize(JSON.stringify(old))).toEqual(s);
    s.country.region = 'forest';
    forage(s, false);
    forage(s, false);
    expect(s.country.herbs).toBe(3);
    expect(deserialize(serialize(s))).toEqual(s);
  });
});
