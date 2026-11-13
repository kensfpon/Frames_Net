// Tunable numbers for the orchard.

import type { Season } from './balance';
import type { GoodId } from './goods';

export type TreeId = 'banana' | 'mango' | 'longan' | 'orange';

export interface TreeDef {
  name: string;
  fruit: GoodId;
  saplingPrice: number;
  growDays: number; // watered days from sapling to a bearing tree
  seasons: Season[]; // when a grown tree bears fruit
  cycle: number; // days between harvests while in season
  yield: number; // fruit per harvest
}

export const TREES: Record<TreeId, TreeDef> = {
  banana: {
    name: 'กล้วยน้ำว้า',
    fruit: 'banana',
    saplingPrice: 40,
    growDays: 6,
    seasons: ['hot', 'rainy', 'cool'],
    cycle: 5,
    yield: 2,
  },
  mango: {
    name: 'มะม่วงน้ำดอกไม้',
    fruit: 'mango',
    saplingPrice: 120,
    growDays: 10,
    seasons: ['hot'],
    cycle: 3,
    yield: 3,
  },
  longan: {
    name: 'ลำไย',
    fruit: 'longan',
    saplingPrice: 150,
    growDays: 12,
    seasons: ['rainy'],
    cycle: 3,
    yield: 3,
  },
  orange: {
    name: 'ส้มสายน้ำผึ้ง',
    fruit: 'orange',
    saplingPrice: 140,
    growDays: 12,
    seasons: ['cool'],
    cycle: 3,
    yield: 3,
  },
};

export const TREE_IDS = Object.keys(TREES) as TreeId[];

export const ORCHARD_SLOTS = 6;
/** Fruit left unpicked stops piling up here. */
export const TREE_MAX_FRUIT = 9;
/** Manure makes the next harvest of one tree bigger. */
export const FERTILIZER = { price: 15, bonus: 2 };
/** A storm knocks down this share of the fruit hanging on every tree, rounded up. */
export const STORM_DROP = 0.5;
/** Watering a young tree costs the same as watering a vegetable tile. */
export const ORCHARD_STAMINA = { plant: 6, pick: 2, fell: 5 };
/** Bamboo-grade wood from felling a grown tree. */
export const FELLED_WOOD = 2;
