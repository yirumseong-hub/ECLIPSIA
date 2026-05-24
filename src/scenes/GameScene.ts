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
//
// 피해 계산 규칙 (CLAUDE.md §3):
//   모든 피해는 반드시 DamageCalculator.calculate()를 거침.
//
// Ability 발동 규칙:
//   form=ZONE       → fireZoneAbility
//   form=PROJECTILE → fireProjectileAbility
//   form=MELEE_HIT  → fireMeleeHitAbility
//
// Overheat 연동 (Block 5 추가):
//   FIRE Ability 발동 전  → consumeOverheat(): true면 ×2 dmg / ×1.5 area
//   FIRE Ability 발동 후  → addHeat()
//
// Champion (Stone Warden):
//   championSet / championTimers로 관리.
//   3초마다 충격파(넉백) 발사. HP<50% 시 이속 1.5배.
//   처치 시 Relic Box 시각 표시 + 드롭.
// ============================================================

import Phaser from 'phaser';
import { Player, WASDKeys } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { XPOrb } from '../entities/XPOrb';
import { HPOrb } from '../entities/HPOrb';
import { OverheatMechanic, OVERHEAT_DAMAGE_MULT, OVERHEAT_AREA_MULT } from '../entities/mechanics/OverheatMechanic';
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
import { HUDData, SlotDisplayData } from '../ui/HUD';
import { calculate } from '../systems/DamageCalculator';
import { DropManager } from '../systems/DropManager';
import { WaveManager } from '../systems/WaveManager';
import { ARA_DATA } from '../data/characters';
import { STONE_WARDEN_DATA, EnemyData } from '../data/enemies';
import { AttributeCard } from '../data/attributeCards';
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

// ── Spitter AI 상수 (임시값 — CLAUDE.md §15) ─────────────────
const SPITTER_FLEE_DIST      = 160;
const SPITTER_SHOOT_DIST     = 320;
const SPITTER_SHOOT_COOLDOWN = 2500; // ms
const SPITTER_PROJ_SPEED     = 200;  // px/s

// ── Champion (Stone Warden) 상수 ─────────────────────────────
const CHAMPION_SHOCKWAVE_COOLDOWN   = 3000; // ms
const CHAMPION_SPEED_BOOST_RATIO    = 1.5;
const CHAMPION_HP_BOOST_THRESHOLD   = 0.5;

// ── Stage 상수 ────────────────────────────────────────────────
const STAGE_DURATION_SEC     = 420; // 7분
const CHAMPION_CHECK_TIMES   = [150, 300] as const; // 2:30 / 5:00
const CHAMPION_SPAWN_CHANCE  = 0.75;

export class GameScene extends Phaser.Scene {
  // ── 엔티티 ───────────────────────────────────────────────
  private player!: Player;

  // ── ObjectPool (CLAUDE.md §3: 풀링 필수) ─────────────────
  private enemyPool!:           ObjectPool<Enemy>;
  private projectilePool!:      ObjectPool<Projectile>;
  private xpOrbPool!:           ObjectPool<XPOrb>;
  private hpOrbPool!:           ObjectPool<HPOrb>;
  private enemyProjectilePool!: ObjectPool<Projectile>;

  // ── Phaser Physics Group ──────────────────────────────────
  private enemyGroup!:           Phaser.Physics.Arcade.Group;
  private projectileGroup!:      Phaser.Physics.Arcade.Group;
  private xpOrbGroup!:           Phaser.Physics.Arcade.Group;
  private hpOrbGroup!:           Phaser.Physics.Arcade.Group;
  private enemyProjectileGroup!: Phaser.Physics.Arcade.Group;

  // ── 입력 ─────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!:    WASDKeys;

  // ── 타이머 ───────────────────────────────────────────────
  private normalAttackTimer: number = 0;
  private abilityTimers:     Map<string, number> = new Map();
  private abilityCooldowns:  Map<string, number> = new Map(); // full CD (ms)
  private spitterTimers:     Map<Enemy, number>  = new Map();

  // ── Ability 시스템 ────────────────────────────────────────
  private abilityManager!: AbilityManager;
  private levelUpManager!: LevelUpManager;
  private levelUpUI!:      LevelUpUI;

  // ── XP / 레벨 / Gold ─────────────────────────────────────
  private playerLevel: number = 1;
  private playerXP:    number = 0;
  private playerGold:  number = 0;

