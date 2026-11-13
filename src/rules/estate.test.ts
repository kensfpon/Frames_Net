import { describe, expect, it } from 'vitest';
import { START_MONEY } from '../data/balance';
import { FESTIVALS } from '../data/festivals';
import { GOODS } from '../data/goods';
import { TREES } from '../data/orchard';
import { RICE } from '../data/paddy';
import { shipAll } from './actions';
import { endDay } from './day';
import { chore, newEstate, validEstate } from './estate';
import { deserialize, serialize } from './save';
import { SAVE_VERSION, createNewGame } from './state';

const SUN = () => 0;
const newGame = () => createNewGame(SUN);

describe('estate in the save file', () => {
  it('starts empty and round-trips with work in progress', () => {
    const s = newGame();
    expect(s.estate).toEqual(newEstate());
    expect(validEstate(s.estate)).toBe(true);

    s.money = 900;
    chore(s, 'paddy:buy');
    chore(s, 'paddy:gate:1:in');
    chore(s, 'paddy:plough:1');
    chore(s, 'orchard:buy:mango');
    chore(s, 'orchard:plant:4:mango');
    s.estate.goods.rice = 7;
    s.estate.festivals.joined.songkran = 6;
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('gives a version 3 save an empty paddy, orchard and festival log', () => {
    const s = newGame();
    s.money = 615;
    const v3 = JSON.parse(serialize(s));
    v3.version = 3;
    delete v3.estate;
    const loaded = deserialize(JSON.stringify(v3));
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.money).toBe(615);
    expect(loaded!.estate).toEqual(newEstate());
  });

  it('rejects an estate that is missing or out of shape', () => {
    const broken = (change: (estate: ReturnType<typeof newEstate>) => void) => {
      const s = newGame();
      change(s.estate);
      return deserialize(JSON.stringify(s));
    };
    expect(broken((e) => (e.paddy.plots[0].water = 9))).toBeNull();
    expect(broken((e) => (e.paddy.plots[0].gate = 'sideways' as never))).toBeNull();
    expect(broken((e) => e.paddy.plots.pop())).toBeNull();
    expect(broken((e) => (e.paddy.seedlings = -1))).toBeNull();
    expect(broken((e) => (e.orchard.slots[0] = { id: 'durian' } as never))).toBeNull();
    expect(broken((e) => (e.orchard.slots[0] = { id: 'mango', age: 99, watered: false, bloom: 0, fruit: 0, fed: false }))).toBeNull();
    expect(broken((e) => delete (e.goods as Partial<typeof e.goods>).rice)).toBeNull();
    expect(broken((e) => (e.goodsShipping.mango = 1.5))).toBeNull();
    expect(broken((e) => (e.festivals.joined.songkran = 'yes' as never))).toBeNull();

    const missing = JSON.parse(serialize(newGame()));
    delete missing.estate; // a current-version save must carry its estate
    expect(deserialize(JSON.stringify(missing))).toBeNull();
  });
});

describe('estate in the day loop', () => {
  it('ships rice and fruit in the crate and is paid for them next morning', () => {
    const s = newGame();
    s.estate.goods.rice = 3;
    s.estate.goods.mango = 2;
    expect(shipAll(s)).toBe(5);
    expect(s.estate.goods.rice).toBe(0);
    expect(shipAll(s)).toBe(0);

    const summary = endDay(s, false, SUN);
    const expected = 3 * GOODS.rice.price + 2 * GOODS.mango.price;
    expect(summary.total).toBe(expected);
    expect(summary.sold).toEqual([
      { name: GOODS.rice.name, count: 3, amount: 3 * GOODS.rice.price },
      { name: GOODS.mango.name, count: 2, amount: 2 * GOODS.mango.price },
    ]);
    expect(s.money).toBe(START_MONEY + expected);
    expect(endDay(s, false, SUN).total).toBe(0);
  });

  it('runs the paddy and the orchard through the night under the new weather', () => {
    const s = newGame();
    s.money = 1000;
    chore(s, 'paddy:gate:0:in');
    chore(s, 'orchard:buy:banana');
    chore(s, 'orchard:plant:0:banana');
    chore(s, 'orchard:water:0');
    s.forecast = 'rain';
    const summary = endDay(s, false, SUN);
    expect(s.weather).toBe('rain');
    expect(s.estate.paddy.plots[0].water).toBe(3); // +2 canal, +1 rain
    expect(s.estate.paddy.plots[1].water).toBe(1); // rain alone
    expect(s.estate.orchard.slots[0]).toMatchObject({ age: 1, watered: true });
    expect(summary.notes).toEqual([]);
  });

  it('reports trouble in the paddy and festival news in the morning summary', () => {
    const s = newGame();
    Object.assign(s.estate.paddy.plots[0], { stage: 'planted', water: 1 });
    s.day = 5;
    s.forecast = 'sunny';
    const summary = endDay(s, false, SUN); // wakes on day 6: Songkran
    expect(summary.notes).toHaveLength(2);
    expect(summary.notes[0]).toContain('ใบเหลือง');
    expect(summary.notes[1]).toContain(FESTIVALS.songkran.name);
  });

  it('carries a whole rice crop from seedlings to money', () => {
    const s = newGame();
    expect(chore(s, 'paddy:buy').ok).toBe(true);
    expect(chore(s, 'paddy:gate:0:in').ok).toBe(true);
    endDay(s, false, SUN); // water comes in overnight
    expect(chore(s, 'paddy:plough:0').ok).toBe(true);
    expect(chore(s, 'paddy:plant:0').ok).toBe(true);
    // Sunny every day: one night with the gate open, the next with it shut, keeps the water good.
    for (let night = 0; night < RICE.nights; night++) {
      chore(s, 'paddy:gate:0:' + (s.estate.paddy.plots[0].water >= 2 ? 'closed' : 'in'));
      endDay(s, false, SUN);
    }
    expect(chore(s, 'paddy:harvest:0').ok).toBe(true);
    expect(s.estate.goods.rice).toBe(RICE.fullYield);
    shipAll(s);
    const before = s.money;
    endDay(s, false, SUN);
    expect(s.money).toBe(before + RICE.fullYield * GOODS.rice.price);
  });
});

describe('chores by name', () => {
  it('routes each action to its rule', () => {
    const s = newGame();
    s.money = 1000;
    expect(chore(s, 'paddy:gate:2:out').ok).toBe(true);
    expect(s.estate.paddy.plots[2].gate).toBe('out');
    expect(chore(s, 'orchard:buy:longan').ok).toBe(true);
    expect(chore(s, 'orchard:plant:5:longan').ok).toBe(true);
    expect(s.estate.orchard.slots[5]?.id).toBe('longan');
    expect(chore(s, 'orchard:water:5').ok).toBe(true);
    expect(chore(s, 'orchard:feed:5').ok).toBe(false); // too young
    expect(chore(s, 'orchard:pick:5').ok).toBe(false); // no fruit
    expect(chore(s, 'orchard:fell:5').ok).toBe(true);
    expect(s.money).toBe(1000 - TREES.longan.saplingPrice);

    s.day = 6;
    s.minutes = FESTIVALS.songkran.from;
    expect(chore(s, 'festival:join').ok).toBe(true);
  });

  it('refuses anything it does not know without touching the game', () => {
    const s = newGame();
    const before = serialize(s);
    for (const action of [
      '',
      'paddy',
      'paddy:plough',
      'paddy:plough:x',
      'paddy:plough:9',
      'paddy:gate:0:sideways',
      'paddy:gate:0',
      'paddy:dance:0',
      'orchard:plant:0:durian',
      'orchard:plant::mango',
      'orchard:water:1.5',
      'orchard:pick:-1',
      'festival:join', // day 1 has no festival
      'festival:leave',
      'barn:burn',
    ])
      expect(chore(s, action).ok, action).toBe(false);
    expect(serialize(s)).toBe(before);
  });
});
