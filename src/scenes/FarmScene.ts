import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GRID_COLS, GRID_ROWS, PLAYER_SPEED, TILE_SIZE } from '../config';
import {
  CROPS,
  CROP_IDS,
  MAX_STAMINA,
  MINUTES_PER_TICK,
  MS_PER_TICK,
  SEASON_NAMES,
  WEATHER_NAMES,
  type CropId,
  type Season,
} from '../data/balance';
import { MAP_OBJECTS, SPAWN_TILE, inBounds, isFarmable, objectAt } from '../data/map';
import {
  buySeed,
  isRipe,
  seedsForSale,
  shipAll,
  shopClosedReason,
  useTool,
  type FailReason,
  type Tool,
} from '../rules/actions';
import { dayOfSeason, inSeason, isWet, seasonOf, yearOf } from '../rules/calendar';
import { advanceMinutes, endDay, formatClock, type DaySummary } from '../rules/day';
import { createNewGame, type GameState } from '../rules/state';
import { loadGame, saveGame } from '../storage';

type Mode = 'play' | 'shop' | 'summary' | 'confirmSleep' | 'confirmNew';

const FONT = 'Tahoma, "Leelawadee UI", sans-serif';

const COLORS = {
  tilled: 0x9a6b3f,
  watered: 0x5e3d22,
  sprout: 0x7fd47f,
  withered: 0x6b5a3a,
};

/** Grass colours per season: dry and yellow, lush, then pale. */
const GRASS: Record<Season, { yard: number; field: number }> = {
  hot: { yard: 0x9bb352, field: 0x8aa646 },
  rainy: { yard: 0x58a552, field: 0x479646 },
  cool: { yard: 0x8fb88a, field: 0x7ea97a },
};

const FAIL_TEXT: Record<FailReason, string> = {
  tired: 'เหนื่อยเกินไป ไปนอนพักก่อน',
  notField: 'ตรงนี้ปลูกไม่ได้',
  notGrass: 'พรวนไปแล้ว',
  notTilled: 'ต้องพรวนดินก่อน',
  alreadyWatered: 'รดน้ำไปแล้ววันนี้',
  occupied: 'มีต้นอยู่แล้ว',
  noSeed: 'ไม่มีเมล็ดในถุง',
  outOfSeason: 'เมล็ดนี้ปลูกฤดูนี้ไม่ได้',
  nothingToHarvest: 'ไม่มีอะไรให้เก็บ',
  notRipe: 'ยังไม่โตพอ',
  shopClosed: 'แผงขายเปิด 08:00–17:00',
  shopStorm: 'พายุเข้า แผงขายปิดทั้งวัน',
  notSold: 'ฤดูนี้ไม่มีเมล็ดนี้ขาย',
  noMoney: 'เงินไม่พอ',
  nothingToShip: 'ไม่มีผลผลิตให้ส่ง',
};

interface Slot {
  label: () => string;
  tool: () => Tool | null; // null when the slot has nothing usable (an empty seed bag)
}

/**
 * Draws the game state and turns key presses into rule actions.
 * All rules live in src/rules; this scene never decides outcomes itself.
 */
export class FarmScene extends Phaser.Scene {
  state!: GameState;
  mode: Mode = 'play';
  selected = 0;
  /** Which seed the seed bag is set to. May point at a seed the player has run out of. */
  seedChoice: CropId = 'morningGlory';

  private rainDim!: Phaser.GameObjects.Rectangle;
  private rainGfx!: Phaser.GameObjects.Graphics;
  private tileRects: Phaser.GameObjects.Rectangle[][] = [];
  private cropMarks: Phaser.GameObjects.Arc[][] = [];
  private player!: Phaser.GameObjects.Rectangle;
  private cursor!: Phaser.GameObjects.Rectangle;
  private facing = { x: 0, y: 1 };
  private tickMs = 0;

  private slots: Slot[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private staminaFill!: Phaser.GameObjects.Rectangle;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private overlay!: Phaser.GameObjects.Container;
  private overlayText!: Phaser.GameObjects.Text;
  private lastSummary: DaySummary | null = null;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('farm');
  }

  create(): void {
    this.buildMap();
    this.buildPlayer();
    this.buildHud();
    this.buildOverlay();
    this.buildKeys();

    const loaded = loadGame();
    this.state = loaded.status === 'ok' ? loaded.state : createNewGame();
    this.pickAvailableSeed();
    this.resetPlayer();
    this.refreshAllTiles();
    if (loaded.status === 'corrupt') this.toast('ไฟล์เซฟอ่านไม่ได้ เริ่มเกมใหม่', 5000);
  }

