import type { Season } from './balance';

export type FishId =
  | 'tilapia'
  | 'barb'
  | 'gourami'
  | 'perch'
  | 'catfish'
  | 'snakehead'
  | 'featherback'
  | 'eel'
  | 'carp'
  | 'giantGourami'
  | 'mackerel'
  | 'snapper'
  | 'grouper'
  | 'barracuda';

export interface FishDef {
  habitat?: 'lake' | 'sea';
  name: string;
  seasons: Season[];
  from: number; // minutes since midnight, inclusive
  to: number; // exclusive
  wetAllDay: boolean; // also bites at any hour when it rains
  weight: number; // relative chance among the fish available right now
  price: number;
  windowMs: number; // how long the player has to react to the bite
}

const ALL: Season[] = ['hot', 'rainy', 'cool'];
const H = 60;

export const FISH: Record<FishId, FishDef> = {
  tilapia: {
    name: 'ปลานิล',
    seasons: ALL,
    from: 0,
    to: 24 * H,
    wetAllDay: false,
    weight: 40,
    price: 12,
    windowMs: 900,
  },
  barb: {
    name: 'ปลาตะเพียน',
    seasons: ['hot', 'rainy'],
    from: 6 * H,
    to: 18 * H,
    wetAllDay: false,
    weight: 30,
    price: 18,
    windowMs: 800,
  },
  gourami: {
    name: 'ปลาสลิด',
    seasons: ['cool'],
    from: 6 * H,
    to: 18 * H,
    wetAllDay: false,
    weight: 30,
    price: 20,
    windowMs: 800,
  },
  perch: {
    name: 'ปลาหมอ',
    seasons: ['rainy'],
    from: 0,
    to: 24 * H,
    wetAllDay: false,
    weight: 25,
    price: 25,
    windowMs: 700,
  },
  catfish: {
    name: 'ปลาดุก',
    seasons: ['hot', 'rainy'],
    from: 18 * H,
    to: 24 * H,
    wetAllDay: true,
    weight: 20,
    price: 35,
    windowMs: 650,
  },
  snakehead: {
    name: 'ปลาช่อน',
    seasons: ALL,
    from: 6 * H,
    to: 10 * H,
    wetAllDay: false,
    weight: 12,
    price: 60,
    windowMs: 550,
  },
  featherback: {
    name: 'ปลากราย',
    seasons: ['cool'],
    from: 16 * H,
    to: 24 * H,
    wetAllDay: false,
    weight: 8,
    price: 85,
    windowMs: 500,
  },
  carp: {
    name: 'ปลาไน',
    habitat: 'lake',
    seasons: ALL,
    from: 0,
    to: 24 * H,
    wetAllDay: false,
    weight: 36,
    price: 48,
    windowMs: 990,
  },
  giantGourami: {
    name: 'ปลาแรด',
    habitat: 'lake',
    seasons: ALL,
    from: 6 * H,
    to: 18 * H,
    wetAllDay: true,
    weight: 18,
    price: 85,
    windowMs: 850,
  },
  mackerel: {
    name: 'ปลาทู',
    habitat: 'sea',
    seasons: ALL,
    from: 0,
    to: 24 * H,
    wetAllDay: false,
    weight: 45,
    price: 32,
    windowMs: 980,
  },
  snapper: {
    name: 'ปลากะพงแดง',
    habitat: 'sea',
    seasons: ALL,
    from: 6 * H,
    to: 18 * H,
    wetAllDay: true,
    weight: 25,
    price: 78,
    windowMs: 860,
  },
  grouper: {
    name: 'ปลาเก๋า',
    habitat: 'sea',
    seasons: ['hot', 'rainy'],
    from: 6 * H,
    to: 24 * H,
    wetAllDay: false,
    weight: 14,
    price: 105,
    windowMs: 780,
  },
  barracuda: {
    name: 'ปลาสาก',
    habitat: 'sea',
    seasons: ALL,
    from: 16 * H,
    to: 24 * H,
    wetAllDay: false,
    weight: 12,
    price: 125,
    windowMs: 710,
  },
  eel: {
    name: 'ปลาไหล',
    seasons: ['rainy'],
    from: 20 * H,
    to: 24 * H,
    wetAllDay: false,
    weight: 6,
    price: 110,
    windowMs: 450,
  },
};

export const FISH_IDS = Object.keys(FISH) as FishId[];

/** Real-time wait for a bite, in milliseconds. */
export const BITE_WAIT_MS = { min: 3000, max: 9000 };
/** Fish bite sooner in the rain. */
export const WET_WAIT_FACTOR = 0.6;
