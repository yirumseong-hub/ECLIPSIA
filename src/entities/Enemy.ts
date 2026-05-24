import Phaser from 'phaser';

export class Enemy extends Phaser.GameObjects.GameObject {
  hitCounters: Map<string, number> = new Map();

  constructor(scene: Phaser.Scene) {
    super(scene, 'Enemy');
    // TODO: 적 초기화
  }
}