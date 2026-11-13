import {
  CROPS,
  CROP_IDS,
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  MAX_STAMINA,
  PASSED_OUT_STAMINA,
  type Season,
  type Weather,
} from '../data/balance';
import { FISH, FISH_IDS } from '../data/fish';
import { inSeason, isWet, rollWeather, seasonOf, seasonWarning, type Rng } from './calendar';
import type { GameState } from './state';

export interface SoldLine {
  name: string;
  count: number;
  amount: number;
}

export interface DaySummary {
  day: number; // the new day that just started
  sold: SoldLine[];
  total: number;
  passedOut: boolean;
  weather: Weather;
  forecast: Weather;
  newSeason: Season | null; // set on the first morning of a season
  withered: number; // plants killed by the season change this morning
  seasonWarning: number; // days until the season changes, counting today; 0 = no warning
}

/** Advance the clock. Returns true when midnight is reached and the player passes out. */
export function advanceMinutes(state: GameState, minutes: number): boolean {
  state.minutes = Math.min(state.minutes + minutes, DAY_END_MINUTES);
  return state.minutes >= DAY_END_MINUTES;
}

/** Sleep (or pass out): pay for shipped goods, grow watered crops, start the next morning. */
export function endDay(state: GameState, passedOut: boolean, rng: Rng = Math.random): DaySummary {
  const sold: SoldLine[] = [];
  let total = 0;
  for (const id of CROP_IDS) {
    const count = state.shipping[id];
    if (count > 0) {
      const amount = count * CROPS[id].sellPrice;
      sold.push({ name: CROPS[id].name, count, amount });
      total += amount;
    }
    state.shipping[id] = 0;
  }
  for (const id of FISH_IDS) {
    const count = state.fishShipping[id];
    if (count > 0) {
      const amount = count * FISH[id].price;
      sold.push({ name: FISH[id].name, count, amount });
      total += amount;
    }
    state.fishShipping[id] = 0;
  }
  state.money += total;

  const oldSeason = seasonOf(state.day);
  state.day += 1;
  const season = seasonOf(state.day);
  const newSeason = season !== oldSeason ? season : null;
  state.weather = state.forecast;
  state.forecast = rollWeather(seasonOf(state.day + 1), rng);
  const wet = isWet(state.weather);

  let withered = 0;
  for (const row of state.tiles) {
    for (const tile of row) {
      const crop = tile.crop;
      if (crop && !crop.withered) {
        // Yesterday's watering counts first, then the new season takes its toll.
        if (tile.watered) crop.growth = Math.min(crop.growth + 1, CROPS[crop.id].days);
        if (newSeason && !inSeason(crop.id, newSeason)) {
          crop.withered = true;
          withered += 1;
        }
      }
      tile.watered = wet && tile.kind === 'tilled';
    }
  }

  state.minutes = DAY_START_MINUTES;
  state.stamina = passedOut ? PASSED_OUT_STAMINA : MAX_STAMINA;
  return {
    day: state.day,
    sold,
    total,
    passedOut,
    weather: state.weather,
    forecast: state.forecast,
    newSeason,
    withered,
    seasonWarning: seasonWarning(state.day),
  };
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
