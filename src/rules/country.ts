import { CROPS, CROP_IDS, MARKET_CROPS, MAX_STAMINA, type CropId } from '../data/balance';
import { FISH, FISH_IDS, type FishId } from '../data/fish';
import { seasonOf, inSeason } from './calendar';
import type { GameState } from './state';

export const regionNames = {
  farm: 'ไร่ล้านนา',
  lake: 'สระบัวแก้ว',
  forest: 'ป่าไผ่ร่มเย็น',
  village: 'หมู่บ้านเวียงคำ',
  market: 'กาดเวียงคำ',
  ranch: 'คอกปศุสัตว์',
  coast: 'หาดอ่าวมุก',
};
export type Region = keyof typeof regionNames;
export type Animal = 'duck' | 'cow';
export const animals = {
  duck: { name: 'เป็ดไข่', buy: 95, sell: 65, product: 'ไข่เป็ด', price: 28 },
  cow: { name: 'วัวนม', buy: 320, sell: 225, product: 'น้ำนม', price: 68 },
};
export const gear = {
  can: { name: 'บัวรดน้ำทองแดง', cost: 110, note: 'ลดพลังรดน้ำ 1 หน่วย' },
  hoe: { name: 'จอบเหล็ก', cost: 135, note: 'ลดพลังพรวนดิน 1 หน่วย' },
  rod: { name: 'คันเบ็ดคาร์บอน', cost: 155, note: 'ปลากินเหยื่อเร็วขึ้น 28%' },
};
export const meals = {
  rice: { name: 'ข้าวเหนียวห่อใบตอง', cost: 12, energy: 18 },
  noodles: { name: 'ข้าวซอยไก่', cost: 28, energy: 45 },
};
export function newCountry() {
  return {
    region: 'farm' as Region,
    can: false,
    hoe: false,
    rod: false,
    duck: 0,
    cow: 0,
    feed: 0,
    fedDucks: 0,
    fedCows: 0,
    duckEggs: 0,
    milk: 0,
    herbs: 0,
    herbDay: 0,
    woodDay: 0,
  };
}
export type Country = ReturnType<typeof newCountry>;
export function marketSeeds(s: GameState) {
  return CROP_IDS.filter((id) => inSeason(id, seasonOf(s.day)));
}
export function matureHerd(s: GameState) {
  const c = s.country;
  c.duckEggs += Math.min(c.fedDucks, c.duck);
  c.milk += Math.min(c.fedCows, c.cow);
  c.fedDucks = 0;
  c.fedCows = 0;
}
export function feedHerd(s: GameState) {
  const c = s.country;
  const hungry = c.duck + c.cow - c.fedDucks - c.fedCows;
  if (!hungry) return c.duck + c.cow ? 'ให้อาหารครบแล้ววันนี้' : 'ซื้อสัตว์จากพิมก่อน';
  const units = Math.min(hungry, c.feed);
  if (!units) return 'ซื้ออาหารสัตว์จากพิมก่อน';
  const ducks = Math.min(units, c.duck - c.fedDucks);
  c.fedDucks += ducks;
  c.fedCows += units - ducks;
  c.feed -= units;
  return 'ให้อาหาร ' + units + ' ตัวแล้ว รับผลผลิตตอนเช้า';
}
function pay(s: GameState, price: number) {
  if (s.money < price) return false;
  s.money -= price;
  return true;
}
export function trade(s: GameState, action: string): string {
  const [kind, id] = action.split(':');
  const c = s.country;
  if (kind === 'meal' && Object.hasOwn(meals, id)) {
    const m = meals[id as keyof typeof meals];
    if (s.stamina >= MAX_STAMINA) return 'พลังงานเต็มแล้ว';
    if (!pay(s, m.cost)) return 'เงินไม่พอ';
    const before = s.stamina;
    s.stamina = Math.min(MAX_STAMINA, s.stamina + m.energy);
    return 'กิน' + m.name + ' พลังงาน +' + (s.stamina - before);
  }
  if (kind === 'gear' && Object.hasOwn(gear, id)) {
    const key = id as keyof typeof gear;
    if (c[key]) return 'มีอุปกรณ์นี้แล้ว';
    if (!pay(s, gear[key].cost)) return 'เงินไม่พอ';
    c[key] = true;
    return 'ติดตั้ง' + gear[key].name + ' แล้ว';
  }
  if (kind === 'seed' && marketSeeds(s).includes(id as CropId)) {
    const crop = id as CropId;
    if (!pay(s, CROPS[crop].seedPrice)) return 'เงินไม่พอ';
    s.seeds[crop]++;
    return 'ซื้อเมล็ด' + CROPS[crop].name + ' แล้ว';
  }
  if (kind === 'animal' && Object.hasOwn(animals, id)) {
    const key = id as Animal;
    if (c[key] >= 6) return 'คอกนี้รับได้ชนิดละ 6 ตัว';
    if (!pay(s, animals[key].buy)) return 'เงินไม่พอ';
    c[key]++;
    return 'รับ' + animals[key].name + ' เข้าคอกแล้ว';
  }
  if (kind === 'sellAnimal' && Object.hasOwn(animals, id)) {
    const key = id as Animal;
    if (!c[key]) return 'ยังไม่มีสัตว์ชนิดนี้';
    c[key]--;
    const fed = key === 'cow' ? 'fedCows' : 'fedDucks';
    c[fed] = Math.min(c[key], c[fed]);
    s.money += animals[key].sell;
    return 'ขาย' + animals[key].name + ' แล้ว';
  }
  if (kind === 'feed') {
    if (!pay(s, 9)) return 'เงินไม่พอ';
    c.feed += 3;
    return 'ได้อาหารสัตว์ 3 ส่วน';
  }
  if (kind === 'care') return feedHerd(s);
  if (kind === 'sell') {
    let value = 0;
    if (CROP_IDS.includes(id as CropId) && s.produce[id as CropId] > 0) {
      s.produce[id as CropId]--;
      value = CROPS[id as CropId].sellPrice;
    } else if (FISH_IDS.includes(id as FishId) && s.fish[id as FishId] > 0) {
      s.fish[id as FishId]--;
      value = FISH[id as FishId].price;
    } else if (id === 'eggs' && s.village.eggs > 0) {
      s.village.eggs--;
      value = 35;
    } else if ((id === 'herbs' || id === 'milk' || id === 'duckEggs') && c[id] > 0) {
      c[id]--;
      value = { herbs: 18, milk: 68, duckEggs: 28 }[id];
    }
    if (!value) return 'ยังไม่มีของชิ้นนี้';
    s.money += value;
    return 'ขายแล้ว ได้ ฿' + value;
  }
  return 'สินค้านี้ยังซื้อไม่ได้';
}
export function forage(s: GameState, wood: boolean) {
  const c = s.country,
    day = wood ? 'woodDay' : 'herbDay';
  if (c[day] === s.day) return 'ตรงนี้เก็บแล้ว รอวันพรุ่งนี้';
  if (s.stamina < 2) return 'พลังงานไม่พอ';
  s.stamina -= 2;
  c[day] = s.day;
  if (wood) {
    s.village.wood += 4;
    return 'ได้ไม้ไผ่สำหรับงานช่าง ×4';
  }
  c.herbs += 3;
  return 'ได้สมุนไพรป่า ×3 นำไปขายที่กาดได้';
}
export function validCountry(value: unknown): value is Country {
  if (!value || typeof value !== 'object') return false;
  const c = value as Country;
  return (
    Object.hasOwn(regionNames, c.region) &&
    ['can', 'hoe', 'rod'].every((k) => typeof c[k as keyof Country] === 'boolean') &&
    Object.keys(newCountry())
      .filter((k) => !['region', 'can', 'hoe', 'rod'].includes(k))
      .every((k) => {
        const n = c[k as keyof Country];
        return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
      }) &&
    c.fedCows <= c.cow &&
    c.fedDucks <= c.duck &&
    c.duck <= 6 &&
    c.cow <= 6
  );
}
export { MARKET_CROPS };
