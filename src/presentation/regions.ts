import { type Marker, type Point, sites, walkable } from './ground';
import { regionNames, type Region } from '../rules/country';
import { estateFarmSpots, estateVillageSpots } from './estate';
export const npcs = {
  cook: {
    name: 'ป้าบัว',
    role: 'แม่ครัวกาดเช้า',
    line: 'ข้าวซอยหม้อนี้เพิ่งยกลงจากเตา เหนื่อยจากไร่ก็มากินให้อิ่มก่อนนะ',
  },
  trader: {
    name: 'ต้นกล้า',
    role: 'พ่อค้าเมล็ดพันธุ์',
    line: 'ของสดจากไร่และปลาที่ตกได้ เอามาขายให้ผมได้เลยครับ',
  },
  smith: {
    name: 'ช่างคำ',
    role: 'ช่างตีเหล็ก',
    line: 'เหล็กดีช่วยผ่อนแรง จอบกับบัวรดน้ำรุ่นนี้ใช้แรงน้อยลงทุกครั้ง',
  },
  rancher: {
    name: 'พิม',
    role: 'เจ้าของคอกสัตว์',
    line: 'ซื้อเป็ดหรือวัวแล้วฝากเลี้ยงที่คอกนี้ได้ ให้อาหารตัวละหนึ่งส่วน ผลผลิตจะเข้ากระเป๋าตอนเช้า',
  },
  fisher: {
    name: 'ลุงเภา',
    role: 'ชาวประมง',
    line: 'ที่สระมีปลาไนกับปลาแรด ถ้าอยากได้ปลาทูให้ลองท่าเรือที่หาดอ่าวมุกดู',
  },
  ranger: {
    name: 'ไผ่',
    role: 'ผู้ดูแลป่า',
    line: 'เก็บสมุนไพรริมทางกับไม้ไผ่ล้มได้วันละครั้งนะ พ่อค้าในกาดรับซื้อสมุนไพรด้วย',
  },
};
export type Person = keyof typeof npcs;
export type Spot = Marker & { sprite?: string };
const spot = (label: string, icon: string, x: number, y: number, sprite?: string): Spot => ({
  label,
  icon,
  foot: { x, y },
  pin: { x, y: y - (sprite ? 85 : 32) },
  sprite,
});
const npc = (person: Person, x: number, y: number) => spot(npcs[person].name, 'book', x, y, person);
const gate = (id: Region, x: number, y: number) => spot('ไป' + regionNames[id], 'pin', x, y);
type Layout = { spawn: Point; spots: Record<string, Spot>; paths: number[][]; description: string };
export const layouts: Record<Region, Layout> = {
  farm: {
    spawn: { x: 740, y: 413 },
    spots: { ...sites, 'to-village': gate('village', 861, 145), ...estateFarmSpots },
    paths: [],
    description: 'แปลงผัก บ้านพัก และลังส่งของ',
  },
  lake: {
    spawn: { x: 790, y: 770 },
    spots: {
      angling: spot('ตกปลาน้ำจืด', 'fish', 815, 460),
      fisher: npc('fisher', 1020, 755),
      'to-forest': gate('forest', 355, 756),
    },
    paths: [
      [85, 745, 1510, 806],
      [729, 704, 910, 786],
      [772, 457, 859, 754],
    ],
    description: 'ตกปลาไนและปลาแรดที่ท่าน้ำ',
  },
  forest: {
    spawn: { x: 800, y: 747 },
    spots: {
      ranger: npc('ranger', 636, 532),
      herbs: spot('เก็บสมุนไพร', 'sprout', 375, 505),
      timber: spot('ตัดไม้ไผ่', 'tools', 1160, 519),
      'to-lake': gate('lake', 810, 795),
    },
    paths: [
      [728, 496, 854, 830],
      [340, 460, 1200, 600],
      [498, 396, 1050, 495],
      [637, 584, 894, 650],
    ],
    description: 'หาไม้ไผ่และสมุนไพรกลางป่า',
  },
  village: {
    spawn: { x: 800, y: 650 },
    spots: {
      ranger: npc('ranger', 646, 464),
      fisher: npc('fisher', 1100, 650),
      'to-market': gate('market', 813, 338),
      'to-ranch': gate('ranch', 1300, 575),
      'to-farm': gate('farm', 375, 632),
      ...estateVillageSpots,
    },
    paths: [
      [365, 607, 1310, 717],
      [411, 357, 838, 632],
      [721, 324, 887, 462],
      [1160, 413, 1340, 635],
      [802, 336, 1210, 415],
    ],
    description: 'พบชาวบ้านที่ลานกลางเวียง',
  },
  market: {
    spawn: { x: 804, y: 706 },
    spots: {
      cook: npc('cook', 332, 408),
      trader: npc('trader', 808, 409),
      smith: npc('smith', 1290, 412),
      'to-village': gate('village', 767, 758),
    },
    paths: [
      [210, 362, 1420, 461],
      [401, 430, 1125, 730],
      [554, 684, 1000, 825],
    ],
    description: 'อาหาร เมล็ดพันธุ์ เครื่องมือ และรับซื้อของ',
  },
  ranch: {
    spawn: { x: 712, y: 706 },
    spots: {
      rancher: npc('rancher', 1030, 605),
      herd: spot('ดูแลสัตว์ของฉัน', 'farm', 754, 436),
      'to-village': gate('village', 712, 790),
    },
    paths: [
      [590, 299, 878, 699],
      [440, 485, 760, 678],
      [503, 600, 1053, 827],
      [864, 599, 1250, 707],
    ],
    description: 'ซื้อขายสัตว์ ให้อาหาร และเก็บผลผลิต',
  },
  coast: {
    spawn: { x: 800, y: 727 },
    spots: {
      angling: spot('ตกปลาทะเล', 'fish', 805, 363),
      fisher: npc('fisher', 656, 716),
      'to-village': gate('village', 1080, 742),
    },
    paths: [
      [770, 349, 858, 725],
      [605, 644, 1158, 800],
      [355, 684, 662, 783],
      [917, 557, 1180, 701],
    ],
    description: 'ตกปลาทู กะพงแดง ปลาเก๋า และปลาสาก',
  },
};
export function canWalk(region: Region, p: Point) {
  if (region === 'farm') return walkable(p);
  return layouts[region].paths.some(([l, t, r, b]) => p.x >= l && p.x <= r && p.y >= t && p.y <= b);
}
export const regionArt = (region: Region) =>
  region === 'farm' ? '/art/valley.webp' : '/art/regions/' + region + '.webp';
