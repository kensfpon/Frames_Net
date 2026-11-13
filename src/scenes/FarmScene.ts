import { layouts, npcs, regionArt, canWalk, type Person } from '../presentation/regions';
import { forage, trade, regionNames, type Region } from '../rules/country';
import {
  greet,
  gather,
  giveBerry,
  completeOrder,
  buildCoop,
  careForHen,
  type Villager,
} from '../rules/village';
import Phaser from 'phaser';
import { CROPS, CROP_IDS, MS_PER_TICK, MINUTES_PER_TICK, type CropId } from '../data/balance';
import { FIELD, MAP_OBJECTS } from '../data/map';
import { FISH, type FishId } from '../data/fish';
import {
  buySeed,
  shipAll,
  useTool,
  shopClosedReason,
  seedsForSale,
  type FailReason,
  type Tool,
} from '../rules/actions';
import { isWet, seasonOf } from '../rules/calendar';
import { advanceMinutes, endDay } from '../rules/day';
import { castLine, spendCast, landFish, rollBiteDelayMs, rollFish } from '../rules/fishing';
import { createNewGame, type GameState } from '../rules/state';
import { loadGame, saveGame } from '../storage';
import { Hud, toolArt, type Panel } from '../presentation/hud';
import { FarmAudio } from '../presentation/audio';
import { W, H, cellAt, center, corner, route, type Cell, type Point } from '../presentation/ground';

