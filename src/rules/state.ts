import { GRID_COLS, GRID_ROWS } from '../config';
import { CROP_IDS, DAY_START_MINUTES, MAX_STAMINA, START_MONEY, START_SEEDS, type CropId, type Weather } from '../data/balance';
import { FISH_IDS, type FishId } from '../data/fish';
import { rollWeather, seasonOf, type Rng } from './calendar';

export const SAVE_VERSION = 3;

export interface Crop {
  id: CropId;
  growth: number; // watered days so far
  withered: boolean; // killed by a season change; must be cleared
}

export interface Tile {
  kind: 'grass' | 'tilled';
  watered: boolean;
  crop: Crop | null;
}

export type Counts = Record<CropId, number>;
export type FishCounts = Record<FishId, number>;

/** The whole game as plain JSON-serialisable data. */
export interface GameState {
  version: number;
  day: number; // counts up forever; season and year are derived from it
  minutes: number; // minutes since midnight
  money: number;
  stamina: number;
  weather: Weather; // today
  forecast: Weather; // tomorrow
  tiles: Tile[][]; // [row][col]
  seeds: Counts;
  produce: Counts;
  shipping: Counts; // produce in the shipping crate, paid next morning
  fish: FishCounts; // fish carried in the bag
  fishShipping: FishCounts; // fish in the shipping crate
}

export function emptyCounts(): Counts {
  const c = {} as Counts;
  for (const id of CROP_IDS) c[id] = 0;
  return c;
}

export function emptyFishCounts(): FishCounts {
  const c = {} as FishCounts;
  for (const id of FISH_IDS) c[id] = 0;
  return c;
}

export function createNewGame(rng: Rng = Math.random): GameState {
  const tiles: Tile[][] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const line: Tile[] = [];
    for (let col = 0; col < GRID_COLS; col++) line.push({ kind: 'grass', watered: false, crop: null });
    tiles.push(line);
  }
  return {
    version: SAVE_VERSION,
    day: 1,
    minutes: DAY_START_MINUTES,
    money: START_MONEY,
    stamina: MAX_STAMINA,
    weather: 'sunny', // the first day is always gentle
    forecast: rollWeather(seasonOf(2), rng),
    tiles,
    seeds: { ...emptyCounts(), ...START_SEEDS },
    produce: emptyCounts(),
    shipping: emptyCounts(),
    fish: emptyFishCounts(),
    fishShipping: emptyFishCounts(),
  };
}
