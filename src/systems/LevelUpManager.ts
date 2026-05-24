// ============================================================
// src/systems/LevelUpManager.ts
// 레벨업 선택지 생성 및 Discard fallback 처리.
//
// 선택지 생성 규칙 (CLAUDE.md §5):
//   5/6 확률: Ability (봉인 제외 풀에서 랜덤)
//   1/6 확률: Attribute Card (ALL_ATTRIBUTE_CARDS에서 랜덤)
//   중복 불가 (usedIds로 관리)
//
// Fallback 규칙 (CLAUDE.md §6):
//   선택지 생성 전 MINIMUM_POOL_SIZE(3) 미만이면 releaseOldest() 호출.
//   checkFallback()은 GameScene.handleDiscard()에서도 직접 호출.
//
// 사용처:
//   GameScene.ts — onLevelUp() 시 generateChoices(), handleDiscard() 시 checkFallback()
// ============================================================

import { AbilityData, ALL_ABILITIES } from '../abilities/AbilityData';
import { AttributeCard, ALL_ATTRIBUTE_CARDS } from '../data/attributeCards';
import { AbilityManager } from '../abilities/AbilityManager';

export type Choice =
  | { type: 'ABILITY';        data: AbilityData    }
  | { type: 'ATTRIBUTE_CARD'; data: AttributeCard  };

// 풀이 이 값 미만이면 가장 오래된 봉인 자동 해제 (CLAUDE.md §6)
const MINIMUM_POOL_SIZE = 3;

// 무한 루프 방지 상한 (선택지가 풀 크기보다 많을 수 없음)
const MAX_ATTEMPTS = 60;

export class LevelUpManager {

  // 레벨업 선택지 생성.
  // count: 기본 3장. Kael 패시브 발동 시 4장.
  // abilityManager: 봉인 여부 확인 + fallback 해제에 사용.
  // playerLevel: isBanned() 판단 기준.
  generateChoices(
    count: 3 | 4,
    abilityManager: AbilityManager,
    playerLevel: number,
  ): Choice[] {
    this.checkFallback(abilityManager, playerLevel);

    const choices: Choice[] = [];
    const usedIds  = new Set<string>();
    let   attempts = 0;

    while (choices.length < count && attempts < MAX_ATTEMPTS) {
      attempts++;

      if (Math.random() < 1 / 6) {
        // Attribute Card 선택 (1/6 확률)
        const available = ALL_ATTRIBUTE_CARDS.filter(c => !usedIds.has(c.id));
        if (available.length === 0) continue;
        const card = available[Math.floor(Math.random() * available.length)];
        choices.push({ type: 'ATTRIBUTE_CARD', data: card });
        usedIds.add(card.id);
      } else {
        // Ability 선택 (5/6 확률). 봉인된 Ability 제외.
        const available = ALL_ABILITIES.filter(
          a => !usedIds.has(a.id) && !abilityManager.isBanned(a.id, playerLevel),
        );
        if (available.length === 0) continue;
        const ability = available[Math.floor(Math.random() * available.length)];
        choices.push({ type: 'ABILITY', data: ability });
        usedIds.add(ability.id);
      }
    }

    return choices;
  }

  // 풀 크기 체크 후 부족하면 가장 오래된 봉인 해제.
  // generateChoices() 진입 시 자동 호출, GameScene.handleDiscard() 후에도 직접 호출.
  checkFallback(abilityManager: AbilityManager, playerLevel: number): void {
    const available = ALL_ABILITIES.filter(
      a => !abilityManager.isBanned(a.id, playerLevel),
    );
    if (available.length < MINIMUM_POOL_SIZE) {
      abilityManager.releaseOldest();
    }
  }
}
