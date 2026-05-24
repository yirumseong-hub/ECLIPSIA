import Phaser from 'phaser';
import { Choice } from '../systems/LevelUpManager';

export class LevelUpUI {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(choices: Choice[], onSelect: (choice: Choice) => void, onDiscard: () => void): void {
    // TODO: 카드 3장(또는 4장) 표시, 하단 Discard 버튼 상시 노출
  }

  hide(): void {
    // TODO: UI 숨김, 게임 재개
  }
}