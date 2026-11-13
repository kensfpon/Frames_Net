import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import { W, H } from './presentation/ground';

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#334a32',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  audio: { noAudio: true },
  scale: { mode: Phaser.Scale.NONE },
  scene: [FarmScene],
});
Object.assign(window, { game });
