// ============================================================
// src/data/enemies.ts
// 적 정적 데이터 정의 파일. 로직 없음, 순수 데이터만.
// 적 추가 시 이 파일에 EnemyData 항목만 추가.
//
// 사용처:
//   Enemy.ts > activate() — 스탯 초기화
//   GameScene.ts > spawnEnemy() — 스폰 시 전달
//   WaveManager.ts (Block 4) — 웨이브 구성
// ============================================================

import { EnemyGrade, SpecialTag, Attribute } from '../abilities/AbilityData';

export interface EnemyData {
  id: string;
  name: string;
  grade: EnemyGrade;

  // 전투 스탯 (임시값 — 밸런싱 단계에서 조정 예정)
  hp: number;
  moveSpeed: number;      // px/s
  damage: number;         // 플레이어 접촉 피해
  xpReward: number;       // 처치 시 XP 드롭량

  // 물리/비주얼
  bodyRadius: number;     // 충돌 판정 반지름 (px)
  textureKey: string;     // Phaser 텍스처 키 (GameScene에서 사전 생성)

  // 속성 저항 및 특수 태그 (CLAUDE.md §14)
  resistances: { attribute: Attribute; reduction: number }[];
  specialTags: SpecialTag[];
}

// ──────────────────────────────────────────────
// Grunt — 기본 돌격형 MOB
// 특수 태그 없음. 플레이어를 향해 직선 추적. 접촉 피해.
// ──────────────────────────────────────────────
export const GRUNT_DATA: EnemyData = {
  id:         'grunt',
  name:       'Grunt',
  grade:      'MOB',
  hp:         40,       // 임시값
  moveSpeed:  90,       // 임시값 (px/s)
  damage:     10,       // 임시값
  xpReward:   5,        // 임시값
  bodyRadius: 18,
  textureKey: 'grunt_tex',
  resistances: [],
  specialTags: [],
};

// ──────────────────────────────────────────────
// ArmoredGrunt — 방어형 MOB (Block 4에서 활성화)
// ARMORED: 물리 피해 50% 감소 (CLAUDE.md §14)
// Grunt보다 HP 많고 이동속도 느림.
// ──────────────────────────────────────────────
export const ARMORED_GRUNT_DATA: EnemyData = {
  id:         'armored_grunt',
  name:       'Armored Grunt',
  grade:      'MOB',
  hp:         70,       // 임시값
  moveSpeed:  70,       // 임시값
  damage:     12,       // 임시값
  xpReward:   8,        // 임시값
  bodyRadius: 18,
  textureKey: 'armored_grunt_tex',
  resistances: [],
  specialTags: ['ARMORED'],
};

// ──────────────────────────────────────────────
// Spitter — 원거리형 MOB (Block 4에서 활성화)
// 플레이어와 거리 유지하며 투사체 발사. 근접 시 도주.
// ──────────────────────────────────────────────
export const SPITTER_DATA: EnemyData = {
  id:         'spitter',
  name:       'Spitter',
  grade:      'MOB',
  hp:         30,       // 임시값
  moveSpeed:  80,       // 임시값
  damage:     8,        // 임시값
  xpReward:   7,        // 임시값
  bodyRadius: 16,
  textureKey: 'spitter_tex',
  resistances: [],
  specialTags: [],
};

// WaveManager(Block 4)에서 id로 데이터를 조회할 때 사용
export const ENEMY_DATA_MAP: Record<string, EnemyData> = {
  grunt:         GRUNT_DATA,
  armored_grunt: ARMORED_GRUNT_DATA,
  spitter:       SPITTER_DATA,
};