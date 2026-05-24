// ============================================================
// src/scenes/GameScene.ts
// 메인 게임 씬. 게임 로직, 물리, ObjectPool, 전투, XP/레벨업 총괄.
//
// 씬 구성:
//   GameScene (이 파일) : 게임 로직, 물리, 충돌 처리
//   UIScene             : HUD 오버레이 (병렬 실행)
//
// ObjectPool 규칙 (CLAUDE.md §3):
//   Enemy / Projectile / XPOrb / HPOrb는 반드시 각 Pool을 통해 생성/반환.
//   직접 new Enemy() 등 호출 금지.
//
// 피해 계산 규칙 (CLAUDE.md §3):
//   모든 피해는 반드시 DamageCalculator.calculate()를 거침.
//
// Ability 발동 규칙:
//   abilityTimers(Map<id, ms>)로 쿨다운 관리.
//   form=ZONE → fireZoneAbility (플레이어 중심 범위 피해)
//   form=PROJECTILE → fireProjectileAbility (자동 조준 투사체)
//   form=MELEE_HIT → fireMeleeHitAbility (lastDirection 기준 부채꼴 타격)
//
// 의존성:
//   entities/Player.ts           > Player, WASDKeys
//   entities/Enemy.ts            > Enemy
//   entities/Projectile.ts       > Projectile
//   entities/XPOrb.ts            > XPOrb
//   entities/HPOrb.ts            > HPOrb
//   entities/mechanics/OverheatMechanic.ts > OverheatMechanic
//   abilities/AbilityData.ts     > AbilityData, ALL_ABILITIES, ATTRIBUTE_COLORS, LevelStats
//   abilities/AbilityManager.ts  > AbilityManager, AbilitySlot
//   systems/DamageCalculator.ts  > calculate
//   systems/LevelUpManager.ts    > LevelUpManager, Choice
//   systems/DropManager.ts       > DropManager
//   ui/LevelUpUI.ts              > LevelUpUI
//   data/characters.ts           > ARA_DATA
//   data/enemies.ts              > GRUNT_DATA, ARMORED_GRUNT_DATA, SPITTER_DATA, EnemyData
//   utils/ObjectPool.ts          > ObjectPool
// ============================================================

import Phaser from 'phaser';
import { Player, WASDKeys } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { XPOrb } from '../entities/XPOrb';
import { HPOrb } from '../entities/HPOrb';
import { OverheatMechanic } from '../entities/mechanics/OverheatMechanic';
import {
  AbilityData,
  ALL_ABILITIES,
  Attribute,
  ATTRIBUTE_COLORS,
  LevelStats,
} from '../abilities/AbilityData';
import { AbilityManager, AbilitySlot } from '../abilities/AbilityManager';
import { LevelUpManager, Choice } from '../systems/LevelUpManager';
import { LevelUpUI } from '../ui/LevelUpUI';
import { calculate } from '../systems/DamageCalculator';
import { DropManager } from '../systems/DropManager';
import { ARA_DATA } from '../data/characters';
import {
  GRUNT_DATA,
  ARMORED_GRUNT_DATA,
  SPITTER_DATA,
  EnemyData,
} from '../data/enemies';
import { ObjectPool } from '../utils/ObjectPool';

// ── 전투 상수 (임시값 — CLAUDE.md §15) ──────────────────────
const CRIT_CHANCE     = 0.05;
const CRIT_MULTIPLIER = 1.5;

// ── XP / 레벨업 상수 ─────────────────────────────────────────
const XP_THRESHOLDS    = [20, 50, 90, 140, 200, 270, 350, 440];
const XP_ABSORB_RADIUS = 100;
const XP_ABSORB_SPEED  = 150;

// ── HP 오브 흡수 상수 ────────────────────────────────────────
const HP_ABSORB_RADIUS = 80;
const HP_ABSORB_SPEED  = 120;

// ── 테스트 스폰 설정 (Block 5에서 WaveManager로 교체) ─────────
const TEST_SPAWN_COUNT = 16;
const MIN_SPAWN_DIST   = 200;

// ── Spitter AI 상수 (임시값 — CLAUDE.md §15) ─────────────────
// 이 거리 미만 → 도주, 이하 → 정지+사격, 초과 → 추격
const SPITTER_FLEE_DIST       = 160;
const SPITTER_SHOOT_DIST      = 320;
const SPITTER_SHOOT_COOLDOWN  = 2500; // ms
const SPITTER_PROJ_SPEED      = 200;  // px/s

