import {
  CROPS,
  DAYS_PER_SEASON,
  SEASONS,
  SEASON_WARNING_DAYS,
  WEATHER_ODDS,
  type CropId,
  type Season,
  type Weather,
} from '../data/balance';

/** A source of numbers in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;

export function seasonOf(day: number): Season {
  return SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length];
}

export function dayOfSeason(day: number): number {
  return ((day - 1) % DAYS_PER_SEASON) + 1;
}

export function yearOf(day: number): number {
  return Math.floor((day - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1;
}

/**
 * Days until the season changes, counting today, when a warning is due.
 * 0 means no warning. On the last day of a season this returns 1.
 */
export function seasonWarning(day: number): number {
  const left = DAYS_PER_SEASON - dayOfSeason(day) + 1;
  return left <= SEASON_WARNING_DAYS ? left : 0;
}

export function inSeason(crop: CropId, season: Season): boolean {
  return CROPS[crop].seasons.includes(season);
}

export function rollWeather(season: Season, rng: Rng): Weather {
  const odds = WEATHER_ODDS[season];
  let roll = rng();
  for (const [weather, chance] of odds) {
    if (roll < chance) return weather;
    roll -= chance;
  }
  return odds[odds.length - 1][0];
}

export function isWet(weather: Weather): boolean {
  return weather === 'rain' || weather === 'storm';
}
