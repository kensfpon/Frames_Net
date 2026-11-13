import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#5a9e4b',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [FarmScene],
});

// Exposed for debugging in the browser console.
(window as unknown as { game: Phaser.Game }).game = game;
