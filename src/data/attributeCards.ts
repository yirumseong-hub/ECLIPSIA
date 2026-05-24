// ============================================================
// src/data/attributeCards.ts
// Attribute Card 정적 데이터. 속성당 2장 × 7속성 = 총 14장.
// 로직 없음 — 순수 데이터만.
//
// 카드 효과 적용:
//   Block 4에서 AbilityManager / DamageCalculator와 연결 예정.
//   statKey + valueType으로 어느 스탯에 얼마나 더할지 결정.
//
// 사용처:
//   LevelUpManager.ts — 1/6 확률로 선택지에 포함
//   LevelUpUI.ts      — 카드 표시
// ============================================================

import { Attribute, Tag, ValueType } from '../abilities/AbilityData';

export interface AttributeCard {
  id: string;
  attribute: Attribute;
  effectDesc: string;
  // 이 카드가 영향을 주는 Ability 조건 (Block 4 필터링에 사용)
  targetTag: Tag;
  // 수정할 스탯 키 (LevelStats 필드명 또는 전용 키)
  statKey: string;
  value: number;
  valueType: ValueType;
}

// ── FIRE 카드 2장 ────────────────────────────────────────────

const FIRE_DMG_BOOST: AttributeCard = {
  id:         'fire_dmg_boost',
  attribute:  'FIRE',
  effectDesc: 'FIRE 계열 피해 +12%',
  targetTag:  { attribute: 'FIRE' },
  statKey:    'damage',
  value:      12,
  valueType:  'PERCENT',
};

const FIRE_DOT_BOOST: AttributeCard = {
  id:         'fire_dot_boost',
  attribute:  'FIRE',
  effectDesc: 'FIRE 지속 피해 +10%',
  targetTag:  { attribute: 'FIRE' },
  statKey:    'dotDamage',
  value:      10,
  valueType:  'PERCENT',
};

// ── FROST 카드 2장 ───────────────────────────────────────────

const FROST_DMG_BOOST: AttributeCard = {
  id:         'frost_dmg_boost',
  attribute:  'FROST',
  effectDesc: 'FROST 계열 피해 +12%',
  targetTag:  { attribute: 'FROST' },
  statKey:    'damage',
  value:      12,
  valueType:  'PERCENT',
};

const FROST_SLOW_BOOST: AttributeCard = {
  id:         'frost_slow_boost',
  attribute:  'FROST',
  effectDesc: 'FROST 둔화 지속시간 +1초',
  targetTag:  { attribute: 'FROST' },
  statKey:    'dotDuration',
  value:      1,
  valueType:  'FLAT',
};

// ── LIGHTNING 카드 2장 ───────────────────────────────────────

const LIGHTNING_DMG_BOOST: AttributeCard = {
  id:         'lightning_dmg_boost',
  attribute:  'LIGHTNING',
  effectDesc: 'LIGHTNING 계열 피해 +12%',
  targetTag:  { attribute: 'LIGHTNING' },
  statKey:    'damage',
  value:      12,
  valueType:  'PERCENT',
};

const LIGHTNING_CHAIN_BOOST: AttributeCard = {
  id:         'lightning_chain_boost',
  attribute:  'LIGHTNING',
  effectDesc: 'LIGHTNING 연쇄 횟수 +1',
  targetTag:  { attribute: 'LIGHTNING' },
  statKey:    'chainCount',
  value:      1,
  valueType:  'FLAT',
};

// ── SHADOW 카드 2장 ──────────────────────────────────────────

const SHADOW_DMG_BOOST: AttributeCard = {
  id:         'shadow_dmg_boost',
  attribute:  'SHADOW',
  effectDesc: 'SHADOW 계열 피해 +12%',
  targetTag:  { attribute: 'SHADOW' },
  statKey:    'damage',
  value:      12,
  valueType:  'PERCENT',
};

// critChance는 LevelStats에 없는 전용 키 — Block 4에서 Player 스탯에 반영
const SHADOW_CRIT_BOOST: AttributeCard = {
  id:         'shadow_crit_boost',
  attribute:  'SHADOW',
  effectDesc: 'SHADOW 공격 치명타 확률 +3%',
  targetTag:  { attribute: 'SHADOW' },
  statKey:    'critChance',
  value:      3,
  valueType:  'PERCENT',
};

// ── ARCANE 카드 2장 ──────────────────────────────────────────

const ARCANE_DMG_BOOST: AttributeCard = {
  id:         'arcane_dmg_boost',
  attribute:  'ARCANE',
  effectDesc: 'ARCANE 계열 피해 +12%',
  targetTag:  { attribute: 'ARCANE' },
  statKey:    'damage',
  value:      12,
  valueType:  'PERCENT',
};

// duration: 버프/지속 효과 지속시간 (Block 4 전용 키)
const ARCANE_BUFF_BOOST: AttributeCard = {
  id:         'arcane_buff_boost',
  attribute:  'ARCANE',
  effectDesc: 'ARCANE 효과 지속시간 +20%',
  targetTag:  { attribute: 'ARCANE' },
  statKey:    'duration',
  value:      20,
  valueType:  'PERCENT',
};

// ── PHYSICAL 카드 2장 ────────────────────────────────────────

const PHYSICAL_DMG_BOOST: AttributeCard = {
  id:         'physical_dmg_boost',
  attribute:  'PHYSICAL',
  effectDesc: 'PHYSICAL 계열 피해 +12%',
  targetTag:  { attribute: 'PHYSICAL' },
  statKey:    'damage',
  value:      12,
  valueType:  'PERCENT',
};

// armorPen: ARMORED 태그 감소율 무시 비율 (Block 4 전용 키)
const PHYSICAL_ARMOR_PEN: AttributeCard = {
  id:         'physical_armor_pen',
  attribute:  'PHYSICAL',
  effectDesc: 'PHYSICAL 방어 관통 +15%',
  targetTag:  { attribute: 'PHYSICAL' },
  statKey:    'armorPen',
  value:      15,
  valueType:  'PERCENT',
};

// ── HOLY 카드 2장 ────────────────────────────────────────────

const HOLY_HEAL_BOOST: AttributeCard = {
  id:         'holy_heal_boost',
  attribute:  'HOLY',
  effectDesc: 'HOLY 회복량 +15%',
  targetTag:  { attribute: 'HOLY' },
  statKey:    'healAmount',
  value:      15,
  valueType:  'PERCENT',
};

const HOLY_SHIELD_BOOST: AttributeCard = {
  id:         'holy_shield_boost',
  attribute:  'HOLY',
  effectDesc: 'HOLY 보호막량 +15%',
  targetTag:  { attribute: 'HOLY' },
  statKey:    'shieldAmount',
  value:      15,
  valueType:  'PERCENT',
};

// LevelUpManager에서 1/6 확률 선택지 풀로 사용
export const ALL_ATTRIBUTE_CARDS: AttributeCard[] = [
  FIRE_DMG_BOOST,      FIRE_DOT_BOOST,
  FROST_DMG_BOOST,     FROST_SLOW_BOOST,
  LIGHTNING_DMG_BOOST, LIGHTNING_CHAIN_BOOST,
  SHADOW_DMG_BOOST,    SHADOW_CRIT_BOOST,
  ARCANE_DMG_BOOST,    ARCANE_BUFF_BOOST,
  PHYSICAL_DMG_BOOST,  PHYSICAL_ARMOR_PEN,
  HOLY_HEAL_BOOST,     HOLY_SHIELD_BOOST,
];
