import { GRID_COLS, GRID_ROWS } from '../config';
import { CROPS, CROP_IDS, WEATHER_NAMES } from '../data/balance';
import { SAVE_VERSION, type Counts, type GameState, type Tile } from './state';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isWeather = (w: unknown): boolean => typeof w === 'string' && w in WEATHER_NAMES;

function validCounts(c: unknown): c is Counts {
  return isObject(c) && CROP_IDS.every((id) => isCount(c[id]));
}

function validTile(t: unknown): t is Tile {
  if (!isObject(t)) return false;
  if (t.kind !== 'grass' && t.kind !== 'tilled') return false;
  if (typeof t.watered !== 'boolean') return false;
  if (t.crop === null) return true;
  const crop = t.crop;
  if (!isObject(crop)) return false;
  return typeof crop.id === 'string' && crop.id in CROPS && isCount(crop.growth) && typeof crop.withered === 'boolean';
}

/**
 * Version 1 -> 2: seasons and weather arrived. Old saves get calm weather,
 * zero counts for the new crops, and no withered plants.
 */
function migrateV1toV2(s: Raw): void {
  s.weather = 'sunny';
  s.forecast = 'sunny';
  for (const key of ['seeds', 'produce', 'shipping']) {
    const counts = s[key];
    if (!isObject(counts)) continue;
    for (const id of CROP_IDS) if (counts[id] === undefined) counts[id] = 0;
  }
  if (Array.isArray(s.tiles)) {
    for (const row of s.tiles) {
      if (!Array.isArray(row)) continue;
      for (const tile of row) {
        if (isObject(tile) && isObject(tile.crop) && tile.crop.withered === undefined) tile.crop.withered = false;
      }
    }
  }
  s.version = 2;
}

/** Parse a save string. Returns null when it is missing, corrupt or from an unknown version. */
export function deserialize(text: string | null): GameState | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  const s = data;
  if (s.version === 1) migrateV1toV2(s);
  if (s.version !== SAVE_VERSION) return null;
  if (!isCount(s.day) || s.day < 1 || !isCount(s.minutes) || !isCount(s.money) || !isCount(s.stamina)) return null;
  if (!isWeather(s.weather) || !isWeather(s.forecast)) return null;
  if (!validCounts(s.seeds) || !validCounts(s.produce) || !validCounts(s.shipping)) return null;
  if (!Array.isArray(s.tiles) || s.tiles.length !== GRID_ROWS) return null;
  for (const row of s.tiles) {
    if (!Array.isArray(row) || row.length !== GRID_COLS || !row.every(validTile)) return null;
  }
  return data as unknown as GameState;
}
