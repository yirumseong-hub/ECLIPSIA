import Phaser from 'phaser';

export class HUD {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    // TODO: HP바, 타이머, 레벨, 경험치바, Ability 슬롯 6칸, Relic 슬롯 3칸, Gold 표시
  }

  update(): void {
    // TODO: 매 프레임 HUD 수치 갱신
  }
}