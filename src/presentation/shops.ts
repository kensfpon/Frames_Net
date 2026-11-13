import { CROPS, CROP_IDS, type CropId } from '../data/balance';
import { FISH, FISH_IDS } from '../data/fish';
import type { GameState } from '../rules/state';
import { animals, gear, meals, marketSeeds, regionNames, type Region } from '../rules/country';
import { layouts, npcs, regionArt, type Person } from './regions';

const action = (key: string, label: string, disabled = false) =>
  '<button class="action" data-cmd="trade-' +
  key +
  '"' +
  (disabled ? ' disabled' : '') +
  '>' +
  label +
  '</button>';
const line = (title: string, note: string, control: string) =>
  '<div class="row"><span><strong>' +
  title +
  '</strong><small class="detail">' +
  note +
  '</small></span>' +
  control +
  '</div>';
export function destinations(current: Region) {
  return (
    '<div class="postcards">' +
    (Object.keys(regionNames) as Region[])
      .map(
        (id) =>
          '<button data-cmd="travel-' +
          id +
          '" ' +
          (id === current ? 'disabled' : '') +
          '><img src="' +
          regionArt(id) +
          '" alt=""><span><b>' +
          regionNames[id] +
          '</b><small>' +
          (id === current ? 'คุณอยู่ที่นี่' : layouts[id].description) +
          '</small></span></button>',
      )
      .join('') +
    '</div>'
  );
}
export function herdInfo(s: GameState) {
  const c = s.country;
  return (
    line('สัตว์ของคุณ', 'เป็ด ' + c.duck + ' ตัว · วัว ' + c.cow + ' ตัว', '') +
    line(
      'อาหารสัตว์ ' + c.feed + ' ส่วน',
      'วันนี้กินแล้ว ' + (c.fedCows + c.fedDucks) + ' / ' + (c.duck + c.cow) + ' ตัว',
      action('care', 'ให้อาหาร'),
    ) +
    line('ผลผลิตในกระเป๋า', 'ไข่เป็ด ' + c.duckEggs + ' ฟอง · น้ำนม ' + c.milk + ' ขวด', '')
  );
}
export function merchant(person: Person, s: GameState) {
  const n = npcs[person],
    c = s.country;
  let result =
    '<div class="conversation"><img src="/art/' +
    person +
    '.webp" alt=""><div><strong>' +
    n.role +
    '</strong><p>' +
    n.line +
    '</p></div></div>';
  if (person === 'ranger' || person === 'fisher') return result;
  result += '<p class="purse">เงินในกระเป๋า ฿' + s.money + '</p>';
  if (person === 'cook')
    for (const [id, m] of Object.entries(meals))
      result += line(
        m.name,
        'กินทันที · พลังงาน +' + m.energy,
        action('meal:' + id, '฿' + m.cost, s.stamina >= 100 || s.money < m.cost),
      );
  if (person === 'smith')
    for (const [id, g] of Object.entries(gear)) {
      const owned = c[id as keyof typeof gear];
      result += line(
        g.name,
        g.note,
        action('gear:' + id, owned ? 'ติดตั้งแล้ว' : '฿' + g.cost, owned || s.money < g.cost),
      );
    }
  if (person === 'rancher') {
    for (const id of ['duck', 'cow'] as const) {
      const a = animals[id];
      result += line(
        a.name + ' ×' + c[id],
        a.product + ' ขายได้ ฿' + a.price,
        '<div class="trade-buttons">' +
          action('animal:' + id, 'ซื้อ ฿' + a.buy, c[id] >= 6 || s.money < a.buy) +
          action('sellAnimal:' + id, 'ขาย ฿' + a.sell, !c[id]) +
          '</div>',
      );
    }
    result += line('อาหารสัตว์', '3 ส่วน', action('feed', '฿9', s.money < 9)) + herdInfo(s);
  }
  if (person === 'trader') {
    result += '<h3>รับซื้อทันที</h3>';
    const sale = (id: string, name: string, count: number, price: number) =>
      count ? line(name + ' ×' + count, 'ขายทีละชิ้น', action('sell:' + id, 'ขาย ฿' + price)) : '';
    const goods =
      CROP_IDS.map((id) => sale(id, CROPS[id].name, s.produce[id], CROPS[id].sellPrice)).join('') +
      FISH_IDS.map((id) => sale(id, FISH[id].name, s.fish[id], FISH[id].price)).join('') +
      sale('eggs', 'ไข่ไก่', s.village.eggs, 35) +
      sale('duckEggs', 'ไข่เป็ด', c.duckEggs, 28) +
      sale('milk', 'น้ำนม', c.milk, 68) +
      sale('herbs', 'สมุนไพรป่า', c.herbs, 18);
    result += goods || '<p>เก็บผัก ปลา สมุนไพร หรือผลผลิตจากสัตว์มาขายได้ที่นี่</p>';
    result +=
      '<h3>เมล็ดประจำฤดู</h3>' +
      marketSeeds(s)
        .map((id: CropId) =>
          line(
            CROPS[id].name,
            'โต ' + CROPS[id].days + ' วัน · มี ' + s.seeds[id],
            action('seed:' + id, '฿' + CROPS[id].seedPrice, s.money < CROPS[id].seedPrice),
          ),
        )
        .join('');
  }
  return result;
}
