import { GRID_COLS, GRID_ROWS } from '../config';
import { CROP_IDS, DAY_START_MINUTES, MAX_STAMINA, START_MONEY, START_SEEDS, type CropId, type Weather } from '../data/balance';
import { rollWeather, seasonOf, type Rng } from './calendar';

export const SAVE_VERSION = 2;

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
}

export function emptyCounts(): Counts {
  const c = {} as Counts;
  for (const id of CROP_IDS) c[id] = 0;
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
  };
}