export class GameScene extends Phaser.Scene {
  // ── 엔티티 ───────────────────────────────────────────────
  private player!: Player;

  // ── ObjectPool (CLAUDE.md §3: 풀링 필수) ─────────────────
  private enemyPool!: ObjectPool<Enemy>;
  private projectilePool!: ObjectPool<Projectile>;        // 플레이어 투사체
  private xpOrbPool!: ObjectPool<XPOrb>;
  private hpOrbPool!: ObjectPool<HPOrb>;
  private enemyProjectilePool!: ObjectPool<Projectile>;   // 적 투사체 (Spitter 전용)

  // ── Phaser Physics Group ──────────────────────────────────
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private xpOrbGroup!: Phaser.Physics.Arcade.Group;
  private hpOrbGroup!: Phaser.Physics.Arcade.Group;
  private enemyProjectileGroup!: Phaser.Physics.Arcade.Group;

  // ── 입력 ─────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: WASDKeys;

  // ── 타이머 ───────────────────────────────────────────────
  // Normal Attack 쿨다운 (ms)
  private normalAttackTimer: number = 0;
  // Ability 쿨다운: abilityId → 남은 시간(ms). 0 이하 시 발동.
  private abilityTimers: Map<string, number> = new Map();
  // Spitter 사격 쿨다운: enemy 인스턴스 → 남은 시간(ms).
  private spitterTimers: Map<Enemy, number> = new Map();

  // ── Ability 시스템 ────────────────────────────────────────
  private abilityManager!: AbilityManager;
  private levelUpManager!: LevelUpManager;
  private levelUpUI!: LevelUpUI;

  // ── XP / 레벨 시스템 ─────────────────────────────────────
  private playerLevel: number = 1;
  private playerXP:    number = 0;
  private playerGold:  number = 0;

  // 레벨업 UI 표시 중 true. update() 조기 반환으로 게임 로직 정지.
  private isLevelingUp: boolean = false;

  // 슬롯 꽉 찬 상태에서 선택한 Ability — Discard 후 자동 장착 대기.
  private pendingAbility: AbilityData | null = null;

  // ── 디버그 표시 (UIScene HUD 구현 전 임시) ──────────────────
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ── 씬 초기화 ─────────────────────────────────────────────

  create(): void {
    const { width, height } = this.scale;

    // ① 텍스처 사전 생성 (Pool factory 이전에 반드시 먼저 호출)
    this.generateGameTextures();

    // ② 아케이드 물리 월드 경계 설정
    this.physics.world.setBounds(0, 0, width, height);

    // ③ 맵 배경 + 경계선 (임시 그래픽, CLAUDE.md §16)
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);
    const border = this.add.graphics();
    border.lineStyle(2, 0x4444aa, 0.8);
    border.strokeRect(2, 2, width - 4, height - 4);

    // ④ Physics Group 생성
    this.enemyGroup           = this.physics.add.group();
    this.projectileGroup      = this.physics.add.group();
    this.xpOrbGroup           = this.physics.add.group();
    this.hpOrbGroup           = this.physics.add.group();
    this.enemyProjectileGroup = this.physics.add.group();

    // ⑤ ObjectPool 초기화
    this.enemyPool = new ObjectPool<Enemy>(
      () => { const e = new Enemy(this); this.enemyGroup.add(e); return e; },
      () => {},
      20,
    );
    this.projectilePool = new ObjectPool<Projectile>(
      () => { const p = new Projectile(this); this.projectileGroup.add(p); return p; },
      () => {},
      40,
    );
    this.xpOrbPool = new ObjectPool<XPOrb>(
      () => { const o = new XPOrb(this); this.xpOrbGroup.add(o); return o; },
      () => {},
      30,
    );
    this.hpOrbPool = new ObjectPool<HPOrb>(
      () => { const o = new HPOrb(this); this.hpOrbGroup.add(o); return o; },
      () => {},
      10,
    );
    // 적 투사체 풀 — enemyProjectileGroup에만 속함 (playerGroup과 overlap만 설정)
    this.enemyProjectilePool = new ObjectPool<Projectile>(
      () => { const p = new Projectile(this); this.enemyProjectileGroup.add(p); return p; },
      () => {},
      20,
    );

