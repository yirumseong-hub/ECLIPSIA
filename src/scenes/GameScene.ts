// ============================================================
// src/scenes/GameScene.ts
// 메인 게임 씬. 게임 로직, 물리, ObjectPool, 전투, XP/레벨업 총괄.
//
// 씬 구성:
//   GameScene (이 파일) : 게임 로직, 물리, 충돌 처리
//   UIScene             : HUD 오버레이 (병렬 실행)
//
// ObjectPool 규칙 (CLAUDE.md §3):
//   Enemy / Projectile / XPOrb는 반드시 각 Pool을 통해 생성/반환.
//   직접 new Enemy() 등 호출 금지.
//
// 피해 계산 규칙 (CLAUDE.md §3):
//   모든 피해는 반드시 DamageCalculator.calculate()를 거침.
//
// 의존성:
//   entities/Player.ts         > Player, WASDKeys
//   entities/Enemy.ts          > Enemy
//   entities/Projectile.ts     > Projectile
//   entities/XPOrb.ts          > XPOrb
//   entities/mechanics/OverheatMechanic.ts > OverheatMechanic
//   abilities/AbilityData.ts   > AbilityData, ALL_ABILITIES, ATTRIBUTE_COLORS
//   abilities/AbilityManager.ts > AbilityManager
//   systems/DamageCalculator.ts > calculate
//   systems/LevelUpManager.ts  > LevelUpManager, Choice
//   ui/LevelUpUI.ts            > LevelUpUI
//   data/characters.ts         > ARA_DATA
//   data/enemies.ts            > GRUNT_DATA, EnemyData
//   utils/ObjectPool.ts        > ObjectPool
// ============================================================

import Phaser from 'phaser';
import { Player, WASDKeys } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { XPOrb } from '../entities/XPOrb';
import { OverheatMechanic } from '../entities/mechanics/OverheatMechanic';
import { AbilityData, ALL_ABILITIES, Attribute, ATTRIBUTE_COLORS } from '../abilities/AbilityData';
import { AbilityManager } from '../abilities/AbilityManager';
import { LevelUpManager, Choice } from '../systems/LevelUpManager';
import { LevelUpUI } from '../ui/LevelUpUI';
import { calculate } from '../systems/DamageCalculator';
import { ARA_DATA } from '../data/characters';
import { GRUNT_DATA, EnemyData } from '../data/enemies';
import { ObjectPool } from '../utils/ObjectPool';

// ── 전투 상수 (임시값 — CLAUDE.md §15) ──────────────────────
// 치명타: 확률 5%, 배율 1.5x (CLAUDE.md §9)
const CRIT_CHANCE     = 0.05;
const CRIT_MULTIPLIER = 1.5;

// ── XP / 레벨업 상수 (임시값 — CLAUDE.md §15) ───────────────
// 각 레벨에서 다음 레벨로 오르는 데 필요한 XP (인덱스 = 현재레벨 - 1)
const XP_THRESHOLDS   = [20, 50, 90, 140, 200, 270, 350, 440];
// 반경 내 XP 오브 자동 흡수 (CLAUDE.md §15)
const XP_ABSORB_RADIUS = 100;
const XP_ABSORB_SPEED  = 150;

// ── 테스트 스폰 설정 (Block 4에서 WaveManager로 교체) ────────
const TEST_SPAWN_COUNT = 8;
const MIN_SPAWN_DIST   = 200;

export class GameScene extends Phaser.Scene {
  // ── 엔티티 ───────────────────────────────────────────────
  private player!: Player;

  // ── ObjectPool (CLAUDE.md §3: 풀링 필수) ─────────────────
  private enemyPool!: ObjectPool<Enemy>;
  private projectilePool!: ObjectPool<Projectile>;
  private xpOrbPool!: ObjectPool<XPOrb>;

  // ── Phaser Physics Group ──────────────────────────────────
  // 풀에서 생성된 모든 인스턴스(활성+비활성 포함)를 보유.
  // 비활성 인스턴스는 body.enable=false 상태여서 overlap 자동 스킵됨.
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private xpOrbGroup!: Phaser.Physics.Arcade.Group;

  // ── 입력 ─────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: WASDKeys;

  // ── Normal Attack 타이머 ──────────────────────────────────
  // 매 프레임 delta(ms)로 감산. 0 이하 시 발사 후 cooldown으로 리셋.
  private normalAttackTimer: number = 0;

  // ── Ability 시스템 (Block 3) ──────────────────────────────
  private abilityManager!: AbilityManager;
  private levelUpManager!: LevelUpManager;
  private levelUpUI!: LevelUpUI;

