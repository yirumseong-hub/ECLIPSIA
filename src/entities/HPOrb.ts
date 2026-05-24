// ============================================================
// src/entities/HPOrb.ts
// HP 오브 엔티티. 적 처치 시 확률 드롭, 플레이어 접촉 시 HP 회복.
//
// ObjectPool 규칙 (CLAUDE.md §3):
//   new HPOrb()는 GameScene의 Pool factory 내부에서만 호출.
//   드롭은 hpOrbPool.get() → activate() 순서로 처리.
//   수집은 deactivate() → hpOrbPool.release() 순서로 처리.
//
// 자동 흡수:
//   GameScene.updateHPOrbAttraction()에서 매 프레임
//   updateAttraction(playerX, playerY, radius, speed) 호출.
//
// 사용처:
//   GameScene.ts > hpOrbPool — 생성/반환
//   GameScene.ts > onEnemyDeath() — activate() 호출
//   GameScene.ts > handlePlayerCollectHP() — deactivate() 호출
//   GameScene.ts > updateHPOrbAttraction() — updateAttraction() 호출
// ============================================================

import Phaser from 'phaser';

export class HPOrb extends Phaser.Physics.Arcade.Sprite {
  // 수집 시 플레이어 maxHp 대비 회복 비율.
  // DropManager의 HP_DROP 테이블 값을 activate()에서 받아 설정.
  healPercent: number = 0.02;

  constructor(scene: Phaser.Scene) {
    // GameScene.generateGameTextures()에서 'hp_orb_tex' 사전 생성 필요.
    super(scene, 0, 0, 'hp_orb_tex');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 원형 충돌 판정 (반지름 8px)
    (this.body as Phaser.Physics.Arcade.Body).setCircle(8);

    // 풀 대기 상태로 시작
    this.disableBody(true, true);
  }

  // ── ObjectPool 공개 API ──────────────────────────────────

  // 적 처치 위치에 드롭. GameScene.onEnemyDeath()에서 hpOrbPool.get() 직후 호출.
  activate(x: number, y: number, healPercent: number): void {
    this.enableBody(true, x, y, true, true);
    this.healPercent = healPercent;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  // 플레이어 접촉 수집 시 비활성화.
  // 반드시 이후 hpOrbPool.release(this) 호출.
  deactivate(): void {
    this.disableBody(true, true);
  }

  // ── 자동 흡수 ───────────────────────────────────────────

  // 플레이어가 radius 내에 진입하면 플레이어 방향으로 이동.
  // 반경 밖이면 정지. GameScene.updateHPOrbAttraction()에서 매 프레임 호출.
  updateAttraction(
    playerX: number,
    playerY: number,
    radius: number,
    speed: number,
  ): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    if (dist <= radius) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else {
      body.setVelocity(0, 0);
    }
  }
}
