// ============================================================
// src/abilities/AbilityData.ts
// 전체 타입 정의 + Ability 풀 정적 데이터.
// 로직 없음 — 순수 데이터 / 타입만.
//
// 사용처:
//   AbilityManager.ts  — 슬롯 관리, Stack/Level 연산
//   LevelUpManager.ts  — 선택지 생성 풀
//   GameScene.ts       — startingAbility 탐색, 발사 로직 참조
//   LevelUpUI.ts       — 카드 표시
// ============================================================

export type Attribute   = 'FIRE' | 'FROST' | 'LIGHTNING' | 'SHADOW' | 'ARCANE' | 'PHYSICAL' | 'HOLY';
export type AbilityType = 'ACTIVE' | 'PASSIVE' | 'AURA' | 'SUMMON' | 'REACTION';
export type RangeType   = 'MELEE' | 'MID' | 'LONG' | 'SELF' | 'GLOBAL';
export type TriggerType = 'TIME' | 'CONDITION';
export type AimType     = 'AUTO' | 'DIRECTIONAL';
export type AttackForm  = 'PROJECTILE' | 'FALLING' | 'ZONE' | 'MELEE_HIT';
export type AuraTarget  = 'ENEMY' | 'SELF';
export type TargetType  = 'RANDOM' | 'ON_ENEMY';
export type ValueType   = 'PERCENT' | 'FLAT';
export type EnemyGrade  = 'MOB' | 'ELITE' | 'CHAMPION' | 'BOSS';
export type SpecialTag  = 'ARMORED' | 'ETHEREAL' | 'UNDEAD';

export interface Tag {
  attribute?: Attribute;
  type?: AbilityType;
  range?: RangeType;
}

export interface AttackShape {
  form: AttackForm;
  speed?: number;
  pierce?: number;
  targetType?: TargetType;
  duration?: number;
  interval?: number;
}

export interface SummonData {
  maxCount: number;
  duration: number | null;
  attackForm: AttackForm;
}

export interface LevelStats {
  damage?: number;
  cooldown?: number;
  area?: number;
  pierce?: number;
  projectileCount?: number;
  dotDamage?: number;
  dotDuration?: number;
  dotInterval?: number;
  chainCount?: number;
  shieldAmount?: number;
  healAmount?: number;
}

export interface AbilityData {
  id: string;
  name: string;
  attribute: Attribute;
  type: AbilityType;
  range: RangeType;
  triggerType?: TriggerType;
  cooldown?: number;
  triggerCondition?: string;
  aimType?: AimType;
  attackShape?: AttackShape;
  summonData?: SummonData;
  reactionTrigger?: string;
  auraTarget?: AuraTarget;
  // [1, 3, 5]: 레벨 1→2에 스택 1개, 2→3에 3개, 3→4에 5개 필요 (CLAUDE.md §3)
  stackRequired: [number, number, number];
  // 4레벨 구조: stats[0]=Lv1, stats[1]=Lv2, stats[2]=Lv3, stats[3]=Lv4
  stats: [LevelStats, LevelStats, LevelStats, LevelStats];
  effectDesc: [string, string, string, string];
}

export interface NormalAttackStats {
  damage: number;
  projectileCount: number | null;
  area: number | null;
  dotDamage: number | null;
  dotDuration: number | null;
  dotInterval: number | null;
  chainCount: number | null;
}

export interface NormalAttack {
  id: string;
  name: string;
  ownerCharacter: string;
  attribute: Attribute;
  range: RangeType;
  aimType: AimType;
  attackShape: AttackShape;
  cooldown: number;
  stats: NormalAttackStats;
}

// 임시 그래픽 색상 코드 (CLAUDE.md §16)
export const ATTRIBUTE_COLORS: Record<Attribute, number> = {
  FIRE:      0xff4400,
  FROST:     0x44aaff,
  LIGHTNING: 0xffee00,
  SHADOW:    0x6600cc,
  ARCANE:    0xff44aa,
  PHYSICAL:  0x888888,
  HOLY:      0xffdd44,
};

// ── Ability 풀 (Block 3 추가, 발동 로직은 Block 4) ──────────

// flame_burst: FIRE / ACTIVE / MELEE / ZONE / TIME
// Ara Starting Gear (characters.ts > ARA_DATA.startingAbilityId)
const FLAME_BURST: AbilityData = {
  id:          'flame_burst',
  name:        'Flame Burst',
  attribute:   'FIRE',
  type:        'ACTIVE',
  range:       'MELEE',
  triggerType: 'TIME',
  cooldown:    4.0,
  attackShape: { form: 'ZONE', duration: 0.5, interval: 0.1 },
  stackRequired: [1, 3, 5],
  stats: [
    { damage: 25, area: 80,  cooldown: 4.0 },
    { damage: 35, area: 100, cooldown: 3.5 },
    { damage: 50, area: 120, cooldown: 3.0 },
    { damage: 70, area: 140, cooldown: 2.5 },
  ],
  effectDesc: [
    '주변 80px에 25 FIRE 피해',
    '주변 100px에 35 FIRE 피해, 쿨다운 감소',
    '주변 120px에 50 FIRE 피해, 쿨다운 감소',
    '주변 140px에 70 FIRE 피해, 쿨다운 최소화',
  ],
};

