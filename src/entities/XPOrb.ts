// ============================================================
// src/entities/XPOrb.ts
// XP 오브 엔티티. 적 처치 시 드롭, 플레이어 접촉 시 XP 지급.
//
// ObjectPool 규칙 (CLAUDE.md §3):
//   new XPOrb()는 GameScene의 Pool factory 내부에서만 호출.
//   드롭은 xpOrbPool.get() → activate() 순서로 처리.
//   수집은 deactivate() → xpOrbPool.release() 순서로 처리.
//
// 자동 흡수 (Block 3):
//   GameScene.updateXPOrbAttraction()에서 매 프레임
//   updateAttraction(playerX, playerY, radius, speed) 호출.
//   반경 내 진입 시 플레이어 방향으로 velocity 설정.
//   반경 밖 이탈 시 velocity 0으로 리셋.
//
// 사용처:
//   GameScene.ts > xpOrbPool — 생성/반환
//   GameScene.ts > onEnemyDeath() — activate() 호출
//   GameScene.ts > handlePlayerCollectXP() — deactivate() 호출
//   GameScene.ts > updateXPOrbAttraction() — updateAttraction() 호출
// ============================================================

import Phaser from 'phaser';

export class XPOrb extends Phaser.Physics.Arcade.Sprite {
  // 수집 시 플레이어에게 지급할 XP량.
  // EnemyData.xpReward 값을 activate()에서 받아 설정.
  xpAmount: number = 0;

  constructor(scene: Phaser.Scene) {
    // GameScene.generateGameTextures()에서 'xp_orb_tex' 사전 생성 필요.
    super(scene, 0, 0, 'xp_orb_tex');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 원형 충돌 판정 (반지름 6px)
    (this.body as Phaser.Physics.Arcade.Body).setCircle(6);

    // 풀 대기 상태로 시작
    this.disableBody(true, true);
  }

  // ── ObjectPool 공개 API ──────────────────────────────────

  // 적 처치 위치에 드롭. GameScene.onEnemyDeath()에서 xpOrbPool.get() 직후 호출.
  activate(x: number, y: number, xpAmount: number): void {
    this.enableBody(true, x, y, true, true);
    this.xpAmount = xpAmount;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  // 플레이어 접촉 수집 시 비활성화.
  // 반드시 이후 xpOrbPool.release(this) 호출.
  deactivate(): void {
    this.disableBody(true, true);
  }

  // ── 자동 흡수 (Block 3) ──────────────────────────────────

  // 플레이어가 radius 내에 진입하면 플레이어 방향으로 이동.
  // 반경 밖이면 정지. GameScene.updateXPOrbAttraction()에서 매 프레임 호출.
  // XP_ABSORB_RADIUS=100, XP_ABSORB_SPEED=150 (CLAUDE.md §15 임시값)
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
