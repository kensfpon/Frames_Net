import { destinations, herdInfo, merchant } from './shops';
import { layouts, npcs, type Person } from './regions';
import { regionNames, type Region } from '../rules/country';
import { names } from '../rules/village';
import { CROPS, CROP_IDS, SEASON_NAMES, WEATHER_NAMES, type CropId } from '../data/balance';
import { FISH, FISH_IDS } from '../data/fish';
import { dayOfSeason, seasonOf, yearOf, isWet, seasonWarning } from '../rules/calendar';
import { formatClock, type DaySummary } from '../rules/day';
import { seedsForSale } from '../rules/actions';
import type { GameState } from '../rules/state';
import type { FarmAudio } from './audio';
import { icon, decorate } from './icons';
import { W, H } from './ground';
export const toolNames = ['จอบ', 'บัวรดน้ำ', 'มือเก็บเกี่ยว', 'ถุงเมล็ด', 'เบ็ดตกปลา', 'ขวาน', 'อีเต้อ'];
export const toolArt = ['hoe', 'can', 'hand', 'seed', 'rod', 'axe', 'pick'];
export type Panel =
  | 'journal'
  | 'bag'
  | 'settings'
  | 'help'
  | 'shop'
  | 'sleep'
  | 'new'
  | 'summary'
  | 'mali'
  | 'chai'
  | 'travel'
  | 'herd'
  | Person;
const $ = (id: string) => document.getElementById(id)!;
const button = (cmd: string, label: string, quiet = false) =>
  '<button class="action ' + (quiet ? 'quiet' : '') + '" data-cmd="' + cmd + '">' + label + '</button>';
const itemPic = (id: string, label: string) =>
  '<span class="item-name"><img alt="" src="/art/' + id + '.webp">' + label + '</span>';
