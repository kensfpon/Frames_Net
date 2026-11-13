import { CROPS, CROP_IDS, DAYS_PER_SEASON, DAY_END_MINUTES, MAX_STAMINA, MINUTES_PER_TICK, SEASONS } from '../data/balance';
import {
  BOAT_RACE,
  FAIR_PRIZE_FACTOR,
  FESTIVALS,
  FESTIVAL_IDS,
  FESTIVAL_MINUTES,
  FESTIVAL_NOTICE_DAYS,
  LANTERN_PRICE,
  MAX_FRIENDSHIP,
  ROCKET_WOOD,
  SONGKRAN_STAMINA,
  type FestivalId,
} from '../data/festivals';
import { GOODS, GOOD_IDS } from '../data/goods';
import { RICE } from '../data/paddy';
import { dayOfSeason, isWet, seasonOf, type Rng } from './calendar';
import { NO_MONEY, done, isRecord, isWhole, pay, refuse, type Outcome } from './outcome';
import { riceRipe } from './paddy';
import type { GameState } from './state';

/** The day each festival was last joined; 0 means never. */
export interface Festivals {
  joined: Record<FestivalId, number>;
}

export function newFestivals(): Festivals {
  const joined = {} as Record<FestivalId, number>;
  for (const id of FESTIVAL_IDS) joined[id] = 0;
  return { joined };
}

const YEAR_DAYS = DAYS_PER_SEASON * SEASONS.length;
const dayOfYear = (id: FestivalId) => SEASONS.indexOf(FESTIVALS[id].season) * DAYS_PER_SEASON + FESTIVALS[id].day;

/** The festival held on this day, if any. */
export function festivalOn(day: number): FestivalId | null {
  const season = seasonOf(day);
  const date = dayOfSeason(day);
  return FESTIVAL_IDS.find((id) => FESTIVALS[id].season === season && FESTIVALS[id].day === date) ?? null;
}

/** Days from this day to the festival's next date; 0 on the day itself. */
export function daysUntil(id: FestivalId, day: number): number {
  const today = ((day - 1) % YEAR_DAYS) + 1;
  return (dayOfYear(id) - today + YEAR_DAYS) % YEAR_DAYS;
}

/** The next festival on the calendar, counting today's. */
export function nextFestival(day: number): { id: FestivalId; inDays: number } {
  return FESTIVAL_IDS.map((id) => ({ id, inDays: daysUntil(id, day) })).sort((a, b) => a.inDays - b.inDays)[0];
}

const clock = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

export function festivalHours(id: FestivalId): string {
  return clock(FESTIVALS[id].from) + '–' + clock(FESTIVALS[id].to) + ' น.';
}

/** Why today's festival cannot be joined right now, or null when the player may walk in. */
export function festivalClosed(state: GameState): string | null {
  const id = festivalOn(state.day);
  if (!id) return 'วันนี้ไม่มีงานประเพณี';
  if (state.estate.festivals.joined[id] === state.day) return 'ร่วมงานวันนี้แล้ว';
  if (state.weather === 'storm') return 'พายุฝน งานวันนี้งด';
  if (state.minutes < FESTIVALS[id].from) return 'งานยังไม่เริ่ม เปิด ' + festivalHours(id);
  if (state.minutes >= FESTIVALS[id].to) return 'งานเลิกแล้ว';
  return null;
}

/** The single most valuable crop, fruit or sack of rice in the bag, for the produce fair. */
function bestEntry(state: GameState): { name: string; price: number; take: () => void } | null {
  let best: { name: string; price: number; take: () => void } | null = null;
  for (const id of CROP_IDS) {
    if (state.produce[id] > 0 && CROPS[id].sellPrice > (best?.price ?? 0))
      best = { name: CROPS[id].name, price: CROPS[id].sellPrice, take: () => (state.produce[id] -= 1) };
  }
  for (const id of GOOD_IDS) {
    if (state.estate.goods[id] > 0 && GOODS[id].price > (best?.price ?? 0))
      best = { name: GOODS[id].name, price: GOODS[id].price, take: () => (state.estate.goods[id] -= 1) };
  }
  return best;
}

