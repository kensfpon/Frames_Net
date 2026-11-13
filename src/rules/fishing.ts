import { BITE_WAIT_MS, FISH, FISH_IDS, WET_WAIT_FACTOR, type FishId } from '../data/fish';
import { inBounds, objectAt } from '../data/map';
import { staminaCost, type ActionResult } from './actions';
import { isWet, seasonOf, type Rng } from './calendar';
import type { GameState } from './state';

/** Fish that can bite right now, given the season, the hour and the weather. */
export type Water = 'farm' | 'lake' | 'sea';
export function availableFish(state: GameState, water: Water = 'farm'): FishId[] {
  const season = seasonOf(state.day);
  const wet = isWet(state.weather);
  return FISH_IDS.filter((id) => {
    const f = FISH[id];
    if (
      water === 'sea'
        ? f.habitat !== 'sea'
        : water === 'lake'
          ? f.habitat === 'sea'
          : f.habitat !== undefined
    )
      return false;
    if (!f.seasons.includes(season)) return false;
    const inHours = state.minutes >= f.from && state.minutes < f.to;
    return inHours || (f.wetAllDay && wet);
  });
}

/** Pick which fish takes the hook, weighted by how common each one is. */
export function rollFish(state: GameState, rng: Rng, water: Water = 'farm'): FishId {
  const pool = availableFish(state, water);
  const total = pool.reduce((sum, id) => sum + FISH[id].weight, 0);
  let roll = rng() * total;
  for (const id of pool) {
    if (roll < FISH[id].weight) return id;
    roll -= FISH[id].weight;
  }
  return pool[pool.length - 1];
}

export function rollBiteDelayMs(state: GameState, rng: Rng): number {
  const base = BITE_WAIT_MS.min + rng() * (BITE_WAIT_MS.max - BITE_WAIT_MS.min);
  return base * (isWet(state.weather) ? WET_WAIT_FACTOR : 1) * (state.country.rod ? 0.72 : 1);
}

/** Cast the line at a tile. Costs stamina whether or not a fish is landed. */
export function castLine(state: GameState, col: number, row: number): ActionResult {
  if (!inBounds(col, row) || objectAt(col, row)?.id !== 'pond') return { ok: false, reason: 'notWater' };
  return spendCast(state);
}
export function spendCast(state: GameState): ActionResult {
  const cost = staminaCost(state, 'fish');
  if (state.stamina < cost) return { ok: false, reason: 'tired' };
  state.stamina -= cost;
  return { ok: true };
}

export function landFish(state: GameState, fish: FishId): void {
  state.fish[fish] += 1;
}