// fire_bolt: FIRE / ACTIVE / LONG / PROJECTILE / TIME / AUTO
const FIRE_BOLT: AbilityData = {
  id:          'fire_bolt',
  name:        'Fire Bolt',
  attribute:   'FIRE',
  type:        'ACTIVE',
  range:       'LONG',
  triggerType: 'TIME',
  cooldown:    2.0,
  aimType:     'AUTO',
  attackShape: { form: 'PROJECTILE', speed: 380, pierce: 0 },
  stackRequired: [1, 3, 5],
  stats: [
    { damage: 20, projectileCount: 1, cooldown: 2.0 },
    { damage: 30, projectileCount: 1, cooldown: 1.7 },
    { damage: 42, projectileCount: 2, cooldown: 1.5 },
    { damage: 58, projectileCount: 2, cooldown: 1.2 },
  ],
  effectDesc: [
    'FIRE 투사체 1발 발사, 20 피해',
    'FIRE 투사체 1발 발사, 30 피해, 쿨다운 감소',
    'FIRE 투사체 2발 동시 발사, 42 피해',
    'FIRE 투사체 2발 동시 발사, 58 피해',
  ],
};

// frost_lance: FROST / ACTIVE / LONG / PROJECTILE / TIME / AUTO / pierce
const FROST_LANCE: AbilityData = {
  id:          'frost_lance',
  name:        'Frost Lance',
  attribute:   'FROST',
  type:        'ACTIVE',
  range:       'LONG',
  triggerType: 'TIME',
  cooldown:    2.5,
  aimType:     'AUTO',
  attackShape: { form: 'PROJECTILE', speed: 300, pierce: 1 },
  stackRequired: [1, 3, 5],
  stats: [
    { damage: 28, pierce: 1, cooldown: 2.5 },
    { damage: 40, pierce: 1, cooldown: 2.2 },
    { damage: 55, pierce: 2, cooldown: 1.9 },
    { damage: 75, pierce: 3, cooldown: 1.6 },
  ],
  effectDesc: [
    'FROST 관통 투사체 (관통 1회), 28 피해',
    'FROST 관통 투사체 (관통 1회), 40 피해',
    'FROST 관통 투사체 (관통 2회), 55 피해',
    'FROST 관통 투사체 (관통 3회), 75 피해',
  ],
};

// slash: PHYSICAL / ACTIVE / MELEE / MELEE_HIT / TIME / DIRECTIONAL
const SLASH: AbilityData = {
  id:          'slash',
  name:        'Slash',
  attribute:   'PHYSICAL',
  type:        'ACTIVE',
  range:       'MELEE',
  triggerType: 'TIME',
  cooldown:    0.9,
  aimType:     'DIRECTIONAL',
  attackShape: { form: 'MELEE_HIT' },
  stackRequired: [1, 3, 5],
  stats: [
    { damage: 22, area: 70,  cooldown: 0.9 },
    { damage: 32, area: 80,  cooldown: 0.8 },
    { damage: 45, area: 90,  cooldown: 0.7 },
    { damage: 62, area: 100, cooldown: 0.6 },
  ],
  effectDesc: [
    '전방 70px PHYSICAL 타격, 22 피해',
    '전방 80px PHYSICAL 타격, 32 피해',
    '전방 90px PHYSICAL 타격, 45 피해',
    '전방 100px PHYSICAL 타격, 62 피해',
  ],
};

// holy_nova: HOLY / ACTIVE / MELEE / ZONE / TIME (범위 피해 + 회복)
const HOLY_NOVA: AbilityData = {
  id:          'holy_nova',
  name:        'Holy Nova',
  attribute:   'HOLY',
  type:        'ACTIVE',
  range:       'MELEE',
  triggerType: 'TIME',
  cooldown:    5.0,
  attackShape: { form: 'ZONE', duration: 0.3 },
  stackRequired: [1, 3, 5],
  stats: [
    { damage: 30, area: 100, healAmount: 5,  cooldown: 5.0 },
    { damage: 45, area: 120, healAmount: 8,  cooldown: 4.5 },
    { damage: 62, area: 140, healAmount: 12, cooldown: 4.0 },
    { damage: 85, area: 160, healAmount: 18, cooldown: 3.5 },
  ],
  effectDesc: [
    '주변 100px HOLY 피해 30 + 체력 5 회복',
    '주변 120px HOLY 피해 45 + 체력 8 회복',
    '주변 140px HOLY 피해 62 + 체력 12 회복',
    '주변 160px HOLY 피해 85 + 체력 18 회복',
  ],
};

// arcane_missile: ARCANE / ACTIVE / LONG / PROJECTILE / TIME / AUTO
const ARCANE_MISSILE: AbilityData = {
  id:          'arcane_missile',
  name:        'Arcane Missile',
  attribute:   'ARCANE',
  type:        'ACTIVE',
  range:       'LONG',
  triggerType: 'TIME',
  cooldown:    1.2,
  aimType:     'AUTO',
  attackShape: { form: 'PROJECTILE', speed: 500, pierce: 0 },
  stackRequired: [1, 3, 5],
  stats: [
    { damage: 14, projectileCount: 1, cooldown: 1.2 },
    { damage: 20, projectileCount: 2, cooldown: 1.1 },
    { damage: 28, projectileCount: 3, cooldown: 1.0 },
    { damage: 38, projectileCount: 4, cooldown: 0.9 },
  ],
  effectDesc: [
    'ARCANE 투사체 1발, 14 피해',
    'ARCANE 투사체 2발, 20 피해',
    'ARCANE 투사체 3발, 28 피해',
    'ARCANE 투사체 4발, 38 피해',
  ],
};

// LevelUpManager / GameScene에서 순회해 사용 (CLAUDE.md §5 선택지 생성 풀)
export const ALL_ABILITIES: AbilityData[] = [
  FLAME_BURST,
  FIRE_BOLT,
  FROST_LANCE,
  SLASH,
  HOLY_NOVA,
  ARCANE_MISSILE,
];