  // ── Attribute Card 피해 보너스 ────────────────────────────
  // attribute → 누적 PERCENT 보너스 (값 12 = +12%)
  private attributeDmgBonuses: Map<string, number> = new Map();

  // ── WaveManager ──────────────────────────────────────────
  private waveManager!: WaveManager;

  // ── Stage 타이머 ─────────────────────────────────────────
  private stageElapsedSeconds: number = 0;
  private stageNumber:         number = 1;

  // ── Champion 관리 ────────────────────────────────────────
  private championCheckDone: [boolean, boolean] = [false, false];
  private championSet:    Set<Enemy>         = new Set();
  private championTimers: Map<Enemy, number> = new Map();
  private shockwaveSet:   Set<Projectile>    = new Set();

  // ── 게임 상태 ─────────────────────────────────────────────
  private isLevelingUp:   boolean = false;
  private isGameOver:     boolean = false;
  private stageCompleted: boolean = false;

  // Discard 후 장착 대기 중인 Ability
  private pendingAbility: AbilityData | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ── 씬 초기화 ─────────────────────────────────────────────

  create(): void {
    const { width, height } = this.scale;

    // ① 텍스처 사전 생성 (Pool factory 이전에 반드시 먼저 호출)
    this.generateGameTextures();

    // ② 아케이드 물리 월드 경계
    this.physics.world.setBounds(0, 0, width, height);

    // ③ 맵 배경 + 경계선
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
      () => {}, 20,
    );
    this.projectilePool = new ObjectPool<Projectile>(
      () => { const p = new Projectile(this); this.projectileGroup.add(p); return p; },
      () => {}, 40,
    );
    this.xpOrbPool = new ObjectPool<XPOrb>(
      () => { const o = new XPOrb(this); this.xpOrbGroup.add(o); return o; },
      () => {}, 30,
    );
    this.hpOrbPool = new ObjectPool<HPOrb>(
      () => { const o = new HPOrb(this); this.hpOrbGroup.add(o); return o; },
      () => {}, 10,
    );
    this.enemyProjectilePool = new ObjectPool<Projectile>(
      () => { const p = new Projectile(this); this.enemyProjectileGroup.add(p); return p; },
      () => {}, 20,
    );

    // ⑥ 플레이어 생성
    this.player = new Player(this, width / 2, height / 2, ARA_DATA, new OverheatMechanic());

    // ⑦ Ability 시스템 초기화
    this.abilityManager = new AbilityManager();
    this.levelUpManager = new LevelUpManager();
    this.levelUpUI      = new LevelUpUI(this);

    const startId = ARA_DATA.startingAbilityId;
    if (startId) {
      const startAbility = ALL_ABILITIES.find(a => a.id === startId);
      if (startAbility) this.abilityManager.equip(startAbility);
    }

    // ⑧ Physics Overlap 설정
    this.physics.add.overlap(
      this.projectileGroup, this.enemyGroup,
      (a, b) => this.handleProjectileHitEnemy(
        a as unknown as Projectile, b as unknown as Enemy,
      ),
    );
    this.physics.add.overlap(
      this.player, this.enemyGroup,
      (_p, b) => this.handlePlayerHitEnemy(b as Enemy),
    );
    this.physics.add.overlap(
      this.player, this.xpOrbGroup,
      (_p, o) => this.handlePlayerCollectXP(o as XPOrb),
    );
    this.physics.add.overlap(
      this.player, this.hpOrbGroup,
      (_p, o) => this.handlePlayerCollectHP(o as HPOrb),
    );
    this.physics.add.overlap(
      this.player, this.enemyProjectileGroup,
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

    // ⑩ WaveManager (spawnTestEnemies 대체)
    this.waveManager = new WaveManager(
      this,
      (x, y, data) => this.spawnEnemy(x, y, data),
    );

    // ⑪ UI 씬 병렬 실행
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
  }

