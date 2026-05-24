import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // 배경
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // 타이틀
    this.add.text(width / 2, height / 2 - 80, 'ECLIPSIA', {
      fontSize: '72px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 시작 안내 (깜빡임)
    const hint = this.add.text(width / 2, height / 2 + 30, 'ENTER 또는 SPACE 로 시작', {
      fontSize: '22px',
      color: '#8888cc',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: 0.2,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    const startKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    startKey.once('down', () => this.scene.start('GameScene'));
    spaceKey.once('down', () => this.scene.start('GameScene'));
  }
}