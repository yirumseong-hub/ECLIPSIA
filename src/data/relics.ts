import { Tag, ValueType } from '../abilities/AbilityData';

export interface RelicData {
  id: string;
  name: string;
  desc: string;
  targetTag: Tag | null;
  condition: string | null;
  statKey: string;
  value: number;
  valueType: ValueType;
}

// TODO: Relic 데이터 정의
export const ALL_RELICS: RelicData[] = [];