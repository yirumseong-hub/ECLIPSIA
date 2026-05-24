import Phaser from 'phaser';
import { Choice } from '../systems/LevelUpManager';

export type BoxType = 'BIG_BOX' | 'LEVEL_BOX' | 'RELIC_BOX' | 'CURSE_BOX';

export class BoxUI {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(type: BoxType, choices: Choice[], onSelect: (choice: Choice) => void): void {
    // TODO: 상자 유형별 선택 UI 표시
  }

  hide(): void {
    // TODO: UI 숨김
  }
}