import {
  CROPS,
  CROP_IDS,
  HEAT_EXTRA_STAMINA,
  SHOP_CLOSE_MINUTES,
  SHOP_OPEN_MINUTES,
  STAMINA_COST,
  type CropId,
} from '../data/balance';
import { inBounds, isFarmable, objectAt } from '../data/map';
import { inSeason, isWet, seasonOf } from './calendar';
import type { GameState } from './state';

export type Tool = { kind: 'hoe' } | { kind: 'can' } | { kind: 'hand' } | { kind: 'seed'; crop: CropId };

export type FailReason =
  | 'tired'
  | 'notField'
  | 'notGrass'
  | 'notTilled'
  | 'alreadyWatered'
  | 'occupied'
  | 'noSeed'
  | 'outOfSeason'
  | 'nothingToHarvest'
  | 'notRipe'
  | 'shopClosed'
  | 'shopStorm'
  | 'notSold'
  | 'noMoney'
  | 'nothingToShip';

export type ActionResult = { ok: true } | { ok: false; reason: FailReason };

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

/** What an action costs today; hot days make all work harder. */
export function staminaCost(state: GameState, action: keyof typeof STAMINA_COST): number {
  return STAMINA_COST[action] + (state.weather === 'heat' ? HEAT_EXTRA_STAMINA : 0);
}

function spend(state: GameState, action: keyof typeof STAMINA_COST): boolean {
  const cost = staminaCost(state, action);
  if (state.stamina < cost) return false;
  state.stamina -= cost;
  return true;
}

export function isRipe(state: GameState, col: number, row: number): boolean {
  const crop = state.tiles[row][col].crop;
  return crop !== null && !crop.withered && crop.growth >= CROPS[crop.id].days;
}

/** Use the held tool on a tile. Mutates state only when the action succeeds. */
export function useTool(state: GameState, tool: Tool, col: number, row: number): ActionResult {
  if (!inBounds(col, row) || !isFarmable(col, row) || objectAt(col, row)) return fail('notField');
  const tile = state.tiles[row][col];

  // Clearing a withered plant is free with either the hoe or bare hands.
  if (tile.crop?.withered && (tool.kind === 'hoe' || tool.kind === 'hand')) {
    tile.crop = null;
    return OK;
  }

  switch (tool.kind) {
    case 'hoe':
      if (tile.kind !== 'grass') return fail('notGrass');
      if (!spend(state, 'hoe')) return fail('tired');
      tile.kind = 'tilled';
      tile.watered = isWet(state.weather); // freshly turned soil gets rained on too
      return OK;

    case 'can':
      if (tile.kind !== 'tilled') return fail('notTilled');
      if (tile.watered) return fail('alreadyWatered');
      if (!spend(state, 'water')) return fail('tired');
      tile.watered = true;
      return OK;

    case 'seed':
      if (tile.kind !== 'tilled') return fail('notTilled');
      if (tile.crop) return fail('occupied');
      if (state.seeds[tool.crop] <= 0) return fail('noSeed');
      if (!inSeason(tool.crop, seasonOf(state.day))) return fail('outOfSeason');
      if (!spend(state, 'plant')) return fail('tired');
      state.seeds[tool.crop] -= 1;
      tile.crop = { id: tool.crop, growth: 0, withered: false };
      return OK;

    case 'hand':
      if (!tile.crop) return fail('nothingToHarvest');
      if (!isRipe(state, col, row)) return fail('notRipe');
      if (!spend(state, 'harvest')) return fail('tired');
      state.produce[tile.crop.id] += 1;
      tile.crop = null;
      return OK;
  }
}

/** null when the stall is open, otherwise why it is shut. */
export function shopClosedReason(state: GameState): 'shopStorm' | 'shopClosed' | null {
  if (state.weather === 'storm') return 'shopStorm';
  if (state.minutes < SHOP_OPEN_MINUTES || state.minutes >= SHOP_CLOSE_MINUTES) return 'shopClosed';
  return null;
}

/** Seeds the stall sells today: only crops that can be planted this season. */
export function seedsForSale(state: GameState): CropId[] {
  const season = seasonOf(state.day);
  return CROP_IDS.filter((id) => inSeason(id, season));
}

export function buySeed(state: GameState, crop: CropId): ActionResult {
  const closed = shopClosedReason(state);
  if (closed) return fail(closed);
  if (!seedsForSale(state).includes(crop)) return fail('notSold');
  const price = CROPS[crop].seedPrice;
  if (state.money < price) return fail('noMoney');
  state.money -= price;
  state.seeds[crop] += 1;
  return OK;
}

/** Move all carried produce into the shipping crate. Returns how many items were moved. */
export function shipAll(state: GameState): number {
  let moved = 0;
  for (const id of CROP_IDS) {
    moved += state.produce[id];
    state.shipping[id] += state.produce[id];
    state.produce[id] = 0;
  }
  return moved;
}
