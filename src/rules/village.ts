import type { GameState } from './state';

export type Villager = 'mali' | 'chai';
export type Resource = 'wood' | 'stone' | 'berry';
export interface Village {
  wood: number;
  stone: number;
  berry: number;
  eggs: number;
  eggsShipping: number;
  nest: number;
  coop: boolean;
  fed: number;
  orderDay: number;
  gathered: Record<Resource, number>;
  people: Record<Villager, { points: number; talked: number; gifted: number }>;
}
export function newVillage(): Village {
  const friend = () => ({ points: 0, talked: 0, gifted: 0 });
  return {
    wood: 0,
    stone: 0,
    berry: 0,
    eggs: 0,
    eggsShipping: 0,
    nest: 0,
    coop: false,
    fed: 0,
    orderDay: 0,
    gathered: { wood: 0, stone: 0, berry: 0 },
    people: { mali: friend(), chai: friend() },
  };
}
export const names = { mali: 'มะลิ', chai: 'ลุงชัย', wood: 'ไม้', stone: 'หิน', berry: 'ลูกหม่อน' };
export function gather(s: GameState, item: Resource) {
  if (s.village.gathered[item] === s.day) return 'เก็บจุดนี้แล้ว กลับมาพรุ่งนี้';
  const cost = item === 'berry' ? 1 : 3;
  if (s.stamina < cost) return 'พลังงานไม่พอ กลับไปพักที่บ้าน';
  s.stamina -= cost;
  s.village.gathered[item] = s.day;
  const count = item === 'stone' ? 2 : 3;
  s.village[item] += count;
  return 'ได้' + names[item] + ' ×' + count;
}
export function greet(s: GameState, id: Villager) {
  const person = s.village.people[id];
  if (person.talked !== s.day) {
    person.talked = s.day;
    person.points = Math.min(20, person.points + 1);
  }
}
export function giveBerry(s: GameState, id: Villager) {
  const person = s.village.people[id];
  if (person.gifted === s.day) return 'ให้ของขวัญวันนี้แล้ว';
  if (!s.village.berry) return 'เก็บลูกหม่อนจากพุ่มทางซ้ายก่อน';
  s.village.berry--;
  person.gifted = s.day;
  person.points = Math.min(20, person.points + 2);
  return '“ลูกหม่อนหวานจัง ขอบใจนะ!”';
}
export function completeOrder(s: GameState) {
  if (s.village.orderDay === s.day) return 'ส่งคำขอวันนี้แล้ว';
  const berryDay = s.day % 2 === 0;
  if ((berryDay ? s.village.berry : s.produce.morningGlory) < 2) return 'ยังมีของไม่ครบ 2 ชิ้น';
  if (berryDay) s.village.berry -= 2;
  else s.produce.morningGlory -= 2;
  s.money += 70;
  s.village.orderDay = s.day;
  return 'ส่งของให้มะลิแล้ว รับ ฿70';
}
export function buildCoop(s: GameState) {
  const v = s.village;
  if (v.coop) return 'สร้างเล้าไก่แล้ว';
  if (v.wood < 3 || v.stone < 2) return 'ต้องใช้ไม้ 3 และหิน 2';
  v.wood -= 3;
  v.stone -= 2;
  v.coop = true;
  return 'ลุงชัยสร้างเล้าให้แล้ว ไปทักทายแม่ไก่ที่ลานข้างแปลง';
}
export function careForHen(s: GameState) {
  const v = s.village;
  if (!v.coop) return 'คุยกับลุงชัยเพื่อสร้างเล้าไก่';
  if (v.nest > 0) {
    const count = v.nest;
    v.eggs += count;
    v.nest = 0;
    return 'เก็บไข่ ×' + count + ' แล้ว';
  }
  if (v.fed === s.day) return 'แม่ไก่อิ่มแล้ว รอเก็บไข่ตอนเช้า';
  if (!v.berry) return 'ต้องใช้ลูกหม่อน 1 ลูกเพื่อให้อาหาร';
  v.berry--;
  v.fed = s.day;
  return 'แม่ไก่กินอิ่มแล้ว พรุ่งนี้จะมีไข่ในรัง';
}
