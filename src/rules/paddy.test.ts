import { describe, expect, it } from 'vitest';
import { MAX_STAMINA, START_MONEY, type Weather } from '../data/balance';
import { GATES, IRON_HOE_SAVING, PADDY_STAMINA, RICE } from '../data/paddy';
import { endDay } from './day';
import {
  buySeedlings,
  expectedYield,
  goodWater,
  harvestRice,
  paddyNight,
  plough,
  riceRipe,
  setGate,
  transplant,
  waterAfter,
} from './paddy';
import { createNewGame, type GameState } from './state';

const SUN = () => 0; // every season lists sunny first, so 0 always rolls sunny
const newGame = () => createNewGame(SUN);
const plot = (s: GameState, index = 0) => s.estate.paddy.plots[index];

/** A game whose first plot is ploughed, holds good water and has just been transplanted. */
function planted() {
  const s = newGame();
  s.estate.paddy.seedlings = 1;
  plot(s).water = 2;
  plough(s, 0);
  transplant(s, 0);
  s.stamina = MAX_STAMINA;
  return s;
}

describe('paddy water', () => {
  it('moves overnight by the gate plus the weather, and stays between dry and flooded', () => {
    expect(waterAfter(2, 'closed', 'sunny')).toBe(1);
    expect(waterAfter(2, 'in', 'sunny')).toBe(3);
    expect(waterAfter(2, 'closed', 'heat')).toBe(0);
    expect(waterAfter(2, 'in', 'heat')).toBe(2);
    expect(waterAfter(2, 'closed', 'rain')).toBe(3);
    expect(waterAfter(2, 'closed', 'storm')).toBe(4);
    expect(waterAfter(2, 'out', 'storm')).toBe(2);
    expect(waterAfter(0, 'out', 'heat')).toBe(0);
    expect(waterAfter(4, 'in', 'storm')).toBe(4);
  });

  it('always leaves a gate setting that keeps good water good, whatever the forecast', () => {
    for (const water of [1, 2, 3])
      for (const weather of ['sunny', 'heat', 'rain', 'storm'] as Weather[])
        expect(GATES.some((gate) => goodWater(waterAfter(water, gate, weather))), water + ' ' + weather).toBe(true);
  });

  it('fills a dry plot through an open gate while the player sleeps', () => {
    const s = newGame();
    s.forecast = 'sunny';
    expect(setGate(s, 0, 'in').ok).toBe(true);
    endDay(s, false, SUN);
    expect(plot(s).water).toBe(1); // +2 from the canal, -1 to the sun
    expect(plot(s, 1).water).toBe(0); // its gate stayed shut
  });

  it('refuses a gate setting or a plot that does not exist', () => {
    const s = newGame();
    expect(setGate(s, 0, 'sideways' as never).ok).toBe(false);
    expect(setGate(s, 7, 'in').ok).toBe(false);
    expect(plot(s).gate).toBe('closed');
  });
});

