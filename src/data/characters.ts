// ============================================================
// src/data/characters.ts
// 캐릭터 정적 데이터 정의 파일. 로직 없음, 순수 데이터만.
// 캐릭터 추가 시 이 파일에 데이터만 추가하면 됨.
//
// 사용처:
//   Player.ts — 생성자 주입으로 스탯/메카닉 초기화
//   GameScene.ts — Player 생성 시 전달
//   HUD.ts (Block 4) — 캐릭터 정보 표시
// ============================================================

import { NormalAttack } from '../abilities/AbilityData';

export type MechanicType = 'OVERHEAT' | 'CONDUCTOR' | 'STIGMA' | null;

// 캐릭터 기본 데이터 구조.
// Player 생성자에 주입되어 스탯과 메카닉 타입을 초기화함.
export interface CharacterData {
  id: string;
  name: string;

  // 전투 스탯 (임시값 — 밸런싱 단계에서 조정 예정)
  maxHp: number;
  moveSpeed: number;        // px/s
  damageMultiplier: number; // 기본 피해 배율 (1.0 = 100%)
  bodyRadius: number;       // 충돌 판정 반지름 (px)

  // 슬롯 미소모 고유 기본 공격.
  // abilities/AbilityData.ts > NormalAttack 인터페이스 참조.
  normalAttack: NormalAttack;

  // 런 시작 시 슬롯에 미리 장착될 Ability ID.
  // null이면 Starting Gear 없음.
  startingAbilityId: string | null;

  // 고유 메카닉 종류. GameScene에서 어떤 IMechanic 구현체를 생성할지 결정.
  mechanicType: MechanicType;

  // 고유 패시브 설명 (UI 표시용 텍스트)
  passiveDesc: string;
}

// ──────────────────────────────────────────────
// Ara (아라) — Normal Attack: Ember Shot
// FIRE / LONG / AUTO / PROJECTILE (CLAUDE.md §13)
// ──────────────────────────────────────────────
const EMBER_SHOT: NormalAttack = {
  id:             'ember_shot',
  name:           'Ember Shot',
  ownerCharacter: 'ara',
  attribute:      'FIRE',
  range:          'LONG',
  aimType:        'AUTO',
  attackShape: {
    form:  'PROJECTILE',
    speed: 400,   // px/s (임시값)
    pierce: 0,
  },
  cooldown: 1.5,  // 초 (임시값)
  stats: {
    damage:       15,   // 임시값
    projectileCount: 1,
    area:         null,
    dotDamage:    null,
    dotDuration:  null,
    dotInterval:  null,
    chainCount:   null,
  },
};

// ──────────────────────────────────────────────
// Kael (카엘) — Normal Attack: Frost Bolt
// FROST / LONG / AUTO / PROJECTILE (CLAUDE.md §11)
// ──────────────────────────────────────────────
const FROST_BOLT: NormalAttack = {
  id:             'frost_bolt',
  name:           'Frost Bolt',
  ownerCharacter: 'kael',
  attribute:      'FROST',
  range:          'LONG',
  aimType:        'AUTO',
  attackShape: {
    form:  'PROJECTILE',
    speed: 350,   // 임시값
    pierce: 0,
  },
  cooldown: 1.5,  // 임시값
  stats: {
    damage:       12,   // 임시값
    projectileCount: 1,
    area:         null,
    dotDamage:    null,
    dotDuration:  null,
    dotInterval:  null,
    chainCount:   null,
  },
};

// ──────────────────────────────────────────────
// Sera (세라) — Normal Attack: Sacred Slash
// HOLY / MELEE / DIRECTIONAL / MELEE_HIT (CLAUDE.md §11)
// ──────────────────────────────────────────────
const SACRED_SLASH: NormalAttack = {
  id:             'sacred_slash',
  name:           'Sacred Slash',
  ownerCharacter: 'sera',
  attribute:      'HOLY',
  range:          'MELEE',
  aimType:        'DIRECTIONAL',
  attackShape: {
    form: 'MELEE_HIT',
  },
  cooldown: 0.8,  // 임시값
  stats: {
    damage:       20,   // 임시값
    projectileCount: null,
    area:         null,
    dotDamage:    null,
    dotDuration:  null,
    dotInterval:  null,
    chainCount:   null,
  },
};

// ──────────────────────────────────────────────
// Ara (아라)
// 공격적 단일 속성 집중 빌드. HP 낮음, 피해 높음.
// ──────────────────────────────────────────────
export const ARA_DATA: CharacterData = {
  id:               'ara',
  name:             'Ara',
  maxHp:            80,     // 임시값
  moveSpeed:        200,    // 임시값
  damageMultiplier: 1.2,    // 임시값
  bodyRadius:       16,
  normalAttack:     EMBER_SHOT,
  startingAbilityId: 'flame_burst',
  mechanicType:     'OVERHEAT',
  passiveDesc:      'FIRE Ability 2개 이상 보유 시 모든 FIRE 피해 +15%',
};

// ──────────────────────────────────────────────
// Kael (카엘)
// Discard 적극 활용 빌드 재편형. 이동속도 빠름.
// ──────────────────────────────────────────────
export const KAEL_DATA: CharacterData = {
  id:               'kael',
  name:             'Kael',
  maxHp:            100,    // 임시값
  moveSpeed:        240,    // 임시값
  damageMultiplier: 1.0,
  bodyRadius:       16,
  normalAttack:     FROST_BOLT,
  startingAbilityId: null,
  mechanicType:     'CONDUCTOR',
  passiveDesc:      'Discard 사용 시 다음 레벨업 선택지가 3장에서 4장으로 증가',
};

// ──────────────────────────────────────────────
// Sera (세라)
// 슬롯을 덜 쓸수록 강해지는 역발상 빌드. HP 높음.
// ──────────────────────────────────────────────
export const SERA_DATA: CharacterData = {
  id:               'sera',
  name:             'Sera',
  maxHp:            130,    // 임시값
  moveSpeed:        170,    // 임시값
  damageMultiplier: 1.0,
  bodyRadius:       16,
  normalAttack:     SACRED_SLASH,
  startingAbilityId: null,
  mechanicType:     'STIGMA',
  passiveDesc:      '비어있는 Ability 슬롯 1개당 피해 +8%, 받는 피해 -3%',
};

// 캐릭터 선택 UI 등에서 전체 목록을 순회할 때 사용
export const ALL_CHARACTERS: CharacterData[] = [ARA_DATA, KAEL_DATA, SERA_DATA];