import { FIELD } from '../data/map';
export const W = 1600,
  H = 900;
export type Point = { x: number; y: number };
export type Cell = { col: number; row: number };
export type Site =
  | 'house'
  | 'crate'
  | 'pond'
  | 'stall'
  | 'mali'
  | 'chai'
  | 'wood'
  | 'stone'
  | 'berry'
  | 'hen';
export type Marker = { label: string; icon: string; pin: Point; foot: Point };
const marker = (label: string, icon: string, x: number, y: number, fx: number, fy: number): Marker => ({
  label,
  icon,
  pin: { x, y },
  foot: { x: fx, y: fy },
});
export const sites: Record<Site, Marker> = {
  house: marker('บ้านพัก', 'farm', 414, 253, 418, 366),
  crate: marker('ลังส่งของ', 'crate', 532, 322, 533, 376),
  pond: marker('บ่อตกปลา', 'fish', 1203, 558, 1140, 591),
  stall: marker('ร้านเมล็ดพันธุ์', 'shop', 1190, 217, 1220, 335),
  mali: marker('มะลิ', 'sprout', 946, 293, 917, 363),
  chai: marker('ลุงชัย', 'tools', 195, 319, 222, 394),
  wood: marker('กองไม้', 'tools', 132, 296, 137, 365),
  stone: marker('กองหิน', 'tools', 966, 302, 956, 357),
  berry: marker('พุ่มหม่อน', 'sprout', 281, 576, 333, 609),
  hen: marker('เล้าไก่', 'farm', 280, 438, 307, 487),
};
export function corner(u: number, v: number): Point {
  return { x: 377 + 656 * u, y: 432 + 287 * v };
}
export function center(c: Cell): Point {
  return corner((c.col - FIELD.col + 0.5) / FIELD.w, (c.row - FIELD.row + 0.5) / FIELD.h);
}
export function cellAt(p: Point): Cell | null {
  const u = (p.x - 377) / 656,
    v = (p.y - 432) / 287;
  return u >= 0 && u < 1 && v >= 0 && v < 1
    ? { col: FIELD.col + Math.floor(u * FIELD.w), row: FIELD.row + Math.floor(v * FIELD.h) }
    : null;
}
// All coordinates are on the overhead map. Keep walls, fences and water impassable.
const paths = [
  [92, 360, 393, 420],
  [390, 347, 457, 437],
  [380, 363, 1242, 433],
  [320, 411, 1062, 753],
  [1060, 406, 1118, 650],
  [1083, 565, 1203, 606],
  [1190, 311, 1299, 393],
  [1050, 346, 1250, 403],
  [830, 78, 894, 392],
  [893, 346, 994, 399],
  [286, 422, 378, 620],
  [198, 393, 362, 435],
  [504, 360, 560, 381],
];
export function walkable(p: Point) {
  return paths.some(([l, t, r, b]) => p.x >= l && p.x <= r && p.y >= t && p.y <= b);
}
// Search the footpaths as well as the vegetable bed so a tap across the pond uses the bridge.
export function route(from: Point, to: Point, passable = walkable): Point[] {
  const step = 12,
    id = (x: number, y: number) => x + y * 140;
  const sx = Math.round(from.x / step),
    sy = Math.round(from.y / step),
    start = id(sx, sy);
  const queue = [start],
    previous = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i],
      x = node % 140,
      y = Math.floor(node / 140);
    if (Math.hypot(x * step - to.x, y * step - to.y) < step * 1.5) {
      const path: Point[] = [to];
      for (let n = node; n !== start; n = previous.get(n)!)
        path.push({ x: (n % 140) * step, y: Math.floor(n / 140) * step });
      return path.reverse();
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]) {
      const key = id(x + dx, y + dy);
      if (!previous.has(key) && passable({ x: (x + dx) * step, y: (y + dy) * step })) {
        previous.set(key, node);
        queue.push(key);
      }
    }
  }
  return [];
}
