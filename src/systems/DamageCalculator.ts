import { Attribute, Tag, SpecialTag } from '../abilities/AbilityData';

export interface DamageInput {
  baseDamage: number;
  attribute: Attribute;
  attackerTags: Tag;
  targetResistances: { attribute: Attribute; reduction: number }[];
  targetSpecialTags: SpecialTag[];
  isCritical: boolean;
  critMultiplier: number;
}

export interface DamageResult {
  finalDamage: number;
  isCritical: boolean;
}

// 모든 피해 계산은 반드시 이 함수를 거친다
export function calculate(input: DamageInput): DamageResult {
  // TODO: 저항, 특수 태그(ARMORED/ETHEREAL), 치명타, Attribute Card 효과 적용
  let damage = input.baseDamage;

  if (input.isCritical) {
    damage *= input.critMultiplier;
  }

  return { finalDamage: Math.floor(damage), isCritical: input.isCritical };
}