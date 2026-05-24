import Phaser from 'phaser';

export interface SpawnConfig {
  time: number;
  interval: number;
  count: number;
  gradeWeights: { MOB: number; ELITE: number };
}

export const STAGE1_SPAWN_CURVE: SpawnConfig[] = [
  { time: 0,   interval: 3.0, count: 3,  gradeWeights: { MOB: 1.0, ELITE: 0.0 } },
  { time: 180, interval: 2.0, count: 5,  gradeWeights: { MOB: 0.8, ELITE: 0.2 } },
  { time: 300, interval: 1.5, count: 8,  gradeWeights: { MOB: 0.6, ELITE: 0.4 } },
  { time: 390, interval: 1.0, count: 10, gradeWeights: { MOB: 0.5, ELITE: 0.5 } },
];

export class WaveManager {
  private scene: Phaser.Scene;
  private elapsedSeconds: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(delta: number): void {
    // TODO: 시간 경과에 따른 스폰 밀도 곡선 적용, 화면 밖 4방향 스폰
    this.elapsedSeconds += delta / 1000;
  }

  private getCurrentConfig(): SpawnConfig {
    let config = STAGE1_SPAWN_CURVE[0];
    for (const c of STAGE1_SPAWN_CURVE) {
      if (this.elapsedSeconds >= c.time) config = c;
    }
    return config;
  }
}