import type { Season, Weather } from '../data/balance';
import { GOODS } from '../data/goods';
import {
  FELLED_WOOD,
  FERTILIZER,
  ORCHARD_SLOTS,
  ORCHARD_STAMINA,
  STORM_DROP,
  TREES,
  TREE_IDS,
  TREE_MAX_FRUIT,
  type TreeId,
} from '../data/orchard';
import { staminaCost } from './actions';
import { isWet, seasonOf } from './calendar';
import { NO_MONEY, TOO_TIRED, done, effort, isRecord, isWhole, pay, refuse, spend, type Outcome } from './outcome';
import type { GameState } from './state';

/**
 * A fruit tree. A sapling needs watering (or rain) on enough days to grow up; after that it
 * looks after itself, lives through every season and bears fruit when its season comes round.
 */
export interface Tree {
  id: TreeId;
  age: number; // watered days so far, up to growDays
  watered: boolean; // today, by hand or by rain; only matters while young
  bloom: number; // in-season nights since the last harvest set
  fruit: number; // ripe fruit hanging on the tree
  fed: boolean; // manured: the next harvest set is bigger
}

export interface Orchard {
  slots: (Tree | null)[];
  saplings: Record<TreeId, number>;
}

export function newOrchard(): Orchard {
  const saplings = {} as Record<TreeId, number>;
  for (const id of TREE_IDS) saplings[id] = 0;
  return { slots: Array.from({ length: ORCHARD_SLOTS }, () => null), saplings };
}

export function isGrown(tree: Tree): boolean {
  return tree.age >= TREES[tree.id].growDays;
}

export function bearsIn(tree: Tree, season: Season): boolean {
  return isGrown(tree) && TREES[tree.id].seasons.includes(season);
}

/** Nights until the tree sets its next fruit, or null when it is young or out of season. */
export function nightsToFruit(tree: Tree, season: Season): number | null {
  return bearsIn(tree, season) ? TREES[tree.id].cycle - tree.bloom : null;
}

