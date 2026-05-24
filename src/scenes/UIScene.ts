// ============================================================
// src/scenes/UIScene.ts
// HUD 오버레이 씬. GameScene과 병렬 실행.
//
// GameScene이 매 프레임 'hud-update' 이벤트를 발행하면
// 이 씬이 HUD.update(data)를 호출해 시각 요소를 갱신.
//
// 씬 생명주기:
//   GameScene.create() → scene.launch('UIScene')
//   GameScene.triggerGameOver() / showStageComplete() → scene.stop('UIScene')
//   GameScene.restart() → 다시 create() → scene.launch('UIScene')
// ============================================================

import Phaser from 'phaser';
import { HUD, HUDData } from '../ui/HUD';

export class UIScene extends Phaser.Scene {
  private hud!: HUD;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.hud = new HUD(this);
    this.hud.create();

    // GameScene의 'hud-update' 이벤트 수신 → HUD 갱신
    const gameScene = this.scene.get('GameScene');
    gameScene.events.on('hud-update', (data: HUDData) => {
      this.hud.update(data);
    }, this);

    // GameScene 종료(게임오버/스테이지 클리어) 시 이벤트 정리
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      gameScene.events.off('hud-update', undefined, this);
    });
  }
}
