import { AbilityData } from '../abilities/AbilityData';
import { AttributeCard } from '../data/attributeCards';

export type Choice =
  | { type: 'ABILITY'; data: AbilityData }
  | { type: 'ATTRIBUTE_CARD'; data: AttributeCard };

const MINIMUM_POOL_SIZE = 3;

export class LevelUpManager {
  // 선택지 3장 생성 (Kael 패시브 발동 시 4장)
  generateChoices(count: 3 | 4, bannedIds: Set<string>): Choice[] {
    // TODO: 5/6 Ability, 1/6 Attribute Card 랜덤, 중복 불가
    return [];
  }
}