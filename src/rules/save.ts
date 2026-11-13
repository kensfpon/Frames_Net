import { GRID_COLS, GRID_ROWS } from '../config';
import { CROPS, CROP_IDS, WEATHER_NAMES } from '../data/balance';
import { FISH_IDS } from '../data/fish';
import { SAVE_VERSION, type Counts, type GameState, type Tile } from './state';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

import { newCountry, validCountry, MARKET_CROPS } from './country';
import { FISH } from '../data/fish';
import { newVillage } from './village';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isWeather = (w: unknown): boolean => typeof w === 'string' && w in WEATHER_NAMES;

function validCounts(c: unknown): c is Counts {
  return isObject(c) && CROP_IDS.every((id) => isCount(c[id]));
}

function validFishCounts(c: unknown): boolean {
  return isObject(c) && FISH_IDS.every((id) => isCount(c[id]));
}

function validTile(t: unknown): t is Tile {
  if (!isObject(t)) return false;
  if (t.kind !== 'grass' && t.kind !== 'tilled') return false;
  if (typeof t.watered !== 'boolean') return false;
  if (t.crop === null) return true;
  const crop = t.crop;
  if (!isObject(crop)) return false;
  return (
    typeof crop.id === 'string' &&
    crop.id in CROPS &&
    isCount(crop.growth) &&
    typeof crop.withered === 'boolean'
  );
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
        if (isObject(tile) && isObject(tile.crop) && tile.crop.withered === undefined)
          tile.crop.withered = false;
      }
    }
  }
  s.version = 2;
}

/** Version 2 -> 3: fishing arrived. Old saves start with no fish. */
function migrateV2toV3(s: Raw): void {
  const none = (): Record<string, number> => Object.fromEntries(FISH_IDS.map((id) => [id, 0]));
  s.fish = none();
  s.fishShipping = none();
  s.version = 3;
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
  if (s.version === 2) migrateV2toV3(s);
  if (s.version !== SAVE_VERSION) return null;
  if (!isCount(s.day) || s.day < 1 || !isCount(s.minutes) || !isCount(s.money) || !isCount(s.stamina))
    return null;
  if (!isWeather(s.weather) || !isWeather(s.forecast)) return null;
  if (s.country === undefined) {
    s.country = newCountry();
    for (const k of ['seeds', 'produce', 'shipping']) {
      const bag = s[k];
      if (isObject(bag)) for (const id of MARKET_CROPS) bag[id] ??= 0;
    }
    for (const k of ['fish', 'fishShipping']) {
      const bag = s[k];
      if (isObject(bag)) for (const id of FISH_IDS) if (FISH[id].habitat) bag[id] ??= 0;
    }
  }
  if (!validCountry(s.country)) return null;
  if (!validCounts(s.seeds) || !validCounts(s.produce) || !validCounts(s.shipping)) return null;
  if (!validFishCounts(s.fish) || !validFishCounts(s.fishShipping)) return null;
  if (!Array.isArray(s.tiles) || s.tiles.length !== GRID_ROWS) return null;
  for (const row of s.tiles) {
    if (!Array.isArray(row) || row.length !== GRID_COLS || !row.every(validTile)) return null;
  }
  if (s.village === undefined) s.village = newVillage();
  const village = s.village;
  if (!isObject(village) || typeof village.coop !== 'boolean') return null;
  const counts = ['wood', 'stone', 'berry', 'eggs', 'eggsShipping', 'nest', 'fed', 'orderDay'];
  const whole = (n: unknown) => isCount(n) && Number.isSafeInteger(n);
  if (!counts.every((k) => whole(village[k]))) return null;
  const { gathered, people } = village;
  if (!isObject(gathered) || !['wood', 'stone', 'berry'].every((k) => whole(gathered[k]))) return null;
  if (
    !isObject(people) ||
    !['mali', 'chai'].every((k) => {
      const f = people[k];
      return (
        isObject(f) && whole(f.points) && Number(f.points) <= 20 && whole(f.talked) && whole(f.gifted)
      );
    })
  )
    return null;
  return data as unknown as GameState;
}
