// ============================================================
// src/systems/DropManager.ts
// HP 오브 / XP / Gold 드롭 계산 통합 관리.
//
// 사용 방법:
//   const drops = DropManager.computeDrops(enemyData);
//   drops.xpAmount       — XP 오브에 전달할 XP량 (항상 드롭)
//   drops.hpHealPercent  — HP 오브 healPercent (드롭 안 하면 null)
//   drops.goldAmount     — 획득 Gold (드롭 안 하면 0)
//
// 드롭 임시값 (CLAUDE.md §8, 밸런싱 단계에서 조정):
//   HP: MOB 5%/2hp%, ELITE 20%/5%, CHAMPION 60%/10%, BOSS 100%/20%
//   Gold: MOB 없음, ELITE 40%/5-10, CHAMPION 100%/30-50, BOSS 100%/80-120
//
// 사용처:
//   GameScene.ts > onEnemyDeath() — 적 처치 시 드롭 결과 계산
// ============================================================

import { EnemyData } from '../data/enemies';
import { EnemyGrade } from '../abilities/AbilityData';

export interface DropResult {
  xpAmount:      number;
  hpHealPercent: number | null; // null이면 HP 오브 드롭 없음
  goldAmount:    number;        // 0이면 Gold 드롭 없음
}

// HP 오브 드롭 테이블 (CLAUDE.md §8 임시값)
const HP_DROP: Record<EnemyGrade, { chance: number; healPercent: number }> = {
  MOB:      { chance: 0.05, healPercent: 0.02 },
  ELITE:    { chance: 0.20, healPercent: 0.05 },
  CHAMPION: { chance: 0.60, healPercent: 0.10 },
  BOSS:     { chance: 1.00, healPercent: 0.20 },
};

// Gold 드롭 테이블 (CLAUDE.md §8 임시값)
const GOLD_DROP: Record<EnemyGrade, { chance: number; min: number; max: number }> = {
  MOB:      { chance: 0.00, min: 0,  max: 0   },
  ELITE:    { chance: 0.40, min: 5,  max: 10  },
  CHAMPION: { chance: 1.00, min: 30, max: 50  },
  BOSS:     { chance: 1.00, min: 80, max: 120 },
};

export class DropManager {
  // 정적 메서드 — 인스턴스 불필요.
  // EnemyData를 받아 드롭 결과를 확률 계산하여 반환.
  static computeDrops(data: EnemyData): DropResult {
    // XP는 항상 드롭
    const xpAmount = data.xpReward;

    // HP 오브 드롭 여부
    const hpTable = HP_DROP[data.grade];
    const hpHealPercent = Math.random() < hpTable.chance ? hpTable.healPercent : null;

    // Gold 드롭 여부 + 수량 (정수 범위 랜덤)
    const goldTable = GOLD_DROP[data.grade];
    let goldAmount = 0;
    if (goldTable.chance > 0 && Math.random() < goldTable.chance) {
      goldAmount = Math.floor(Math.random() * (goldTable.max - goldTable.min + 1)) + goldTable.min;
    }

    return { xpAmount, hpHealPercent, goldAmount };
  }
}
