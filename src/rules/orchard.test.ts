import { describe, expect, it } from 'vitest';
import { MAX_STAMINA, START_MONEY, STAMINA_COST } from '../data/balance';
import { FELLED_WOOD, FERTILIZER, ORCHARD_SLOTS, ORCHARD_STAMINA, TREES, TREE_MAX_FRUIT, type TreeId } from '../data/orchard';
import {
  bearsIn,
  buySapling,
  fellTree,
  fertilize,
  isGrown,
  nightsToFruit,
  orchardNight,
  pickFruit,
  plantTree,
  waterTree,
  type Tree,
} from './orchard';
import { createNewGame, type GameState } from './state';

const SUN = () => 0;
const newGame = () => createNewGame(SUN);
const tree = (s: GameState, slot = 0) => s.estate.orchard.slots[slot] as Tree;

/** A game with a full-grown tree of this kind in the first slot. */
function grown(id: TreeId) {
  const s = newGame();
  s.estate.orchard.slots[0] = { id, age: TREES[id].growDays, watered: false, bloom: 0, fruit: 0, fed: false };
  return s;
}

function nights(s: GameState, count: number) {
  for (let i = 0; i < count; i++) orchardNight(s, 'sunny');
}

describe('orchard planting', () => {
  it('buys saplings for money and refuses unknown trees', () => {
    const s = newGame();
    expect(buySapling(s, 'banana').ok).toBe(true);
    expect(s.money).toBe(START_MONEY - TREES.banana.saplingPrice);
    expect(s.estate.orchard.saplings.banana).toBe(1);
    expect(buySapling(s, 'durian' as never).ok).toBe(false);
    s.money = 0;
    expect(buySapling(s, 'mango').ok).toBe(false);
    expect(s.estate.orchard.saplings.mango).toBe(0);
  });

  it('plants a sapling in an empty slot and uses it up', () => {
    const s = newGame();
    expect(plantTree(s, 0, 'banana').ok).toBe(false); // no sapling yet
    s.estate.orchard.saplings.banana = 2;
    expect(plantTree(s, 0, 'banana').ok).toBe(true);
    expect(tree(s)).toEqual({ id: 'banana', age: 0, watered: false, bloom: 0, fruit: 0, fed: false });
    expect(s.estate.orchard.saplings.banana).toBe(1);
    expect(s.stamina).toBe(MAX_STAMINA - ORCHARD_STAMINA.plant);
    expect(plantTree(s, 0, 'banana').ok).toBe(false); // occupied
    expect(plantTree(s, ORCHARD_SLOTS, 'banana').ok).toBe(false); // no such slot
    expect(plantTree(s, -1, 'banana').ok).toBe(false);
    expect(s.estate.orchard.saplings.banana).toBe(1);
  });

  it('counts a sapling set in the rain as watered', () => {
    const s = newGame();
    s.weather = 'rain';
    s.estate.orchard.saplings.mango = 1;
    plantTree(s, 2, 'mango');
    expect(tree(s, 2).watered).toBe(true);
    expect(waterTree(s, 2).ok).toBe(false);
  });
});

describe('young trees', () => {
  it('grow only on days they were watered by hand or by rain', () => {
    const s = newGame();
    s.estate.orchard.saplings.banana = 1;
    plantTree(s, 0, 'banana');
    orchardNight(s, 'sunny');
    expect(tree(s).age).toBe(0); // went thirsty

    const before = s.stamina;
    expect(waterTree(s, 0).ok).toBe(true);
    expect(s.stamina).toBe(before - STAMINA_COST.water);
    expect(waterTree(s, 0).ok).toBe(false); // once a day
    orchardNight(s, 'rain');
    expect(tree(s).age).toBe(1);
    expect(tree(s).watered).toBe(true); // today's rain does tomorrow's watering

    orchardNight(s, 'sunny');
    expect(tree(s).age).toBe(2);
    expect(tree(s).watered).toBe(false);
  });

  it('grow up after enough watered days, then need no more water', () => {
    const s = newGame();
    s.estate.orchard.saplings.banana = 1;
    plantTree(s, 0, 'banana');
    let notes: string[] = [];
    for (let day = 0; day < TREES.banana.growDays; day++) {
      expect(isGrown(tree(s))).toBe(false);
      waterTree(s, 0);
      notes = orchardNight(s, 'sunny');
    }
    expect(isGrown(tree(s))).toBe(true);
    expect(notes.join()).toContain('โตเต็มที่');
    expect(waterTree(s, 0).ok).toBe(false);
    expect(fertilize(s, 0).ok).toBe(true);
  });

  it('cannot be manured before they are grown', () => {
    const s = newGame();
    s.estate.orchard.saplings.mango = 1;
    plantTree(s, 0, 'mango');
    expect(fertilize(s, 0).ok).toBe(false);
    expect(s.money).toBe(START_MONEY);
  });
});

