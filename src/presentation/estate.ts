// Plain working panels for the rice paddy, the orchard and the festivals.
// They reuse the dialog styles that already exist; the real look is still to come
// (see docs/handoff/codex-graphics-handoff.md).

import { SEASON_NAMES, WEATHER_NAMES } from '../data/balance';
import { FESTIVALS, FESTIVAL_IDS } from '../data/festivals';
import { GOODS, GOOD_IDS } from '../data/goods';
import { FERTILIZER, TREES, TREE_IDS } from '../data/orchard';
import { GATES, GATE_NAMES, RICE, WATER_NAMES } from '../data/paddy';
import { seasonOf } from '../rules/calendar';
import { daysUntil, festivalClosed, festivalHours, festivalOn } from '../rules/festival';
import { isGrown, nightsToFruit, type Tree } from '../rules/orchard';
import { expectedYield, goodWater, riceInSeason, riceRipe, waterAfter, type PaddyPlot } from '../rules/paddy';
import type { GameState } from '../rules/state';
import type { Marker } from './ground';

const marker = (label: string, icon: string, x: number, y: number): Marker => ({
  label,
  icon,
  foot: { x, y },
  pin: { x, y: y - 32 },
});
/** Signposts on the home farm. Placeholder spots: neither place is painted on the map yet. */
export const estateFarmSpots = {
  paddy: marker('นาข้าว', 'sprout', 1089, 470),
  orchard: marker('สวนผลไม้', 'sprout', 332, 548),
};
export const estateVillageSpots = {
  festival: marker('ลานงานประเพณี', 'sun', 520, 560),
};
export type EstatePanel = 'paddy' | 'orchard' | 'festival';

const button = (action: string, label: string, disabled = false, quiet = false) =>
  '<button class="action' +
  (quiet ? ' quiet' : '') +
  '" data-cmd="chore-' +
  action +
  '"' +
  (disabled ? ' disabled' : '') +
  '>' +
  label +
  '</button>';
const line = (title: string, note: string, control = '') =>
  '<div class="row"><span><strong>' + title + '</strong><small class="detail">' + note + '</small></span>' + control + '</div>';
const row = (a: string, b: string) => '<div class="row"><span>' + a + '</span><b>' + b + '</b></div>';
const actions = (html: string) => (html ? '<div class="actions">' + html + '</div>' : '');
const seasons = (list: readonly (keyof typeof SEASON_NAMES)[]) =>
  list.length === 3 ? 'ทุกฤดู' : list.map((s) => SEASON_NAMES[s]).join(' ');

function plotStatus(plot: PaddyPlot): string {
  if (plot.stage === 'fallow') return 'ว่าง ยังไม่ไถ';
  if (plot.stage === 'ploughed') return 'ไถแล้ว รอดำนา';
  if (plot.dead) return 'ข้าวตาย ต้องไถกลบ';
  if (riceRipe(plot)) return 'ข้าวสุก พร้อมเกี่ยว ' + expectedYield(plot) + ' ' + GOODS.rice.unit;
  return (
    'ข้าวโต ' +
    plot.growth +
    '/' +
    RICE.nights +
    ' คืน' +
    (plot.stress ? ' · ใบเหลือง ' + plot.stress + '/' + RICE.deadlyStress : '')
  );
}

