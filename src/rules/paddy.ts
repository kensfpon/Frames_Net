import type { Weather } from '../data/balance';
import { GOODS } from '../data/goods';
import {
  GATES,
  GATE_FLOW,
  GATE_NAMES,
  GOOD_WATER,
  IRON_HOE_SAVING,
  PADDY_PLOTS,
  PADDY_STAMINA,
  RICE,
  WATER_MAX,
  WATER_NAMES,
  WEATHER_FLOW,
  type Gate,
} from '../data/paddy';
import { seasonOf } from './calendar';
import { NO_MONEY, TOO_TIRED, done, effort, isRecord, isWhole, pay, refuse, spend, type Outcome } from './outcome';
import type { GameState } from './state';

/**
 * One rice plot. Unlike a vegetable tile it is never watered by hand: the player sets the
 * sluice gate and the water level moves overnight with the gate and the next day's weather.
 */
export interface PaddyPlot {
  stage: 'fallow' | 'ploughed' | 'planted';
  water: number; // 0 dry .. WATER_MAX flooded
  gate: Gate;
  growth: number; // nights of good water since transplanting
  stress: number; // bad nights in a row; RICE.deadlyStress kills the crop
  lost: number; // bad nights in total; each one costs a unit of yield
  dead: boolean; // killed by drought or flood; plough it under to start again
}

export interface Paddy {
  plots: PaddyPlot[];
  seedlings: number; // bundles in hand; one bundle plants one plot
}

export function newPaddy(): Paddy {
  return {
    seedlings: 0,
    plots: Array.from({ length: PADDY_PLOTS }, () => ({
      stage: 'fallow' as const,
      water: 0,
      gate: 'closed' as const,
      growth: 0,
      stress: 0,
      lost: 0,
      dead: false,
    })),
  };
}

export const plotName = (index: number) => 'แปลงนาที่ ' + (index + 1);

export function goodWater(water: number): boolean {
  return water >= GOOD_WATER.min && water <= GOOD_WATER.max;
}

/** The water level a plot wakes up with, given tonight's gate and tomorrow's weather. */
export function waterAfter(water: number, gate: Gate, weather: Weather): number {
  return Math.max(0, Math.min(WATER_MAX, water + GATE_FLOW[gate] + WEATHER_FLOW[weather]));
}

export function riceRipe(plot: PaddyPlot): boolean {
  return plot.stage === 'planted' && !plot.dead && plot.growth >= RICE.nights;
}

/** Units of paddy rice the plot gives if it is cut once ripe. */
export function expectedYield(plot: PaddyPlot): number {
  return Math.max(RICE.minYield, RICE.fullYield - plot.lost);
}

export function riceInSeason(state: GameState): boolean {
  return RICE.seasons.includes(seasonOf(state.day));
}

const plotAt = (state: GameState, index: number): PaddyPlot | undefined => state.estate.paddy.plots[index];
const NO_PLOT = refuse('ไม่มีแปลงนานี้');

export function buySeedlings(state: GameState): Outcome {
  if (!riceInSeason(state)) return refuse('ฤดูหนาวไม่มีกล้าข้าวขาย รอฤดูร้อน');
  if (!pay(state, RICE.seedlingPrice)) return refuse(NO_MONEY);
  state.estate.paddy.seedlings += 1;
  return done('ซื้อกล้าข้าว 1 มัด ดำได้หนึ่งแปลง');
}

/** Turn the soil. Also the way to clear a dead crop. */
export function plough(state: GameState, index: number): Outcome {
  const plot = plotAt(state, index);
  if (!plot) return NO_PLOT;
  if (plot.stage === 'ploughed') return refuse('แปลงนี้ไถแล้ว');
  if (plot.stage === 'planted' && !plot.dead)
    return refuse(riceRipe(plot) ? 'เกี่ยวข้าวก่อนแล้วค่อยไถ' : 'ยังมีข้าวอยู่ในแปลง');
  const cost = effort(state, PADDY_STAMINA.plough - (state.country.hoe ? IRON_HOE_SAVING : 0), true);
  if (!spend(state, cost)) return refuse(TOO_TIRED);
  Object.assign(plot, { stage: 'ploughed', growth: 0, stress: 0, lost: 0, dead: false });
  return done('ไถ' + plotName(index) + ' แล้ว');
}