    // ⑥ 플레이어 생성
    this.player = new Player(this, width / 2, height / 2, ARA_DATA, new OverheatMechanic());

    // ⑦ Ability 시스템 초기화
    this.abilityManager = new AbilityManager();
    this.levelUpManager = new LevelUpManager();
    this.levelUpUI      = new LevelUpUI(this);

    // 캐릭터 Starting Ability 자동 장착 (Ara: flame_burst)
    const startId = ARA_DATA.startingAbilityId;
    if (startId) {
      const startAbility = ALL_ABILITIES.find(a => a.id === startId);
      if (startAbility) this.abilityManager.equip(startAbility);
    }

    // ⑧ Physics Overlap 설정
    // 플레이어 투사체 ↔ 적
    this.physics.add.overlap(
      this.projectileGroup,
      this.enemyGroup,
      (a, b) => this.handleProjectileHitEnemy(
        a as unknown as Projectile,
        b as unknown as Enemy,
      ),
    );
    // 플레이어 ↔ 적 (접촉 피해)
    this.physics.add.overlap(
      this.player,
      this.enemyGroup,
      (_p, b) => this.handlePlayerHitEnemy(b as Enemy),
    );
    // 플레이어 ↔ XP 오브
    this.physics.add.overlap(
      this.player,
      this.xpOrbGroup,
      (_p, o) => this.handlePlayerCollectXP(o as XPOrb),
    );
    // 플레이어 ↔ HP 오브
    this.physics.add.overlap(
      this.player,
      this.hpOrbGroup,
      (_p, o) => this.handlePlayerCollectHP(o as HPOrb),
    );
    // 적 투사체 ↔ 플레이어
    this.physics.add.overlap(
      this.player,
      this.enemyProjectileGroup,
      (_p, b) => this.handleEnemyProjectileHitPlayer(b as Projectile),
    );

    // ⑨ 키보드 입력
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // ⑩ 디버그 텍스트 (우상단 임시)
    this.debugText = this.add.text(width - 8, 8, '', {
      fontSize: '13px', color: '#ffffff',
    }).setOrigin(1, 0).setDepth(50);

    // ⑪ 테스트 적 스폰
    this.spawnTestEnemies();

