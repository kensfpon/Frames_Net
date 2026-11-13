import { GOODS, GOOD_IDS, type GoodId } from '../data/goods';
import { isRecord, isWhole } from './outcome';
import type { GameState } from './state';

export type GoodCounts = Record<GoodId, number>;

export function emptyGoods(): GoodCounts {
  const c = {} as GoodCounts;
  for (const id of GOOD_IDS) c[id] = 0;
  return c;
}

/** Move carried rice and fruit into the shipping crate. Returns how many units were moved. */
export function shipGoods(state: GameState): number {
  const { goods, goodsShipping } = state.estate;
  let moved = 0;
  for (const id of GOOD_IDS) {
    moved += goods[id];
    goodsShipping[id] += goods[id];
    goods[id] = 0;
  }
  return moved;
}

/** Empty the crate's rice and fruit and say what each line earned. The caller adds the money. */
export function payGoods(state: GameState): { name: string; count: number; amount: number }[] {
  const crate = state.estate.goodsShipping;
  const sold = [];
  for (const id of GOOD_IDS) {
    if (crate[id] > 0) sold.push({ name: GOODS[id].name, count: crate[id], amount: crate[id] * GOODS[id].price });
    crate[id] = 0;
  }
  return sold;
}

export function validGoods(v: unknown): v is GoodCounts {
  return isRecord(v) && GOOD_IDS.every((id) => isWhole(v[id]));
}