  // ---------- construction ----------

  private buildMap(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      this.tileRects.push([]);
      this.cropMarks.push([]);
      for (let col = 0; col < GRID_COLS; col++) {
        const rect = this.add
          .rectangle(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE, GRASS.hot.yard)
          .setOrigin(0)
          .setStrokeStyle(1, 0x000000, 0.08);
        const mark = this.add
          .circle(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, 4, COLORS.sprout)
          .setVisible(false);
        this.tileRects[row].push(rect);
        this.cropMarks[row].push(mark);
      }
    }

    for (const o of MAP_OBJECTS) {
      this.add
        .rectangle(o.col * TILE_SIZE, o.row * TILE_SIZE, o.w * TILE_SIZE, o.h * TILE_SIZE, o.color)
        .setOrigin(0)
        .setStrokeStyle(2, 0x000000, 0.4);
      this.add
        .text((o.col + o.w / 2) * TILE_SIZE, (o.row + o.h / 2) * TILE_SIZE, o.label, {
          fontFamily: FONT,
          fontSize: o.w > 1 ? '16px' : '11px',
          color: '#ffffff',
          padding: { top: 4 },
        })
        .setOrigin(0.5);
    }

    this.cursor = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.85)
      .setDepth(5);

    this.rainDim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x16233f, 0.22).setOrigin(0).setDepth(14);
    this.rainGfx = this.add.graphics().setDepth(15);
  }

  private buildPlayer(): void {
    this.player = this.add.rectangle(0, 0, 28, 36, 0x2f6fd0).setStrokeStyle(2, 0x12305e).setDepth(6);
  }

  private buildHud(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, 34, 0x000000, 0.55).setOrigin(0).setDepth(20);
    this.statusText = this.add
      .text(12, 3, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', padding: { top: 4 } })
      .setDepth(21);
    this.add
      .text(GAME_WIDTH - 250, 3, 'แรง', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', padding: { top: 4 } })
      .setDepth(21);
    this.add.rectangle(GAME_WIDTH - 210, 9, 196, 16, 0x333333).setOrigin(0).setDepth(21);
    this.staminaFill = this.add.rectangle(GAME_WIDTH - 208, 11, 192, 12, 0x6fdc5a).setOrigin(0).setDepth(22);

    this.add
      .text(GAME_WIDTH - 8, 38, 'WASD เดิน · Space ใช้ของกับช่องตรงหน้า · E เปิด/คุย · 1–4 เลือกของ · Q เปลี่ยนเมล็ด · F2 เริ่มใหม่', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#00000066',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(21);

    this.slots = [
      { label: () => 'จอบ', tool: () => ({ kind: 'hoe' }) },
      { label: () => 'บัวรดน้ำ', tool: () => ({ kind: 'can' }) },
      { label: () => 'มือเก็บ', tool: () => ({ kind: 'hand' }) },
      {
        label: () => {
          const count = this.state.seeds[this.seedChoice];
          if (this.ownedSeeds().length === 0) return 'ถุงเมล็ด (ว่าง)';
          const off = inSeason(this.seedChoice, seasonOf(this.state.day)) ? '' : ' นอกฤดู';
          return `เมล็ด${CROPS[this.seedChoice].name} x${count}${off}  [Q]`;
        },
        tool: () => ({ kind: 'seed', crop: this.seedChoice }),
      },
    ];
    const slotW = GAME_WIDTH / this.slots.length;
    this.slots.forEach((_slot, i) => {
      const t = this.add
        .text(i * slotW + slotW / 2, GAME_HEIGHT - 18, '', {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 6, y: 5 },
        })
        .setOrigin(0.5)
        .setDepth(21);
      this.slotTexts.push(t);
    });

    this.toastText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 62, '', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#fff7c2',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setVisible(false);
  }

  private buildOverlay(): void {
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0);
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 340, 0x2b2118)
      .setStrokeStyle(3, 0xd9a441);
    this.overlayText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
        padding: { top: 6 },
      })
      .setOrigin(0.5);
    this.overlay = this.add.container(0, 0, [dim, panel, this.overlayText]).setDepth(40).setVisible(false);
  }

  private buildKeys(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const codes: Record<string, number> = {
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      space: K.SPACE, e: K.E, q: K.Q, esc: K.ESC, y: K.Y, f2: K.F2,
      n1: K.ONE, n2: K.TWO, n3: K.THREE, n4: K.FOUR, n5: K.FIVE, n6: K.SIX,
    };
    this.keys = {};
    for (const [name, code] of Object.entries(codes)) this.keys[name] = kb.addKey(code);
  }

  // ---------- frame loop ----------

  update(_time: number, deltaMs: number): void {
    if (this.mode === 'play') this.updatePlay(deltaMs);
    else this.updateOverlay();
    this.refreshHud();
    this.drawRain();
  }

  private drawRain(): void {
    const wet = isWet(this.state.weather);
    this.rainDim.setVisible(wet);
    this.rainGfx.clear();
    if (!wet) return;
    const t = this.time.now;
    const heavy = this.state.weather === 'storm';
    this.rainGfx.lineStyle(heavy ? 2 : 1, 0xcfe8ff, 0.55);
    const drops = heavy ? 140 : 80;
    for (let i = 0; i < drops; i++) {
      const x = (i * 137.5 + t * 0.12) % GAME_WIDTH;
      const y = (i * 71.3 + t * (heavy ? 0.9 : 0.6)) % GAME_HEIGHT;
      this.rainGfx.lineBetween(x, y, x - 4, y + 12);
    }
  }

  private ownedSeeds(): CropId[] {
    return CROP_IDS.filter((id) => this.state.seeds[id] > 0);
  }

  /** Point the seed bag at something useful: an in-season seed if the player owns one. */
  private pickAvailableSeed(): void {
    const owned = this.ownedSeeds();
    if (owned.length === 0 || this.state.seeds[this.seedChoice] > 0) return;
    const season = seasonOf(this.state.day);
    this.seedChoice = owned.find((id) => inSeason(id, season)) ?? owned[0];
  }

  private cycleSeed(): void {
    const owned = this.ownedSeeds();
    if (owned.length === 0) {
      this.toast(FAIL_TEXT.noSeed);
      return;
    }
    const at = owned.indexOf(this.seedChoice);
    this.seedChoice = owned[(at + 1) % owned.length];
    this.selected = 3;
  }

  private pressed(name: string): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys[name]);
  }

  private numberPressed(): number {
    for (let i = 1; i <= 6; i++) if (this.pressed(`n${i}`)) return i;
    return 0;
  }

  private updatePlay(deltaMs: number): void {
    this.movePlayer(deltaMs);

    this.tickMs += deltaMs;
    while (this.tickMs >= MS_PER_TICK) {
      this.tickMs -= MS_PER_TICK;
      if (advanceMinutes(this.state, MINUTES_PER_TICK)) {
        this.finishDay(true);
        return;
      }
    }

    const n = this.numberPressed();
    if (n >= 1 && n <= this.slots.length) this.selected = n - 1;
    if (this.pressed('q')) this.cycleSeed();

    const target = this.targetTile();
    this.cursor.setPosition(target.col * TILE_SIZE, target.row * TILE_SIZE);

    if (this.pressed('space')) {
      const tool = this.slots[this.selected].tool();
      const result = tool ? useTool(this.state, tool, target.col, target.row) : null;
      if (result?.ok) {
        this.refreshTile(target.col, target.row);
        this.pickAvailableSeed(); // move on when the last seed of a kind is used
      } else this.toast(FAIL_TEXT[result ? result.reason : 'noSeed']);
    }

    if (this.pressed('e')) this.interact(target.col, target.row);
    if (this.pressed('f2')) this.open('confirmNew');
  }

  private interact(col: number, row: number): void {
    const obj = inBounds(col, row) ? objectAt(col, row) : null;
    if (!obj) return;
    if (obj.id === 'house') this.open('confirmSleep');
    else if (obj.id === 'crate') {
      const moved = shipAll(this.state);
      this.toast(moved > 0 ? `ใส่ลังแล้ว ${moved} ชิ้น รับเงินพรุ่งนี้เช้า` : FAIL_TEXT.nothingToShip);
    } else if (obj.id === 'stall') {
      const closed = shopClosedReason(this.state);
      if (closed) this.toast(FAIL_TEXT[closed]);
      else this.open('shop');
    }
  }

  private updateOverlay(): void {
    switch (this.mode) {
      case 'shop': {
        const n = this.numberPressed();
        const stock = seedsForSale(this.state);
        if (n >= 1 && n <= stock.length) {
          const result = buySeed(this.state, stock[n - 1]);
          if (!result.ok) this.toast(FAIL_TEXT[result.reason]);
          else this.pickAvailableSeed();
          this.overlayText.setText(this.shopText());
        }
        if (this.pressed('e') || this.pressed('esc')) this.close();
        break;
      }
      case 'summary':
        if (this.pressed('e') || this.pressed('space')) this.close();
        break;
      case 'confirmSleep':
        if (this.pressed('e')) this.finishDay(false);
        else if (this.pressed('esc')) this.close();
        break;
      case 'confirmNew':
        if (this.pressed('y')) {
          this.state = createNewGame();
          this.seedChoice = 'morningGlory';
          saveGame(this.state);
          this.resetPlayer();
          this.refreshAllTiles();
          this.close();
          this.toast('เริ่มเกมใหม่แล้ว');
        } else if (this.pressed('esc')) this.close();
        break;
    }
  }

  // ---------- day cycle ----------

  private finishDay(passedOut: boolean): void {
    this.lastSummary = endDay(this.state, passedOut);
    const saved = saveGame(this.state);
    this.tickMs = 0;
    this.resetPlayer();
    this.refreshAllTiles();
    this.open('summary');
    if (!saved) this.toast('บันทึกเกมไม่สำเร็จ', 5000);
  }

  // ---------- overlays ----------

  private open(mode: Exclude<Mode, 'play'>): void {
    this.mode = mode;
    const text =
      mode === 'shop' ? this.shopText()
      : mode === 'summary' ? this.summaryText()
      : mode === 'confirmSleep' ? 'เข้านอนเลยไหม?\n\nE = นอน     Esc = ยังก่อน'
      : 'เริ่มเกมใหม่?\nเซฟเดิมจะหายถาวร\n\nY = เริ่มใหม่     Esc = ยกเลิก';
    this.overlayText.setText(text);
    this.overlay.setVisible(true);
  }

  private close(): void {
    this.mode = 'play';
    this.overlay.setVisible(false);
  }

  private shopText(): string {
    const lines = seedsForSale(this.state).map((id, i) => {
      const c = CROPS[id];
      return `${i + 1}  เมล็ด${c.name}   ฿${c.seedPrice}   (โต ${c.days} วัน ขาย ฿${c.sellPrice})   มี ${this.state.seeds[id]}`;
    });
    const season = SEASON_NAMES[seasonOf(this.state.day)];
    const left = 14 - dayOfSeason(this.state.day);
    return [
      `แผงขายเมล็ด${season}`,
      `เงิน ฿${this.state.money}     เหลืออีก ${left} วันในฤดูนี้`,
      '',
      ...lines,
      '',
      'กดเลขเพื่อซื้อ     E = ปิด',
    ].join('\n');
  }

  private dateText(day: number): string {
    return `ปี ${yearOf(day)} ${SEASON_NAMES[seasonOf(day)]} วันที่ ${dayOfSeason(day)}`;
  }

  private summaryText(): string {
    const s = this.lastSummary!;
    const sold = s.sold.map((l) => `${CROPS[l.crop].name} x${l.count}   ฿${l.amount}`);
    const notes: string[] = [];
    if (s.newSeason) notes.push(`เข้าสู่${SEASON_NAMES[s.newSeason]}แล้ว แผงขายเปลี่ยนเมล็ด`);
    if (s.withered > 0) notes.push(`พืช ${s.withered} ต้นทนฤดูใหม่ไม่ได้ เหี่ยวไปแล้ว`);
    if (s.seasonWarning > 0) {
      notes.push(
        s.seasonWarning === 1
          ? 'วันนี้วันสุดท้ายของฤดู พืชที่ไม่ทนฤดูใหม่จะเหี่ยวพรุ่งนี้เช้า'
          : `อีก ${s.seasonWarning} วันเปลี่ยนฤดู รีบเก็บพืชที่ไม่ทนฤดูใหม่`,
      );
    }
    return [
      `เช้า${this.dateText(s.day)}`,
      s.passedOut ? 'เมื่อคืนหมดแรงล้มหลับ วันนี้แรงเหลือครึ่งเดียว' : 'นอนเต็มอิ่ม แรงกลับมาเต็ม',
      `วันนี้${WEATHER_NAMES[s.weather]}     พรุ่งนี้${WEATHER_NAMES[s.forecast]}`,
      ...notes,
      '',
      ...(sold.length ? sold : ['เมื่อวานไม่ได้ส่งของขาย']),
      `รายได้ ฿${s.total}     เงินรวม ฿${this.state.money}`,
      '',
      'E = เริ่มวันใหม่',
    ].join('\n');
  }

  private toast(message: string, ms = 1800): void {
    this.toastText.setText(message).setVisible(true);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(ms, () => this.toastText.setVisible(false));
  }

  // ---------- player ----------

  private resetPlayer(): void {
    this.player.setPosition((SPAWN_TILE.col + 0.5) * TILE_SIZE, (SPAWN_TILE.row + 0.5) * TILE_SIZE);
    this.facing = { x: 0, y: 1 };
  }

  /** Centre of the player's feet, used for collisions and tile lookup. */
  private feet(x = this.player.x, y = this.player.y): { x: number; y: number } {
    return { x, y: y + this.player.height / 2 - 6 };
  }

  private canStand(x: number, y: number): boolean {
    const f = this.feet(x, y);
    for (const ox of [-10, 10]) {
      for (const oy of [-5, 5]) {
        const px = f.x + ox;
        const py = f.y + oy;
        if (px < 0 || px >= GAME_WIDTH || py < 0 || py >= GAME_HEIGHT) return false;
        if (objectAt(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))) return false;
      }
    }
    return true;
  }

  private movePlayer(deltaMs: number): void {
    const k = this.keys;
    let dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    let dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (dx === 0 && dy === 0) return;

    // Face the last pressed axis; vertical wins on diagonals so facing is always one tile.
    this.facing = dy !== 0 ? { x: 0, y: dy } : { x: dx, y: 0 };

    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    const step = (PLAYER_SPEED * Math.min(deltaMs, 50)) / 1000;
    if (this.canStand(this.player.x + dx * step, this.player.y)) this.player.x += dx * step;
    if (this.canStand(this.player.x, this.player.y + dy * step)) this.player.y += dy * step;
  }

  playerTile(): { col: number; row: number } {
    const f = this.feet();
    return { col: Math.floor(f.x / TILE_SIZE), row: Math.floor(f.y / TILE_SIZE) };
  }

  /** The tile directly in front of the player. May be outside the map. */
  targetTile(): { col: number; row: number } {
    const t = this.playerTile();
    return { col: t.col + this.facing.x, row: t.row + this.facing.y };
  }

  // ---------- drawing ----------

  private refreshAllTiles(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) this.refreshTile(col, row);
    }
  }

  private refreshTile(col: number, row: number): void {
    const tile = this.state.tiles[row][col];
    const grass = GRASS[seasonOf(this.state.day)];
    const base = isFarmable(col, row) ? grass.field : grass.yard;
    const color = tile.kind === 'grass' ? base : tile.watered ? COLORS.watered : COLORS.tilled;
    this.tileRects[row][col].setFillStyle(color);

    const mark = this.cropMarks[row][col];
    if (!tile.crop) {
      mark.setVisible(false);
      return;
    }
    if (tile.crop.withered) {
      mark.setVisible(true).setRadius(9).setFillStyle(COLORS.withered).setStrokeStyle(2, 0x2e2616);
      return;
    }
    const def = CROPS[tile.crop.id as CropId];
    const ripe = isRipe(this.state, col, row);
    const progress = tile.crop.growth / def.days;
    mark
      .setVisible(true)
      .setRadius(4 + progress * 14)
      .setFillStyle(ripe ? def.color : COLORS.sprout)
      .setStrokeStyle(ripe ? 3 : 1, ripe ? 0xffffff : 0x1d4d1d);
  }

  private refreshHud(): void {
    const s = this.state;
    this.statusText.setText(
      `${this.dateText(s.day)} · ${formatClock(s.minutes)} · วันนี้${WEATHER_NAMES[s.weather]} · พรุ่งนี้${WEATHER_NAMES[s.forecast]} · ฿${s.money} · กระเป๋า ${this.produceCount()}`,
    );
    this.staminaFill.width = 192 * (s.stamina / MAX_STAMINA);
    this.staminaFill.setFillStyle(s.stamina > 25 ? 0x6fdc5a : 0xe0533a);
    this.slotTexts.forEach((t, i) => {
      t.setText(`${i + 1} ${this.slots[i].label()}`);
      t.setBackgroundColor(i === this.selected ? '#d9a441' : '#000000aa');
      t.setColor(i === this.selected ? '#000000' : '#ffffff');
    });
  }

  private produceCount(): number {
    return CROP_IDS.reduce((sum, id) => sum + this.state.produce[id], 0);
  }
}
