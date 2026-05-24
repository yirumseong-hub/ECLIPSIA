// ============================================================
// src/entities/mechanics/IMechanic.ts
// 캐릭터 고유 메카닉 공통 인터페이스.
// 모든 메카닉 구현체(OverheatMechanic, ConductorMechanic, StigmaMechanic)는
// 이 인터페이스를 implements 해야 함.
// Player.ts는 IMechanic 타입으로만 참조하므로
// 구체적인 메카닉 클래스를 몰라도 됨 (의존성 역전).
// ============================================================

export interface IMechanic {
  // 매 프레임 GameScene.update() → Player.update() 에서 호출됨
  update(delta: number): void;

  // HUD 게이지 표시용 현재값 (0 ~ getGaugeMax())
  getGaugeValue(): number;

  // HUD 게이지 표시용 최대값
  getGaugeMax(): number;

  // 런 시작 또는 특정 조건에서 게이지 초기화
  reset(): void;
}