/** Transplant a bundle of seedlings. The plot needs standing water, but not a flood. */
export function transplant(state: GameState, index: number): Outcome {
  const plot = plotAt(state, index);
  if (!plot) return NO_PLOT;
  if (plot.stage === 'planted') return refuse('แปลงนี้มีข้าวอยู่แล้ว');
  if (plot.stage === 'fallow') return refuse('ไถนาก่อนดำ');
  if (!riceInSeason(state)) return refuse('ฤดูหนาวดำนาไม่ได้ รอฤดูร้อน');
  if (state.estate.paddy.seedlings < 1) return refuse('ยังไม่มีกล้าข้าว');
  if (plot.water < GOOD_WATER.min) return refuse('นาแห้ง เปิดประตูรับน้ำแล้วรอหนึ่งคืน');
  if (plot.water > GOOD_WATER.max) return refuse('น้ำท่วมแปลง ระบายน้ำออกก่อน');
  if (!spend(state, effort(state, PADDY_STAMINA.transplant, true))) return refuse(TOO_TIRED);
  state.estate.paddy.seedlings -= 1;
  Object.assign(plot, { stage: 'planted', growth: 0, stress: 0, lost: 0, dead: false });
  return done('ดำนา' + plotName(index) + ' แล้ว ดูแลระดับน้ำ ' + RICE.nights + ' คืน');
}

export function setGate(state: GameState, index: number, gate: Gate): Outcome {
  const plot = plotAt(state, index);
  if (!plot) return NO_PLOT;
  if (!GATES.includes(gate)) return refuse('ประตูน้ำตั้งแบบนี้ไม่ได้');
  plot.gate = gate;
  return done('ประตูน้ำ' + plotName(index) + ': ' + GATE_NAMES[gate]);
}

/** Cut the ripe rice into the bag. A drained field is much lighter work. */
export function harvestRice(state: GameState, index: number): Outcome {
  const plot = plotAt(state, index);
  if (!plot) return NO_PLOT;
  if (plot.stage !== 'planted') return refuse('แปลงนี้ยังไม่มีข้าว');
  if (plot.dead) return refuse('ข้าวตายแล้ว ไถกลบเพื่อเริ่มใหม่');
  if (!riceRipe(plot)) return refuse('ข้าวยังไม่สุก (' + plot.growth + '/' + RICE.nights + ' คืน)');
  const drained = plot.water < GOOD_WATER.min + 1;
  const cost = effort(state, drained ? PADDY_STAMINA.harvest : PADDY_STAMINA.harvestWet, true);
  if (!spend(state, cost)) return refuse(TOO_TIRED);
  const amount = expectedYield(plot);
  state.estate.goods.rice += amount;
  Object.assign(plot, { stage: 'fallow', growth: 0, stress: 0, lost: 0, dead: false });
  return done('เกี่ยวข้าวได้ ' + amount + ' ' + GOODS.rice.unit + ' ใส่ลังส่งของเพื่อขาย');
}

/**
 * One night in the paddy. Call it once the new day's weather is known.
 * Returns lines for the morning summary.
 */
export function paddyNight(state: GameState, weather: Weather): string[] {
  const notes: string[] = [];
  state.estate.paddy.plots.forEach((plot, index) => {
    plot.water = waterAfter(plot.water, plot.gate, weather);
    // Fallow soil, dead plants and ripe grain no longer care about the water.
    if (plot.stage !== 'planted' || plot.dead || riceRipe(plot)) return;
    if (goodWater(plot.water)) {
      plot.growth += 1;
      plot.stress = 0;
      if (riceRipe(plot)) notes.push(plotName(index) + ' ข้าวสุกเหลืองทั้งแปลง พร้อมเกี่ยวแล้ว');
      return;
    }
    plot.stress += 1;
    plot.lost += 1;
    const trouble = plot.water === 0 ? 'น้ำแห้ง' : WATER_NAMES[plot.water];
    if (plot.stress >= RICE.deadlyStress) {
      plot.dead = true;
      notes.push(plotName(index) + ' ' + trouble + 'ติดกัน ' + RICE.deadlyStress + ' คืน ข้าวตายทั้งแปลง');
    } else {
      notes.push(
        plotName(index) + ' ' + trouble + ' ข้าวใบเหลือง (' + plot.stress + '/' + RICE.deadlyStress + ')',
      );
    }
  });
  return notes;
}

function validPlot(v: unknown): v is PaddyPlot {
  if (!isRecord(v)) return false;
  return (
    (v.stage === 'fallow' || v.stage === 'ploughed' || v.stage === 'planted') &&
    isWhole(v.water) &&
    v.water <= WATER_MAX &&
    GATES.includes(v.gate as Gate) &&
    isWhole(v.growth) &&
    v.growth <= RICE.nights &&
    isWhole(v.stress) &&
    isWhole(v.lost) &&
    typeof v.dead === 'boolean'
  );
}

export function validPaddy(v: unknown): v is Paddy {
  return (
    isRecord(v) &&
    isWhole(v.seedlings) &&
    Array.isArray(v.plots) &&
    v.plots.length === PADDY_PLOTS &&
    v.plots.every(validPlot)
  );
}