  // ── XP / 레벨 시스템 (Block 3) ───────────────────────────
  private playerLevel: number = 1;
  private playerXP:    number = 0;

  // 레벨업 UI 표시 중 true. update() 조기 반환으로 게임 로직 정지.
  private isLevelingUp: boolean = false;

  // 슬롯 꽉 찬 상태에서 선택한 Ability — Discard 후 자동 장착 대기.
  private pendingAbility: AbilityData | null = null;

  // ── 디버그 표시 (UIScene HUD 구현 전 임시) ──────────────────
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

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
    this.enemyGroup      = this.physics.add.group();
    this.projectileGroup = this.physics.add.group();
    this.xpOrbGroup      = this.physics.add.group();

    // ⑤ ObjectPool 초기화
    // factory: 인스턴스 생성 후 Physics Group에 추가 (최초 1회).
    // reset: no-op (activate/deactivate가 상태 전담).
    this.enemyPool = new ObjectPool<Enemy>(
      () => { const e = new Enemy(this); this.enemyGroup.add(e); return e; },
      () => {},
      20,
    );
    this.projectilePool = new ObjectPool<Projectile>(
      () => { const p = new Projectile(this); this.projectileGroup.add(p); return p; },
      () => {},
      30,
    );
    this.xpOrbPool = new ObjectPool<XPOrb>(
      () => { const o = new XPOrb(this); this.xpOrbGroup.add(o); return o; },
      () => {},
      30,
    );

    // ⑥ 플레이어 생성
    // ARA_DATA: data/characters.ts에서 정의한 Ara 스탯 데이터
    // OverheatMechanic: Ara 고유 메카닉 (IMechanic 인터페이스로 주입)
    this.player = new Player(this, width / 2, height / 2, ARA_DATA, new OverheatMechanic());

    // ⑦ Ability 시스템 초기화 (Block 3)
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
    // 투사체 ↔ 적: 피해 적용 (DamageCalculator 경유)
    this.physics.add.overlap(
      this.projectileGroup,
      this.enemyGroup,
      (a, b) => this.handleProjectileHitEnemy(a as Enemy | Projectile, b as Enemy | Projectile),
    );

    // 플레이어 ↔ 적: 접촉 피해 (무적 판정 포함)
    this.physics.add.overlap(
      this.player,
      this.enemyGroup,
      (_p, b) => this.handlePlayerHitEnemy(b as Enemy),
    );

    // 플레이어 ↔ XP 오브: XP 수집
    this.physics.add.overlap(
      this.player,
      this.xpOrbGroup,
      (_p, o) => this.handlePlayerCollectXP(o as XPOrb),
    );

    // ⑨ 키보드 입력
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // ⑩ 디버그 텍스트 (UIScene HUD 구현 전 임시 레벨/XP 표시)
    this.debugText = this.add.text(width - 8, 8, '', {
      fontSize: '13px', color: '#ffffff',
    }).setOrigin(1, 0).setDepth(50);

    // ⑪ 테스트 적 스폰 (Block 4에서 WaveManager로 교체)
    this.spawnTestEnemies();