const fail: Record<FailReason, string> = {
  tired: 'พลังงานหมดแล้ว กลับบ้านเพื่อพักผ่อน',
  notField: 'เลือกช่องดินกลางแปลง',
  notGrass: 'พรวนดินช่องนี้แล้ว',
  notTilled: 'ใช้จอบพรวนดินก่อน',
  alreadyWatered: 'ช่องนี้รดน้ำแล้ววันนี้',
  occupied: 'ช่องนี้มีต้นไม้อยู่แล้ว',
  noSeed: 'ถุงเมล็ดว่าง ซื้อได้ที่ร้านเมล็ดพันธุ์',
  outOfSeason: 'เมล็ดนี้ปลูกในฤดูนี้ไม่ได้',
  nothingToHarvest: 'ยังไม่มีพืชให้เก็บ',
  notRipe: 'ผักยังโตไม่เต็มที่',
  shopClosed: 'ร้านเปิด 08:00–17:00 น.',
  shopStorm: 'ร้านปิดวันนี้เนื่องจากพายุ',
  notWater: 'ไปที่บ่อตกปลาเพื่อเหวี่ยงเบ็ด',
  notSold: 'ฤดูนี้ไม่มีเมล็ดนี้ขาย',
  noMoney: 'เงินไม่พอซื้อเมล็ด',
  nothingToShip: 'กระเป๋ายังไม่มีผลผลิตหรือปลา',
};
const SPAWN = { x: 740, y: 413 };
const same = (a: Cell | null, b: Cell | null) => a?.col === b?.col && a?.row === b?.row;
type Cast = { ms: number; fish?: FishId };
export class FarmScene extends Phaser.Scene {
  state!: GameState;
  private audioFx = new FarmAudio();
  private hud!: Hud;
  selected = 0;
  seedChoice: CropId = 'morningGlory';
  private actor!: Phaser.GameObjects.Image;
  private backdrop!: Phaser.GameObjects.Image;
  private people!: Phaser.GameObjects.Group;
  private herdSprites!: Phaser.GameObjects.Group;
  private herdSignature = '';
  private get region() {
    return this.state.country.region;
  }
  private get spots() {
    return layouts[this.region].spots;
  }
  private coop!: Phaser.GameObjects.Image;
  private chicken!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private toolProp!: Phaser.GameObjects.Image;
  private cursor!: Phaser.GameObjects.Graphics;
  private weather!: Phaser.GameObjects.Graphics;
  private terrain!: Phaser.GameObjects.Layer;
  private castInfo!: Phaser.GameObjects.Text;
  private waterLine!: Phaser.GameObjects.Graphics;
  private pos: Point = { ...SPAWN };
  private face: Point = { x: 0, y: 1 };
  private aim: Cell | null = null;
  private lastOutline: Cell | null = null;
  private path: Point[] = [];
  private arrived?: () => void;
  private cast: Cast | null = null;
  private keys = new Set<string>();
  private tick = 0;
  private steps = 0;
  private lastStep = 0;
  private birdTime = 0;
  private swing = 0;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor() {
    super('farm');
  }
  preload() {
    for (const region of Object.keys(regionNames) as Region[])
      if (region !== 'farm') this.load.image(region, regionArt(region));
    for (const key of [...Object.keys(npcs), 'duck', 'cow'])
      this.load.image(key, '/art/' + key + '.webp');
    this.load.image('valley', '/art/valley.webp');
    this.load.spritesheet('farmer', '/art/farmer.webp', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('plants', '/art/plants.webp', { frameWidth: 48, frameHeight: 48 });
    for (const name of ['mali', 'chai', 'hen', 'coop']) this.load.image(name, '/art/' + name + '.webp');
    toolArt.forEach((id) => this.load.image(id, '/art/' + id + '.webp'));
  }
  create() {
    const loaded = loadGame();
    this.state = loaded.status === 'ok' ? loaded.state : createNewGame();
    this.pickSeed();
    this.backdrop = this.add.image(0, 0, 'valley').setOrigin(0);
    this.people = this.add.group();
    this.herdSprites = this.add.group();
    this.coop = this.add.image(266, 482, 'coop').setOrigin(0.5, 1).setDisplaySize(86, 86).setDepth(2);
    this.chicken = this.add.image(304, 484, 'hen').setOrigin(0.5, 1).setDisplaySize(39, 39).setDepth(2);
    this.terrain = this.add.layer().setDepth(1);
    this.cursor = this.add.graphics().setDepth(2);
    this.shadow = this.add.ellipse(0, 0, 34, 9, 0x201a0e, 0.34).setDepth(3);
    this.actor = this.add.image(0, 0, 'farmer', 0).setOrigin(0.5, 1).setDepth(4);
    this.toolProp = this.add.image(0, 0, 'hoe').setDepth(5).setVisible(false);
    this.weather = this.add.graphics().setDepth(8);
    this.waterLine = this.add.graphics().setDepth(5);
    this.castInfo = this.add
      .text(0, 0, '', {
        fontFamily: 'Tahoma',
        fontSize: '19px',
        padding: { x: 10, y: 6 },
        backgroundColor: '#243a2c',
        color: '#ffedb1',
      })
      .setOrigin(0.5, 1)
      .setDepth(9)
      .setVisible(false);
    this.hud = new Hud((c) => this.command(c), this.audioFx);
    this.enterRegion(this.region);
    this.renderActor(false, 0);
    this.aim = this.front();
    this.outline(this.aim);
    const canvas = this.game.canvas;
    const point = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height };
    };
    let down: Point | null = null;
    canvas.addEventListener('pointerdown', (ev) => {
      this.audioFx.unlock();
      down = { x: ev.clientX, y: ev.clientY };
    });
    canvas.addEventListener('pointercancel', () => {
      down = null;
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!this.hud.panel && !this.cast && ev.pointerType === 'mouse') {
        const c = this.region === 'farm' ? cellAt(point(ev)) : null;
        this.outline(c ?? this.aim);
      }
    });
    canvas.addEventListener('pointerleave', () => this.outline(this.aim));
    canvas.addEventListener('pointerup', (ev) => {
      if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 12) return;
      down = null;
      if (this.hud.panel) return;
      if (this.cast) {
        this.pull();
        return;
      }
      const p = point(ev),
        c = this.region === 'farm' ? cellAt(p) : null;
      if (c) {
        this.aim = c;
        this.outline(c);
        const foot = center(c);
        this.go({ x: foot.x, y: foot.y - 9 }, () => this.work(c));
        return;
      }
      const target = Object.keys(this.spots).find((id) => {
        if (id === 'hen' && !this.state.village.coop) return false;
        const pin = this.spots[id].pin;
        return Math.abs(p.x - pin.x) < 37 && p.y >= pin.y - 12 && p.y <= pin.y + 59;
      });
      if (target) {
        this.visit(target);
        return;
      }
      if ((this.region === 'lake' && p.y < 600) || (this.region === 'coast' && p.y < 445)) {
        this.visit('angling');
        return;
      }
      if (this.region === 'farm' && p.x > 1204 && p.x < 1494 && p.y > 485 && p.y < 680) {
        this.visit('pond');
        return;
      }
      if (canWalk(this.region, p)) {
        this.aim = null;
        this.go(p);
        return;
      }
      this.hud.toast('คลิกที่แปลงดิน ทางเดิน หรือป้ายสถานที่');
    });
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearKeys);
    document.addEventListener('visibilitychange', this.visibility);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.keyDown);
      window.removeEventListener('keyup', this.keyUp);
      window.removeEventListener('blur', this.clearKeys);
      document.removeEventListener('visibilitychange', this.visibility);
    });
    this.hud.refresh(this.state, this.selected, this.seedChoice);
    if (loaded.status === 'corrupt') this.hud.toast('อ่านเซฟเดิมไม่ได้ เริ่มฟาร์มใหม่แล้ว');
  }
  private clearKeys = () => {
    this.keys.clear();
  };
  private visibility = () => {
    this.keys.clear();
    this.audioFx.mix();
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private keyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    this.audioFx.unlock();
    const k = e.code,
      p = this.hud.panel;
    if (p) {
      if (e.repeat) return;
      if (
        k === 'Escape' ||
        (p === 'help' && ['KeyH', 'KeyE'].includes(k)) ||
        (p === 'shop' && k === 'KeyE') ||
        (p === 'summary' && ['KeyE', 'Space'].includes(k))
      ) {
        e.preventDefault();
        this.command('close');
      } else if (p === 'sleep' && k === 'KeyE') this.command('next');
      else if (p === 'new' && k === 'KeyY') this.command('reset');
      else if (p === 'shop' && /^Digit[1-6]$/.test(k)) {
        const id = seedsForSale(this.state)[Number(k.slice(-1)) - 1];
        if (id) this.command('buy-' + id);
      }
      return;
    }
    if (k === 'Space' && (e.target as HTMLElement).matches('button:focus-visible')) return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
        'F2',
      ].includes(k)
    )
      e.preventDefault();
    this.keys.add(k);
    if (e.repeat) return;
    if (this.cast) {
      if (k === 'Space') this.pull();
      if (k === 'Escape') this.stopCast();
      return;
    }
    if (/^Digit[1-7]$/.test(k)) this.command('tool-' + (Number(k.slice(-1)) - 1));
    if (k === 'KeyQ') this.command('seed');
    if (k === 'KeyM') this.command('travel');
    if (k === 'KeyI') this.command('bag');
    if (k === 'KeyJ') this.command('journal');
    if (k === 'KeyH') this.command('help');
    if (k === 'F2') this.command('new');
    if (k === 'Space') {
      this.stopTravel();
      if (this.region !== 'farm') {
        const key =
          this.selected === 4
            ? 'angling'
            : this.selected === 5
              ? 'timber'
              : this.selected === 2
                ? 'herbs'
                : '';
        if (key && this.near(key)) this.useSite(key);
        else this.hud.toast('เดินเข้าใกล้จุดใช้งานแล้วกด E หรือคลิกป้าย');
      } else if (this.selected >= 5) {
        const id = this.selected === 5 ? 'wood' : 'stone';
        if (this.near(id)) this.useSite(id);
        else this.hud.toast('เดินไปที่' + this.spots[id].label + 'ก่อน');
      } else if (this.selected === 4) {
        if (this.near('pond')) this.startCast();
        else this.hud.toast(fail.notWater);
      } else this.work(this.aim ?? this.front());
    }
    if (k === 'KeyE') {
      const id = Object.keys(this.spots)
        .filter((i) => (i !== 'hen' || this.state.village.coop) && this.near(i))
        .sort((a, b) => this.distance(a) - this.distance(b))[0];
      if (id) this.useSite(id);
      else this.hud.toast('เดินเข้าใกล้ป้ายสถานที่ หรือคลิกป้ายเพื่อเดินไป');
    }
  };
  private near(id: string) {
    return this.distance(id) < 64;
  }
  private distance(id: string) {
    if (!this.spots[id]) return Infinity;
    const p = this.spots[id].foot;
    return Math.hypot(p.x - this.pos.x, p.y - this.pos.y);
  }
  private front() {
    if (this.region !== 'farm') return null;
    return cellAt({ x: this.pos.x + this.face.x * 48, y: this.pos.y + this.face.y * 31 });
  }
  private stopTravel() {
    this.path = [];
    this.arrived = undefined;
  }
  private go(p: Point, arrive?: () => void) {
    this.stopTravel();
    if (Math.hypot(this.pos.x - p.x, this.pos.y - p.y) < 9) {
      arrive?.();
      return;
    }
    this.aim = null;
    this.outline(null);
    this.path = route(this.pos, p, (point) => canWalk(this.region, point));
    if (this.path.length) this.arrived = arrive;
    else this.hud.toast('ไปไม่ถึงจุดนี้ เลือกทางเดินหรือช่องดินอีกครั้ง');
  }
  private visit(id: string) {
    if (this.cast) {
      if (id === 'pond' || id === 'angling') this.pull();
      return;
    }
    this.aim = null;
    if (!this.spots[id]) return;
    this.go(this.spots[id].foot, () => this.useSite(id));
  }
  private enterRegion(region: Region) {
    this.stopTravel();
    this.stopCast();
    this.keys.clear();
    this.swing = 0;
    this.state.country.region = region;
    this.backdrop.setTexture(region === 'farm' ? 'valley' : region).setDisplaySize(W, H);
    this.people.clear(true, true);
    const add = (texture: string, x: number, y: number) =>
      this.people.add(this.add.image(x, y, texture).setOrigin(0.5, 1).setDisplaySize(73, 73).setDepth(2));
    if (region === 'farm') {
      add('mali', 921, 365);
      add('chai', 192, 392);
    } else
      for (const m of Object.values(this.spots)) if (m.sprite) add(m.sprite, m.foot.x - 22, m.foot.y - 2);
    this.terrain.setVisible(region === 'farm');
    this.coop.setVisible(region === 'farm' && this.state.village.coop);
    this.chicken.setVisible(region === 'farm' && this.state.village.coop);
    this.herdSignature = '';
    this.renderHerd();
    this.pos = { ...layouts[region].spawn };
    this.face = { x: 0, y: 1 };
    this.aim = this.front();
    this.outline(this.aim);
    if (region === 'farm') this.drawBed();
    this.hud.setRegion(region);
    this.hud.follow(this.pos.x);
    this.renderActor(false, 0);
    this.birdTime = 0;
    this.audioFx.setRegion(region);
  }
  private renderHerd() {
    const c = this.state.country,
      signature = [this.region, c.duck, c.cow].join('/');
    if (signature === this.herdSignature) return;
    this.herdSignature = signature;
    this.herdSprites.clear(true, true);
    if (this.region !== 'ranch') return;
    for (const id of ['duck', 'cow'] as const)
      for (let i = 0; i < c[id]; i++) {
        const x = (id === 'duck' ? 1150 : 180) + (i % 3) * 70,
          y = 311 + Math.floor(i / 3) * 49;
        const size = id === 'duck' ? 44 : 73;
        this.herdSprites.add(this.add.image(x, y, id).setDisplaySize(size, size).setDepth(2));
      }
  }
  private useSite(id: string) {
    if (id.startsWith('to-')) {
      this.enterRegion(id.slice(3) as Region);
      return;
    }
    if (Object.hasOwn(npcs, id)) {
      this.open(id as Person);
      return;
    }
    if (id === 'angling') {
      this.selected = 4;
      this.startCast();
      return;
    }
    if (id === 'herd') {
      this.open('herd');
      return;
    }
    if (id === 'herbs' || id === 'timber') {
      this.selected = id === 'timber' ? 5 : 2;
      this.swing = 1;
      this.toolProp.setTexture(toolArt[this.selected]);
      this.audioFx.play(id === 'timber' ? 'hoe' : 'hand');
      this.hud.toast(forage(this.state, id === 'timber'));
      return;
    }
    if (id === 'mali' || id === 'chai') {
      greet(this.state, id);
      this.open(id);
      return;
    }
    if (id === 'hen') {
      this.hud.toast(careForHen(this.state));
      return;
    }
    if (id === 'wood' || id === 'stone' || id === 'berry') {
      const slot = id === 'wood' ? 5 : id === 'stone' ? 6 : 2;
      if (this.selected !== slot) {
        this.hud.toast(
          'เลือก' +
            ['จอบ', 'บัวรดน้ำ', 'มือเก็บเกี่ยว', 'ถุงเมล็ด', 'เบ็ด', 'ขวาน', 'อีเต้อ'][slot] +
            'ก่อน',
        );
        return;
      }
      const stamina = this.state.stamina;
      this.hud.toast(gather(this.state, id));
      if (stamina !== this.state.stamina) {
        this.swing = 1;
        this.toolProp.setTexture(toolArt[slot]);
        this.audioFx.play(id === 'berry' ? 'hand' : 'hoe');
      }
      return;
    }
    if (id === 'house') this.open('sleep');
    if (id === 'pond') {
      this.selected = 4;
      this.startCast();
    }
    if (id === 'crate') {
      const n = shipAll(this.state);
      this.hud.toast(n ? 'ใส่ลังแล้ว ' + n + ' ชิ้น รับเงินพรุ่งนี้เช้า' : fail.nothingToShip);
      if (n) this.audioFx.play('coin');
    }
    if (id === 'stall') {
      const closed = shopClosedReason(this.state);
      if (closed) this.hud.toast(fail[closed]);
      else this.open('shop');
    }
  }
  private command(cmd: string) {
    const s = this.state;
    if (cmd.startsWith('travel-')) {
      const dest = cmd.slice(7);
      if (!Object.hasOwn(regionNames, dest)) return;
      this.hud.close();
      this.enterRegion(dest as Region);
      return;
    }
    if (cmd.startsWith('trade-')) {
      const panel = this.hud.panel;
      if (!panel) return;
      const message = trade(s, cmd.slice(6));
      this.pickSeed();
      this.hud.invalidate();
      this.renderHerd();
      this.open(panel);
      this.hud.toast(message);
      this.audioFx.play('select');
      return;
    }
    if (cmd === 'farm' && this.region !== 'farm') {
      if (this.hud.panel) this.hud.close();
      this.enterRegion('farm');
      return;
    }
    if (cmd === 'gift' || cmd === 'order' || cmd === 'build') {
      const person = this.hud.panel;
      if (person !== 'mali' && person !== 'chai') return;
      const message =
        cmd === 'gift'
          ? giveBerry(s, person as Villager)
          : cmd === 'order'
            ? completeOrder(s)
            : buildCoop(s);
      this.hud.invalidate();
      this.open(person);
      this.hud.toast(message);
      return;
    }
    if (cmd === 'sound') {
      this.audioFx.muted = !this.audioFx.muted;
      this.audioFx.persist();
      this.hud.soundIcon();
      if (this.hud.panel === 'settings') this.open('settings');
      return;
    }
    if (cmd === 'close' || cmd === 'farm') {
      if (this.hud.panel) this.hud.close();
      return;
    }
    if (cmd === 'save') {
      this.hud.toast(saveGame(s) ? 'บันทึกฟาร์มแล้ว' : 'บันทึกไม่สำเร็จ');
      return;
    }
    if (cmd === 'next') {
      this.finishDay(false);
      return;
    }
    if (cmd === 'reset') {
      this.state = createNewGame();
      this.selected = 0;
      this.seedChoice = 'morningGlory';
      this.resetDay();
      this.hud.close();
      this.hud.toast(saveGame(this.state) ? 'เริ่มฟาร์มใหม่แล้ว' : 'เริ่มฟาร์มแล้ว แต่บันทึกไม่สำเร็จ');
      return;
    }
    if (cmd.startsWith('buy-')) {
      const result = buySeed(s, cmd.slice(4) as CropId);
      if (result.ok) {
        this.audioFx.play('coin');
        this.pickSeed();
        this.open('shop');
        this.hud.toast('ซื้อเมล็ดแล้ว');
      } else this.hud.toast(fail[result.reason]);
      return;
    }
    if (cmd.startsWith('equip-')) {
      this.seedChoice = cmd.slice(6) as CropId;
      this.selected = 3;
      this.hud.close();
      return;
    }
    if (cmd.startsWith('site-')) {
      this.visit(cmd.slice(5));
      return;
    }
    if (this.cast) this.stopCast();
    this.stopTravel();
    if (cmd.startsWith('tool-')) {
      this.selected = Number(cmd.slice(5));
      this.audioFx.play('select');
      return;
    }
    if (cmd === 'seed') {
      const ids = CROP_IDS.filter((i) => s.seeds[i] > 0);
      if (!ids.length) {
        this.hud.toast(fail.noSeed);
        return;
      }
      this.selected = 3;
      this.seedChoice = ids[(ids.indexOf(this.seedChoice) + 1) % ids.length];
      return;
    }
    this.open(cmd as Panel);
  }
  private open(p: Panel) {
    this.stopTravel();
    this.keys.clear();
    this.hud.open(p, this.state);
  }
  private pickSeed() {
    if (!this.state.seeds[this.seedChoice]) {
      const owned = CROP_IDS.filter((i) => this.state.seeds[i] > 0);
      this.seedChoice =
        owned.find((i) => CROPS[i].seasons.includes(seasonOf(this.state.day))) ??
        owned[0] ??
        this.seedChoice;
    }
  }
  private work(c: Cell | null) {
    if (this.selected >= 5) {
      this.hud.toast(this.selected === 5 ? 'ใช้ขวานกับกองไม้' : 'ใช้อีเต้อกับกองหิน');
      return;
    }
    if (!c || this.selected === 4) {
      this.hud.toast(this.selected === 4 ? fail.notWater : fail.notField);
      return;
    }
    const tool: Tool =
      this.selected === 3
        ? { kind: 'seed', crop: this.seedChoice }
        : { kind: (['hoe', 'can', 'hand'] as const)[this.selected as 0 | 1 | 2] };
    const result = useTool(this.state, tool, c.col, c.row);
    if (!result.ok) {
      this.audioFx.play('error');
      this.hud.toast(fail[result.reason]);
      return;
    }
    this.hud.invalidate();
    this.aim = c;
    this.outline(c);
    this.audioFx.play(tool.kind);
    this.swing = 1;
    this.toolProp.setTexture(tool.kind);
    this.pickSeed();
    this.drawBed();
    const pos = center(c);
    if (!this.reduced)
      for (let i = 0; i < 9; i++) {
        const wet = tool.kind === 'can',
          dot = this.add
            .ellipse(
              pos.x,
              pos.y,
              wet ? 3 : 4,
              wet ? 6 : 3,
              wet ? 0xb9e4f2 : tool.kind === 'hoe' ? 0x84572a : 0xabc67a,
              0.9,
            )
            .setDepth(6);
        this.tweens.add({
          targets: dot,
          x: pos.x + (Math.random() - 0.5) * 53,
          y: pos.y - 9 - Math.random() * 22,
          alpha: 0,
          duration: 350 + Math.random() * 180,
          onComplete: () => dot.destroy(),
        });
      }
    if (tool.kind === 'hand') this.hud.toast('เก็บผลผลิตแล้ว');
  }
  private startCast() {
    if (this.cast) return;
    const pond = MAP_OBJECTS.find((o) => o.id === 'pond')!;
    const res = this.region === 'farm' ? castLine(this.state, pond.col, pond.row) : spendCast(this.state);
    if (!res.ok) {
      this.hud.toast(fail[res.reason]);
      return;
    }
    this.stopTravel();
    this.cast = { ms: rollBiteDelayMs(this.state, Math.random) };
    this.face = { x: 0, y: -1 };
    this.audioFx.play('rod');
    this.castInfo
      .setText('รอปลากินเบ็ด…')
      .setPosition(this.pos.x, this.pos.y - 115)
      .setVisible(true);
  }
  private pull() {
    if (!this.cast) return;
    if (this.cast.fish) {
      const id = this.cast.fish;
      landFish(this.state, id);
      this.audioFx.play('coin');
      this.hud.toast('ได้' + FISH[id].name + ' · ขายได้ ฿' + FISH[id].price);
    } else this.hud.toast('ดึงเบ็ดเร็วไป ลองเหวี่ยงใหม่');
    this.stopCast();
  }
  private stopCast() {
    this.cast = null;
    this.castInfo.setVisible(false);
    this.waterLine.clear();
  }
  private updateCast(dt: number, t: number) {
    const f = this.cast!;
    f.ms -= dt;
    if (f.ms <= 0) {
      if (f.fish) {
        this.hud.toast('ปลาหลุดแล้ว ลองอีกครั้ง');
        this.stopCast();
        return;
      }
      f.fish = rollFish(
        this.state,
        Math.random,
        this.region === 'coast' ? 'sea' : this.region === 'lake' ? 'lake' : 'farm',
      );
      f.ms = FISH[f.fish].windowMs;
      this.castInfo.setText('ปลากินเบ็ด! คลิก / Space');
      this.audioFx.play('bite');
    }
    const x = this.pos.x + (this.region === 'farm' ? 76 : 18),
      y = this.pos.y + (this.region === 'farm' ? 14 : -68) + Math.sin(t * 0.006) * 2,
      g = this.waterLine.clear();
    g.lineStyle(1.2, 0xf3e4c7, 0.8).lineBetween(this.pos.x + 8, this.pos.y - 45, x, y);
    g.fillStyle(0xb54a2b).fillCircle(x, y, 4);
    g.lineStyle(1, 0xf9f3c7, 0.5).strokeEllipse(x, y + 3, 13 + Math.sin(t * 0.006) * 5, 4);
  }
  private resetDay() {
    this.enterRegion('farm');
    this.stopTravel();
    this.stopCast();
    this.hud.invalidate();
    this.pos = { ...SPAWN };
    this.face = { x: 0, y: 1 };
    this.tick = 0;
    this.aim = this.front();
    this.drawBed();
    this.outline(this.aim);
    this.renderActor(false, 0);
  }
  private finishDay(passed: boolean) {
    const summary = endDay(this.state, passed);
    this.resetDay();
    this.audioFx.play('morning');
    this.hud.open('summary', this.state, summary);
    if (!saveGame(this.state)) this.hud.toast('บันทึกไม่สำเร็จ');
  }
  private drawBed() {
    this.terrain.removeAll(true);
    const soil = this.add.graphics();
    this.terrain.add(soil);
    for (let r = 0; r < FIELD.h; r++)
      for (let c = 0; c < FIELD.w; c++) {
        const tile = this.state.tiles[r + FIELD.row][c + FIELD.col];
        if (tile.kind !== 'tilled') continue;
        const p = corner((c + 0.5) / FIELD.w, (r + 0.5) / FIELD.h),
          width = (corner(1, (r + 0.5) / FIELD.h).x - corner(0, (r + 0.5) / FIELD.h).x) / FIELD.w;
        soil
          .fillStyle(tile.watered ? 0x211910 : 0x513219, tile.watered ? 0.64 : 0.45)
          .fillEllipse(p.x, p.y, width * 0.92, 29);
        soil.lineStyle(2, tile.watered ? 0x9b8364 : 0xc09a69, 0.55);
        for (let j = -1; j <= 1; j++)
          soil.lineBetween(
            p.x - width * 0.31 + j * 1.4,
            p.y + j * 6,
            p.x + width * 0.32,
            p.y + j * 6 - 1,
          );
        if (tile.crop) {
          const crop = tile.crop,
            progress = crop.growth / CROPS[crop.id].days,
            size = 17 + progress * (width * 1.09 - 14);
          const plant = this.add
            .image(p.x, p.y + 15, 'plants', crop.growth === 0 ? 0 : CROP_IDS.indexOf(crop.id))
            .setOrigin(0.5, 1)
            .setDisplaySize(size, size);
          if (crop.withered) plant.setTint(0x766148).setAngle(22).setAlpha(0.8);
          this.terrain.add(plant);
        }
      }
  }
  private outline(c: Cell | null) {
    if (same(c, this.lastOutline)) return;
    this.lastOutline = c;
    const g = this.cursor.clear();
    if (!c) return;
    const u = (c.col - FIELD.col) / FIELD.w,
      v = (c.row - FIELD.row) / FIELD.h;
    const points = [
      corner(u, v),
      corner(u + 1 / FIELD.w, v),
      corner(u + 1 / FIELD.w, v + 1 / FIELD.h),
      corner(u, v + 1 / FIELD.h),
    ].map((p) => new Phaser.Math.Vector2(p.x, p.y));
    g.fillStyle(0xf5d785, 0.1).fillPoints(points, true);
    g.lineStyle(2, 0xffe8ae, 0.9).strokePoints(points, true);
  }
  private renderActor(moving: boolean, t: number) {
    const height = 78;
    const sideways = Math.abs(this.face.x) > Math.abs(this.face.y);
    const facingFrame = sideways ? 3 : this.face.y < 0 ? 6 : 0;
    const frame = facingFrame + (moving ? [0, 1, 0, 2][Math.floor(this.steps / 110) % 4] : 0);
    const bob = this.reduced
      ? 0
      : moving
        ? Math.sin(this.steps * 0.024) * 1.3
        : Math.sin(t * 0.002) * 0.5;
    const swing = this.reduced ? 0 : Math.sin(this.swing * Math.PI);
    this.actor
      .setFrame(frame)
      .setPosition(this.pos.x, this.pos.y + bob)
      .setDisplaySize(height, height)
      .setFlipX(sideways && this.face.x > 0)
      .setAngle(swing * (this.face.x > 0.25 ? 9 : -9));
    this.shadow.setPosition(this.pos.x + 3, this.pos.y - 1).setDisplaySize(height * 0.34, height * 0.075);
    this.toolProp.setVisible(this.swing > 0 || !!this.cast);
    if (this.toolProp.visible) {
      if (this.cast) this.toolProp.setTexture('rod');
      this.toolProp
        .setPosition(this.pos.x + height * 0.19, this.pos.y - height * 0.43)
        .setDisplaySize(height * 0.45, height * 0.45)
        .setAngle(this.cast ? -22 : -30 + swing * 65);
    }
  }
  update(t: number, delta: number) {
    if (!this.hud || document.hidden) return;
    const dt = Math.min(delta, 100);
    this.coop.setVisible(this.region === 'farm' && this.state.village.coop);
    this.chicken.setVisible(this.region === 'farm' && this.state.village.coop);
    if (this.state.village.coop && !this.reduced)
      this.chicken.setX(307 + Math.sin(t / 2100) * 9).setFlipX(Math.cos(t / 2100) > 0);
    if (this.hud.panel) {
      this.hud.refresh(this.state, this.selected, this.seedChoice);
      return;
    }
    this.tick += dt;
    if (this.tick >= MS_PER_TICK) {
      this.tick -= MS_PER_TICK;
      if (advanceMinutes(this.state, MINUTES_PER_TICK)) {
        this.finishDay(true);
        return;
      }
    }
    let moved = false;
    if (this.cast) this.updateCast(dt, t);
    else {
      const has = (a: string, b: string) => Number(this.keys.has(a) || this.keys.has(b));
      let dx = has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft'),
        dy = has('KeyS', 'ArrowDown') - has('KeyW', 'ArrowUp');
      const speed = dt * 0.245;
      if (dx || dy) {
        this.stopTravel();
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        this.face = { x: dx, y: dy };
        const newX = this.pos.x + dx * speed,
          newY = this.pos.y + dy * speed;
        if (canWalk(this.region, { x: newX, y: this.pos.y })) {
          moved ||= newX !== this.pos.x;
          this.pos.x = newX;
        }
        if (canWalk(this.region, { x: this.pos.x, y: newY })) {
          moved ||= newY !== this.pos.y;
          this.pos.y = newY;
        }
        this.aim = this.front();
        this.outline(this.aim);
      } else if (this.path.length) {
        const next = this.path[0],
          dx = next.x - this.pos.x,
          dy = next.y - this.pos.y,
          len = Math.hypot(dx, dy);
        if (len > 0.1) this.face = { x: dx / len, y: dy / len };
        if (len <= speed) {
          this.pos = { ...next };
          this.path.shift();
        } else {
          this.pos.x += (dx / len) * speed;
          this.pos.y += (dy / len) * speed;
        }
        moved = true;
        if (!this.path.length) {
          const action = this.arrived;
          this.arrived = undefined;
          action?.();
        }
      }
    }
    if (moved) {
      this.hud.follow(this.pos.x);
      this.steps += dt;
      if (this.steps - this.lastStep > 360) {
        this.lastStep = this.steps;
        this.audioFx.play('step');
      }
    }
    this.swing = Math.max(0, this.swing - dt / 470);
    this.renderActor(moved, t);
    if (t > this.birdTime) {
      this.audioFx.ambience(isWet(this.state.weather), this.state.minutes >= 1140);
      this.birdTime = t + 4500 + Math.random() * 4500;
    }
    this.drawWeather(t);
    this.hud.refresh(this.state, this.selected, this.seedChoice);
  }
  private drawWeather(t: number) {
    const g = this.weather.clear(),
      s = this.state,
      wet = isWet(s.weather),
      night = Math.max(0, Math.min(1, (s.minutes - 1010) / 210));
    if (night) g.fillStyle(0x172343, 0.65 * night).fillRect(0, 0, W, H);
    if (s.weather === 'heat') g.fillStyle(0xf6b148, 0.1).fillRect(0, 0, W, H);
    if (seasonOf(s.day) === 'cool') g.fillStyle(0xa0c3dc, 0.09).fillRect(0, 0, W, H);
    if (wet) {
      const storm = s.weather === 'storm';
      g.fillStyle(0x1c3444, storm ? 0.39 : 0.23).fillRect(0, 0, W, H);
      if (!this.reduced) {
        g.lineStyle(1.3, 0xdfedf3, 0.48);
        for (let i = 0; i < (storm ? 150 : 80); i++) {
          const x = (i * 149.3 + t * 0.09) % W,
            y = (i * 113.9 + t * 0.58) % H;
          g.lineBetween(x, y, x - 5, y + 15);
        }
      }
    } else if (!this.reduced) {
      for (let i = 0; i < 10; i++) {
        const x = (i * 197 + t * 0.011) % W,
          y = 440 + ((i * 97) % 360) + Math.sin(t * 0.001 + i) * 9;
        g.fillStyle(0xffe6af, 0.32 + 0.19 * Math.sin(t * 0.002 + i)).fillCircle(x, y, 1.65);
      }
    }
  }
}