describe('rice', () => {
  it('sells seedlings only in the rice seasons and only for money', () => {
    const s = newGame();
    expect(buySeedlings(s).ok).toBe(true);
    expect(s.money).toBe(START_MONEY - RICE.seedlingPrice);
    expect(s.estate.paddy.seedlings).toBe(1);
    s.money = RICE.seedlingPrice - 1;
    expect(buySeedlings(s).ok).toBe(false);
    s.money = 500;
    s.day = 29; // first day of the cool season
    expect(buySeedlings(s).ok).toBe(false);
    expect(s.estate.paddy.seedlings).toBe(1);
  });

  it('needs ploughed soil, standing water and a bundle of seedlings to transplant', () => {
    const s = newGame();
    s.estate.paddy.seedlings = 1;
    plot(s).water = 2;
    expect(transplant(s, 0).ok).toBe(false); // not ploughed
    expect(plough(s, 0).ok).toBe(true);
    expect(s.stamina).toBe(MAX_STAMINA - PADDY_STAMINA.plough);
    expect(plough(s, 0).ok).toBe(false); // already ploughed

    s.estate.paddy.seedlings = 0;
    expect(transplant(s, 0).ok).toBe(false);
    s.estate.paddy.seedlings = 1;
    plot(s).water = 0;
    expect(transplant(s, 0).ok).toBe(false); // dry
    plot(s).water = 4;
    expect(transplant(s, 0).ok).toBe(false); // flooded
    plot(s).water = 1;
    s.day = 29;
    expect(transplant(s, 0).ok).toBe(false); // cool season
    s.day = 1;

    expect(transplant(s, 0).ok).toBe(true);
    expect(plot(s).stage).toBe('planted');
    expect(s.estate.paddy.seedlings).toBe(0);
    expect(s.stamina).toBe(MAX_STAMINA - PADDY_STAMINA.plough - PADDY_STAMINA.transplant);
    expect(transplant(s, 0).ok).toBe(false); // occupied
    expect(plough(s, 0).ok).toBe(false); // living rice cannot be ploughed under
  });

  it('grows one step per night of good water and ripens after the full count', () => {
    const s = planted();
    let notes: string[] = [];
    for (let night = 0; night < RICE.nights; night++) {
      expect(riceRipe(plot(s))).toBe(false);
      plot(s).water = 2;
      notes = paddyNight(s, 'sunny');
    }
    expect(plot(s).growth).toBe(RICE.nights);
    expect(riceRipe(plot(s))).toBe(true);
    expect(notes.join()).toContain('พร้อมเกี่ยว');

    expect(harvestRice(s, 0).ok).toBe(true);
    expect(s.estate.goods.rice).toBe(RICE.fullYield);
    expect(plot(s).stage).toBe('fallow');
    expect(harvestRice(s, 0).ok).toBe(false);
  });

  it('turns yellow on a dry night, loses a unit of yield, and recovers with water', () => {
    const s = planted();
    plot(s).water = 1;
    const notes = paddyNight(s, 'sunny'); // gate shut: 1 - 1 = dry
    expect(plot(s).water).toBe(0);
    expect(plot(s)).toMatchObject({ growth: 0, stress: 1, lost: 1, dead: false });
    expect(notes.join()).toContain('ใบเหลือง');

    setGate(s, 0, 'in');
    expect(paddyNight(s, 'sunny')).toEqual([]);
    expect(plot(s)).toMatchObject({ water: 1, growth: 1, stress: 0, lost: 1 });
    expect(expectedYield(plot(s))).toBe(RICE.fullYield - 1);
  });

  it('dies after three bad nights in a row, and ploughing clears the plot', () => {
    const s = planted();
    plot(s).water = 0;
    paddyNight(s, 'heat');
    paddyNight(s, 'heat');
    expect(plot(s).dead).toBe(false);
    const notes = paddyNight(s, 'heat');
    expect(plot(s).dead).toBe(true);
    expect(notes.join()).toContain('ข้าวตาย');

    setGate(s, 0, 'in');
    paddyNight(s, 'rain');
    expect(plot(s).growth).toBe(0); // water came too late
    expect(harvestRice(s, 0).ok).toBe(false);
    expect(plough(s, 0).ok).toBe(true);
    expect(plot(s)).toMatchObject({ stage: 'ploughed', dead: false, stress: 0, lost: 0 });
  });

  it('floods under a storm with the gate shut, and draining ahead of it saves the night', () => {
    const shut = planted();
    paddyNight(shut, 'storm');
    expect(plot(shut)).toMatchObject({ water: 4, growth: 0, stress: 1 });

    const drained = planted();
    setGate(drained, 0, 'out');
    paddyNight(drained, 'storm');
    expect(plot(drained)).toMatchObject({ water: 2, growth: 1, stress: 0 });
  });

  it('stops caring about water once ripe, and is lighter to cut in a drained field', () => {
    const wet = planted();
    plot(wet).growth = RICE.nights;
    plot(wet).water = 4;
    expect(paddyNight(wet, 'storm')).toEqual([]);
    expect(plot(wet)).toMatchObject({ stress: 0, lost: 0, dead: false });
    harvestRice(wet, 0);
    expect(wet.stamina).toBe(MAX_STAMINA - PADDY_STAMINA.harvestWet);

    const dry = planted();
    plot(dry).growth = RICE.nights;
    plot(dry).water = 1;
    harvestRice(dry, 0);
    expect(dry.stamina).toBe(MAX_STAMINA - PADDY_STAMINA.harvest);
  });

  it('never yields less than the minimum however rough the season was', () => {
    const s = planted();
    plot(s).growth = RICE.nights;
    plot(s).lost = 40;
    harvestRice(s, 0);
    expect(s.estate.goods.rice).toBe(RICE.minYield);
  });

  it('makes field work heavier in the heat and ploughing lighter with the iron hoe', () => {
    const hot = newGame();
    hot.weather = 'heat';
    plough(hot, 0);
    expect(hot.stamina).toBe(MAX_STAMINA - PADDY_STAMINA.plough - 3);

    const tooled = newGame();
    tooled.country.hoe = true;
    plough(tooled, 0);
    expect(tooled.stamina).toBe(MAX_STAMINA - PADDY_STAMINA.plough + IRON_HOE_SAVING);
  });

  it('does nothing when too tired, and leaves the plot unchanged', () => {
    const s = newGame();
    s.stamina = PADDY_STAMINA.plough - 1;
    expect(plough(s, 0).ok).toBe(false);
    expect(plot(s).stage).toBe('fallow');
    expect(s.stamina).toBe(PADDY_STAMINA.plough - 1);
  });

  it('can be steered to a full harvest through any weather by reading the forecast', () => {
    const s = planted();
    // A fixed but varied run of rolls: sun, heat, rain and storms across the hot and rainy seasons.
    const rolls = [0.05, 0.7, 0.95, 0.4, 0.99, 0.2, 0.65, 0.92, 0.1, 0.8, 0.97, 0.3];
    let turn = 0;
    const rng = () => rolls[turn++ % rolls.length];
    s.day = 10;
    let nights = 0;
    while (!riceRipe(plot(s))) {
      const gate = GATES.find((g) => goodWater(waterAfter(plot(s).water, g, s.forecast)))!;
      setGate(s, 0, gate);
      endDay(s, false, rng);
      nights += 1;
    }
    expect(nights).toBe(RICE.nights);
    expect(expectedYield(plot(s))).toBe(RICE.fullYield);
  });
});