export function paddyPanel(s: GameState): string {
  const paddy = s.estate.paddy;
  let html =
    '<p>ข้าวไม่ต้องรดน้ำทีละช่อง แต่ต้องคุมระดับน้ำด้วยประตูน้ำ น้ำเปลี่ยนตอนกลางคืนตามประตูน้ำและอากาศของวันพรุ่งนี้ ข้าวโตเฉพาะคืนที่น้ำอยู่ระหว่างน้ำตื้นถึงน้ำลึก</p>' +
    '<p class="purse">พยากรณ์พรุ่งนี้: ' +
    WEATHER_NAMES[s.forecast] +
    ' · เงิน ฿' +
    s.money +
    '</p>' +
    line(
      'กล้าข้าว ×' + paddy.seedlings,
      'หนึ่งมัดดำได้หนึ่งแปลง · ขายช่วง' + seasons(RICE.seasons),
      button('paddy:buy', 'ซื้อ ฿' + RICE.seedlingPrice, !riceInSeason(s) || s.money < RICE.seedlingPrice),
    );
  paddy.plots.forEach((plot, i) => {
    const growing = plot.stage === 'planted' && !plot.dead && !riceRipe(plot);
    const tonight = waterAfter(plot.water, plot.gate, s.forecast);
    html +=
      '<h3>แปลงนาที่ ' +
      (i + 1) +
      ' · ' +
      plotStatus(plot) +
      '</h3>' +
      line(
        'ระดับน้ำ: ' + WATER_NAMES[plot.water],
        'คืนนี้จะเป็น' + WATER_NAMES[tonight] + (growing && !goodWater(tonight) ? ' · ข้าวจะใบเหลือง ปรับประตูน้ำก่อนนอน' : ''),
      ) +
      actions(
        GATES.map((gate) =>
          button(
            'paddy:gate:' + i + ':' + gate,
            (plot.gate === gate ? '✓ ' : '') + GATE_NAMES[gate] + ' → ' + WATER_NAMES[waterAfter(plot.water, gate, s.forecast)],
            plot.gate === gate,
            true,
          ),
        ).join(''),
      ) +
      actions(
        plot.stage === 'fallow' || plot.dead
          ? button('paddy:plough:' + i, 'ไถนา')
          : plot.stage === 'ploughed'
            ? button('paddy:plant:' + i, 'ดำนา', paddy.seedlings < 1)
            : riceRipe(plot)
              ? button('paddy:harvest:' + i, 'เกี่ยวข้าว')
              : '',
      );
  });
  return (
    html +
    '<h3>ยุ้งข้าว</h3>' +
    line(
      GOODS.rice.name + ' ×' + s.estate.goods.rice,
      'ใส่ลังส่งของหน้าบ้านเพื่อขาย ' + GOODS.rice.unit + 'ละ ฿' + GOODS.rice.price,
    )
  );
}

function treeRow(s: GameState, tree: Tree, slot: number): string {
  const def = TREES[tree.id];
  const title = 'หลุมที่ ' + (slot + 1) + ' · ' + def.name;
  if (!isGrown(tree))
    return line(
      title,
      'ต้นอ่อน ' + tree.age + '/' + def.growDays + ' วัน · ' + (tree.watered ? 'ได้น้ำแล้ววันนี้' : 'ยังไม่ได้น้ำ'),
      button('orchard:water:' + slot, 'รดน้ำ', tree.watered),
    );
  const wait = nightsToFruit(tree, seasonOf(s.day));
  return line(
    title,
    (tree.fruit ? 'ผลสุก ×' + tree.fruit : 'ยังไม่มีผลสุก') +
      ' · ' +
      (wait === null ? 'ออกผล' + seasons(def.seasons) : 'ออกผลอีก ' + wait + ' คืน') +
      (tree.fed ? ' · ใส่ปุ๋ยแล้ว' : ''),
    '<div class="trade-buttons">' +
      button('orchard:pick:' + slot, 'เก็บผล', !tree.fruit) +
      button('orchard:feed:' + slot, 'ปุ๋ย ฿' + FERTILIZER.price, tree.fed || s.money < FERTILIZER.price, true) +
      '</div>',
  );
}