    // ⑫ UI 씬 병렬 실행
    this.scene.launch('UIScene');
  }

  update(time: number, delta: number): void {
    if (this.isLevelingUp) return;

    this.player.update(this.cursors, this.wasd, time, delta);
    this.updateEnemies(delta);
    this.updateNormalAttack(delta);
    this.updateAbilities(delta);
    this.updateXPOrbAttraction();
    this.updateHPOrbAttraction();
    this.cleanupOutOfBoundsProjectiles();

    // 디버그: 레벨 / XP / Gold / HP 표시
    const threshold = this.getXPThreshold(this.playerLevel);
    this.debugText.setText(
      `Lv.${this.playerLevel}  XP:${this.playerXP}/${threshold}` +
      `  Gold:${this.playerGold}  HP:${this.player.hp}/${this.player.maxHp}`,
    );
  }

  // ── 프레임 업데이트: 적 AI ────────────────────────────────

  // Spitter는 별도 AI, 나머지는 단순 추격.
  private updateEnemies(delta: number): void {
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      if (enemy.enemyData?.id === 'spitter') {
        this.updateSpitterAI(enemy, delta);
      } else {
        enemy.chasePlayer(this.player.x, this.player.y);
      }
    }
  }

  // Spitter AI:
  //   dist < FLEE_DIST      → 도주 (플레이어 반대 방향)
  //   FLEE_DIST~SHOOT_DIST  → 정지 + 주기적 투사체 발사
  //   dist > SHOOT_DIST     → 플레이어 추격
  private updateSpitterAI(spitter: Enemy, delta: number): void {
    const dist = Phaser.Math.Distance.Between(
      spitter.x, spitter.y, this.player.x, this.player.y,
    );
    const body = spitter.body as Phaser.Physics.Arcade.Body;
    const speed = spitter.enemyData?.moveSpeed ?? 80;

    if (dist < SPITTER_FLEE_DIST) {
      // 플레이어 반대 방향으로 도주
      const angle = Phaser.Math.Angle.Between(
        this.player.x, this.player.y, spitter.x, spitter.y,
      );
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else if (dist <= SPITTER_SHOOT_DIST) {
      // 정지 후 사격 쿨다운 처리
      body.setVelocity(0, 0);
      const remaining = (this.spitterTimers.get(spitter) ?? 0) - delta;
      if (remaining <= 0) {
        this.fireSpitterProjectile(spitter);
        this.spitterTimers.set(spitter, SPITTER_SHOOT_COOLDOWN);
      } else {
        this.spitterTimers.set(spitter, remaining);
      }
    } else {
      // 추격
      spitter.chasePlayer(this.player.x, this.player.y);
    }
  }

  // Spitter가 플레이어 방향으로 투사체 발사.
  private fireSpitterProjectile(spitter: Enemy): void {
    const proj  = this.enemyProjectilePool.get();
    const angle = Phaser.Math.Angle.Between(
      spitter.x, spitter.y, this.player.x, this.player.y,
    );
    proj.activate(
      spitter.x, spitter.y,
      Math.cos(angle) * SPITTER_PROJ_SPEED,
      Math.sin(angle) * SPITTER_PROJ_SPEED,
      spitter.enemyData?.damage ?? 8,
      'PHYSICAL',
      0,
      'proj_physical_tex',
    );
  }

  // ── 프레임 업데이트: Normal Attack ────────────────────────

  private updateNormalAttack(delta: number): void {
    this.normalAttackTimer -= delta;
    if (this.normalAttackTimer > 0) return;

    const na     = this.player.characterData.normalAttack;
    const target = this.findNearestEnemy();
    if (!target) return;

    const speed = na.attackShape.speed;
    if (!speed) return;

    this.fireProjectile(
      this.player.x, this.player.y,
      target.x, target.y,
      na.stats.damage,
      na.attribute,
      speed,
      na.attackShape.pierce ?? 0,
      `proj_${na.attribute.toLowerCase()}_tex`,
    );

    this.normalAttackTimer = na.cooldown * 1000;
  }

  // ── 프레임 업데이트: Ability 발동 ─────────────────────────

  // 장착된 모든 Ability의 쿨다운을 delta로 감산.
  // 쿨다운 만료 시 fireAbility() 호출 후 쿨다운 리셋.
  private updateAbilities(delta: number): void {
    const equipped = this.abilityManager.getEquippedAbilities();
    for (const slot of equipped) {
      const id      = slot.ability.id;
      const current = this.abilityTimers.get(id) ?? 0;
      const next    = current - delta;
      if (next <= 0) {
        this.fireAbility(slot);
        const stats       = slot.ability.stats[slot.level - 1];
        const cooldownSec = stats.cooldown ?? slot.ability.cooldown ?? 2;
        this.abilityTimers.set(id, cooldownSec * 1000);
      } else {
        this.abilityTimers.set(id, next);
      }
    }
  }

  // Ability 발동 진입점.
  // Ara 고유 패시브 적용 후 attackShape.form에 따라 분기.
  private fireAbility(slot: AbilitySlot): void {
    const stats  = slot.ability.stats[slot.level - 1];
    const rawDmg = stats.damage ?? 0;

    // Ara 고유 패시브: 광기의 불꽃 (CLAUDE.md §13)
    // FIRE Ability 2개 이상 보유 시 FIRE 피해 +15%
    const araBonus = slot.ability.attribute === 'FIRE'
      ? this.player.getFirePassiveBonus(this.abilityManager.countByAttribute('FIRE'))
      : 0;
    const araFactor = 1 + araBonus;

    const form = slot.ability.attackShape?.form;

    if (form === 'ZONE') {
      // ZONE: 발동 시 calculate까지 즉시 처리 → damageMultiplier 포함한 baseDmg
      const baseDmg = rawDmg * araFactor * this.player.characterData.damageMultiplier;
      this.fireZoneAbility(slot, stats, baseDmg);
    } else if (form === 'PROJECTILE') {
      // PROJECTILE: proj.damage로 저장 → handleProjectileHitEnemy에서 damageMultiplier 적용
      const projDmg = rawDmg * araFactor;
      this.fireProjectileAbility(slot, stats, projDmg);
    } else if (form === 'MELEE_HIT') {
      const baseDmg = rawDmg * araFactor * this.player.characterData.damageMultiplier;
      this.fireMeleeHitAbility(slot, stats, baseDmg);
    }
  }

  // ZONE: 플레이어 중심 원형 범위 내 모든 적에게 피해.
  // 루프 도중 死亡 처리를 막기 위해 toKill 배열로 모아 루프 후 일괄 처리.
  private fireZoneAbility(slot: AbilitySlot, stats: LevelStats, baseDmg: number): void {
    const radius  = stats.area ?? 80;
    const color   = ATTRIBUTE_COLORS[slot.ability.attribute];
    const toKill: Enemy[] = [];

    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, enemy.x, enemy.y,
      );
      if (dist > radius) continue;

      const isCrit = Math.random() < CRIT_CHANCE;
      const result = calculate({
        baseDamage:        baseDmg,
        attribute:         slot.ability.attribute,
        attackerTags:      { attribute: slot.ability.attribute, type: slot.ability.type },
        targetResistances: enemy.resistances,
        targetSpecialTags: enemy.specialTags,
        isCritical:        isCrit,
        critMultiplier:    CRIT_MULTIPLIER,
      });
      if (enemy.takeDamage(result.finalDamage)) toKill.push(enemy);
    }

    toKill.forEach(e => this.onEnemyDeath(e));

    // Holy Nova: 회복 (CLAUDE.md §13)
    if (stats.healAmount) this.player.heal(stats.healAmount);

    this.showZoneEffect(this.player.x, this.player.y, radius, color);
  }

  // PROJECTILE: 가장 가까운 N개 적을 자동 조준해 투사체 발사.
  private fireProjectileAbility(slot: AbilitySlot, stats: LevelStats, projDmg: number): void {
    const count   = stats.projectileCount ?? 1;
    const pierce  = stats.pierce ?? slot.ability.attackShape?.pierce ?? 0;
    const speed   = slot.ability.attackShape?.speed ?? 300;
    const texKey  = `proj_${slot.ability.attribute.toLowerCase()}_tex`;
    const targets = this.findNearestEnemies(count);

    for (const target of targets) {
      this.fireProjectile(
        this.player.x, this.player.y,
        target.x, target.y,
        projDmg,
        slot.ability.attribute,
        speed,
        pierce,
        texKey,
      );
    }
  }

  // MELEE_HIT: 마지막 이동 방향 기준 ±90° 부채꼴 범위 내 적에게 피해.
  private fireMeleeHitAbility(slot: AbilitySlot, stats: LevelStats, baseDmg: number): void {
    const radius  = stats.area ?? 70;
    const color   = ATTRIBUTE_COLORS[slot.ability.attribute];
    const dirAngle = Math.atan2(
      this.player.lastDirectionY,
      this.player.lastDirectionX,
    );
    const halfArc = Math.PI / 2; // ±90°
    const toKill: Enemy[] = [];

    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, enemy.x, enemy.y,
      );
      if (dist > radius) continue;

      const toEnemy = Phaser.Math.Angle.Between(
        this.player.x, this.player.y, enemy.x, enemy.y,
      );
      const diff = Phaser.Math.Angle.Wrap(toEnemy - dirAngle);
      if (Math.abs(diff) > halfArc) continue;

      const isCrit = Math.random() < CRIT_CHANCE;
      const result = calculate({
        baseDamage:        baseDmg,
        attribute:         slot.ability.attribute,
        attackerTags:      { attribute: slot.ability.attribute, type: slot.ability.type },
        targetResistances: enemy.resistances,
        targetSpecialTags: enemy.specialTags,
        isCritical:        isCrit,
        critMultiplier:    CRIT_MULTIPLIER,
      });
      if (enemy.takeDamage(result.finalDamage)) toKill.push(enemy);
    }

    toKill.forEach(e => this.onEnemyDeath(e));
    this.showMeleeHitEffect(this.player.x, this.player.y, radius, dirAngle, color);
  }

  // ZONE 시각 이펙트: 속성 색상 원 + 알파 트윈.
  private showZoneEffect(x: number, y: number, radius: number, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, 0.3);
    g.fillCircle(x, y, radius);
    g.lineStyle(2, color, 0.8);
    g.strokeCircle(x, y, radius);
    this.tweens.add({
      targets: g, alpha: 0, duration: 280,
      onComplete: () => g.destroy(),
    });
  }

  // MELEE_HIT 시각 이펙트: 부채꼴(±90°) + 알파 트윈.
  private showMeleeHitEffect(
    x: number, y: number,
    radius: number, angle: number, color: number,
  ): void {
    const g       = this.add.graphics();
    const halfArc = Math.PI / 2;
    const steps   = 12;
    g.fillStyle(color, 0.45);
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i <= steps; i++) {
      const a = (angle - halfArc) + (i / steps) * (halfArc * 2);
      g.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    g.closePath();
    g.fillPath();
    this.tweens.add({
      targets: g, alpha: 0, duration: 180,
      onComplete: () => g.destroy(),
    });
  }

  // ── 프레임 업데이트: 오브 흡수 ───────────────────────────

  private updateXPOrbAttraction(): void {
    for (const child of this.xpOrbGroup.getChildren()) {
      const orb = child as XPOrb;
      if (!orb.active) continue;
      orb.updateAttraction(this.player.x, this.player.y, XP_ABSORB_RADIUS, XP_ABSORB_SPEED);
    }
  }

  private updateHPOrbAttraction(): void {
    for (const child of this.hpOrbGroup.getChildren()) {
      const orb = child as HPOrb;
      if (!orb.active) continue;
      orb.updateAttraction(this.player.x, this.player.y, HP_ABSORB_RADIUS, HP_ABSORB_SPEED);
    }
  }

  // ── 프레임 업데이트: 투사체 정리 ─────────────────────────

  private cleanupOutOfBoundsProjectiles(): void {
    const { width, height } = this.scale;

    for (const child of this.projectileGroup.getChildren()) {
      const proj = child as Projectile;
      if (!proj.active) continue;
      if (proj.x < 0 || proj.x > width || proj.y < 0 || proj.y > height) {
        proj.deactivate();
        this.projectilePool.release(proj);
      }
    }

    for (const child of this.enemyProjectileGroup.getChildren()) {
      const proj = child as Projectile;
      if (!proj.active) continue;
      if (proj.x < 0 || proj.x > width || proj.y < 0 || proj.y > height) {
        proj.deactivate();
        this.enemyProjectilePool.release(proj);
      }
    }
  }

  // ── 전투 헬퍼 ─────────────────────────────────────────────

  // 활성 Enemy 중 가장 가까운 1명. Normal Attack 조준용.
  private findNearestEnemy(): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = Infinity;
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, enemy.x, enemy.y,
      );
      if (dist < minDist) { minDist = dist; nearest = enemy; }
    }
    return nearest;
  }

  // 활성 Enemy를 거리 오름차순 정렬 후 count명 반환. Ability 자동 조준용.
  private findNearestEnemies(count: number): Enemy[] {
    const list: Array<{ enemy: Enemy; dist: number }> = [];
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, enemy.x, enemy.y,
      );
      list.push({ enemy, dist });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list.slice(0, count).map(e => e.enemy);
  }

  // 풀에서 Projectile을 꺼내 지정 방향으로 발사.
  private fireProjectile(
    fromX: number, fromY: number,
    toX: number,   toY: number,
    damage: number | null,
    attribute: Attribute,
    speed: number,
    pierce: number,
    textureKey: string,
  ): void {
    if (!damage) return;
    const proj  = this.projectilePool.get();
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    proj.activate(
      fromX, fromY,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      damage,
      attribute,
      pierce,
      textureKey,
    );
  }

  // 적 처치: 비활성화 → DropManager로 드롭 결정 → 오브 스폰 + Gold 적립.
  private onEnemyDeath(enemy: Enemy): void {
    const data = enemy.enemyData;
    const x    = enemy.x;
    const y    = enemy.y;

    // Spitter 타이머 정리
    this.spitterTimers.delete(enemy);

    enemy.deactivate();
    this.enemyPool.release(enemy);

    if (!data) return;

    const drops = DropManager.computeDrops(data);

    // XP 오브 (항상 드롭)
    const xpOrb = this.xpOrbPool.get();
    xpOrb.activate(x, y, drops.xpAmount);

    // HP 오브 (확률 드롭)
    if (drops.hpHealPercent !== null) {
      const hpOrb = this.hpOrbPool.get();
      hpOrb.activate(x, y, drops.hpHealPercent);
    }

    // Gold
    this.playerGold += drops.goldAmount;
  }

  // ── Physics Overlap 콜백 ──────────────────────────────────

  // 플레이어 투사체 → 적: DamageCalculator 경유 피해.
  private handleProjectileHitEnemy(proj: Projectile, enemy: Enemy): void {
    if (!proj.active || !enemy.active) return;

    const isCrit = Math.random() < CRIT_CHANCE;
    const result = calculate({
      baseDamage:        proj.damage * this.player.characterData.damageMultiplier,
      attribute:         proj.attribute,
      attackerTags:      { attribute: proj.attribute },
      targetResistances: enemy.resistances,
      targetSpecialTags: enemy.specialTags,
      isCritical:        isCrit,
      critMultiplier:    CRIT_MULTIPLIER,
    });

    const isDead = enemy.takeDamage(result.finalDamage);

    if (proj.onHit()) {
      proj.deactivate();
      this.projectilePool.release(proj);
    }

    if (isDead) this.onEnemyDeath(enemy);
  }

  // 적 접촉 → 플레이어: 무적시간 포함 피해.
  private handlePlayerHitEnemy(enemy: Enemy): void {
    if (!enemy.active) return;

    const isCrit = Math.random() < CRIT_CHANCE;
    const result = calculate({
      baseDamage:        enemy.contactDamage,
      attribute:         'PHYSICAL',
      attackerTags:      {},
      targetResistances: [],
      targetSpecialTags: [],
      isCritical:        isCrit,
      critMultiplier:    CRIT_MULTIPLIER,
    });

    this.player.takeDamage(result.finalDamage, this.time.now);
  }

  // XP 오브 → 플레이어: XP 수집 + 레벨업 체크.
  private handlePlayerCollectXP(orb: XPOrb): void {
    if (!orb.active) return;
    this.playerXP += orb.xpAmount;
    orb.deactivate();
    this.xpOrbPool.release(orb);

    const threshold = this.getXPThreshold(this.playerLevel);
    if (this.playerXP >= threshold && !this.isLevelingUp) {
      this.playerXP -= threshold;
      this.onLevelUp();
    }
  }

  // HP 오브 → 플레이어: maxHp × healPercent 회복.
  private handlePlayerCollectHP(orb: HPOrb): void {
    if (!orb.active) return;
    this.player.heal(Math.floor(this.player.maxHp * orb.healPercent));
    orb.deactivate();
    this.hpOrbPool.release(orb);
  }

  // 적 투사체 → 플레이어: DamageCalculator 경유 피해.
  // damageMultiplier 미적용 (incoming 피해에는 플레이어 공격력 배율 불필요).
  private handleEnemyProjectileHitPlayer(proj: Projectile): void {
    if (!proj.active) return;

    const isCrit = Math.random() < CRIT_CHANCE;
    const result = calculate({
      baseDamage:        proj.damage,
      attribute:         proj.attribute,
      attackerTags:      {},
      targetResistances: [],
      targetSpecialTags: [],
      isCritical:        isCrit,
      critMultiplier:    CRIT_MULTIPLIER,
    });

    this.player.takeDamage(result.finalDamage, this.time.now);
    proj.deactivate();
    this.enemyProjectilePool.release(proj);
  }

  // ── XP / 레벨업 ──────────────────────────────────────────

  private getXPThreshold(level: number): number {
    return XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)];
  }

  private onLevelUp(): void {
    this.isLevelingUp = true;
    this.physics.pause();
    this.playerLevel++;

    // 레벨업 시 최대 HP 10% 회복 (CLAUDE.md §13)
    this.player.heal(Math.floor(this.player.maxHp * 0.1));

    const choices = this.levelUpManager.generateChoices(3, this.abilityManager, this.playerLevel);
    this.levelUpUI.show(
      choices,
      this.abilityManager.getEquippedAbilities(),
      (choice) => this.handleLevelUpChoice(choice),
      (abilityId) => this.handleDiscard(abilityId),
    );
  }

  private handleLevelUpChoice(choice: Choice): void {
    if (choice.type === 'ATTRIBUTE_CARD') {
      // AttributeCard 실제 효과 적용은 Block 5 예정
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
      return;
    }

    const ability = choice.data;

    if (this.abilityManager.hasAbility(ability.id)) {
      this.abilityManager.addStack(ability.id);
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
    } else if (this.abilityManager.hasEmptySlot()) {
      this.abilityManager.equip(ability);
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
    } else {
      // 슬롯 꽉 참 → Discard 대기
      this.pendingAbility = ability;
    }
  }

  private handleDiscard(abilityId: string): void {
    this.abilityManager.removeFromSlot(abilityId);
    this.abilityManager.ban(abilityId, this.playerLevel + 5);
    this.levelUpManager.checkFallback(this.abilityManager, this.playerLevel);

    if (this.pendingAbility) {
      this.abilityManager.equip(this.pendingAbility);
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
    }
  }

  private resumeFromLevelUp(): void {
    this.isLevelingUp = false;
    this.physics.resume();
  }

  // ── 스폰 ──────────────────────────────────────────────────

  // 16마리 테스트 스폰: Grunt×8, ArmoredGrunt×5, Spitter×3
  // Block 5에서 WaveManager로 교체 예정.
  private spawnTestEnemies(): void {
    const { width, height } = this.scale;
    for (let i = 0; i < TEST_SPAWN_COUNT; i++) {
      let x: number, y: number;
      do {
        x = Phaser.Math.Between(50, width  - 50);
        y = Phaser.Math.Between(50, height - 50);
      } while (Phaser.Math.Distance.Between(x, y, width / 2, height / 2) < MIN_SPAWN_DIST);

      let data: EnemyData;
      if (i < 8)       data = GRUNT_DATA;
      else if (i < 13) data = ARMORED_GRUNT_DATA;
      else             data = SPITTER_DATA;

      this.spawnEnemy(x, y, data);
    }
  }

  private spawnEnemy(x: number, y: number, data: EnemyData): void {
    const enemy = this.enemyPool.get();
    enemy.activate(x, y, data);
  }

  // ── 텍스처 생성 ───────────────────────────────────────────

  // 에셋 파일 없이 Phaser Graphics 도형으로 모든 텍스처 생성 (CLAUDE.md §16).
  private generateGameTextures(): void {
    // Grunt: 빨간 원
    if (!this.textures.exists('grunt_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff2222, 1);
      g.fillCircle(18, 18, 18);
      g.generateTexture('grunt_tex', 36, 36);
      g.destroy();
    }

    // ArmoredGrunt: 회색 사각형 + 테두리
    if (!this.textures.exists('armored_grunt_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0x888888, 1);
      g.fillRect(2, 2, 32, 32);
      g.lineStyle(2, 0xbbbbbb, 1);
      g.strokeRect(2, 2, 32, 32);
      g.generateTexture('armored_grunt_tex', 36, 36);
      g.destroy();
    }

    // Spitter: 주황색 삼각형
    if (!this.textures.exists('spitter_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff8800, 1);
      g.fillTriangle(16, 0, 32, 32, 0, 32);
      g.generateTexture('spitter_tex', 32, 32);
      g.destroy();
    }

    // HP 오브: 빨간 십자
    if (!this.textures.exists('hp_orb_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff2222, 1);
      g.fillRect(2, 7, 16, 6);   // 가로 바
      g.fillRect(7, 2, 6, 16);   // 세로 바
      g.generateTexture('hp_orb_tex', 20, 20);
      g.destroy();
    }

    // 속성별 투사체 텍스처: 'proj_{attribute소문자}_tex'
    const projDefs: Array<{ key: string; color: number }> = [
      { key: 'proj_fire_tex',      color: ATTRIBUTE_COLORS.FIRE      },
      { key: 'proj_frost_tex',     color: ATTRIBUTE_COLORS.FROST     },
      { key: 'proj_lightning_tex', color: ATTRIBUTE_COLORS.LIGHTNING },
      { key: 'proj_shadow_tex',    color: ATTRIBUTE_COLORS.SHADOW    },
      { key: 'proj_arcane_tex',    color: ATTRIBUTE_COLORS.ARCANE    },
      { key: 'proj_physical_tex',  color: ATTRIBUTE_COLORS.PHYSICAL  },
      { key: 'proj_holy_tex',      color: ATTRIBUTE_COLORS.HOLY      },
    ];
    for (const { key, color } of projDefs) {
      if (!this.textures.exists(key)) {
        const g = this.make.graphics();
        g.fillStyle(color, 1);
        g.fillCircle(6, 6, 6);
        g.generateTexture(key, 12, 12);
        g.destroy();
      }
    }

    // XP 오브: 초록 원
    if (!this.textures.exists('xp_orb_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0x44ff44, 1);
      g.fillCircle(6, 6, 6);
      g.generateTexture('xp_orb_tex', 12, 12);
      g.destroy();
    }
  }
}
