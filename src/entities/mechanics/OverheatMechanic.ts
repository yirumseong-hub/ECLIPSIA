// ============================================================
// src/entities/mechanics/OverheatMechanic.ts
// Ara(아라) 고유 메카닉: Overheat (과열).
//
// 동작 원리 (CLAUDE.md §13):
//   - FIRE Ability 발동 시마다 addHeat() 호출 → 게이지 누적
//   - 게이지 MAX(100) 도달 시 isOverheated() = true
//   - 다음 FIRE Ability 발동 직전 consumeOverheat() 호출
//     → true 반환 시 해당 Ability를 강화 발동 (피해 2배, 범위 1.5배)
//     → 게이지 자동 초기화
//
// 호출 체인:
//   GameScene.update() → Player.update() → IMechanic.update()
//   Ability 발동 시 → OverheatMechanic.addHeat()
//   FIRE Ability 발동 직전 → OverheatMechanic.consumeOverheat()
// ============================================================

import { IMechanic } from './IMechanic';

// Overheat 강화 발동 시 적용되는 배율 상수 (CLAUDE.md §13)
export const OVERHEAT_DAMAGE_MULT = 2.0;   // 피해 2배
export const OVERHEAT_AREA_MULT   = 1.5;   // 범위 1.5배

// FIRE Ability 1회 발동당 게이지 누적량 (임시값 — 밸런싱 단계에서 조정 예정)
const HEAT_PER_ABILITY = 25;
const MAX_GAUGE        = 100;

export class OverheatMechanic implements IMechanic {
  private gauge: number    = 0;
  private overheated: boolean = false;

  // ── 외부 호출 API ──────────────────────────────────

  // FIRE Ability 발동 시 호출.
  // 이미 과열 상태(overheated=true)이면 추가 누적하지 않음.
  addHeat(amount: number = HEAT_PER_ABILITY): void {
    if (this.overheated) return;
    this.gauge = Math.min(MAX_GAUGE, this.gauge + amount);
    if (this.gauge >= MAX_GAUGE) {
      this.overheated = true;
    }
  }

  // FIRE Ability 발동 직전에 호출.
  // 과열 상태면 true 반환 + 게이지/상태 초기화 → 호출부에서 강화 배율 적용.
  // 과열 상태가 아니면 false 반환 → 일반 발동.
  consumeOverheat(): boolean {
    if (!this.overheated) return false;
    this.overheated = false;
    this.gauge = 0;
    return true;
  }

  // HUD 등에서 현재 과열 여부를 확인할 때 사용
  isCurrentlyOverheated(): boolean {
    return this.overheated;
  }

  // ── IMechanic 인터페이스 구현 ────────────────────────

  // 현재 Overheat 게이지는 시간에 따른 자연 감소 없음.
  // 추후 패시브/Relic으로 자연 감소 추가 시 여기에 구현.
  update(_delta: number): void {}

  // HUD 게이지 표시용
  getGaugeValue(): number { return this.gauge; }
  getGaugeMax(): number   { return MAX_GAUGE; }

  // 런 재시작 또는 특수 조건으로 초기화할 때 호출
  reset(): void {
    this.gauge     = 0;
    this.overheated = false;
  }
}