const row = (a: string, b: string) => '<div class="row"><span>' + a + '</span><b>' + b + '</b></div>';
const seasonText = (s: GameState) => SEASON_NAMES[seasonOf(s.day)] + ' • ปีที่ ' + yearOf(s.day);
function tasks(s: GameState) {
  const tiles = s.tiles.flat();
  return [
    [
      'พรวนดินแปลงแรก',
      tiles.some((t) => t.kind === 'tilled' && !t.crop) || tiles.some((t) => t.crop?.growth === 0),
    ],
    ['หว่านเมล็ดลงแปลง', tiles.some((t) => t.crop?.growth === 0)],
    ['รดน้ำต้นกล้า', tiles.some((t) => t.crop?.growth === 0 && t.watered)],
  ] as const;
}
export class Hud {
  private stage = document.querySelector<HTMLElement>('.stage')!;
  private world = $('game');
  private dialog = $('dialog') as HTMLDialogElement;
  private cached = '';
  private timer?: number;
  panel: Panel | null = null;
  constructor(
    private command: (cmd: string) => void,
    private audio: FarmAudio,
  ) {
    $('slots').innerHTML = toolNames
      .map(
        (name, i) =>
          '<button class="slot" data-cmd="tool-' +
          i +
          '" title="' +
          name +
          ' (' +
          (i + 1) +
          ')"><small>' +
          (i + 1) +
          '</small><img alt="" src="/art/' +
          toolArt[i] +
          '.webp"><b>' +
          name +
          '</b>' +
          (i === 3 ? '<em id="seeds"></em>' : '') +
          '</button>',
      )
      .join('');
    const stage = this.stage,
      world = this.world;
    const position = () => this.positionPins();
    stage.scrollLeft = (world.offsetWidth - stage.clientWidth) / 2;
    new ResizeObserver(() => {
      stage.scrollLeft = (world.offsetWidth - stage.clientWidth) / 2;
      position();
    }).observe(world);
    stage.addEventListener('scroll', position);
    stage.addEventListener(
      'wheel',
      (e) => {
        if (world.offsetWidth > stage.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          stage.scrollLeft += e.deltaY;
        }
      },
      { passive: false },
    );
    decorate();
    document.addEventListener('click', (event) => {
      const cmd = (event.target as Element).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
      if (cmd) {
        this.audio.unlock();
        this.command(cmd);
      }
    });
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.command('close');
    });
    this.dialog.addEventListener('input', (e) => {
      if ((e.target as HTMLInputElement).id === 'volume') {
        this.audio.level = +(e.target as HTMLInputElement).value / 100;
        this.audio.persist();
      }
    });
    this.soundIcon();
  }
  private region: Region = 'farm';
  setRegion(region: Region) {
    this.region = region;
    $('locations').innerHTML = Object.entries(layouts[region].spots)
      .map(
        ([id, s]) =>
          '<button class="site" data-cmd="site-' +
          id +
          '" aria-label="' +
          s.label +
          '" title="' +
          s.label +
          '"><span>' +
          (id === 'mali' ? '!' : id === 'chai' ? '…' : icon(s.icon)) +
          '</span><b>' +
          s.label +
          '</b></button>',
      )
      .join('');
    $('area-name').textContent = regionNames[region];
    $('task-card').hidden = region !== 'farm';
    this.positionPins();
    this.invalidate();
  }
  private positionPins() {
    for (const [id, s] of Object.entries(layouts[this.region].spots)) {
      const pin = document.querySelector<HTMLElement>('[data-cmd="site-' + id + '"]')!;
      if (!pin) continue;
      pin.style.left = (s.pin.x / W) * this.world.offsetWidth - this.stage.scrollLeft + 'px';
      pin.style.top = (s.pin.y / H) * this.world.offsetHeight + 'px';
    }
  }
  follow(x: number) {
    const stage = this.stage;
    if (this.world.offsetWidth <= stage.clientWidth) return;
    const screenX = (x / W) * this.world.offsetWidth - stage.scrollLeft;
    const margin = Math.min(100, stage.clientWidth * 0.22);
    if (screenX < margin) stage.scrollLeft += screenX - margin;
    if (screenX > stage.clientWidth - margin) stage.scrollLeft += screenX - stage.clientWidth + margin;
  }
  invalidate() {
    this.cached = '';
  }
  soundIcon() {
    const el = $('sound');
    el.innerHTML = icon(this.audio.muted ? 'mute' : 'sound');
    el.setAttribute('aria-label', this.audio.muted ? 'เปิดเสียง' : 'ปิดเสียง');
    el.setAttribute('aria-pressed', String(!this.audio.muted));
  }
  refresh(s: GameState, slot: number, seed: CropId) {
    const units = s.seeds[seed],
      signature = [s.day, s.minutes, s.weather, s.stamina, s.money, slot, seed, units].join('|');
    if (this.cached === signature) return;
    this.cached = signature;
    const hen = document.querySelector<HTMLElement>('[data-cmd="site-hen"]');
    if (hen) hen.hidden = !s.village.coop;
    $('day').textContent = 'วันที่ ' + dayOfSeason(s.day);
    $('clock').textContent = formatClock(s.minutes);
    $('season').textContent = seasonText(s);
    $('money').textContent = s.money.toLocaleString('th-TH');
    $('weather').textContent = WEATHER_NAMES[s.weather];
    $('weather-medal').innerHTML = '<i>' + icon(isWet(s.weather) ? 'rain' : 'sun') + '</i>';
    $('energy').textContent = s.stamina + '/100';
    $('charge').style.width = s.stamina + '%';
    $('seeds').textContent = '×' + units;
    $('task').textContent = tasks(s).find((t) => !t[1])?.[0] ?? 'พักที่บ้านเพื่อเริ่มวันใหม่';
    document.querySelectorAll('.slot').forEach((el, i) => {
      el.classList.toggle('active', i === slot);
      el.setAttribute('aria-pressed', String(i === slot));
    });
    $('seed-choice').hidden = slot !== 3;
    $('seed-choice').textContent = CROPS[seed].name + ' ×' + units + ' · เปลี่ยน [Q]';
  }
  toast(text: string) {
    if (this.dialog.open) {
      const msg = $('page').querySelector('.message');
      if (msg) {
        msg.textContent = text;
        return;
      }
    }
    $('toast').textContent = text;
    $('toast').classList.add('show');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => $('toast').classList.remove('show'), 2300);
  }
  close() {
    this.dialog.close();
    this.panel = null;
    this.nav('farm');
  }
  private nav(cmd: string) {
    document.querySelectorAll('.nav').forEach((n) => {
      const on = (n as HTMLElement).dataset.cmd === cmd;
      n.classList.toggle('active', on);
      if (on) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });
  }
  open(panel: Panel, s: GameState, summary?: DaySummary) {
    this.panel = panel;
    let title = '',
      body = '';
    const actions = (html: string) => '<div class="actions">' + html + '</div>';
    switch (panel) {
      case 'travel':
        title = 'แผนที่เดินทาง';
        body = destinations(s.country.region);
        break;
      case 'herd':
        title = 'คอกสัตว์ของฉัน';
        body = herdInfo(s);
        break;
      case 'cook':
      case 'trader':
      case 'smith':
      case 'rancher':
      case 'ranger':
      case 'fisher':
        title = npcs[panel].name;
        body = merchant(panel, s);
        break;
      case 'mali':
      case 'chai': {
        const mali = panel === 'mali',
          v = s.village,
          f = v.people[panel];
        title = names[panel];
        const line = mali
          ? f.points >= 5
            ? 'ดีใจที่ได้เจอกันอีกนะ วันนี้ดอกไม้บานเต็มทางเลย'
            : 'ฉันเก็บดอกไม้มาจัดที่ร้านทุกเช้า แถวพุ่มหม่อนมีลูกสุกให้เก็บด้วยนะ'
          : v.coop
            ? 'แม่ไก่ชอบลูกหม่อน ให้กินวันละครั้งแล้วพรุ่งนี้ลองไปดูที่รังนะ'
            : 'อยากเลี้ยงไก่ไหม? เอาไม้จากกองข้างบ้านกับหินข้างป้ายมาให้ลุงสิ';
        body =
          '<div class="conversation"><img src="/art/' +
          panel +
          '.webp" alt=""><div><strong>' +
          (mali ? 'คนขายดอกไม้' : 'ช่างไม้ประจำหมู่บ้าน') +
          '</strong><p>“' +
          line +
          '”</p><span class="hearts" aria-label="มิตรภาพ ' +
          f.points +
          ' จาก 20">' +
          '♥'.repeat(Math.ceil(f.points / 4)) +
          '♡'.repeat(5 - Math.ceil(f.points / 4)) +
          '</span></div></div>' +
          row('ลูกหม่อนในกระเป๋า', '×' + v.berry) +
          actions(button('gift', 'ให้ลูกหม่อน 1 ลูก', true));
        if (mali)
          body +=
            '<h3>คำขอวันนี้</h3>' +
            row(s.day % 2 ? 'ผักบุ้ง 2 กำ' : 'ลูกหม่อน 2 ลูก', '฿70') +
            (v.orderDay === s.day
              ? '<p>ส่งของเรียบร้อยแล้ว</p>'
              : actions(button('order', 'ส่งของให้มะลิ')));
        else
          body +=
            '<h3>เล้าไก่</h3>' +
            (v.coop
              ? '<p>เล้าไก่อยู่ทางซ้ายของแปลงผัก</p>'
              : row('วัสดุที่มี', 'ไม้ ' + v.wood + '/3 · หิน ' + v.stone + '/2') +
                actions(button('build', 'สร้างเล้าไก่')));
        break;
      }
      case 'help':
        title = 'วิธีเล่น';
        body =
          '<p>เลือกจอบแล้วคลิกดินกลางแปลง ชาวไร่จะเดินไปพรวนดินให้ จากนั้นเลือกถุงเมล็ดและบัวรดน้ำ ใช้ที่ช่องเดิมตามลำดับ</p>' +
          '<p>คลิกชาวบ้านเพื่อพูดคุย มะลิมีคำขอประจำวัน ลุงชัยสร้างเล้าไก่ให้ได้เมื่อสะสมไม้และหินครบ</p>' +
          row('เดิน', 'WASD / ลูกศร') +
          row('เลือกเครื่องมือ / เปลี่ยนเมล็ด', '1–7 / Q') +
          row('ใช้เครื่องมือตรงหน้า', 'Space') +
          row('โต้ตอบกับสถานที่ใกล้ตัว', 'E') +
          '<p>ปัดภาพซ้ายขวาหรือเลื่อนล้อเมาส์เพื่อดูไร่บนจอแคบ แตะป้ายสถานที่เพื่อเดินไปใช้งาน ตกปลาที่บ่อแล้วแตะอีกครั้งเมื่อปลาเริ่มกินเบ็ด เข้านอนที่บ้านเพื่อให้ผักที่รดน้ำเติบโต</p>';
        break;
      case 'journal': {
        title = 'บันทึกฟาร์ม';
        const tiles = s.tiles.flat(),
          warn = seasonWarning(s.day);
        body =
          row('วันที่ ' + dayOfSeason(s.day), seasonText(s)) +
          row('อากาศวันนี้', WEATHER_NAMES[s.weather]) +
          row('พยากรณ์พรุ่งนี้', WEATHER_NAMES[s.forecast]) +
          row('พืชในแปลง', tiles.filter((t) => t.crop).length + ' ต้น') +
          '<h3>คำขอของมะลิ</h3>' +
          row(
            s.day % 2 ? 'ผักบุ้ง 2 กำ' : 'ลูกหม่อน 2 ลูก',
            s.village.orderDay === s.day ? 'ส่งแล้ว' : '฿70',
          ) +
          row('มิตรภาพ · มะลิ', s.village.people.mali.points + '/20') +
          row('มิตรภาพ · ลุงชัย', s.village.people.chai.points + '/20') +
          '<h3>งานในไร่</h3>' +
          tasks(s)
            .map((t) => row(t[0], t[1] ? '✓' : '○'))
            .join('') +
          (warn ? '<p>อีก ' + warn + ' วันจะเปลี่ยนฤดู</p>' : '');
        break;
      }
      case 'bag': {
        title = 'กระเป๋าของฉัน';
        const goods = [
          ...CROP_IDS.filter((i) => s.produce[i] > 0).map((i) => row(CROPS[i].name, '×' + s.produce[i])),
          ...FISH_IDS.filter((i) => s.fish[i] > 0).map((i) => row(FISH[i].name, '×' + s.fish[i])),
        ];
        body =
          '<img class="bag-art" src="/art/basket.webp" alt=""><h3>เมล็ดพันธุ์</h3>' +
          (CROP_IDS.filter((i) => s.seeds[i] > 0)
            .map((i) => row(CROPS[i].name, button('equip-' + i, 'เลือก ×' + s.seeds[i], true)))
            .join('') || '<p>ถุงเมล็ดว่าง ซื้อเมล็ดได้ที่ร้าน</p>') +
          '<h3>ผลผลิตจากคอกและป่า</h3>' +
          row(
            'ไข่เป็ด / น้ำนม / สมุนไพร',
            [s.country.duckEggs, s.country.milk, s.country.herbs].join(' / '),
          ) +
          '<h3>ผลผลิตและปลา</h3>' +
          (goods.join('') || '<p>ยังไม่มีผลผลิตในกระเป๋า</p>') +
          '<h3>ของจากหมู่บ้าน</h3>' +
          ['wood', 'stone', 'berry', 'eggs']
            .map((key) => {
              const k = key as 'wood' | 'stone' | 'berry' | 'eggs';
              return row(
                itemPic(k === 'eggs' ? 'egg' : k, k === 'eggs' ? 'ไข่ไก่' : names[k]),
                '×' + s.village[k],
              );
            })
            .join('') +
          '<h3>รอส่งขายในลัง</h3>' +
          row(
            'จำนวน',
            Object.values(s.shipping)
              .concat(Object.values(s.fishShipping))
              .reduce((a, b) => a + b, s.village.eggsShipping) + ' ชิ้น',
          );
        break;
      }
      case 'settings':
        title = 'ตั้งค่า';
        body =
          row('เสียงในฟาร์ม', button('sound', this.audio.muted ? 'เปิดเสียง' : 'ปิดเสียง', true)) +
          row(
            'ระดับเสียง',
            '<input id="volume" aria-label="ระดับเสียง" type="range" min="0" max="100" value="' +
              Math.round(this.audio.level * 100) +
              '">',
          ) +
          actions(button('save', 'บันทึกเกม') + button('new', 'เริ่มเกมใหม่', true));
        break;
      case 'shop':
        title = 'ร้านเมล็ดพันธุ์';
        body =
          '<p>' +
          seasonText(s) +
          ' · มีเงิน ฿' +
          s.money +
          '</p>' +
          seedsForSale(s)
            .map((i) =>
              row(
                CROPS[i].name + ' <small>โต ' + CROPS[i].days + ' วัน · มี ' + s.seeds[i] + '</small>',
                button('buy-' + i, '฿' + CROPS[i].seedPrice),
              ),
            )
            .join('');
        break;
      case 'sleep':
        title = 'พักที่บ้าน';
        body =
          '<p>เข้านอนเพื่อฟื้นพลัง ผักที่รดน้ำจะเติบโต และของในลังจะขายตอนเช้า</p>' +
          actions(button('next', 'เข้านอน [E]') + button('close', 'อยู่ต่อ', true));
        break;
      case 'new':
        title = 'เริ่มไร่ใหม่ไหม?';
        body =
          '<p>การเริ่มใหม่จะแทนที่ฟาร์มที่บันทึกไว้</p>' +
          actions(button('reset', 'ยืนยันเริ่มใหม่ [Y]') + button('close', 'ยกเลิก', true));
        break;
      case 'summary':
        title = 'เช้าวันที่ ' + dayOfSeason(s.day);
        if (summary)
          body =
            '<p>' +
            (summary.passedOut
              ? 'เมื่อคืนหลับไปตอนเที่ยงคืน วันนี้มีพลังครึ่งหนึ่ง'
              : 'พักเต็มอิ่ม พร้อมเริ่มวันใหม่') +
            '</p>' +
            row('วันนี้ / พรุ่งนี้', WEATHER_NAMES[s.weather] + ' / ' + WEATHER_NAMES[s.forecast]) +
            summary.sold.map((l) => row(l.name + ' ×' + l.count, '฿' + l.amount)).join('') +
            row('รายได้จากการขาย', '฿' + summary.total) +
            (summary.newSeason
              ? '<p>เข้าสู่' +
                SEASON_NAMES[summary.newSeason] +
                ' พืชเหี่ยว ' +
                summary.withered +
                ' ต้น</p>'
              : '') +
            actions(button('close', 'เริ่มวันใหม่'));
        break;
    }
    $('page').innerHTML =
      '<h2 id="panel-title">' + title + '</h2>' + body + '<div role="status" class="message"></div>';
    this.dialog.setAttribute('aria-labelledby', 'panel-title');
    this.nav(panel);
    if (!this.dialog.open) this.dialog.showModal();
  }
}
