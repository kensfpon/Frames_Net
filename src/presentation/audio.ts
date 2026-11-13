import type { Region } from '../rules/country';
type Cue =
  | 'hoe'
  | 'can'
  | 'seed'
  | 'hand'
  | 'rod'
  | 'bite'
  | 'coin'
  | 'step'
  | 'select'
  | 'morning'
  | 'error';
export class FarmAudio {
  private ctx?: AudioContext;
  private bus?: GainNode;
  private noise?: AudioBuffer;
  private air?: GainNode;
  private ambientFilter?: BiquadFilterNode;
  private region: Region = 'farm';
  setRegion(region: Region) {
    this.region = region;
    if (this.ctx && this.ambientFilter) {
      const hz = {
        farm: 640,
        lake: 2200,
        forest: 820,
        village: 490,
        market: 340,
        ranch: 550,
        coast: 1650,
      }[region];
      this.ambientFilter.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.4);
    }
  }
  muted = false;
  level = 0.55;
  constructor() {
    try {
      this.muted = localStorage.getItem('lanna-muted') === 'yes';
      const v = localStorage.getItem('lanna-volume');
      if (v !== null && Number.isFinite(+v)) this.level = Math.max(0, Math.min(1, +v));
    } catch {}
  }
  unlock() {
    if (!this.ctx) {
      if (!window.AudioContext) return;
      this.ctx = new AudioContext();
      this.bus = this.ctx.createGain();
      this.bus.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const wind = this.ctx.createBufferSource(),
        filter = this.ctx.createBiquadFilter();
      wind.buffer = this.noise;
      wind.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 640;
      this.air = this.ctx.createGain();
      this.air.gain.value = 0.06;
      wind.connect(filter).connect(this.air).connect(this.bus);
      this.ambientFilter = filter;
      this.setRegion(this.region);
      wind.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    this.mix();
  }
  mix() {
    if (this.ctx && this.bus)
      this.bus.gain.setTargetAtTime(
        document.hidden || this.muted ? 0 : this.level * 0.7,
        this.ctx.currentTime,
        0.04,
      );
  }
  persist() {
    this.mix();
    try {
      localStorage.setItem('lanna-muted', this.muted ? 'yes' : 'no');
      localStorage.setItem('lanna-volume', String(this.level));
    } catch {}
  }
  private tone(
    start: number,
    end: number,
    length: number,
    volume: number,
    delay = 0,
    type: OscillatorType = 'sine',
  ) {
    const c = this.ctx;
    if (!c || !this.bus || this.muted) return;
    const t = c.currentTime + delay,
      osc = c.createOscillator(),
      g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(end, t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + length + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
  private rustle(hz: number, length: number, volume: number) {
    const c = this.ctx;
    if (!c || !this.bus || !this.noise || this.muted) return;
    const src = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain(),
      t = c.currentTime;
    src.buffer = this.noise;
    f.type = 'bandpass';
    f.frequency.value = hz;
    f.Q.value = 0.65;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random());
    src.stop(t + length);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  ambience(wet: boolean, night: boolean) {
    if (!this.ctx || document.hidden) return;
    this.air?.gain.setTargetAtTime(wet ? 0.18 : 0.06, this.ctx.currentTime, 0.5);
    const water = this.region === 'lake' || this.region === 'coast';
    if (water) {
      const now = this.ctx.currentTime;
      const swell = this.region === 'coast' ? 0.38 : 0.17;
      this.air?.gain.cancelScheduledValues(now);
      this.air?.gain.setTargetAtTime(swell, now, 0.9);
      this.air?.gain.setTargetAtTime(wet ? 0.16 : 0.05, now + 2, 1.1);
      if (this.region === 'lake') {
        this.tone(510, 820, 0.18, 0.065, 0.3);
        this.tone(405, 660, 0.15, 0.05, 0.75);
      } else {
        this.tone(1620, 950, 0.33, 0.037, 1.1);
        this.tone(1520, 890, 0.28, 0.032, 1.55);
      }
      return;
    }
    if (this.region === 'market') {
      [523, 659, 784].forEach((n, i) => this.tone(n, n * 0.99, 0.24, 0.045, i * 0.19, 'triangle'));
      return;
    }
    if (this.region === 'ranch') {
      this.tone(139, 91, 0.6, 0.03, 0.1, 'triangle');
      this.tone(295, 220, 0.11, 0.05, 1.3);
      return;
    }
    if (this.region === 'village') {
      this.tone(880, 865, 0.55, 0.045);
      this.tone(1318, 1300, 0.37, 0.022, 0.25);
      return;
    }
    if (this.region === 'forest') {
      for (let i = 0; i < 4; i++) this.tone(3300, 3600, 0.075, 0.025, i * 0.14, 'triangle');
    }
    if (!wet) {
      const pitch = (night ? 2200 : 2900) + Math.random() * 800;
      this.tone(pitch, pitch * 1.2, 0.13, 0.04);
      this.tone(pitch * 1.18, pitch * 0.94, 0.19, 0.035, 0.18);
    }
  }
  play(cue: Cue) {
    switch (cue) {
      case 'hoe':
        this.rustle(850, 0.23, 0.8);
        this.tone(140, 48, 0.12, 0.38);
        break;
      case 'can':
        this.rustle(3800, 0.65, 0.45);
        this.tone(900, 420, 0.09, 0.08, 0.17);
        break;
      case 'step':
        this.rustle(340 + Math.random() * 220, 0.12, 0.29);
        break;
      case 'hand':
        this.rustle(2100, 0.24, 0.52);
        this.tone(660, 880, 0.16, 0.12);
        break;
      case 'seed':
        this.rustle(1800, 0.18, 0.38);
        this.tone(430, 570, 0.12, 0.07, 0.05);
        break;
      case 'rod':
        this.rustle(2700, 0.26, 0.36);
        this.tone(470, 160, 0.18, 0.18);
        break;
      case 'bite':
        this.tone(620, 1040, 0.13, 0.2);
        this.tone(900, 1100, 0.16, 0.17, 0.15);
        break;
      case 'coin':
        this.tone(1050, 910, 0.24, 0.18);
        this.tone(1430, 1350, 0.22, 0.1, 0.08);
        break;
      case 'morning':
        [392, 494, 587, 784].forEach((p, i) => this.tone(p, p, 0.7, 0.12, i * 0.15, 'triangle'));
        break;
      case 'error':
        this.tone(160, 115, 0.12, 0.1);
        break;
      case 'select':
        this.tone(340, 410, 0.07, 0.08);
        break;
    }
  }
}