/** Take part in today's festival. Each one asks for something different and gives something back. */
export function joinFestival(state: GameState, rng: Rng = Math.random): Outcome {
  const closed = festivalClosed(state);
  if (closed) return refuse(closed);
  const id = festivalOn(state.day)!;
  let message: string;

  switch (id) {
    case 'songkran': {
      const before = state.stamina;
      state.stamina = Math.min(MAX_STAMINA, state.stamina + SONGKRAN_STAMINA);
      message = 'สาดน้ำกันชุ่มฉ่ำ พลังงาน +' + (state.stamina - before);
      break;
    }
    case 'rocket':
      if (state.village.wood < ROCKET_WOOD) return refuse('ต้องใช้ไม้ ' + ROCKET_WOOD + ' ท่อนทำบั้งไฟ');
      state.village.wood -= ROCKET_WOOD;
      if (!isWet(state.forecast)) state.forecast = 'rain';
      message = 'บั้งไฟพุ่งขึ้นฟ้า พรุ่งนี้ฝนตกแน่';
      break;
    case 'ploughing': {
      let blessed = 0;
      for (const plot of state.estate.paddy.plots) {
        if (plot.stage !== 'planted' || plot.dead || riceRipe(plot)) continue;
        plot.growth = Math.min(RICE.nights, plot.growth + 1);
        plot.stress = 0;
        blessed += 1;
      }
      state.estate.paddy.seedlings += 1;
      message = 'ได้พันธุ์ข้าวมงคล 1 มัด' + (blessed ? ' ข้าวในนา ' + blessed + ' แปลงโตขึ้นหนึ่งคืน' : '');
      break;
    }
    case 'boatRace': {
      if (state.stamina < BOAT_RACE.stamina) return refuse('ต้องมีพลังงาน ' + BOAT_RACE.stamina + ' จึงลงเรือได้');
      state.stamina -= BOAT_RACE.stamina;
      const won = rng() < BOAT_RACE.winChance;
      state.money += won ? BOAT_RACE.prize : BOAT_RACE.consolation;
      message = won
        ? 'เรือของเราเข้าเส้นชัยก่อน รับรางวัล ฿' + BOAT_RACE.prize
        : 'แพ้ไปครึ่งลำเรือ ได้ค่าแรงฝีพาย ฿' + BOAT_RACE.consolation;
      break;
    }
    case 'yiPeng':
      if (!pay(state, LANTERN_PRICE)) return refuse(NO_MONEY);
      message = 'ปล่อยโคมขึ้นฟ้าพร้อมคำอธิษฐาน';
      break;
    case 'harvestFair': {
      const entry = bestEntry(state);
      if (!entry) return refuse('ต้องมีผัก ผลไม้ หรือข้าวในกระเป๋าไปประกวด');
      entry.take();
      const prize = entry.price * FAIR_PRIZE_FACTOR;
      state.money += prize;
      message = entry.name + 'ได้รางวัลประกวด ฿' + prize;
      break;
    }
  }

  const points = FESTIVALS[id].friendship;
  for (const person of Object.values(state.village.people))
    person.points = Math.min(MAX_FRIENDSHIP, person.points + points);
  state.estate.festivals.joined[id] = state.day;
  // A festival eats part of the day but never knocks the player out by itself.
  state.minutes = Math.max(
    state.minutes,
    Math.min(state.minutes + FESTIVAL_MINUTES, DAY_END_MINUTES - MINUTES_PER_TICK),
  );
  return done(message + ' · มิตรภาพกับเพื่อนบ้าน +' + points);
}

/** Lines for the morning summary: today's festival, or one that is coming up. */
export function festivalNotes(day: number): string[] {
  const today = festivalOn(day);
  if (today)
    return ['วันนี้มีงาน' + FESTIVALS[today].name + ' ที่ลานกลางเวียง ' + festivalHours(today)];
  const next = nextFestival(day);
  if (next.inDays <= FESTIVAL_NOTICE_DAYS)
    return [
      'อีก ' + next.inDays + ' วันมีงาน' + FESTIVALS[next.id].name + ' · เตรียม: ' + FESTIVALS[next.id].bring,
    ];
  return [];
}

export function validFestivals(v: unknown): v is Festivals {
  if (!isRecord(v)) return false;
  const joined = v.joined;
  return isRecord(joined) && FESTIVAL_IDS.every((id) => isWhole(joined[id]));
}
