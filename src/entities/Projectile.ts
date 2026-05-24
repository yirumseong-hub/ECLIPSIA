import Phaser from 'phaser';

export class Projectile extends Phaser.GameObjects.GameObject {
  constructor(scene: Phaser.Scene) {
    super(scene, 'Projectile');
    // TODO: 투사체 초기화
  }
}