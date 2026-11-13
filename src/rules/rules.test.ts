import { describe, expect, it } from 'vitest';
import { CROPS, DAY_START_MINUTES, MAX_STAMINA, PASSED_OUT_STAMINA, START_MONEY, type CropId } from '../data/balance';
import { FIELD } from '../data/map';
import { buySeed, isRipe, seedsForSale, shipAll, useTool } from './actions';
import { dayOfSeason, rollWeather, seasonOf, seasonWarning, yearOf } from './calendar';
import { advanceMinutes, endDay, formatClock } from './day';
import { deserialize, serialize } from './save';
import { createNewGame } from './state';

const C = FIELD.col;
const R = FIELD.row;
const SUN = () => 0; // every season lists sunny first, so 0 always rolls sunny

const newGame = () => createNewGame(SUN);

function plant(s: ReturnType<typeof newGame>, crop: CropId, col = C, row = R) {
  s.seeds[crop] += 1;
  useTool(s, { kind: 'hoe' }, col, row);
  return useTool(s, { kind: 'seed', crop }, col, row);
}

function plantAndGrow(crop: CropId, wateredDays: number) {
  const s = newGame();
  plant(s, crop);
  for (let i = 0; i < wateredDays; i++) {
    useTool(s, { kind: 'can' }, C, R);
    endDay(s, false, SUN);
  }
  return s;
}