export function orchardPanel(s: GameState): string {
  const orchard = s.estate.orchard;
  const owned = TREE_IDS.filter((id) => orchard.saplings[id] > 0);
  const fruit = GOOD_IDS.filter((id) => id !== 'rice' && s.estate.goods[id] > 0);
  return (
    '<p>ต้นอ่อนต้องได้น้ำทุกวัน รดเองหรือฝนตกก็ได้ พอโตแล้วออกผลเองทุกปีเมื่อถึงฤดู เก็บผลก่อนวันพายุฝน เพราะพายุพัดผลร่วงครึ่งต้น</p>' +
    '<p class="purse">พยากรณ์พรุ่งนี้: ' +
    WEATHER_NAMES[s.forecast] +
    ' · เงิน ฿' +
    s.money +
    '</p>' +
    '<h3>กิ่งพันธุ์</h3>' +
    TREE_IDS.map((id) =>
      line(
        TREES[id].name + ' ×' + orchard.saplings[id],
        'โต ' + TREES[id].growDays + ' วัน · ออกผล' + seasons(TREES[id].seasons) + ' ทุก ' + TREES[id].cycle + ' วัน ครั้งละ ' + TREES[id].yield,
        button('orchard:buy:' + id, '฿' + TREES[id].saplingPrice, s.money < TREES[id].saplingPrice),
      ),
    ).join('') +
    '<h3>ต้นไม้ในสวน</h3>' +
    orchard.slots
      .map((tree, slot) =>
        tree
          ? treeRow(s, tree, slot)
          : line('หลุมที่ ' + (slot + 1) + ' · ว่าง', owned.length ? 'เลือกกิ่งพันธุ์ที่จะปลูก' : 'ซื้อกิ่งพันธุ์ก่อน') +
            actions(owned.map((id) => button('orchard:plant:' + slot + ':' + id, 'ปลูก' + TREES[id].name, false, true)).join('')),
      )
      .join('') +
    '<h3>ผลไม้ในกระเป๋า</h3>' +
    (fruit.map((id) => row(GOODS[id].name, '×' + s.estate.goods[id] + ' · ' + GOODS[id].unit + 'ละ ฿' + GOODS[id].price)).join('') ||
      '<p>ยังไม่มีผลไม้ เก็บแล้วใส่ลังส่งของหน้าบ้านเพื่อขาย</p>')
  );
}

export function festivalPanel(s: GameState): string {
  const today = festivalOn(s.day);
  let html: string;
  if (today) {
    const f = FESTIVALS[today];
    const closed = festivalClosed(s);
    html =
      '<h3>วันนี้: ' +
      f.name +
      '</h3><p>' +
      f.story +
      '</p>' +
      row('เวลา', festivalHours(today)) +
      row('ต้องเตรียม', f.bring) +
      row('สิ่งที่ได้', f.reward + ' · มิตรภาพ +' + f.friendship) +
      actions(button('festival:join', 'ร่วมงาน', closed !== null)) +
      (closed ? '<p>' + closed + '</p>' : '');
  } else {
    html = '<p>วันนี้ลานกลางเวียงเงียบสงบ ดูปฏิทินด้านล่างแล้วเตรียมของไว้ให้ทันงานถัดไป</p>';
  }
  return (
    html +
    '<h3>ปฏิทินงานประเพณี</h3>' +
    FESTIVAL_IDS.map((id) => ({ id, wait: daysUntil(id, s.day) }))
      .sort((a, b) => a.wait - b.wait)
      .map(({ id, wait }) =>
        line(
          FESTIVALS[id].name,
          SEASON_NAMES[FESTIVALS[id].season] + ' วันที่ ' + FESTIVALS[id].day + ' · ' + festivalHours(id) + ' · เตรียม: ' + FESTIVALS[id].bring,
          '<b>' + (wait ? 'อีก ' + wait + ' วัน' : 'วันนี้') + '</b>',
        ),
      )
      .join('')
  );
}

/** Extra rows for the bag: what the paddy and the orchard have put in it. */
export function estateBag(s: GameState): string {
  const { goods, goodsShipping, paddy, orchard } = s.estate;
  const carried = GOOD_IDS.filter((id) => goods[id] > 0);
  const waiting = GOOD_IDS.reduce((sum, id) => sum + goodsShipping[id], 0);
  const saplings = TREE_IDS.reduce((sum, id) => sum + orchard.saplings[id], 0);
  return (
    '<h3>ข้าวและผลไม้</h3>' +
    (carried.map((id) => row(GOODS[id].name, '×' + goods[id])).join('') || '<p>ยังไม่มีข้าวหรือผลไม้ในกระเป๋า</p>') +
    (paddy.seedlings || saplings ? row('กล้าข้าว / กิ่งพันธุ์', paddy.seedlings + ' / ' + saplings) : '') +
    (waiting ? row('ข้าวและผลไม้รอขายในลัง', waiting + ' ชิ้น') : '')
  );
}

/** Morning news from the paddy, the orchard and the festival calendar. */
export function notesHtml(notes: string[]): string {
  return notes.map((note) => '<p>' + note + '</p>').join('');
}
