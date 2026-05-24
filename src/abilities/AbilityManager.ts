// ============================================================
// src/abilities/AbilityManager.ts
// Ability 슬롯 관리, Stack/Level 누적, Discard/Ban 처리.
//
// CLAUDE.md §3 원칙:
//   Stack 누적은 반드시 addStack()만 사용. 직접 조작 금지.
//   Ban 시 banOrder 배열에 순서 기록 → releaseOldest() fallback.
//
// 슬롯 구조:
//   기본 4슬롯. slots[i] = null이면 비어있음.
//   equip() → 첫 번째 null 슬롯에 장착.
//
// Level 구조 (stackRequired [1,3,5]):
//   Lv1 시작. 스택 1개 → Lv2. 추가 스택 3개 → Lv3. 추가 5개 → Lv4(최대).
//   레벨업 시 stack 0으로 리셋.
//
// 사용처:
//   GameScene.ts — abilityManager 인스턴스 보유, 모든 조작 위임
//   LevelUpManager.ts — isBanned(), releaseOldest() 호출
//   LevelUpUI.ts — getEquippedAbilities() 결과를 Discard 목록에 표시
// ============================================================

import { AbilityData, Attribute } from './AbilityData';

export interface AbilitySlot {
  ability: AbilityData;
  level: number;   // 1 ~ 4
  stack: number;   // 현재 레벨에서 누적된 스택 수
}

export class AbilityManager {
  // 기본 4슬롯. null = 비어있음.
  private slots: (AbilitySlot | null)[] = [null, null, null, null];

  // abilityId → 해당 레벨 미만에서 선택지 제외 (Discard 봉인)
  private bannedUntilLevel: Map<string, number> = new Map();

  // Ban 순서 기록 — releaseOldest()에서 FIFO로 해제 (CLAUDE.md §6 fallback)
  private banOrder: string[] = [];

  // ── Stack / Level ─────────────────────────────────────────

  // CLAUDE.md §3: Stack 누적은 반드시 이 함수만 사용.
  // 슬롯에서 abilityId 탐색 → stack++ → stackRequired 충족 시 레벨업.
  addStack(abilityId: string): void {
    const slot = this.slots.find(s => s?.ability.id === abilityId);
    if (!slot) return;

    const MAX_LEVEL = 4;
    if (slot.level >= MAX_LEVEL) return;

    slot.stack++;
    // stackRequired[level-1]: 현재 레벨에서 다음 레벨까지 필요한 스택 수
    if (slot.stack >= slot.ability.stackRequired[slot.level - 1]) {
      slot.level++;
      slot.stack = 0;
    }
  }

  // ── 슬롯 관리 ────────────────────────────────────────────

  // 첫 번째 빈 슬롯에 Ability 장착 (Lv1, stack 0으로 초기화).
  equip(ability: AbilityData): void {
    const idx = this.slots.findIndex(s => s === null);
    if (idx === -1) return;
    this.slots[idx] = { ability, level: 1, stack: 0 };
  }

  // 슬롯에서 Ability 제거 → 슬롯 반환.
  // Discard 후 반드시 ban()도 호출해야 함 (GameScene.handleDiscard() 참조).
  removeFromSlot(abilityId: string): void {
    const idx = this.slots.findIndex(s => s?.ability.id === abilityId);
    if (idx !== -1) this.slots[idx] = null;
  }

  // ── Ban / Fallback ────────────────────────────────────────

  // abilityId를 untilLevel 미만 레벨에서 선택지에 제외.
  // Discard 시 (playerLevel + 5)로 호출 (CLAUDE.md §6).
  ban(abilityId: string, untilLevel: number): void {
    // 최초 ban 시에만 순서 기록 (재봉인 시 순서 유지)
    if (!this.bannedUntilLevel.has(abilityId)) {
      this.banOrder.push(abilityId);
    }
    this.bannedUntilLevel.set(abilityId, untilLevel);
  }

  // 가장 오래된 봉인 1개 해제.
  // LevelUpManager.checkFallback()에서 풀 부족 시 호출 (CLAUDE.md §6).
  releaseOldest(): void {
    while (this.banOrder.length > 0) {
      const oldest = this.banOrder.shift()!;
      if (this.bannedUntilLevel.has(oldest)) {
        this.bannedUntilLevel.delete(oldest);
        return;
      }
    }
  }

  // ── 조회 ─────────────────────────────────────────────────

  isBanned(abilityId: string, currentLevel: number): boolean {
    const until = this.bannedUntilLevel.get(abilityId);
    return until !== undefined && currentLevel < until;
  }

  hasEmptySlot(): boolean {
    return this.slots.some(s => s === null);
  }

  hasAbility(abilityId: string): boolean {
    return this.slots.some(s => s?.ability.id === abilityId);
  }

  getSlots(): (AbilitySlot | null)[] {
    return this.slots;
  }

  // null 슬롯 제외한 장착 목록 반환 — LevelUpUI Discard 서브 패널에 전달
  getEquippedAbilities(): AbilitySlot[] {
    return this.slots.filter((s): s is AbilitySlot => s !== null);
  }

  // Ability 현재 레벨 반환. 미장착이면 0.
  getAbilityLevel(abilityId: string): number {
    return this.slots.find(s => s?.ability.id === abilityId)?.level ?? 0;
  }

  // Ara 고유 패시브: 특정 속성 Ability 보유 수 반환 (GameScene 참조)
  countByAttribute(attribute: Attribute): number {
    return this.slots.filter(s => s?.ability.attribute === attribute).length;
  }
}