const NO_SLOT = refuse('ไม่มีหลุมปลูกนี้');
const EMPTY_SLOT = refuse('หลุมนี้ยังไม่มีต้นไม้');
const inRange = (state: GameState, slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < state.estate.orchard.slots.length;

export function buySapling(state: GameState, id: TreeId): Outcome {
  if (!TREE_IDS.includes(id)) return refuse('ไม่มีกิ่งพันธุ์นี้ขาย');
  if (!pay(state, TREES[id].saplingPrice)) return refuse(NO_MONEY);
  state.estate.orchard.saplings[id] += 1;
  return done('ซื้อกิ่งพันธุ์' + TREES[id].name + 'แล้ว');
}

export function plantTree(state: GameState, slot: number, id: TreeId): Outcome {
  const orchard = state.estate.orchard;
  if (!inRange(state, slot)) return NO_SLOT;
  if (!TREE_IDS.includes(id)) return refuse('ไม่มีกิ่งพันธุ์นี้');
  if (orchard.slots[slot]) return refuse('หลุมนี้มีต้นไม้อยู่แล้ว');
  if (orchard.saplings[id] < 1) return refuse('ยังไม่มีกิ่งพันธุ์' + TREES[id].name);
  if (!spend(state, effort(state, ORCHARD_STAMINA.plant))) return refuse(TOO_TIRED);
  orchard.saplings[id] -= 1;
  // A sapling set in the rain is watered already.
  orchard.slots[slot] = { id, age: 0, watered: isWet(state.weather), bloom: 0, fruit: 0, fed: false };
  return done('ปลูก' + TREES[id].name + 'แล้ว รดน้ำ ' + TREES[id].growDays + ' วันจนโต');
}

export function waterTree(state: GameState, slot: number): Outcome {
  if (!inRange(state, slot)) return NO_SLOT;
  const tree = state.estate.orchard.slots[slot];
  if (!tree) return EMPTY_SLOT;
  if (isGrown(tree)) return refuse('ต้นโตแล้ว รากลึกพอ ไม่ต้องรดน้ำ');
  if (tree.watered) return refuse('ต้นนี้ได้น้ำแล้ววันนี้');
  if (!spend(state, staminaCost(state, 'water'))) return refuse(TOO_TIRED);
  tree.watered = true;
  return done('รดน้ำต้น' + TREES[tree.id].name + 'แล้ว');
}

/** Manure a grown tree: its next harvest set gives extra fruit. */
export function fertilize(state: GameState, slot: number): Outcome {
  if (!inRange(state, slot)) return NO_SLOT;
  const tree = state.estate.orchard.slots[slot];
  if (!tree) return EMPTY_SLOT;
  if (!isGrown(tree)) return refuse('ต้นยังเล็ก รอให้โตก่อนค่อยใส่ปุ๋ย');
  if (tree.fed) return refuse('ต้นนี้ใส่ปุ๋ยแล้ว รอเก็บผลรอบถัดไป');
  if (!pay(state, FERTILIZER.price)) return refuse(NO_MONEY);
  tree.fed = true;
  return done('ใส่ปุ๋ยคอกแล้ว รอบหน้าได้ผลเพิ่ม ' + FERTILIZER.bonus);
}

export function pickFruit(state: GameState, slot: number): Outcome {
  if (!inRange(state, slot)) return NO_SLOT;
  const tree = state.estate.orchard.slots[slot];
  if (!tree) return EMPTY_SLOT;
  if (tree.fruit < 1) return refuse('ต้นนี้ยังไม่มีผลสุก');
  if (!spend(state, effort(state, ORCHARD_STAMINA.pick))) return refuse(TOO_TIRED);
  const good = TREES[tree.id].fruit;
  const count = tree.fruit;
  state.estate.goods[good] += count;
  tree.fruit = 0;
  return done('เก็บ' + GOODS[good].name + ' ' + count + ' ' + GOODS[good].unit + ' ใส่ลังส่งของเพื่อขาย');
}

/** Cut a tree down to free its slot. Unpicked fruit is lost; a grown tree leaves some wood. */
export function fellTree(state: GameState, slot: number): Outcome {
  if (!inRange(state, slot)) return NO_SLOT;
  const tree = state.estate.orchard.slots[slot];
  if (!tree) return EMPTY_SLOT;
  if (!spend(state, effort(state, ORCHARD_STAMINA.fell, true))) return refuse(TOO_TIRED);
  const wood = isGrown(tree) ? FELLED_WOOD : 0;
  state.village.wood += wood;
  state.estate.orchard.slots[slot] = null;
  return done('โค่นต้น' + TREES[tree.id].name + 'แล้ว' + (wood ? ' ได้ไม้ ×' + wood : ''));
}

/**
 * One night in the orchard. Call it once the new day and its weather are set.
 * Returns lines for the morning summary.
 */
export function orchardNight(state: GameState, weather: Weather): string[] {
  const season = seasonOf(state.day);
  const notes: string[] = [];
  let dropped = 0;
  for (const tree of state.estate.orchard.slots) {
    if (!tree) continue;
    const def = TREES[tree.id];
    if (!isGrown(tree)) {
      if (tree.watered) {
        tree.age += 1;
        if (isGrown(tree)) notes.push('ต้น' + def.name + 'โตเต็มที่แล้ว จะออกผลเมื่อถึงฤดู');
      }
    } else if (def.seasons.includes(season)) {
      tree.bloom += 1;
      if (tree.bloom >= def.cycle) {
        tree.bloom = 0;
        tree.fruit = Math.min(TREE_MAX_FRUIT, tree.fruit + def.yield + (tree.fed ? FERTILIZER.bonus : 0));
        tree.fed = false;
      }
    } else {
      tree.bloom = 0;
    }
    if (weather === 'storm' && tree.fruit > 0) {
      const lost = Math.ceil(tree.fruit * STORM_DROP);
      tree.fruit -= lost;
      dropped += lost;
    }
    tree.watered = isWet(weather);
  }
  if (dropped) notes.push('พายุฝนพัดผลไม้ในสวนร่วง ' + dropped + ' ผล');
  return notes;
}

function validTree(v: unknown): v is Tree {
  if (!isRecord(v)) return false;
  const id = v.id as TreeId;
  return (
    TREE_IDS.includes(id) &&
    isWhole(v.age) &&
    v.age <= TREES[id].growDays &&
    typeof v.watered === 'boolean' &&
    isWhole(v.bloom) &&
    isWhole(v.fruit) &&
    v.fruit <= TREE_MAX_FRUIT &&
    typeof v.fed === 'boolean'
  );
}

export function validOrchard(v: unknown): v is Orchard {
  if (!isRecord(v) || !Array.isArray(v.slots) || v.slots.length !== ORCHARD_SLOTS) return false;
  if (!v.slots.every((slot) => slot === null || validTree(slot))) return false;
  const saplings = v.saplings;
  return isRecord(saplings) && TREE_IDS.every((id) => isWhole(saplings[id]));
}
