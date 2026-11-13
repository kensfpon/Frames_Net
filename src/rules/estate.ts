import type { TreeId } from '../data/orchard';
import type { Gate } from '../data/paddy';
import type { Rng } from './calendar';
import { festivalNotes, joinFestival, newFestivals, validFestivals, type Festivals } from './festival';
import { emptyGoods, validGoods, type GoodCounts } from './goods';
import {
  buySapling,
  fellTree,
  fertilize,
  newOrchard,
  orchardNight,
  pickFruit,
  plantTree,
  validOrchard,
  waterTree,
  type Orchard,
} from './orchard';
import { isRecord, refuse, type Outcome } from './outcome';
import {
  buySeedlings,
  harvestRice,
  newPaddy,
  paddyNight,
  plough,
  setGate,
  transplant,
  validPaddy,
  type Paddy,
} from './paddy';
import type { GameState } from './state';

/** Everything beyond the vegetable bed: the rice paddy, the orchard, their harvest and the festivals. */
export interface Estate {
  paddy: Paddy;
  orchard: Orchard;
  festivals: Festivals;
  goods: GoodCounts; // rice and fruit carried in the bag
  goodsShipping: GoodCounts; // rice and fruit in the shipping crate, paid next morning
}

export function newEstate(): Estate {
  return {
    paddy: newPaddy(),
    orchard: newOrchard(),
    festivals: newFestivals(),
    goods: emptyGoods(),
    goodsShipping: emptyGoods(),
  };
}

export function validEstate(v: unknown): v is Estate {
  return (
    isRecord(v) &&
    validPaddy(v.paddy) &&
    validOrchard(v.orchard) &&
    validFestivals(v.festivals) &&
    validGoods(v.goods) &&
    validGoods(v.goodsShipping)
  );
}

/**
 * The night's work in the paddy and the orchard, plus the festival notice board.
 * Call it from endDay once the new day and its weather are set. Returns lines for the morning summary.
 */
export function estateNight(state: GameState): string[] {
  return [...paddyNight(state, state.weather), ...orchardNight(state, state.weather), ...festivalNotes(state.day)];
}

const UNKNOWN = refuse('ยังทำสิ่งนี้ไม่ได้');

/**
 * Run a chore named by a string, so the interface can put it straight on a button:
 *
 *   paddy:buy                    paddy:plough:<plot>      paddy:plant:<plot>
 *   paddy:gate:<plot>:<gate>     paddy:harvest:<plot>
 *   orchard:buy:<tree>           orchard:plant:<slot>:<tree>
 *   orchard:water:<slot>         orchard:feed:<slot>
 *   orchard:pick:<slot>          orchard:fell:<slot>
 *   festival:join
 *
 * Plots and slots count from 0. Anything else is refused without touching the state.
 */
export function chore(state: GameState, action: string, rng: Rng = Math.random): Outcome {
  const [area, verb, a, b] = action.split(':');
  const index = a === undefined || a === '' ? NaN : Number(a);

  if (area === 'paddy') {
    if (verb === 'buy') return buySeedlings(state);
    if (!Number.isInteger(index)) return UNKNOWN;
    if (verb === 'plough') return plough(state, index);
    if (verb === 'plant') return transplant(state, index);
    if (verb === 'gate') return setGate(state, index, b as Gate);
    if (verb === 'harvest') return harvestRice(state, index);
  }
  if (area === 'orchard') {
    if (verb === 'buy') return buySapling(state, a as TreeId);
    if (!Number.isInteger(index)) return UNKNOWN;
    if (verb === 'plant') return plantTree(state, index, b as TreeId);
    if (verb === 'water') return waterTree(state, index);
    if (verb === 'feed') return fertilize(state, index);
    if (verb === 'pick') return pickFruit(state, index);
    if (verb === 'fell') return fellTree(state, index);
  }
  if (area === 'festival' && verb === 'join') return joinFestival(state, rng);
  return UNKNOWN;
}
