import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [MenuScene, GameScene, UIScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  parent: document.body,
};

new Phaser.Game(config);