  update(time: number, delta: number): void {
    // 게임 종료 / 스테이지 클리어 시 완전 정지
    if (this.isGameOver || this.stageCompleted) return;

    // HUD 갱신은 레벨업 UI 표시 중에도 계속 (HP/XP 등 변하지 않지만 일관성 유지)
    this.emitHUDUpdate();

    // 레벨업 UI 중에는 나머지 게임 로직 정지
    if (this.isLevelingUp) return;

    // 게임 오버 체크 (HP=0)
    if (this.player.isDead()) {
      this.triggerGameOver();
      return;
    }

    this.player.update(this.cursors, this.wasd, time, delta);
    this.updateEnemies(delta);
    this.updateNormalAttack(delta);
    this.updateAbilities(delta);
    this.updateXPOrbAttraction();
    this.updateHPOrbAttraction();
    this.cleanupOutOfBoundsProjectiles();

    // Stage 타이머 + 웨이브 스폰
    this.stageElapsedSeconds += delta / 1000;
    this.checkChampionSpawn();
    this.waveManager.update(delta);

    // Stage 클리어 체크 (7분 경과)
    if (this.stageElapsedSeconds >= STAGE_DURATION_SEC) {
      this.showStageComplete();
    }
  }

  // ── HUD 이벤트 발행 ────────────────────────────────────────

  private emitHUDUpdate(): void {
    const mechanic = this.player.mechanic as OverheatMechanic | null;
    this.events.emit('hud-update', {
      hp:            this.player.hp,
      maxHp:         this.player.maxHp,
      level:         this.playerLevel,
      xp:            this.playerXP,
      xpThreshold:   this.getXPThreshold(this.playerLevel),
      gold:          this.playerGold,
      elapsedTime:   this.stageElapsedSeconds,
      stageNumber:   this.stageNumber,
      overheatValue: mechanic?.getGaugeValue()        ?? 0,
      overheatMax:   mechanic?.getGaugeMax()           ?? 0,
      isOverheated:  mechanic?.isCurrentlyOverheated() ?? false,
      slots:         this.buildSlotDisplayData(),
      playerX:       this.player.x,
      playerY:       this.player.y,
    } as HUDData);
  }

  private buildSlotDisplayData(): SlotDisplayData[] {
    const slots = this.abilityManager.getSlots();
    const result: SlotDisplayData[] = [];
    for (let i = 0; i < 6; i++) {
      const slot = i < slots.length ? slots[i] : null;
      if (!slot) {
        result.push({ isEmpty: true, abilityName: null, levelLabel: null, colorHex: 0, cooldownRatio: 0 });
        continue;
      }
      const id       = slot.ability.id;
      const fullCd   = this.abilityCooldowns.get(id) ?? 0;
      const remain   = Math.max(0, this.abilityTimers.get(id) ?? 0);
      const ratio    = fullCd > 0 ? Math.min(1, remain / fullCd) : 0;
      result.push({
        isEmpty:       false,
        abilityName:   slot.ability.name,
        levelLabel:    `Lv.${slot.level}`,
        colorHex:      ATTRIBUTE_COLORS[slot.ability.attribute],
        cooldownRatio: ratio,
      });
    }
    return result;
  }

  // ── 프레임 업데이트: 적 AI ────────────────────────────────

