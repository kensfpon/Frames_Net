// Tunable numbers for the rice paddy.

import type { Season, Weather } from './balance';

export const PADDY_PLOTS = 3;

/** Water level of a plot, 0..WATER_MAX. */
export const WATER_MAX = 4;
export const WATER_NAMES = ['แห้ง', 'น้ำตื้น', 'น้ำพอดี', 'น้ำลึก', 'น้ำท่วม'] as const;
/** Rice grows only while the water stays inside this range. */
export const GOOD_WATER = { min: 1, max: 3 };

export type Gate = 'closed' | 'in' | 'out';
export const GATES: Gate[] = ['closed', 'in', 'out'];
export const GATE_NAMES: Record<Gate, string> = {
  closed: 'ปิด',
  in: 'เปิดรับน้ำ',
  out: 'ระบายน้ำออก',
};

/** How much the water moves overnight: the gate setting plus the next day's weather. */
export const GATE_FLOW: Record<Gate, number> = { closed: 0, in: 2, out: -2 };
export const WEATHER_FLOW: Record<Weather, number> = { sunny: -1, heat: -2, rain: 1, storm: 2 };

export const RICE = {
  nights: 10, // nights of good water from transplanting to ripe
  seedlingPrice: 60, // one bundle plants one plot
  seasons: ['hot', 'rainy'] as Season[], // when seedlings are sold and can be transplanted
  fullYield: 12, // units of paddy rice from a plot that never had a bad night
  minYield: 4,
  deadlyStress: 3, // bad nights in a row that kill the crop
};

export const PADDY_STAMINA = {
  plough: 12,
  transplant: 10,
  harvest: 10, // field drained to shallow or dry
  harvestWet: 16, // cutting rice while standing in water
};
/** The iron hoe from the smith makes ploughing this much lighter. */
export const IRON_HOE_SAVING = 3;
