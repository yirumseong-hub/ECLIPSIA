// ============================================================
// src/entities/Player.ts
// 플레이어 공통 베이스 클래스.
//
// 설계 원칙:
//   - 이동, HP, 무적, 입력 처리 등 모든 캐릭터 공통 로직만 담당.
//   - 캐릭터별 특화 로직은 CharacterData(data/characters.ts)와
//     IMechanic 구현체(entities/mechanics/)를 주입받아 처리.
//   - 직접 Ara/Kael/Sera를 분기하는 코드를 작성하지 않음.
//
// 의존성:
//   - data/characters.ts > CharacterData — 캐릭터 스탯/메타 데이터
//   - entities/mechanics/IMechanic.ts > IMechanic — 고유 메카닉 인터페이스
// ============================================================

import Phaser from 'phaser';
import { CharacterData } from '../data/characters';
import { IMechanic } from './mechanics/IMechanic';

// 피격 무적시간 상수 (CLAUDE.md §10 임시값)
const INVINCIBILITY_DURATION_MS = 500;

// 무적 중 깜빡임 주기 (ms). 값이 작을수록 빠르게 깜빡임.
const BLINK_INTERVAL_MS = 50;

// 무적 중 최소 알파값 (0.0 ~ 1.0)
const BLINK_MIN_ALPHA = 0.3;

export interface WASDKeys {
  up:    Phaser.Input.Keyboard.Key;
  down:  Phaser.Input.Keyboard.Key;
  left:  Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  // ── 스탯 ────────────────────────────────────────────
  hp:    number;
  maxHp: number;

  // ── 캐릭터 데이터 참조 ────────────────────────────────
  // data/characters.ts 에서 주입받은 순수 데이터.
  // characterData.damageMultiplier, passiveDesc 등을 AbilityManager 등에서 참조.
  readonly characterData: CharacterData;

  // ── 고유 메카닉 (없으면 null) ─────────────────────────
  // IMechanic 인터페이스로만 참조 — 구체 타입(OverheatMechanic 등) 몰라도 됨.
  // HUD에서 getGaugeValue()/getGaugeMax()로 게이지 표시.
  readonly mechanic: IMechanic | null;

  // ── DIRECTIONAL Ability 발사 방향 추적 ───────────────────
  // Slash 등 DIRECTIONAL Ability 발사 시 기준 방향 (CLAUDE.md §17).
  // 입력 없을 때는 마지막 이동 방향 유지.
  lastDirectionX: number = 1;
  lastDirectionY: number = 0;

  // ── 내부 상태 ────────────────────────────────────────
  private invincibleUntil: number = 0; // Phaser 누적 시간(ms) 기준

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    characterData: CharacterData,
    mechanic: IMechanic | null = null,
  ) {
    // 플레이어 텍스처 생성 (흰색 원, CLAUDE.md §16 임시 그래픽 전략).
    // scene.make.graphics()는 씬 display list에 추가되지 않으므로
    // generateTexture 후 바로 destroy해도 됨.
    if (!scene.textures.exists('player_tex')) {
      const r = characterData.bodyRadius;
      const g = scene.make.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(r, r, r);
      g.generateTexture('player_tex', r * 2, r * 2);
      g.destroy();
    }

    super(scene, x, y, 'player_tex');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 아케이드 물리 바디를 원형으로 설정 + 월드 경계 충돌 활성화
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(characterData.bodyRadius);
    body.setCollideWorldBounds(true);

    // CharacterData로 스탯 초기화
    this.characterData = characterData;
    this.mechanic      = mechanic;
    this.maxHp         = characterData.maxHp;
    this.hp            = characterData.maxHp;
  }

  // ── 외부 호출 API ──────────────────────────────────────

  // 피해 적용.
  // 무적 시간 중이면 false 반환(피해 무시).
  // 적중 시 HP 감소 + 무적 시간 시작 → true 반환.
  // [DamageCalculator.ts > calculate()] 결과를 받아 GameScene에서 호출.
  takeDamage(amount: number, time: number): boolean {
    if (time < this.invincibleUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleUntil = time + INVINCIBILITY_DURATION_MS;
    return true;
  }

  // HP 오브 흡수, 레벨업 회복 등에서 호출.
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  isInvincible(time: number): boolean {
    return time < this.invincibleUntil;
  }

  // Ara 고유 패시브: 광기의 불꽃.
  // AbilityManager에서 현재 장착된 FIRE Ability 수를 전달받아 보너스 배율 반환.
  // DamageCalculator.calculate() 호출 전에 호출하여 baseDamage에 곱함.
  // Ara가 아닌 캐릭터는 0 반환.
  getFirePassiveBonus(fireAbilityCount: number): number {
    if (this.characterData.id !== 'ara') return 0;
    return fireAbilityCount >= 2 ? 0.15 : 0;
  }

  // ── 프레임 업데이트 ────────────────────────────────────

  // GameScene.update(time, delta) → 이 메서드 호출.
  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: WASDKeys, time: number, delta: number): void {
    this.handleMovement(cursors, wasd);
    this.updateInvincibilityVisual(time);

    // 고유 메카닉 업데이트 (null이면 스킵)
    this.mechanic?.update(delta);
  }

  // ── 내부 메서드 ───────────────────────────────────────

  // WASD + 방향키 이동 처리.
  // 대각선 이동 시 속도를 정규화(√0.5 ≈ 0.707)하여 일정하게 유지.
  private handleMovement(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: WASDKeys): void {
    const body  = this.body as Phaser.Physics.Arcade.Body;
    const speed = this.characterData.moveSpeed;

    const left  = cursors.left.isDown  || wasd.left.isDown;
    const right = cursors.right.isDown || wasd.right.isDown;
    const up    = cursors.up.isDown    || wasd.up.isDown;
    const down  = cursors.down.isDown  || wasd.down.isDown;

    let vx = 0;
    let vy = 0;
    if (left)  vx -= speed;
    if (right) vx += speed;
    if (up)    vy -= speed;
    if (down)  vy += speed;

    // 대각선 정규화
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    body.setVelocity(vx, vy);

    // 마지막 이동 방향 갱신 (DIRECTIONAL Ability 발사 기준)
    const dirX = (right ? 1 : 0) - (left ? 1 : 0);
    const dirY = (down  ? 1 : 0) - (up   ? 1 : 0);
    if (dirX !== 0 || dirY !== 0) {
      this.lastDirectionX = dirX;
      this.lastDirectionY = dirY;
    }
  }

  // 무적 시간 중 알파 깜빡임 피드백.
  // 무적 종료 시 알파 1로 복원.
  private updateInvincibilityVisual(time: number): void {
    if (time < this.invincibleUntil) {
      this.alpha = Math.sin(time / BLINK_INTERVAL_MS) > 0 ? BLINK_MIN_ALPHA : 1;
    } else {
      this.alpha = 1;
    }
  }
}