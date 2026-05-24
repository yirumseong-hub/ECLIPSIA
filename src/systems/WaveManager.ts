// ============================================================
// src/systems/WaveManager.ts
// 웨이브 스폰 관리. Stage 1 스폰 커브 + 화면 밖 4방향 스폰.
//
// 사용 방법:
//   const wm = new WaveManager(scene, (x, y, data) => spawnEnemy(x, y, data));
//   wm.update(delta); // 매 프레임
//
// 스폰 규칙:
//   STAGE1_SPAWN_CURVE에 따라 interval마다 count명씩 화면 밖 4방향에서 스폰.
//   ELITE weight 비중 → ArmoredGrunt, MOB → Grunt/ArmoredGrunt/Spitter 랜덤.
//
// 사용처:
//   GameScene.ts > waveManager — create() 에서 초기화, update() 에서 호출
// ============================================================

import Phaser from 'phaser';
import { EnemyData, GRUNT_DATA, ARMORED_GRUNT_DATA, SPITTER_DATA } from '../data/enemies';

export interface SpawnConfig {
  time: number;      // 이 커브 진입 기준 시간 (초)
  interval: number;  // 스폰 간격 (초)
  count: number;     // 1회 스폰 수
  gradeWeights: { MOB: number; ELITE: number };
}

export const STAGE1_SPAWN_CURVE: SpawnConfig[] = [
  { time:   0, interval: 3.0, count:  3, gradeWeights: { MOB: 1.0, ELITE: 0.0 } },
  { time: 180, interval: 2.0, count:  5, gradeWeights: { MOB: 0.8, ELITE: 0.2 } },
  { time: 300, interval: 1.5, count:  8, gradeWeights: { MOB: 0.6, ELITE: 0.4 } },
  { time: 390, interval: 1.0, count: 10, gradeWeights: { MOB: 0.5, ELITE: 0.5 } },
];

// GameScene이 주입하는 스폰 콜백 타입
export type SpawnFn = (x: number, y: number, data: EnemyData) => void;

export class WaveManager {
  private elapsedSeconds: number = 0;
  private spawnTimer:     number = 0;  // 다음 스폰까지 남은 ms

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly spawnFn: SpawnFn,
  ) {}

  getElapsedSeconds(): number { return this.elapsedSeconds; }

  // GameScene.update(time, delta)에서 매 프레임 호출.
  update(delta: number): void {
    this.elapsedSeconds += delta / 1000;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      const config = this.getCurrentConfig();
      this.spawnWave(config);
      this.spawnTimer = config.interval * 1000;
    }
  }

  private spawnWave(config: SpawnConfig): void {
    for (let i = 0; i < config.count; i++) {
      const data       = this.pickEnemyData(config);
      const [x, y]    = this.getOffScreenPosition();
      this.spawnFn(x, y, data);
    }
  }

  // ELITE weight 확률 → ArmoredGrunt 사용 (실제 ELITE 미구현).
  // MOB 중에서는 Grunt 50% / ArmoredGrunt 25% / Spitter 25%.
  private pickEnemyData(config: SpawnConfig): EnemyData {
    if (Math.random() < config.gradeWeights.ELITE) {
      return ARMORED_GRUNT_DATA;
    }
    const roll = Math.random();
    if (roll < 0.50) return GRUNT_DATA;
    if (roll < 0.75) return ARMORED_GRUNT_DATA;
    return SPITTER_DATA;
  }

  // 화면 밖 4방향 랜덤 위치 반환. pad=40으로 충분히 화면 밖에서 스폰.
  private getOffScreenPosition(): [number, number] {
    const { width, height } = this.scene.scale;
    const pad  = 40;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:  return [Phaser.Math.Between(0, width), -pad];           // 상단
      case 1:  return [Phaser.Math.Between(0, width), height + pad];   // 하단
      case 2:  return [-pad, Phaser.Math.Between(0, height)];          // 좌측
      default: return [width + pad, Phaser.Math.Between(0, height)];   // 우측
    }
  }

  private getCurrentConfig(): SpawnConfig {
    let config = STAGE1_SPAWN_CURVE[0];
    for (const c of STAGE1_SPAWN_CURVE) {
      if (this.elapsedSeconds >= c.time) config = c;
    }
    return config;
  }
}
