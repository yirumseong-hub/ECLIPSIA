// ============================================================
// src/entities/Enemy.ts
// 적 엔티티 베이스 클래스. 모든 적 유형이 이 클래스 인스턴스를 사용.
//
// ObjectPool 규칙 (CLAUDE.md §3):
//   new Enemy()는 GameScene의 Pool factory 내부에서만 호출.
//   스폰은 반드시 enemyPool.get() → activate() 순서로 처리.
//   처치/회수는 deactivate() → enemyPool.release() 순서로 처리.
//
// 적 유형별 스탯 차이는 activate()에 전달하는 EnemyData로 결정.
// Spitter 등 특수 AI는 Block 4에서 별도 AI 컴포넌트로 확장 예정.
//
// 사용처:
//   GameScene.ts > enemyPool — 생성/반환
//   GameScene.ts > handleProjectileHitEnemy() — takeDamage() 호출
//   GameScene.ts > updateEnemies() — chasePlayer() 호출
// ============================================================

import Phaser from 'phaser';
import { Attribute, SpecialTag } from '../abilities/AbilityData';
import { EnemyData } from '../data/enemies';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  // ── 현재 런 스탯 ─────────────────────────────────────
  hp: number = 0;
  maxHp: number = 0;
  moveSpeed: number = 0;
  contactDamage: number = 0;    // 플레이어 접촉 시 1회 피해량
  resistances: { attribute: Attribute; reduction: number }[] = [];
  specialTags: SpecialTag[] = [];

  // CONDITION 기반 Ability 카운터 (CLAUDE.md §3).
  // { abilityId: 누적 횟수 }. 적 사망 시 자동 초기화.
  hitCounters: Map<string, number> = new Map();

  // 현재 적용된 EnemyData 참조. 드롭 처리, UI 표시 등에 사용.
  // 비활성 상태(풀 대기 중)이면 null.
  enemyData: EnemyData | null = null;

  constructor(scene: Phaser.Scene) {
    // 기본 텍스처 'grunt_tex'로 초기화.
    // activate()에서 EnemyData.textureKey로 교체됨.
    // GameScene.generateGameTextures()가 먼저 호출되어 있어야 함.
    super(scene, 0, 0, 'grunt_tex');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 풀 대기 상태로 시작 (비활성, 비가시, 물리 비활성)
    this.disableBody(true, true);
  }

  // ── ObjectPool 공개 API ──────────────────────────────

  // 스폰 시 초기화. GameScene.spawnEnemy() → enemyPool.get() 직후 호출.
  // EnemyData로 텍스처, 스탯, 충돌 크기를 설정함.
  activate(x: number, y: number, data: EnemyData): void {
    this.enemyData = data;

    // 텍스처 교체 및 물리/가시성 활성화
    this.setTexture(data.textureKey);
    this.enableBody(true, x, y, true, true);

    // EnemyData.bodyRadius로 원형 충돌 판정 설정
    (this.body as Phaser.Physics.Arcade.Body).setCircle(data.bodyRadius);

    // 스탯 초기화
    this.maxHp         = data.hp;
    this.hp            = data.hp;
    this.moveSpeed     = data.moveSpeed;
    this.contactDamage = data.damage;
    this.resistances   = data.resistances;
    this.specialTags   = data.specialTags;

    // CONDITION 카운터 초기화 (CLAUDE.md §3)
    this.hitCounters.clear();
  }

  // 처치/회수 시 비활성화. 반드시 이후 enemyPool.release(this) 호출.
  deactivate(): void {
    this.disableBody(true, true);
    // 적 사망 시 hitCounters 자동 초기화 (CLAUDE.md §3)
    this.hitCounters.clear();
    this.enemyData = null;
  }

  // ── 전투 메서드 ───────────────────────────────────────

  // 피해 적용.
  // [DamageCalculator.ts > calculate()] 결과값을 GameScene에서 받아 호출.
  // 사망 시 true 반환 → GameScene.onEnemyDeath() 호출 트리거.
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  // ── AI 업데이트 ───────────────────────────────────────

  // Grunt 기본 AI: 플레이어 위치를 향해 직선 이동.
  // GameScene.updateEnemies()에서 활성 Enemy마다 매 프레임 호출.
  // Block 4에서 Spitter(도주), ArmoredGrunt 등 AI 분기 추가 예정.
  chasePlayer(playerX: number, playerY: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(angle) * this.moveSpeed,
      Math.sin(angle) * this.moveSpeed,
    );
  }
}