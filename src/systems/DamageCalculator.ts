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

const MAGIC_ATTRIBUTES = new Set<Attribute>(['FIRE', 'FROST', 'LIGHTNING', 'SHADOW', 'ARCANE', 'HOLY']);

// 모든 피해 계산은 반드시 이 함수를 거친다
export function calculate(input: DamageInput): DamageResult {
  let damage = input.baseDamage;

  // 1. 치명타
  if (input.isCritical) {
    damage *= input.critMultiplier;
  }

  // 2. ARMORED — 물리 피해 50% 감소
  if (input.targetSpecialTags.includes('ARMORED') && input.attribute === 'PHYSICAL') {
    damage *= 0.5;
  }

  // 3. ETHEREAL — 마법 피해 50% 감소
  if (input.targetSpecialTags.includes('ETHEREAL') && MAGIC_ATTRIBUTES.has(input.attribute)) {
    damage *= 0.5;
  }

  // 4. 속성별 저항
  for (const res of input.targetResistances) {
    if (res.attribute === input.attribute) {
      damage *= (1 - res.reduction);
      break;
    }
  }

  return {
    finalDamage: Math.max(0, Math.floor(damage)),
    isCritical: input.isCritical,
  };
}