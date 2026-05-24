import { Attribute, Tag, ValueType } from '../abilities/AbilityData';

export interface AttributeCard {
  id: string;
  attribute: Attribute;
  effectDesc: string;
  targetTag: Tag;
  statKey: string;
  value: number;
  valueType: ValueType;
}

// TODO: Attribute Card 데이터 정의
export const ALL_ATTRIBUTE_CARDS: AttributeCard[] = [];