    // ⑫ UI 씬 병렬 실행 (HUD 등 오버레이)
    this.scene.launch('UIScene');
  }

  update(time: number, delta: number): void {
    // 레벨업 UI 표시 중 게임 로직 정지 (physics.pause()와 함께)
    if (this.isLevelingUp) return;

    // 플레이어: 이동 + 무적 시각 + 메카닉 업데이트
    this.player.update(this.cursors, this.wasd, time, delta);

    // 활성 Enemy AI 업데이트 (플레이어 추적)
    this.updateEnemies();

    // Normal Attack (Ember Shot): 타이머 기반 자동 발사
    this.updateNormalAttack(delta);

    // XP 오브 자동 흡수 (Block 3, XP_ABSORB_RADIUS=100)
    this.updateXPOrbAttraction();

    // 화면 밖으로 나간 투사체 풀 반환
    this.cleanupOutOfBoundsProjectiles();

    // 디버그: 레벨 / XP 표시
    const threshold = this.getXPThreshold(this.playerLevel);
    this.debugText.setText(
      `Lv.${this.playerLevel}  XP: ${this.playerXP}/${threshold}`,
    );
  }

  // ── Private: 프레임 업데이트 ─────────────────────────────

  // 활성 Enemy 전체를 순회해 플레이어 추적 AI 실행.
  private updateEnemies(): void {
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      enemy.chasePlayer(this.player.x, this.player.y);
    }
  }

  // Normal Attack 타이머 관리 및 발사.
  // normalAttack 데이터를 player.characterData.normalAttack에서 읽어
  // 캐릭터가 바뀌어도 이 메서드를 수정하지 않아도 됨.
  private updateNormalAttack(delta: number): void {
    this.normalAttackTimer -= delta;
    if (this.normalAttackTimer > 0) return;

    const na     = this.player.characterData.normalAttack;
    const target = this.findNearestEnemy();
    if (!target) return;

    const speed = na.attackShape.speed;
    if (!speed) return;

    // 텍스처 키: 'proj_{attribute소문자}_tex' 규칙으로 자동 결정
    const texKey = `proj_${na.attribute.toLowerCase()}_tex`;

    this.fireProjectile(
      this.player.x, this.player.y,
      target.x, target.y,
      na.stats.damage,
      na.attribute,
      speed,
      na.attackShape.pierce ?? 0,
      texKey,
    );

    this.normalAttackTimer = na.cooldown * 1000;
  }

  // XP 오브 자동 흡수: 플레이어 반경 내 오브에 속도 부여.
  // XPOrb.updateAttraction()이 반경 밖 오브 속도를 0으로 리셋.
  private updateXPOrbAttraction(): void {
    for (const child of this.xpOrbGroup.getChildren()) {
      const orb = child as XPOrb;
      if (!orb.active) continue;
      orb.updateAttraction(this.player.x, this.player.y, XP_ABSORB_RADIUS, XP_ABSORB_SPEED);
    }
  }

  // 화면 밖으로 이탈한 활성 투사체를 비활성화해 풀에 반환.
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
  }

  // ── Private: 전투 헬퍼 ────────────────────────────────────

  // 활성 Enemy 중 플레이어와 가장 가까운 대상 반환. 없으면 null.
  private findNearestEnemy(): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = Infinity;
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < minDist) { minDist = dist; nearest = enemy; }
    }
    return nearest;
  }

  // 투사체 풀에서 꺼내 발사.
  // 피해 계산은 적중 시 handleProjectileHitEnemy()에서 DamageCalculator 경유.
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

  // 적 처치 처리: 비활성화 → 풀 반환 → XP 오브 드롭.
  // DropManager(Block 4) 연동 전 임시 직접 처리.
  private onEnemyDeath(enemy: Enemy): void {
    const data = enemy.enemyData;
    const x    = enemy.x;
    const y    = enemy.y;

    enemy.deactivate();
    this.enemyPool.release(enemy);

    if (data) {
      const orb = this.xpOrbPool.get();
      orb.activate(x, y, data.xpReward);
    }
  }

  // ── Private: Physics Overlap 콜백 ─────────────────────────

  // 투사체 ↔ 적 충돌.
  // 인자 순서는 overlap() 설정 시 (projectileGroup, enemyGroup) 순서와 일치.
  // 모든 피해는 DamageCalculator.calculate()를 거침 (CLAUDE.md §3).
  private handleProjectileHitEnemy(a: Enemy | Projectile, b: Enemy | Projectile): void {
    const proj  = a as unknown as Projectile;
    const enemy = b as unknown as Enemy;
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

  // 플레이어 ↔ 적 접촉 피해.
  // Player.takeDamage()가 내부에서 무적 시간 판정 처리.
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

  // 플레이어 ↔ XP 오브 접촉: XP 수집 + 레벨업 체크.
  private handlePlayerCollectXP(orb: XPOrb): void {
    if (!orb.active) return;
    this.playerXP += orb.xpAmount;
    orb.deactivate();
    this.xpOrbPool.release(orb);

    // 레벨업 조건 충족 시 처리 (isLevelingUp 중복 방지)
    const threshold = this.getXPThreshold(this.playerLevel);
    if (this.playerXP >= threshold && !this.isLevelingUp) {
      this.playerXP -= threshold; // 초과 XP 이월
      this.onLevelUp();
    }
  }

  // ── Private: XP / 레벨업 ─────────────────────────────────

  // 현재 레벨에서 다음 레벨까지 필요한 XP.
  // playerLevel 8 초과 시 마지막 값(440) 고정.
  private getXPThreshold(level: number): number {
    return XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)];
  }

  // 레벨업 처리: 물리 정지 → 레벨/HP 갱신 → 선택지 생성 → UI 표시.
  private onLevelUp(): void {
    this.isLevelingUp = true;
    this.physics.pause();
    this.playerLevel++;

    // 레벨업 시 최대 HP의 10% 회복 (CLAUDE.md §13)
    this.player.heal(Math.floor(this.player.maxHp * 0.1));

    const choices = this.levelUpManager.generateChoices(3, this.abilityManager, this.playerLevel);
    this.levelUpUI.show(
      choices,
      this.abilityManager.getEquippedAbilities(),
      (choice) => this.handleLevelUpChoice(choice),
      (abilityId) => this.handleDiscard(abilityId),
    );
  }

  // 카드 선택 처리.
  // 유효한 경우 즉시 hide() + resume. 슬롯 꽉 참 → pendingAbility 설정 후 대기.
  private handleLevelUpChoice(choice: Choice): void {
    if (choice.type === 'ATTRIBUTE_CARD') {
      // AttributeCard 스탯 적용은 Block 4 구현 예정 — 현재는 수집만
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
      return;
    }

    const ability = choice.data;

    if (this.abilityManager.hasAbility(ability.id)) {
      // 이미 보유 → Stack +1 (레벨업 조건 충족 시 자동 레벨 상승)
      this.abilityManager.addStack(ability.id);
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
    } else if (this.abilityManager.hasEmptySlot()) {
      // 빈 슬롯 있음 → 신규 장착
      this.abilityManager.equip(ability);
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
    } else {
      // 슬롯 꽉 참 → Discard 대기. UI 유지. Discard 버튼 클릭 유도.
      this.pendingAbility = ability;
    }
  }

  // Discard 처리: 슬롯 제거 → 봉인(+5레벨) → fallback 체크 → pendingAbility 장착.
  private handleDiscard(abilityId: string): void {
    this.abilityManager.removeFromSlot(abilityId);
    this.abilityManager.ban(abilityId, this.playerLevel + 5);
    // 풀 부족 시 가장 오래된 봉인 자동 해제 (CLAUDE.md §6)
    this.levelUpManager.checkFallback(this.abilityManager, this.playerLevel);

    if (this.pendingAbility) {
      this.abilityManager.equip(this.pendingAbility);
      this.pendingAbility = null;
      this.levelUpUI.hide();
      this.resumeFromLevelUp();
    }
    // pendingAbility 없으면 UI 유지 → 사용자가 카드 선택 계속
  }

  // 물리 재개 + 레벨업 상태 해제.
  private resumeFromLevelUp(): void {
    this.isLevelingUp = false;
    this.physics.resume();
  }

  // ── Private: 스폰 ─────────────────────────────────────────

  // 테스트용 초기 스폰. Block 4에서 WaveManager로 완전 교체.
  private spawnTestEnemies(): void {
    const { width, height } = this.scale;
    for (let i = 0; i < TEST_SPAWN_COUNT; i++) {
      let x: number, y: number;
      do {
        x = Phaser.Math.Between(50, width - 50);
        y = Phaser.Math.Between(50, height - 50);
      } while (Phaser.Math.Distance.Between(x, y, width / 2, height / 2) < MIN_SPAWN_DIST);
      this.spawnEnemy(x, y, GRUNT_DATA);
    }
  }

  // enemyPool에서 Enemy를 꺼내 활성화 (직접 new Enemy() 호출 금지, CLAUDE.md §3).
  private spawnEnemy(x: number, y: number, data: EnemyData): void {
    const enemy = this.enemyPool.get();
    enemy.activate(x, y, data);
  }

  // ── Private: 텍스처 생성 ─────────────────────────────────

  // 모든 게임 오브젝트 텍스처를 Phaser Graphics 도형으로 생성.
  // 에셋 파일 없이 구현 (CLAUDE.md §16 임시 그래픽 전략).
  // Pool 초기화 이전(create() 첫 단계)에 반드시 호출해야 함.
  private generateGameTextures(): void {
    // Grunt: 빨간 원 (CLAUDE.md §16)
    if (!this.textures.exists('grunt_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0xff2222, 1);
      g.fillCircle(18, 18, 18);
      g.generateTexture('grunt_tex', 36, 36);
      g.destroy();
    }

    // 속성별 투사체 텍스처: 'proj_{attribute}_tex' 규칙 (CLAUDE.md §16)
    // GameScene.fireProjectile() 및 Ability 발사 시 자동 탐색됨.
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

    // XP 오브: 초록 원 (CLAUDE.md §16)
    if (!this.textures.exists('xp_orb_tex')) {
      const g = this.make.graphics();
      g.fillStyle(0x44ff44, 1);
      g.fillCircle(6, 6, 6);
      g.generateTexture('xp_orb_tex', 12, 12);
      g.destroy();
    }
  }
}
