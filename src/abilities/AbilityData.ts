export type Attribute = 'FIRE' | 'FROST' | 'LIGHTNING' | 'SHADOW' | 'ARCANE' | 'PHYSICAL' | 'HOLY';
export type AbilityType = 'ACTIVE' | 'PASSIVE' | 'AURA' | 'SUMMON' | 'REACTION';
export type RangeType = 'MELEE' | 'MID' | 'LONG' | 'SELF' | 'GLOBAL';
export type TriggerType = 'TIME' | 'CONDITION';
export type AimType = 'AUTO' | 'DIRECTIONAL';
export type AttackForm = 'PROJECTILE' | 'FALLING' | 'ZONE' | 'MELEE_HIT';
export type AuraTarget = 'ENEMY' | 'SELF';
export type TargetType = 'RANDOM' | 'ON_ENEMY';
export type ValueType = 'PERCENT' | 'FLAT';
export type EnemyGrade = 'MOB' | 'ELITE' | 'CHAMPION' | 'BOSS';
export type SpecialTag = 'ARMORED' | 'ETHEREAL' | 'UNDEAD';

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
  stackRequired: [number, number, number];
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

export const ATTRIBUTE_COLORS: Record<Attribute, number> = {
  FIRE:      0xff4400,
  FROST:     0x44aaff,
  LIGHTNING: 0xffee00,
  SHADOW:    0x6600cc,
  ARCANE:    0xff44aa,
  PHYSICAL:  0x888888,
  HOLY:      0xffdd44,
};

// TODO: Ability 풀 전체 데이터 정의
export const ALL_ABILITIES: AbilityData[] = [];