describe('tools', () => {
  it('tills grass in the field and spends stamina', () => {
    const s = newGame();
    expect(useTool(s, { kind: 'hoe' }, C, R)).toEqual({ ok: true });
    expect(s.tiles[R][C].kind).toBe('tilled');
    expect(s.tiles[R][C].watered).toBe(false);
    expect(s.stamina).toBe(MAX_STAMINA - 4);
  });

  it('refuses to till outside the field or on a building', () => {
    const s = newGame();
    expect(useTool(s, { kind: 'hoe' }, 0, 0)).toEqual({ ok: false, reason: 'notField' });
    expect(useTool(s, { kind: 'hoe' }, 1, 1)).toEqual({ ok: false, reason: 'notField' });
    expect(useTool(s, { kind: 'hoe' }, -1, 99)).toEqual({ ok: false, reason: 'notField' });
    expect(s.stamina).toBe(MAX_STAMINA);
  });

  it('plants only on tilled, empty soil and uses up a seed', () => {
    const s = newGame();
    expect(useTool(s, { kind: 'seed', crop: 'morningGlory' }, C, R)).toEqual({ ok: false, reason: 'notTilled' });
    useTool(s, { kind: 'hoe' }, C, R);
    expect(useTool(s, { kind: 'seed', crop: 'longBean' }, C, R)).toEqual({ ok: false, reason: 'noSeed' });
    expect(useTool(s, { kind: 'seed', crop: 'morningGlory' }, C, R)).toEqual({ ok: true });
    expect(s.seeds.morningGlory).toBe(4);
    expect(useTool(s, { kind: 'seed', crop: 'morningGlory' }, C, R)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('waters a tile once per day', () => {
    const s = newGame();
    useTool(s, { kind: 'hoe' }, C, R);
    expect(useTool(s, { kind: 'can' }, C, R)).toEqual({ ok: true });
    expect(useTool(s, { kind: 'can' }, C, R)).toEqual({ ok: false, reason: 'alreadyWatered' });
  });

  it('does nothing when too tired, and leaves the tile unchanged', () => {
    const s = newGame();
    s.stamina = 3;
    expect(useTool(s, { kind: 'hoe' }, C, R)).toEqual({ ok: false, reason: 'tired' });
    expect(s.tiles[R][C].kind).toBe('grass');
    expect(s.stamina).toBe(3);
  });
});

describe('growth and harvest', () => {
  it('grows only on watered days and never dies of thirst', () => {
    const s = plantAndGrow('morningGlory', 2);
    expect(s.tiles[R][C].crop?.growth).toBe(2);
    endDay(s, false, SUN); // a dry day
    expect(s.tiles[R][C].crop?.growth).toBe(2);
    expect(isRipe(s, C, R)).toBe(false);
    expect(useTool(s, { kind: 'hand' }, C, R)).toEqual({ ok: false, reason: 'notRipe' });
  });

  it('soil dries every sunny morning', () => {
    const s = plantAndGrow('morningGlory', 1);
    expect(s.tiles[R][C].watered).toBe(false);
  });

  it('harvests a ripe crop into the bag and frees the tile', () => {
    const s = plantAndGrow('morningGlory', CROPS.morningGlory.days);
    expect(isRipe(s, C, R)).toBe(true);
    expect(useTool(s, { kind: 'hand' }, C, R)).toEqual({ ok: true });
    expect(s.produce.morningGlory).toBe(1);
    expect(s.tiles[R][C].crop).toBeNull();
    expect(s.tiles[R][C].kind).toBe('tilled');
  });
});

describe('money', () => {
  it('pays for shipped produce the next morning', () => {
    const s = newGame();
    s.produce.morningGlory = 2;
    s.produce.pumpkin = 1;
    expect(shipAll(s)).toBe(3);
    expect(s.money).toBe(START_MONEY);
    const summary = endDay(s, false, SUN);
    expect(summary.total).toBe(2 * 25 + 160);
    expect(s.money).toBe(START_MONEY + 210);
    expect(s.shipping.morningGlory).toBe(0);
    expect(endDay(s, false, SUN).total).toBe(0);
  });

  it('sells seeds only during opening hours and only with enough money', () => {
    const s = newGame();
    expect(buySeed(s, 'longBean')).toEqual({ ok: false, reason: 'shopClosed' }); // 06:00
    s.minutes = 9 * 60;
    expect(buySeed(s, 'longBean')).toEqual({ ok: true });
    expect(s.money).toBe(START_MONEY - 25);
    expect(s.seeds.longBean).toBe(1);
    s.money = 10;
    expect(buySeed(s, 'watermelon')).toEqual({ ok: false, reason: 'noMoney' });
    s.minutes = 17 * 60;
    expect(buySeed(s, 'morningGlory')).toEqual({ ok: false, reason: 'shopClosed' });
  });
});

describe('day cycle', () => {
  it('passes out at midnight and wakes with half stamina', () => {
    const s = newGame();
    expect(advanceMinutes(s, 10)).toBe(false);
    expect(advanceMinutes(s, 24 * 60)).toBe(true);
    const summary = endDay(s, true, SUN);
    expect(summary.passedOut).toBe(true);
    expect(s.stamina).toBe(PASSED_OUT_STAMINA);
    expect(s.day).toBe(2);
    expect(s.minutes).toBe(DAY_START_MINUTES);
  });

  it('restores full stamina after a normal sleep', () => {
    const s = newGame();
    s.stamina = 7;
    endDay(s, false, SUN);
    expect(s.stamina).toBe(MAX_STAMINA);
  });

  it('formats the clock', () => {
    expect(formatClock(6 * 60)).toBe('06:00');
    expect(formatClock(13 * 60 + 40)).toBe('13:40');
  });
});

describe('calendar', () => {
  it('runs hot, rainy, cool in 14-day seasons', () => {
    expect([1, 14, 15, 28, 29, 42, 43].map(seasonOf)).toEqual(['hot', 'hot', 'rainy', 'rainy', 'cool', 'cool', 'hot']);
    expect([1, 14, 15, 43].map(dayOfSeason)).toEqual([1, 14, 1, 1]);
    expect([1, 42, 43, 85].map(yearOf)).toEqual([1, 1, 2, 3]);
  });

  it('warns during the last three days of a season', () => {
    expect([11, 12, 13, 14, 15].map(seasonWarning)).toEqual([0, 3, 2, 1, 0]);
  });
});

describe('weather', () => {
  it('rolls weather from the season odds', () => {
    expect(rollWeather('hot', () => 0)).toBe('sunny');
    expect(rollWeather('hot', () => 0.65)).toBe('heat');
    expect(rollWeather('hot', () => 0.95)).toBe('rain');
    expect(rollWeather('rainy', () => 0.5)).toBe('rain');
    expect(rollWeather('rainy', () => 0.9)).toBe('storm');
    expect(rollWeather('cool', () => 0.999999)).toBe('rain');
  });

  it("makes yesterday's forecast today's weather and rolls a new forecast", () => {
    const s = newGame();
    s.forecast = 'rain';
    const summary = endDay(s, false, () => 0.65);
    expect(s.weather).toBe('rain');
    expect(s.forecast).toBe('heat');
    expect(summary.weather).toBe('rain');
    expect(summary.forecast).toBe('heat');
  });

  it('rain waters every tilled tile, including soil tilled that day', () => {
    const s = newGame();
    plant(s, 'morningGlory');
    s.forecast = 'rain';
    endDay(s, false, SUN);
    expect(s.tiles[R][C].watered).toBe(true);
    expect(s.tiles[R][C + 1].watered).toBe(false); // grass stays grass
    expect(useTool(s, { kind: 'can' }, C, R)).toEqual({ ok: false, reason: 'alreadyWatered' });
    useTool(s, { kind: 'hoe' }, C + 1, R);
    expect(s.tiles[R][C + 1].watered).toBe(true);
    endDay(s, false, SUN); // rain counted as watering
    expect(s.tiles[R][C].crop?.growth).toBe(1);
  });

  it('a heatwave makes every job cost one more stamina', () => {
    const s = newGame();
    s.weather = 'heat';
    useTool(s, { kind: 'hoe' }, C, R);
    expect(s.stamina).toBe(MAX_STAMINA - 5);
  });

  it('a storm closes the stall all day', () => {
    const s = newGame();
    s.weather = 'storm';
    s.minutes = 9 * 60;
    expect(buySeed(s, 'morningGlory')).toEqual({ ok: false, reason: 'shopStorm' });
  });
});

describe('seasons and crops', () => {
  it('sells and plants only in-season crops', () => {
    const s = newGame();
    s.minutes = 9 * 60;
    expect(seedsForSale(s)).toEqual(['morningGlory', 'longBean', 'watermelon']);
    expect(buySeed(s, 'pumpkin')).toEqual({ ok: false, reason: 'notSold' });
    expect(plant(s, 'pumpkin')).toEqual({ ok: false, reason: 'outOfSeason' });
    expect(s.seeds.pumpkin).toBe(1);
    s.day = 15;
    expect(seedsForSale(s)).toEqual(['morningGlory', 'longBean', 'corn', 'chili', 'pumpkin']);
    expect(useTool(s, { kind: 'seed', crop: 'pumpkin' }, C, R)).toEqual({ ok: true });
  });

  it('withers out-of-season crops on the first morning of a new season', () => {
    const s = newGame();
    plant(s, 'watermelon', C, R); // hot only
    plant(s, 'longBean', C + 1, R); // hot and rainy
    s.tiles[R][C].crop!.growth = CROPS.watermelon.days; // even a ripe one withers
    s.day = 14;
    const summary = endDay(s, false, SUN);
    expect(summary.newSeason).toBe('rainy');
    expect(summary.withered).toBe(1);
    expect(s.tiles[R][C].crop?.withered).toBe(true);
    expect(s.tiles[R][C + 1].crop?.withered).toBe(false);
    expect(isRipe(s, C, R)).toBe(false);
  });

  it('clears a withered plant for free with hand or hoe, and it never grows again', () => {
    const s = newGame();
    plant(s, 'watermelon', C, R);
    plant(s, 'watermelon', C + 1, R);
    s.day = 14;
    endDay(s, false, SUN);
    useTool(s, { kind: 'can' }, C, R);
    endDay(s, false, SUN);
    expect(s.tiles[R][C].crop?.growth).toBe(0);
    const before = s.stamina;
    expect(useTool(s, { kind: 'hand' }, C, R)).toEqual({ ok: true });
    expect(useTool(s, { kind: 'hoe' }, C + 1, R)).toEqual({ ok: true });
    expect(s.tiles[R][C].crop).toBeNull();
    expect(s.tiles[R][C + 1].crop).toBeNull();
    expect(s.produce.watermelon).toBe(0);
    expect(s.stamina).toBe(before);
  });

  it('reports no season change on ordinary mornings', () => {
    const s = newGame();
    const summary = endDay(s, false, SUN);
    expect(summary.newSeason).toBeNull();
    expect(summary.withered).toBe(0);
    expect(summary.seasonWarning).toBe(0);
  });
});

describe('save', () => {
  it('round-trips the whole game', () => {
    const s = plantAndGrow('longBean', 2);
    s.money = 777;
    s.weather = 'storm';
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('rejects missing, corrupt, wrong-version and wrong-shape saves', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('{not json')).toBeNull();
    expect(deserialize('42')).toBeNull();
    const s = newGame();
    expect(deserialize(JSON.stringify({ ...s, version: 999 }))).toBeNull();
    expect(deserialize(JSON.stringify({ ...s, tiles: s.tiles.slice(1) }))).toBeNull();
    expect(deserialize(JSON.stringify({ ...s, money: 'lots' }))).toBeNull();
    expect(deserialize(JSON.stringify({ ...s, weather: 'snow' }))).toBeNull();
    const bad = newGame();
    (bad.tiles[0][0] as unknown as { crop: unknown }).crop = { id: 'durian', growth: 1, withered: false };
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });

  it('upgrades a version 1 save without losing progress', () => {
    const v1 = newGame() as unknown as Record<string, unknown>;
    v1.version = 1;
    v1.day = 5;
    v1.money = 480;
    delete v1.weather;
    delete v1.forecast;
    v1.seeds = { morningGlory: 2, longBean: 1, pumpkin: 3 };
    v1.produce = { morningGlory: 0, longBean: 0, pumpkin: 0 };
    v1.shipping = { morningGlory: 4, longBean: 0, pumpkin: 0 };
    const tiles = v1.tiles as { kind: string; watered: boolean; crop: unknown }[][];
    tiles[R][C] = { kind: 'tilled', watered: true, crop: { id: 'longBean', growth: 2 } };

    const s = deserialize(JSON.stringify(v1));
    expect(s).not.toBeNull();
    expect(s!.version).toBe(2);
    expect(s!.day).toBe(5);
    expect(s!.money).toBe(480);
    expect(s!.weather).toBe('sunny');
    expect(s!.seeds.pumpkin).toBe(3);
    expect(s!.seeds.strawberry).toBe(0);
    expect(s!.shipping.morningGlory).toBe(4);
    expect(s!.tiles[R][C].crop).toEqual({ id: 'longBean', growth: 2, withered: false });
  });
});