  private updateEnemies(delta: number): void {
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      if (this.championSet.has(enemy)) {
        this.updateChampionAI(enemy, delta);
      } else if (enemy.enemyData?.id === 'spitter') {
        this.updateSpitterAI(enemy, delta);
      } else {
        enemy.chasePlayer(this.player.x, this.player.y);
      }
    }
  }

  private updateSpitterAI(spitter: Enemy, delta: number): void {
    const dist  = Phaser.Math.Distance.Between(spitter.x, spitter.y, this.player.x, this.player.y);
    const body  = spitter.body as Phaser.Physics.Arcade.Body;
    const speed = spitter.enemyData?.moveSpeed ?? 80;

    if (dist < SPITTER_FLEE_DIST) {
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, spitter.x, spitter.y);
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else if (dist <= SPITTER_SHOOT_DIST) {
      body.setVelocity(0, 0);
      const remaining = (this.spitterTimers.get(spitter) ?? 0) - delta;
      if (remaining <= 0) {
        this.fireSpitterProjectile(spitter);
        this.spitterTimers.set(spitter, SPITTER_SHOOT_COOLDOWN);
      } else {
        this.spitterTimers.set(spitter, remaining);
      }
    } else {
      spitter.chasePlayer(this.player.x, this.player.y);
    }
  }

  // Stone Warden AI: 플레이어 추격 + 주기적 충격파 + HP<50% 가속
  private updateChampionAI(champion: Enemy, delta: number): void {
    const hpRatio  = champion.maxHp > 0 ? champion.hp / champion.maxHp : 1;
    const base     = champion.enemyData?.moveSpeed ?? 60;
    const speed    = hpRatio < CHAMPION_HP_BOOST_THRESHOLD ? base * CHAMPION_SPEED_BOOST_RATIO : base;
    const angle    = Phaser.Math.Angle.Between(champion.x, champion.y, this.player.x, this.player.y);
    (champion.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(angle) * speed, Math.sin(angle) * speed,
    );

    const remaining = (this.championTimers.get(champion) ?? 0) - delta;
    if (remaining <= 0) {
      this.fireChampionShockwave(champion);
      this.championTimers.set(champion, CHAMPION_SHOCKWAVE_COOLDOWN);
    } else {
      this.championTimers.set(champion, remaining);
    }
  }

  // Stone Warden 충격파: 적 투사체 풀 사용 + shockwaveSet 등록
  private fireChampionShockwave(champion: Enemy): void {
    const proj  = this.enemyProjectilePool.get();
    const angle = Phaser.Math.Angle.Between(champion.x, champion.y, this.player.x, this.player.y);
    const speed = 280;
    proj.activate(
      champion.x, champion.y,
      Math.cos(angle) * speed, Math.sin(angle) * speed,
      champion.enemyData?.damage ?? 20,
      'PHYSICAL', 0, 'shockwave_tex',
    );
    this.shockwaveSet.add(proj);
  }

  private fireSpitterProjectile(spitter: Enemy): void {
    const proj  = this.enemyProjectilePool.get();
    const angle = Phaser.Math.Angle.Between(spitter.x, spitter.y, this.player.x, this.player.y);
    proj.activate(
      spitter.x, spitter.y,
      Math.cos(angle) * SPITTER_PROJ_SPEED, Math.sin(angle) * SPITTER_PROJ_SPEED,
      spitter.enemyData?.damage ?? 8, 'PHYSICAL', 0, 'proj_physical_tex',
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
      this.player.x, this.player.y, target.x, target.y,
      na.stats.damage, na.attribute, speed,
      na.attackShape.pierce ?? 0,
      `proj_${na.attribute.toLowerCase()}_tex`,
    );
    this.normalAttackTimer = na.cooldown * 1000;
  }

  // ── 프레임 업데이트: Ability 발동 ─────────────────────────

  private updateAbilities(delta: number): void {
    for (const slot of this.abilityManager.getEquippedAbilities()) {
      const id      = slot.ability.id;
      const current = this.abilityTimers.get(id) ?? 0;
      const next    = current - delta;
      if (next <= 0) {
        this.fireAbility(slot);
        const stats      = slot.ability.stats[slot.level - 1];
        const cdMs       = (stats.cooldown ?? slot.ability.cooldown ?? 2) * 1000;
        this.abilityTimers.set(id, cdMs);
        this.abilityCooldowns.set(id, cdMs); // HUD 쿨다운 표시용
      } else {
        this.abilityTimers.set(id, next);
      }
    }
  }

  // Ability 발동 진입점.
  // Ara 패시브 + Attribute Card 보너스 + Overheat 연동 후 form 분기.
  private fireAbility(slot: AbilitySlot): void {
    const stats  = slot.ability.stats[slot.level - 1];
    const rawDmg = stats.damage ?? 0;

    // Ara 고유 패시브: 광기의 불꽃
    const araBonus = slot.ability.attribute === 'FIRE'
      ? this.player.getFirePassiveBonus(this.abilityManager.countByAttribute('FIRE'))
      : 0;

    // Attribute Card PERCENT 보너스
    const attrBonus  = this.attributeDmgBonuses.get(slot.ability.attribute) ?? 0;
    const combined   = 1 + araBonus + attrBonus / 100;

    // Overheat: FIRE Ability 발동 직전 체크
    let overheatDmgMult  = 1;
    let overheatAreaMult = 1;
    if (slot.ability.attribute === 'FIRE') {
      const mech = this.player.mechanic as OverheatMechanic | null;
      if (mech?.consumeOverheat()) {
        overheatDmgMult  = OVERHEAT_DAMAGE_MULT;
        overheatAreaMult = OVERHEAT_AREA_MULT;
      }
    }

    const form = slot.ability.attackShape?.form;
    if (form === 'ZONE') {
      const baseDmg = rawDmg * combined * this.player.characterData.damageMultiplier * overheatDmgMult;
      this.fireZoneAbility(slot, stats, baseDmg, overheatAreaMult);
    } else if (form === 'PROJECTILE') {
      const projDmg = rawDmg * combined * overheatDmgMult;
      this.fireProjectileAbility(slot, stats, projDmg);
    } else if (form === 'MELEE_HIT') {
      const baseDmg = rawDmg * combined * this.player.characterData.damageMultiplier * overheatDmgMult;
      this.fireMeleeHitAbility(slot, stats, baseDmg, overheatAreaMult);
    }

    // Overheat: FIRE Ability 발동 후 heat 누적
    if (slot.ability.attribute === 'FIRE') {
      const mech = this.player.mechanic as OverheatMechanic | null;
      mech?.addHeat();
    }
  }

  // ZONE: 플레이어 중심 범위 내 모든 적 즉시 피해. areaScale은 Overheat 적용값.
  private fireZoneAbility(slot: AbilitySlot, stats: LevelStats, baseDmg: number, areaScale = 1): void {
    const radius = (stats.area ?? 80) * areaScale;
    const color  = ATTRIBUTE_COLORS[slot.ability.attribute];
    const toKill: Enemy[] = [];

    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) > radius) continue;

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

    if (stats.healAmount) this.player.heal(stats.healAmount);
    this.showZoneEffect(this.player.x, this.player.y, radius, color);
  }

  // PROJECTILE: 가장 가까운 N개 적을 자동 조준해 투사체 발사.
  private fireProjectileAbility(slot: AbilitySlot, stats: LevelStats, projDmg: number): void {
    const count   = stats.projectileCount ?? 1;
    const pierce  = stats.pierce ?? slot.ability.attackShape?.pierce ?? 0;
    const speed   = slot.ability.attackShape?.speed ?? 300;
    const texKey  = `proj_${slot.ability.attribute.toLowerCase()}_tex`;
    for (const target of this.findNearestEnemies(count)) {
      this.fireProjectile(
        this.player.x, this.player.y, target.x, target.y,
        projDmg, slot.ability.attribute, speed, pierce, texKey,
      );
    }
  }

  // MELEE_HIT: 마지막 이동 방향 기준 ±90° 부채꼴 내 적에게 피해.
  private fireMeleeHitAbility(slot: AbilitySlot, stats: LevelStats, baseDmg: number, areaScale = 1): void {
    const radius   = (stats.area ?? 70) * areaScale;
    const color    = ATTRIBUTE_COLORS[slot.ability.attribute];
    const dirAngle = Math.atan2(this.player.lastDirectionY, this.player.lastDirectionX);
    const halfArc  = Math.PI / 2;
    const toKill: Enemy[] = [];

    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist > radius) continue;

      const toEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(toEnemy - dirAngle)) > halfArc) continue;

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

  // ── 시각 이펙트 ──────────────────────────────────────────

  private showZoneEffect(x: number, y: number, radius: number, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, 0.3);
    g.fillCircle(x, y, radius);
    g.lineStyle(2, color, 0.8);
    g.strokeCircle(x, y, radius);
    this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() });
  }

  private showMeleeHitEffect(x: number, y: number, radius: number, angle: number, color: number): void {
    const g       = this.add.graphics();
    const halfArc = Math.PI / 2;
    const steps   = 12;
    g.fillStyle(color, 0.45);
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i <= steps; i++) {
      const a = (angle - halfArc) + (i / steps) * halfArc * 2;
      g.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    g.closePath();
    g.fillPath();
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  // 적 사망 시 Relic Box 시각 표시 (임시: 빈 상자 3초 후 페이드)
  private showRelicBoxDrop(x: number, y: number): void {
    const g = this.add.graphics().setDepth(20);
    g.fillStyle(0x9900ff, 1);
    g.fillRect(x - 14, y - 14, 28, 28);
    g.lineStyle(2, 0xffdd44, 1);
    g.strokeRect(x - 14, y - 14, 28, 28);
    const t = this.add.text(x, y, '?', { fontSize: '18px', color: '#ffdd44' })
      .setOrigin(0.5).setDepth(21);
    this.tweens.add({
      targets: [g, t], alpha: 0, delay: 2000, duration: 600,
      onComplete: () => { g.destroy(); t.destroy(); },
    });
  }

  // ── 프레임 업데이트: 오브 흡수 ───────────────────────────

  private updateXPOrbAttraction(): void {
    for (const child of this.xpOrbGroup.getChildren()) {
      const orb = child as XPOrb;
      if (orb.active) orb.updateAttraction(this.player.x, this.player.y, XP_ABSORB_RADIUS, XP_ABSORB_SPEED);
    }
  }

  private updateHPOrbAttraction(): void {
    for (const child of this.hpOrbGroup.getChildren()) {
      const orb = child as HPOrb;
      if (orb.active) orb.updateAttraction(this.player.x, this.player.y, HP_ABSORB_RADIUS, HP_ABSORB_SPEED);
    }
  }

  // ── 프레임 업데이트: 투사체 정리 ─────────────────────────

  private cleanupOutOfBoundsProjectiles(): void {
    const { width, height } = this.scale;
    for (const child of this.projectileGroup.getChildren()) {
      const proj = child as Projectile;
      if (proj.active && (proj.x < 0 || proj.x > width || proj.y < 0 || proj.y > height)) {
        proj.deactivate(); this.projectilePool.release(proj);
      }
    }
    for (const child of this.enemyProjectileGroup.getChildren()) {
      const proj = child as Projectile;
      if (proj.active && (proj.x < 0 || proj.x > width || proj.y < 0 || proj.y > height)) {
        this.shockwaveSet.delete(proj);
        proj.deactivate(); this.enemyProjectilePool.release(proj);
      }
    }
  }

  // ── 전투 헬퍼 ─────────────────────────────────────────────

  private findNearestEnemy(): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = Infinity;
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (d < minDist) { minDist = d; nearest = enemy; }
    }
    return nearest;
  }

  private findNearestEnemies(count: number): Enemy[] {
    const list: Array<{ enemy: Enemy; dist: number }> = [];
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      list.push({ enemy, dist: Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) });
    }
    return list.sort((a, b) => a.dist - b.dist).slice(0, count).map(e => e.enemy);
  }

  private fireProjectile(
    fromX: number, fromY: number, toX: number, toY: number,
    damage: number | null, attribute: Attribute,
    speed: number, pierce: number, textureKey: string,
  ): void {
    if (!damage) return;
    const proj  = this.projectilePool.get();
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    proj.activate(fromX, fromY, Math.cos(angle) * speed, Math.sin(angle) * speed, damage, attribute, pierce, textureKey);
  }

  // ── 적 처치 ───────────────────────────────────────────────

  private onEnemyDeath(enemy: Enemy): void {
    const data       = enemy.enemyData;
    const x          = enemy.x;
    const y          = enemy.y;
    const isChampion = this.championSet.has(enemy);

    this.spitterTimers.delete(enemy);
    this.championSet.delete(enemy);
    this.championTimers.delete(enemy);

    enemy.deactivate();
    this.enemyPool.release(enemy);

    if (!data) return;

    const drops = DropManager.computeDrops(data);

    const xpOrb = this.xpOrbPool.get();
    xpOrb.activate(x, y, drops.xpAmount);

    if (drops.hpHealPercent !== null) {
      const hpOrb = this.hpOrbPool.get();
      hpOrb.activate(x, y, drops.hpHealPercent);
    }

    this.playerGold += drops.goldAmount;

    if (isChampion) this.showRelicBoxDrop(x, y);
  }

  // ── Physics Overlap 콜백 ──────────────────────────────────

  private handleProjectileHitEnemy(proj: Projectile, enemy: Enemy): void {
    if (!proj.active || !enemy.active) return;

    const attrBonus  = this.attributeDmgBonuses.get(proj.attribute) ?? 0;
    const attrFactor = 1 + attrBonus / 100;
    const isCrit     = Math.random() < CRIT_CHANCE;
    const result     = calculate({
      baseDamage:        proj.damage * this.player.characterData.damageMultiplier * attrFactor,
      attribute:         proj.attribute,
      attackerTags:      { attribute: proj.attribute },
      targetResistances: enemy.resistances,
      targetSpecialTags: enemy.specialTags,
      isCritical:        isCrit,
      critMultiplier:    CRIT_MULTIPLIER,
    });

    const isDead = enemy.takeDamage(result.finalDamage);
    if (proj.onHit()) { proj.deactivate(); this.projectilePool.release(proj); }
    if (isDead) this.onEnemyDeath(enemy);
  }

  private handlePlayerHitEnemy(enemy: Enemy): void {
    if (!enemy.active) return;
    const isCrit = Math.random() < CRIT_CHANCE;
    const result = calculate({
      baseDamage: enemy.contactDamage, attribute: 'PHYSICAL',
      attackerTags: {}, targetResistances: [], targetSpecialTags: [],
      isCritical: isCrit, critMultiplier: CRIT_MULTIPLIER,
    });
    this.player.takeDamage(result.finalDamage, this.time.now);
  }

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

  private handlePlayerCollectHP(orb: HPOrb): void {
    if (!orb.active) return;
    this.player.heal(Math.floor(this.player.maxHp * orb.healPercent));
    orb.deactivate();
    this.hpOrbPool.release(orb);
  }

  // 적 투사체 → 플레이어. 충격파면 넉백 추가 적용.
  private handleEnemyProjectileHitPlayer(proj: Projectile): void {
    if (!proj.active) return;

    // velocity는 deactivate() 전에 읽어야 함
    const body         = proj.body as Phaser.Physics.Arcade.Body;
    const vx           = body.velocity.x;
    const vy           = body.velocity.y;
    const isShockwave  = this.shockwaveSet.has(proj);

    const isCrit = Math.random() < CRIT_CHANCE;
    const result = calculate({
      baseDamage: proj.damage, attribute: proj.attribute,
      attackerTags: {}, targetResistances: [], targetSpecialTags: [],
      isCritical: isCrit, critMultiplier: CRIT_MULTIPLIER,
    });

    this.player.takeDamage(result.finalDamage, this.time.now);

    if (isShockwave) {
      const len = Math.sqrt(vx * vx + vy * vy) || 1;
      this.player.applyKnockback((vx / len) * 350, (vy / len) * 350, 250, this.time.now);
      this.shockwaveSet.delete(proj);
    }

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
      this.applyAttributeCard(choice.data);
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

  // Attribute Card 효과 적용 (damage PERCENT 카드만 즉시 반영)
  private applyAttributeCard(card: AttributeCard): void {
    if (card.statKey === 'damage' && card.valueType === 'PERCENT') {
      const prev = this.attributeDmgBonuses.get(card.attribute) ?? 0;
      this.attributeDmgBonuses.set(card.attribute, prev + card.value);
    }
  }

  // ── Champion 스폰 ─────────────────────────────────────────

  private checkChampionSpawn(): void {
    for (let i = 0; i < CHAMPION_CHECK_TIMES.length; i++) {
      if (!this.championCheckDone[i] && this.stageElapsedSeconds >= CHAMPION_CHECK_TIMES[i]) {
        this.championCheckDone[i] = true;
        if (Math.random() < CHAMPION_SPAWN_CHANCE) this.spawnChampion();
      }
    }
  }

  private spawnChampion(): void {
    const { width, height } = this.scale;
    const pad  = 40;
    const side = Math.floor(Math.random() * 4);
    let x: number, y: number;
    switch (side) {
      case 0:  x = Phaser.Math.Between(0, width); y = -pad;           break;
      case 1:  x = Phaser.Math.Between(0, width); y = height + pad;   break;
      case 2:  x = -pad; y = Phaser.Math.Between(0, height);          break;
      default: x = width + pad; y = Phaser.Math.Between(0, height);   break;
    }
    const enemy = this.enemyPool.get();
    enemy.activate(x, y, STONE_WARDEN_DATA);
    this.championSet.add(enemy);
  }

  // ── 스폰 ──────────────────────────────────────────────────

  private spawnEnemy(x: number, y: number, data: EnemyData): void {
    const enemy = this.enemyPool.get();
    enemy.activate(x, y, data);
  }

  // ── 게임 종료 / 스테이지 클리어 ──────────────────────────

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.physics.pause();
    if (this.scene.isActive('UIScene')) this.scene.stop('UIScene');
    this.showGameOverScreen();
  }

  private showGameOverScreen(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(100);
    this.add.text(width / 2, height / 2 - 90, 'GAME OVER', {
      fontSize: '52px', color: '#ff4444', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const m = Math.floor(this.stageElapsedSeconds / 60);
    const s = Math.floor(this.stageElapsedSeconds % 60);
    this.add.text(width / 2, height / 2 - 10, `생존 시간: ${m}:${String(s).padStart(2, '0')}`, {
      fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(101);
    this.add.text(width / 2, height / 2 + 30, `Gold: ${this.playerGold}`, {
      fontSize: '22px', color: '#ffdd44',
    }).setOrigin(0.5).setDepth(101);

    const btn = this.add.rectangle(width / 2, height / 2 + 90, 170, 48, 0x444466)
      .setDepth(101).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height / 2 + 90, '다시 시작', { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5).setDepth(102);
    btn.on('pointerover',  () => btn.setFillStyle(0x6666aa));
    btn.on('pointerout',   () => btn.setFillStyle(0x444466));
    btn.on('pointerup',    () => { this.scene.stop('UIScene'); this.scene.restart(); });
  }

  private showStageComplete(): void {
    this.stageCompleted = true;
    this.physics.pause();
    if (this.scene.isActive('UIScene')) this.scene.stop('UIScene');

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(100);
    this.add.text(width / 2, height / 2 - 90, 'STAGE CLEAR!', {
      fontSize: '52px', color: '#ffdd44', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const m = Math.floor(this.stageElapsedSeconds / 60);
    const s = Math.floor(this.stageElapsedSeconds % 60);
    this.add.text(width / 2, height / 2 - 10, `클리어 시간: ${m}:${String(s).padStart(2, '0')}`, {
      fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(101);
    this.add.text(width / 2, height / 2 + 30, `Gold: ${this.playerGold}`, {
      fontSize: '22px', color: '#ffdd44',
    }).setOrigin(0.5).setDepth(101);

    const btn = this.add.rectangle(width / 2, height / 2 + 90, 170, 48, 0x446644)
      .setDepth(101).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height / 2 + 90, '다시 시작', { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5).setDepth(102);
    btn.on('pointerover', () => btn.setFillStyle(0x66aa66));
    btn.on('pointerout',  () => btn.setFillStyle(0x446644));
    btn.on('pointerup',   () => { this.scene.stop('UIScene'); this.scene.restart(); });
  }

  // ── 텍스처 생성 ───────────────────────────────────────────

  private generateGameTextures(): void {
    // Grunt: 빨간 원
    if (!this.textures.exists('grunt_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff2222, 1); g.fillCircle(18, 18, 18);
      g.generateTexture('grunt_tex', 36, 36); g.destroy();
    }
    // ArmoredGrunt: 회색 사각형 + 테두리
    if (!this.textures.exists('armored_grunt_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0x888888, 1); g.fillRect(2, 2, 32, 32);
      g.lineStyle(2, 0xbbbbbb, 1); g.strokeRect(2, 2, 32, 32);
      g.generateTexture('armored_grunt_tex', 36, 36); g.destroy();
    }
    // Spitter: 주황색 삼각형
    if (!this.textures.exists('spitter_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff8800, 1); g.fillTriangle(16, 0, 32, 32, 0, 32);
      g.generateTexture('spitter_tex', 32, 32); g.destroy();
    }
    // Stone Warden: 크고 밝은 보라색 원 + 테두리 (Champion)
    if (!this.textures.exists('stone_warden_tex')) {
      const r = 28;
      const g = this.make.graphics();
      g.fillStyle(0xaa44ff, 1); g.fillCircle(r + 2, r + 2, r);
      g.lineStyle(3, 0xffaaff, 1); g.strokeCircle(r + 2, r + 2, r);
      g.generateTexture('stone_warden_tex', (r + 2) * 2, (r + 2) * 2); g.destroy();
    }
    // HP 오브: 빨간 십자
    if (!this.textures.exists('hp_orb_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff2222, 1);
      g.fillRect(2, 7, 16, 6); g.fillRect(7, 2, 6, 16);
      g.generateTexture('hp_orb_tex', 20, 20); g.destroy();
    }
    // 충격파: 주황 원 (일반 투사체보다 큼)
    if (!this.textures.exists('shockwave_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff8800, 0.9); g.fillCircle(12, 12, 12);
      g.lineStyle(2, 0xffdd44, 1); g.strokeCircle(12, 12, 12);
      g.generateTexture('shockwave_tex', 24, 24); g.destroy();
    }
    // 속성별 투사체 텍스처
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
        g.fillStyle(color, 1); g.fillCircle(6, 6, 6);
        g.generateTexture(key, 12, 12); g.destroy();
      }
    }
    // XP 오브: 초록 원
    if (!this.textures.exists('xp_orb_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0x44ff44, 1); g.fillCircle(6, 6, 6);
      g.generateTexture('xp_orb_tex', 12, 12); g.destroy();
    }
  }
}
