import { GRID_COLS, GRID_ROWS } from '../config';

export type ObjectId = 'house' | 'crate' | 'stall';

export interface MapObject {
  id: ObjectId;
  label: string;
  col: number;
  row: number;
  w: number;
  h: number;
  color: number;
}

export const MAP_OBJECTS: MapObject[] = [
  { id: 'house', label: 'บ้าน', col: 1, row: 1, w: 3, h: 2, color: 0xb5651d },
  { id: 'crate', label: 'ลังส่งของ', col: 5, row: 2, w: 1, h: 1, color: 0xd9a441 },
  { id: 'stall', label: 'แผงขายเมล็ด', col: 15, row: 1, w: 3, h: 2, color: 0x8e5bb5 },
];

/** Tiles where the player may till and plant. */
export const FIELD = { col: 2, row: 4, w: 16, h: 7 };

/** Where the player wakes up each morning (tile coordinates, just below the house). */
export const SPAWN_TILE = { col: 2, row: 3 };

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

export function objectAt(col: number, row: number): MapObject | null {
  for (const o of MAP_OBJECTS) {
    if (col >= o.col && col < o.col + o.w && row >= o.row && row < o.row + o.h) return o;
  }
  return null;
}

export function isFarmable(col: number, row: number): boolean {
  return col >= FIELD.col && col < FIELD.col + FIELD.w && row >= FIELD.row && row < FIELD.row + FIELD.h;
}
