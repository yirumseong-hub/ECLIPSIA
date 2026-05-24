import Phaser from 'phaser';
import { EnemyGrade } from '../abilities/AbilityData';

export const HP_DROP: Record<EnemyGrade, { chance: number; healPercent: number }> = {
  MOB:      { chance: 0.05, healPercent: 0.02 },
  ELITE:    { chance: 0.20, healPercent: 0.05 },
  CHAMPION: { chance: 0.60, healPercent: 0.10 },
  BOSS:     { chance: 1.00, healPercent: 0.20 },
};

export const GOLD_DROP: Record<EnemyGrade, { chance: number; min: number; max: number }> = {
  MOB:      { chance: 0,    min: 0,   max: 0   },
  ELITE:    { chance: 0.40, min: 5,   max: 10  },
  CHAMPION: { chance: 1.00, min: 30,  max: 50  },
  BOSS:     { chance: 1.00, min: 80,  max: 120 },
};

export class DropManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  dropXP(x: number, y: number, amount: number): void {
    // TODO: ObjectPool에서 XPOrb 꺼내 배치
  }

  dropHP(x: number, y: number, grade: EnemyGrade): void {
    // TODO: 확률 체크 후 ObjectPool에서 HPOrb 꺼내 배치
  }

  dropGold(x: number, y: number, grade: EnemyGrade): void {
    // TODO: 확률 체크 후 Gold 오브 배치
  }
}