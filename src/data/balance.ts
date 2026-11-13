// All tunable numbers for the game live here.

export type Season = 'hot' | 'rainy' | 'cool';
export const SEASONS: Season[] = ['hot', 'rainy', 'cool'];
export const SEASON_NAMES: Record<Season, string> = { hot: 'ฤดูร้อน', rainy: 'ฤดูฝน', cool: 'ฤดูหนาว' };
export const DAYS_PER_SEASON = 14;
export const SEASON_WARNING_DAYS = 3;

export type Weather = 'sunny' | 'rain' | 'heat' | 'storm';
export const WEATHER_NAMES: Record<Weather, string> = {
  sunny: 'แดด',
  rain: 'ฝน',
  heat: 'แดดจัด',
  storm: 'พายุฝน',
};

/** Chance of each weather per season. Each row sums to 1. */
export const WEATHER_ODDS: Record<Season, [Weather, number][]> = {
  hot: [['sunny', 0.6], ['heat', 0.3], ['rain', 0.1]],
  rainy: [['sunny', 0.3], ['rain', 0.55], ['storm', 0.15]],
  cool: [['sunny', 0.85], ['rain', 0.15]],
};
export const HEAT_EXTRA_STAMINA = 1;

export type CropId =
  | 'morningGlory'
  | 'longBean'
  | 'watermelon'
  | 'corn'
  | 'chili'
  | 'pumpkin'
  | 'cabbage'
  | 'tomato'
  | 'strawberry';

export interface CropDef {
  name: string;
  seasons: Season[];
  days: number; // watered days needed to mature
  seedPrice: number;
  sellPrice: number;
  color: number;
}

export const CROPS: Record<CropId, CropDef> = {
  morningGlory: { name: 'ผักบุ้ง', seasons: ['hot', 'rainy', 'cool'], days: 3, seedPrice: 10, sellPrice: 25, color: 0x2fbf6b },
  longBean: { name: 'ถั่วฝักยาว', seasons: ['hot', 'rainy'], days: 5, seedPrice: 25, sellPrice: 70, color: 0x9bd13a },
  watermelon: { name: 'แตงโม', seasons: ['hot'], days: 9, seedPrice: 60, sellPrice: 200, color: 0x1f7a3a },
  corn: { name: 'ข้าวโพด', seasons: ['rainy'], days: 6, seedPrice: 30, sellPrice: 90, color: 0xf2d13a },
  chili: { name: 'พริก', seasons: ['rainy'], days: 7, seedPrice: 40, sellPrice: 120, color: 0xd9281e },
  pumpkin: { name: 'ฟักทอง', seasons: ['rainy', 'cool'], days: 8, seedPrice: 50, sellPrice: 160, color: 0xf08a1e },
  cabbage: { name: 'กะหล่ำปลี', seasons: ['cool'], days: 6, seedPrice: 30, sellPrice: 95, color: 0xb8e6a0 },
  tomato: { name: 'มะเขือเทศ', seasons: ['cool'], days: 7, seedPrice: 40, sellPrice: 125, color: 0xe8452c },
  strawberry: { name: 'สตรอว์เบอร์รี', seasons: ['cool'], days: 9, seedPrice: 70, sellPrice: 230, color: 0xff5c8a },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

export const DAY_START_MINUTES = 6 * 60;
export const DAY_END_MINUTES = 24 * 60;
export const MINUTES_PER_TICK = 10;
export const MS_PER_TICK = 5500; // one day (06:00-24:00) lasts about 10 real minutes

export const SHOP_OPEN_MINUTES = 8 * 60;
export const SHOP_CLOSE_MINUTES = 17 * 60;

export const MAX_STAMINA = 100;
export const PASSED_OUT_STAMINA = 50;
export const STAMINA_COST = { hoe: 4, water: 2, plant: 1, harvest: 1 } as const;

export const START_MONEY = 200;
export const START_SEEDS: Partial<Record<CropId, number>> = { morningGlory: 5 };
