import { describe, expect, it } from 'vitest';
import { CROPS, DAY_END_MINUTES, MAX_STAMINA, START_MONEY } from '../data/balance';
import {
  BOAT_RACE,
  FAIR_PRIZE_FACTOR,
  FESTIVALS,
  FESTIVAL_IDS,
  FESTIVAL_MINUTES,
  LANTERN_PRICE,
  MAX_FRIENDSHIP,
  ROCKET_WOOD,
  SONGKRAN_STAMINA,
  type FestivalId,
} from '../data/festivals';
import { GOODS } from '../data/goods';
import { daysUntil, festivalClosed, festivalNotes, festivalOn, joinFestival, nextFestival } from './festival';
import { createNewGame } from './state';

const SUN = () => 0;
const YEAR = 42;
const DAY: Record<FestivalId, number> = {
  songkran: 6,
  rocket: 12,
  ploughing: 16,
  boatRace: 25,
  yiPeng: 31,
  harvestFair: 38,
};

/** A game standing in the middle of this festival, in fair weather. */
function at(id: FestivalId) {
  const s = createNewGame(SUN);
  s.day = DAY[id];
  s.minutes = FESTIVALS[id].from + 60;
  s.weather = 'sunny';
  return s;
}

describe('festival calendar', () => {
  it('puts every festival on its own day, every year', () => {
    for (const id of FESTIVAL_IDS) {
      expect(festivalOn(DAY[id]), id).toBe(id);
      expect(festivalOn(DAY[id] + YEAR), id).toBe(id);
    }
    expect(festivalOn(1)).toBeNull();
    expect(new Set(Object.values(DAY)).size).toBe(FESTIVAL_IDS.length);
  });

  it('counts the days to the next one, across the end of the year', () => {
    expect(nextFestival(1)).toEqual({ id: 'songkran', inDays: 5 });
    expect(nextFestival(6)).toEqual({ id: 'songkran', inDays: 0 });
    expect(nextFestival(7)).toEqual({ id: 'rocket', inDays: 5 });
    expect(nextFestival(39)).toEqual({ id: 'songkran', inDays: 9 });
    expect(daysUntil('harvestFair', 39)).toBe(YEAR - 1);
  });

  it('announces a festival two days ahead and on the day', () => {
    expect(festivalNotes(1)).toEqual([]);
    expect(festivalNotes(4).join()).toContain('อีก 2 วัน');
    expect(festivalNotes(4).join()).toContain(FESTIVALS.songkran.name);
    expect(festivalNotes(6).join()).toContain('วันนี้มีงาน');
    expect(festivalNotes(7)).toEqual([]);
  });
});

describe('joining a festival', () => {
  it('needs the right day, the right hours and no storm, and only works once', () => {
    const s = at('songkran');
    s.day = 5;
    expect(joinFestival(s).ok).toBe(false);
    s.day = 6;
    s.minutes = FESTIVALS.songkran.from - 10;
    expect(joinFestival(s).ok).toBe(false);
    s.minutes = FESTIVALS.songkran.to;
    expect(joinFestival(s).ok).toBe(false);
    s.minutes = FESTIVALS.songkran.from;
    s.weather = 'storm';
    expect(joinFestival(s).ok).toBe(false);
    expect(s.village.people.mali.points).toBe(0);

    s.weather = 'sunny';
    expect(festivalClosed(s)).toBeNull();
    expect(joinFestival(s).ok).toBe(true);
    expect(s.estate.festivals.joined.songkran).toBe(6);
    expect(joinFestival(s).ok).toBe(false);
    expect(s.village.people.mali.points).toBe(FESTIVALS.songkran.friendship);
  });

  it('can be joined again when the festival comes round next year', () => {
    const s = at('songkran');
    joinFestival(s);
    s.day += YEAR;
    s.minutes = FESTIVALS.songkran.from;
    expect(joinFestival(s).ok).toBe(true);
  });

  it('takes part of the day but never runs past midnight', () => {
    const s = at('songkran');
    const before = s.minutes;
    joinFestival(s);
    expect(s.minutes).toBe(before + FESTIVAL_MINUTES);

    const late = at('yiPeng');
    late.minutes = FESTIVALS.yiPeng.to - 10;
    joinFestival(late);
    expect(late.minutes).toBeLessThan(DAY_END_MINUTES);
    expect(late.minutes).toBeGreaterThanOrEqual(FESTIVALS.yiPeng.to - 10);
  });

  it('makes friends with every villager, up to the cap', () => {
    const s = at('yiPeng');
    s.village.people.chai.points = MAX_FRIENDSHIP - 1;
    joinFestival(s);
    expect(s.village.people.mali.points).toBe(FESTIVALS.yiPeng.friendship);
    expect(s.village.people.chai.points).toBe(MAX_FRIENDSHIP);
  });
});

