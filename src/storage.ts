import { deserialize, serialize } from './rules/save';
import type { GameState } from './rules/state';

const KEY = 'farm-game-save';

export type LoadResult = { status: 'none' } | { status: 'ok'; state: GameState } | { status: 'corrupt' };

export function loadGame(): LoadResult {
  let text: string | null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    return { status: 'none' };
  }
  if (text === null) return { status: 'none' };
  const state = deserialize(text);
  return state ? { status: 'ok', state } : { status: 'corrupt' };
}

/** Returns false when the browser refuses to store the save. */
export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}
