import { AbilityData } from './AbilityData';

export interface AbilitySlot {
  ability: AbilityData;
  level: number;
  stack: number;
}

export class AbilityManager {
  private slots: (AbilitySlot | null)[] = [null, null, null, null];
  private bannedUntilLevel: Map<string, number> = new Map();

  // Stack 누적은 반드시 이 함수만 사용
  addStack(abilityId: string): void {
    // TODO: 슬롯에서 해당 ability 찾아 stack +1, 레벨업 조건 충족 시 레벨 상승
  }

  equip(ability: AbilityData): void {
    // TODO: 빈 슬롯에 ability 장착
  }

  removeFromSlot(abilityId: string): void {
    // TODO: 슬롯에서 제거 후 슬롯 반환
  }

  ban(abilityId: string, untilLevel: number): void {
    this.bannedUntilLevel.set(abilityId, untilLevel);
  }

  releaseOldest(): void {
    // TODO: 가장 오래된 봉인 해제 (fallback)
  }

  isBanned(abilityId: string, currentLevel: number): boolean {
    const until = this.bannedUntilLevel.get(abilityId);
    return until !== undefined && currentLevel < until;
  }

  getSlots(): (AbilitySlot | null)[] {
    return this.slots;
  }

  hasEmptySlot(): boolean {
    return this.slots.some(s => s === null);
  }

  hasAbility(abilityId: string): boolean {
    return this.slots.some(s => s?.ability.id === abilityId);
  }
}