import { HEAT_EXTRA_STAMINA } from '../data/balance';
import type { GameState } from './state';

/** What a chore did, with a line of Thai for the player. State changes only when ok is true. */
export interface Outcome {
  ok: boolean;
  message: string;
}

export const done = (message: string): Outcome => ({ ok: true, message });
export const refuse = (message: string): Outcome => ({ ok: false, message });

export const TOO_TIRED = 'พลังงานไม่พอ กลับไปพักที่บ้านก่อน';
export const NO_MONEY = 'เงินไม่พอ';

/** Stamina a job costs today. Hot days make all work harder, heavy field work most of all. */
export function effort(state: GameState, base: number, heavy = false): number {
  return base + (state.weather === 'heat' ? HEAT_EXTRA_STAMINA * (heavy ? 3 : 1) : 0);
}

/** Take stamina for a job. Returns false, and takes nothing, when the player is too tired. */
export function spend(state: GameState, cost: number): boolean {
  if (state.stamina < cost) return false;
  state.stamina -= cost;
  return true;
}

export function pay(state: GameState, price: number): boolean {
  if (state.money < price) return false;
  state.money -= price;
  return true;
}

// Small checks shared by the save validators.
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const isWhole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
