import { EnemyGrade, SpecialTag, Attribute } from '../abilities/AbilityData';

export interface EnemyData {
  id: string;
  name: string;
  grade: EnemyGrade;
  hp: number;
  moveSpeed: number;
  damage: number;
  resistances: { attribute: Attribute; reduction: number }[];
  specialTags: SpecialTag[];
}

// TODO: 적 데이터 정의 (Grunt, ArmoredGrunt, Spitter, Stone Warden 등)
export const ENEMY_DATA: Record<string, EnemyData> = {};