describe('what each festival does', () => {
  it('Songkran cools the farmer down', () => {
    const s = at('songkran');
    s.stamina = 40;
    joinFestival(s);
    expect(s.stamina).toBe(40 + SONGKRAN_STAMINA);
    const fresh = at('songkran');
    joinFestival(fresh);
    expect(fresh.stamina).toBe(MAX_STAMINA);
  });

  it('the rocket festival trades wood for rain tomorrow', () => {
    const s = at('rocket');
    s.forecast = 'heat';
    expect(joinFestival(s).ok).toBe(false); // no wood
    expect(s.forecast).toBe('heat');
    s.village.wood = ROCKET_WOOD + 1;
    expect(joinFestival(s).ok).toBe(true);
    expect(s.village.wood).toBe(1);
    expect(s.forecast).toBe('rain');

    const stormy = at('rocket');
    stormy.village.wood = ROCKET_WOOD;
    stormy.forecast = 'storm';
    joinFestival(stormy);
    expect(stormy.forecast).toBe('storm'); // already wet: left alone
  });

  it('the ploughing ceremony gives seedlings and blesses rice that is still growing', () => {
    const s = at('ploughing');
    const [growing, ripe, dead] = s.estate.paddy.plots;
    Object.assign(growing, { stage: 'planted', growth: 3, stress: 2 });
    Object.assign(ripe, { stage: 'planted', growth: 10 });
    Object.assign(dead, { stage: 'planted', growth: 4, dead: true });
    expect(joinFestival(s).ok).toBe(true);
    expect(s.estate.paddy.seedlings).toBe(1);
    expect(growing).toMatchObject({ growth: 4, stress: 0 });
    expect(ripe.growth).toBe(10);
    expect(dead.growth).toBe(4);
  });

  it('the boat race costs stamina and pays by the luck of the day', () => {
    const win = at('boatRace');
    expect(joinFestival(win, () => 0).ok).toBe(true);
    expect(win.stamina).toBe(MAX_STAMINA - BOAT_RACE.stamina);
    expect(win.money).toBe(START_MONEY + BOAT_RACE.prize);

    const lose = at('boatRace');
    joinFestival(lose, () => 0.99);
    expect(lose.money).toBe(START_MONEY + BOAT_RACE.consolation);

    const tired = at('boatRace');
    tired.stamina = BOAT_RACE.stamina - 1;
    expect(joinFestival(tired, () => 0).ok).toBe(false);
    expect(tired.money).toBe(START_MONEY);
    expect(tired.estate.festivals.joined.boatRace).toBe(0);
  });

  it('Yi Peng costs a lantern', () => {
    const s = at('yiPeng');
    joinFestival(s);
    expect(s.money).toBe(START_MONEY - LANTERN_PRICE);
    const broke = at('yiPeng');
    broke.money = LANTERN_PRICE - 1;
    expect(joinFestival(broke).ok).toBe(false);
    expect(broke.village.people.mali.points).toBe(0);
  });

  it('the harvest fair takes the single best thing in the bag and pays four times its price', () => {
    const s = at('harvestFair');
    expect(joinFestival(s).ok).toBe(false); // empty bag
    s.produce.morningGlory = 3;
    s.produce.tomato = 1;
    s.estate.goods.rice = 5;
    expect(joinFestival(s).ok).toBe(true);
    expect(s.produce.tomato).toBe(0);
    expect(s.produce.morningGlory).toBe(3);
    expect(s.estate.goods.rice).toBe(5);
    expect(s.money).toBe(START_MONEY + CROPS.tomato.sellPrice * FAIR_PRIZE_FACTOR);

    const fruit = at('harvestFair');
    fruit.produce.morningGlory = 1;
    fruit.estate.goods.longan = 2;
    joinFestival(fruit);
    expect(fruit.estate.goods.longan).toBe(1);
    expect(fruit.money).toBe(START_MONEY + GOODS.longan.price * FAIR_PRIZE_FACTOR);
  });
});
