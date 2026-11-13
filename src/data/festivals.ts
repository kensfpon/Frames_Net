// The village's festival calendar. One year is three seasons, so every festival comes once a year.

import type { Season } from './balance';

export type FestivalId = 'songkran' | 'rocket' | 'ploughing' | 'boatRace' | 'yiPeng' | 'harvestFair';

export interface FestivalDef {
  name: string;
  season: Season;
  day: number; // day of the season, 1..DAYS_PER_SEASON
  from: number; // minutes since midnight
  to: number;
  story: string; // what the day is about
  bring: string; // what joining needs
  reward: string; // what joining gives
  friendship: number; // points with every villager for showing up
}

export const FESTIVALS: Record<FestivalId, FestivalDef> = {
  songkran: {
    name: 'สงกรานต์ ปี๋ใหม่เมือง',
    season: 'hot',
    day: 6,
    from: 9 * 60,
    to: 18 * 60,
    story: 'รดน้ำดำหัวผู้ใหญ่ สาดน้ำคลายร้อนกลางลานเวียง',
    bring: 'ไม่ต้องเตรียมอะไร',
    reward: 'พลังงาน +25',
    friendship: 2,
  },
  rocket: {
    name: 'บุญบั้งไฟ',
    season: 'hot',
    day: 12,
    from: 10 * 60,
    to: 18 * 60,
    story: 'จุดบั้งไฟขอฝนก่อนเข้าฤดูทำนา',
    bring: 'ไม้ 3 ท่อนสำหรับทำบั้งไฟ',
    reward: 'พรุ่งนี้ฝนตกแน่นอน',
    friendship: 1,
  },
  ploughing: {
    name: 'พิธีแรกนาขวัญ',
    season: 'rainy',
    day: 2,
    from: 8 * 60,
    to: 16 * 60,
    story: 'ทำขวัญข้าวและรับพันธุ์ข้าวมงคลก่อนลงนา',
    bring: 'ไม่ต้องเตรียมอะไร',
    reward: 'กล้าข้าว 1 มัด และข้าวในนาโตขึ้นหนึ่งคืน',
    friendship: 1,
  },
  boatRace: {
    name: 'แข่งเรือยาว',
    season: 'rainy',
    day: 11,
    from: 10 * 60,
    to: 18 * 60,
    story: 'ลงเรือพายแข่งกับหมู่บ้านข้างเคียงตอนน้ำเต็มตลิ่ง',
    bring: 'พลังงาน 30',
    reward: 'ชนะได้ ฿200 แพ้ได้ค่าแรง ฿40',
    friendship: 1,
  },
  yiPeng: {
    name: 'ยี่เป็ง ลอยโคม',
    season: 'cool',
    day: 3,
    from: 17 * 60,
    to: 23 * 60,
    story: 'ปล่อยโคมลอยและลอยกระทงขอขมาแม่น้ำในคืนเดือนเพ็ญ',
    bring: 'ค่าโคม ฿30',
    reward: 'เพื่อนบ้านประทับใจเป็นพิเศษ',
    friendship: 3,
  },
  harvestFair: {
    name: 'ตานข้าวใหม่และประกวดพืชผล',
    season: 'cool',
    day: 10,
    from: 9 * 60,
    to: 17 * 60,
    story: 'ถวายข้าวใหม่ แล้วเอาผลผลิตที่ดีที่สุดในกระเป๋าไปประกวด',
    bring: 'ผัก ผลไม้ หรือข้าว 1 ชิ้นในกระเป๋า',
    reward: 'เงินรางวัล 4 เท่าของราคาขาย',
    friendship: 1,
  },
};

export const FESTIVAL_IDS = Object.keys(FESTIVALS) as FestivalId[];

/** Joining a festival takes this long out of the day. */
export const FESTIVAL_MINUTES = 90;
/** The morning summary announces a festival this many days ahead. */
export const FESTIVAL_NOTICE_DAYS = 2;

export const SONGKRAN_STAMINA = 25;
export const ROCKET_WOOD = 3;
export const BOAT_RACE = { stamina: 30, winChance: 0.5, prize: 200, consolation: 40 };
export const LANTERN_PRICE = 30;
export const FAIR_PRIZE_FACTOR = 4;
/** Friendship with a villager tops out here (the same cap the village rules use). */
export const MAX_FRIENDSHIP = 20;
