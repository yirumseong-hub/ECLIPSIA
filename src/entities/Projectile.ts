// ============================================================
// src/entities/Projectile.ts
// 투사체 엔티티. Normal Attack / Ability가 발사하는 모든 투사체.
//
// ObjectPool 규칙 (CLAUDE.md §3):
//   new Projectile()은 GameScene의 Pool factory 내부에서만 호출.
//   발사는 projectilePool.get() → activate() 순서로 처리.
//   소멸은 deactivate() → projectilePool.release() 순서로 처리.
//
// 관통 처리:
//   onHit() 호출 시 remainingPierce를 소모.
//   0이면 true 반환 → 호출부(GameScene)에서 deactivate/release 처리.
//   0보다 크면 false 반환 → 투사체 유지, 다음 적 계속 관통.
//
// 사용처:
//   GameScene.ts > projectilePool — 생성/반환
//   GameScene.ts > fireProjectile() — activate() 호출
//   GameScene.ts > handleProjectileHitEnemy() — onHit() 호출
//   GameScene.ts > cleanupOutOfBoundsProjectiles() — deactivate() 호출
// ============================================================

import Phaser from 'phaser';
import { Attribute } from '../abilities/AbilityData';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  // 피해 적용 시 DamageCalculator.calculate()의 baseDamage로 사용
  damage: number = 0;

  // DamageCalculator.calculate()의 attribute 파라미터로 전달
  attribute: Attribute = 'PHYSICAL';

  // 남은 관통 횟수. 0이면 첫 적중 시 소멸.
  private remainingPierce: number = 0;

  constructor(scene: Phaser.Scene) {
    // 기본 텍스처 'proj_fire_tex'로 초기화.
    // activate()에서 textureKey로 교체 가능.
    // GameScene.generateGameTextures()가 먼저 호출되어 있어야 함.
    super(scene, 0, 0, 'proj_fire_tex');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 원형 충돌 판정 (반지름 6px)
    (this.body as Phaser.Physics.Arcade.Body).setCircle(6);

    // 풀 대기 상태로 시작
    this.disableBody(true, true);
  }

  // ── ObjectPool 공개 API ──────────────────────────────

  // 발사 시 초기화. GameScene.fireProjectile() 에서 projectilePool.get() 직후 호출.
  // velX, velY: 이동 방향 * 속도 (px/s). Phaser Math.Angle.Between으로 계산.
  activate(
    x: number,
    y: number,
    velX: number,
    velY: number,
    damage: number,
    attribute: Attribute,
    pierce: number = 0,
    textureKey: string = 'proj_fire_tex',
  ): void {
    this.setTexture(textureKey);
    this.enableBody(true, x, y, true, true);
    this.damage          = damage;
    this.attribute       = attribute;
    this.remainingPierce = pierce;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(velX, velY);
  }

  // 화면 밖 이탈 또는 관통 소진 시 비활성화.
  // 반드시 이후 projectilePool.release(this) 호출.
  deactivate(): void {
    this.disableBody(true, true);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  // ── 전투 메서드 ───────────────────────────────────────

  // 적 적중 시 호출. 관통 횟수 소모.
  // true: 관통 소진 → 이 투사체는 소멸되어야 함.
  // false: 관통 남음 → 투사체 유지, 다음 적 계속 관통.
  onHit(): boolean {
    if (this.remainingPierce > 0) {
      this.remainingPierce--;
      return false;
    }
    return true;
  }
}