describe('fruit', () => {
  it('sets on a grown tree every cycle, in its own season only', () => {
    const s = grown('mango'); // day 1 is the hot season
    expect(bearsIn(tree(s), 'hot')).toBe(true);
    expect(nightsToFruit(tree(s), 'hot')).toBe(TREES.mango.cycle);
    nights(s, TREES.mango.cycle - 1);
    expect(tree(s).fruit).toBe(0);
    expect(nightsToFruit(tree(s), 'hot')).toBe(1);
    nights(s, 1);
    expect(tree(s).fruit).toBe(TREES.mango.yield);

    s.day = 15; // rainy season: the mango rests, but keeps the fruit it has
    expect(nightsToFruit(tree(s), 'rainy')).toBeNull();
    nights(s, TREES.mango.cycle * 2);
    expect(tree(s).fruit).toBe(TREES.mango.yield);
    expect(tree(s).bloom).toBe(0);
  });

  it('gives extra fruit once after manure, for a price', () => {
    const s = grown('mango');
    expect(fertilize(s, 0).ok).toBe(true);
    expect(s.money).toBe(START_MONEY - FERTILIZER.price);
    expect(fertilize(s, 0).ok).toBe(false); // already manured
    nights(s, TREES.mango.cycle);
    expect(tree(s).fruit).toBe(TREES.mango.yield + FERTILIZER.bonus);
    expect(tree(s).fed).toBe(false);
    nights(s, TREES.mango.cycle);
    expect(tree(s).fruit).toBe(TREES.mango.yield * 2 + FERTILIZER.bonus);
  });

  it('stops piling up on a tree nobody picks', () => {
    const s = grown('banana');
    nights(s, TREES.banana.cycle * 10);
    expect(tree(s).fruit).toBe(TREE_MAX_FRUIT);
  });

  it('is knocked down by storms, half of what hangs, rounded up', () => {
    const s = grown('longan');
    s.day = 15;
    tree(s).fruit = 5;
    const notes = orchardNight(s, 'storm');
    expect(tree(s).fruit).toBe(2);
    expect(notes.join()).toContain('ร่วง 3');
    tree(s).fruit = 5;
    expect(orchardNight(s, 'rain')).toEqual([]);
    expect(tree(s).fruit).toBe(5);
  });

  it('goes into the bag when picked and leaves the tree bare', () => {
    const s = grown('orange');
    expect(pickFruit(s, 0).ok).toBe(false); // nothing ripe
    tree(s).fruit = 4;
    expect(pickFruit(s, 0).ok).toBe(true);
    expect(s.estate.goods.orange).toBe(4);
    expect(tree(s).fruit).toBe(0);
    expect(s.stamina).toBe(MAX_STAMINA - ORCHARD_STAMINA.pick);
    expect(pickFruit(s, 3).ok).toBe(false); // empty slot
  });

  it('is left on the tree when the player is too tired to pick', () => {
    const s = grown('orange');
    tree(s).fruit = 4;
    s.stamina = ORCHARD_STAMINA.pick - 1;
    expect(pickFruit(s, 0).ok).toBe(false);
    expect(tree(s).fruit).toBe(4);
    expect(s.estate.goods.orange).toBe(0);
  });
});

describe('felling', () => {
  it('frees the slot and leaves wood only from a grown tree', () => {
    const s = grown('mango');
    expect(fellTree(s, 0).ok).toBe(true);
    expect(s.estate.orchard.slots[0]).toBeNull();
    expect(s.village.wood).toBe(FELLED_WOOD);
    expect(fellTree(s, 0).ok).toBe(false);

    s.estate.orchard.saplings.banana = 1;
    plantTree(s, 0, 'banana');
    fellTree(s, 0);
    expect(s.village.wood).toBe(FELLED_WOOD);
  });
});
