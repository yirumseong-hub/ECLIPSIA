# ECLIPSIA — Claude Code 개발 지시서
> 뱀서라이크 판타지 게임 / 1단계 코어 구현 기준

---

## 0. 이 문서의 목적

이 문서는 Claude Code가 읽고 바로 구현에 들어갈 수 있는 지시서다.
설계 문서(game_design_blueprint_v2.md)의 내용을 구현 관점으로 재정리했다.
코드 생성 전 반드시 이 문서 전체를 읽고 구조를 파악한 후 구현한다.

---

## 1. 기술 스택

| 항목 | 결정값 |
|---|---|
| 언어 | TypeScript |
| 게임 프레임워크 | Phaser 3 (최신 안정 버전) |
| 번들러 | Vite |
| 배포 | GitHub + Vercel |
| 저장 | localStorage |

---

## 2. 프로젝트 구조

```
eclipsia/
  src/
    main.ts
    scenes/
      GameScene.ts
      UIScene.ts
      MenuScene.ts
    entities/
      Player.ts
      Enemy.ts
      Projectile.ts
      XPOrb.ts
      HPOrb.ts
    abilities/
      AbilityData.ts       — 전체 Ability 풀 정의 (데이터만)
      AbilityManager.ts    — 슬롯, 스택, 레벨 관리 로직
    systems/
      DamageCalculator.ts  — 모든 피해 계산 단일 처리
      WaveManager.ts       — 웨이브 스폰 관리
      LevelUpManager.ts    — 레벨업 선택지 생성 및 처리
      DropManager.ts       — XP/HP/Gold 오브 드롭 관리
    data/
      enemies.ts
      relics.ts
      attributeCards.ts
    ui/
      HUD.ts
      LevelUpUI.ts
      BoxUI.ts
    utils/
      ObjectPool.ts
      SaveManager.ts
  public/
    assets/
  index.html
  vite.config.ts
  tsconfig.json
```

---

## 3. 절대 원칙 (반드시 준수)

### 피해 계산 중앙화
```
모든 피해는 반드시 DamageCalculator를 거친다.
어떤 Ability, 어떤 Entity도 직접 피해를 적용하지 않는다.
Relic / Attribute Card 효과가 누락/중복 적용되는 버그를 방지하기 위함.

DamageCalculator.calculate({
  baseDamage: number,
  attribute: Attribute,
  attackerTags: Tag,
  target: Enemy,
  isCritical: boolean
}): number
```

### Stack 누적 단일 함수
```
Ability Stack 누적은 AbilityManager.addStack(abilityId)만 사용.
레벨업 선택지 / Level Box / Big Box 어디서 획득하든 동일 함수 호출.
직접 stack 수치를 조작하지 않는다.
```

### 오브젝트 풀링 필수
```
적 / 투사체 / XP 오브 / HP 오브는 모두 ObjectPool을 통해 생성/반환.
new Enemy(), new Projectile() 등을 게임 루프 내에서 직접 호출하지 않는다.
```

### Discard Fallback
```
Ability 봉인(Discard) 후 선택지 생성 가능한 풀이 부족해지면
가장 오래된 봉인부터 자동 해제.
선택지 생성 시 항상 풀 크기를 체크하고 fallback 실행.
```

### CONDITION 기반 Ability 카운터
```
Enemy 객체는 hitCounters: Map<string, number>를 보유.
{ abilityId: 누적 횟수 } 형태로 관리.
적 사망 시 해당 Map 자동 초기화.
```

---

## 4. 핵심 타입 정의

```typescript
type Attribute = 'FIRE' | 'FROST' | 'LIGHTNING' | 'SHADOW' | 'ARCANE' | 'PHYSICAL' | 'HOLY';
type AbilityType = 'ACTIVE' | 'PASSIVE' | 'AURA' | 'SUMMON' | 'REACTION';
type RangeType = 'MELEE' | 'MID' | 'LONG' | 'SELF' | 'GLOBAL';
type TriggerType = 'TIME' | 'CONDITION';
type AimType = 'AUTO' | 'DIRECTIONAL';
type AttackForm = 'PROJECTILE' | 'FALLING' | 'ZONE' | 'MELEE_HIT';
type AuraTarget = 'ENEMY' | 'SELF';
type TargetType = 'RANDOM' | 'ON_ENEMY';
type ValueType = 'PERCENT' | 'FLAT';
type EnemyGrade = 'MOB' | 'ELITE' | 'CHAMPION' | 'BOSS';
type SpecialTag = 'ARMORED' | 'ETHEREAL' | 'UNDEAD';

interface Tag {
  attribute?: Attribute;
  type?: AbilityType;
  range?: RangeType;
}

interface AttackShape {
  form: AttackForm;
  speed?: number;
  pierce?: number;
  targetType?: TargetType;
  duration?: number;
  interval?: number;
}

interface LevelStats {
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

interface AbilityData {
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
  stackRequired: [number, number, number]; // [1, 3, 5] 고정
  stats: [LevelStats, LevelStats, LevelStats, LevelStats];
  effectDesc: [string, string, string, string];
}

interface NormalAttack {
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

interface AttributeCard {
  id: string;
  attribute: Attribute;
  effectDesc: string;
  targetTag: Tag;
  statKey: string;
  value: number;
  valueType: ValueType;
}

interface Enemy {
  id: string;
  name: string;
  grade: EnemyGrade;
  hp: number;
  moveSpeed: number;
  damage: number;
  resistances: { attribute: Attribute; reduction: number }[];
  specialTags: SpecialTag[];
  hitCounters: Map<string, number>;
}
```

---

## 5. 레벨업 선택지 생성 로직

```typescript
// 선택지 3장 생성 (Kael 패시브 발동 시 4장)
function generateLevelUpChoices(count: 3 | 4): Choice[] {
  const choices: Choice[] = [];
  const usedIds = new Set<string>();

  while (choices.length < count) {
    const isAttributeCard = Math.random() < 1/6;

    if (isAttributeCard) {
      const card = getRandomAttributeCard(usedIds);
      if (card) {
        choices.push({ type: 'ATTRIBUTE_CARD', data: card });
        usedIds.add(card.id);
      }
    } else {
      // 봉인된 Ability 제외 후 풀에서 랜덤
      // 단, 기본 레벨업은 Level 1 Ability만
      const ability = getRandomAbility(usedIds, { maxLevel: 1 });
      if (ability) {
        choices.push({ type: 'ABILITY', data: ability });
        usedIds.add(ability.id);
      }
    }
  }
  return choices;
}

// 선택 시 처리
function handleAbilityChoice(abilityId: string): void {
  if (playerHasAbility(abilityId)) {
    AbilityManager.addStack(abilityId); // 보유 중 → Stack +1
  } else if (hasEmptySlot()) {
    AbilityManager.equip(abilityId);    // 빈 슬롯 → 신규 장착
  } else {
    // 슬롯 꽉 참 → Discard UI 강제 표시 후 장착 대기
    showDiscardUI(pendingAbilityId: abilityId);
  }
}
```

---

## 6. Discard 시스템

```typescript
// 선택창이 열릴 때 항상 하단에 Discard 버튼 노출
// 클릭 시 보유 Ability 목록 표시 → 선택 시 아래 실행

function discardAbility(abilityId: string): void {
  AbilityManager.removeFromSlot(abilityId);
  BanManager.ban(abilityId, currentPlayerLevel + 5); // 5레벨 봉인
  checkFallback(); // 풀 부족 시 가장 오래된 봉인 자동 해제
}

function checkFallback(): void {
  const availablePool = getAvailablePool(); // 봉인 제외 풀
  if (availablePool.length < MINIMUM_POOL_SIZE) {
    BanManager.releaseOldest();
  }
}
```

---

## 7. 웨이브 스폰 시스템

```typescript
// 시간 경과에 따른 스폰 밀도 곡선
// 화면 밖 4방향 가장자리에서 스폰

interface SpawnConfig {
  interval: number;       // 스폰 간격 (초). 시간이 지날수록 감소
  count: number;          // 동시 스폰 수. 시간이 지날수록 증가
  gradeWeights: {         // 적 등급 가중치. 시간이 지날수록 Elite 비율 증가
    MOB: number;
    ELITE: number;
  };
}

// Stage 1 임시 곡선 (밸런싱 시 조정)
const stage1SpawnCurve: SpawnConfig[] = [
  { time: 0,   interval: 3.0, count: 3,  gradeWeights: { MOB: 1.0, ELITE: 0.0 } },
  { time: 180, interval: 2.0, count: 5,  gradeWeights: { MOB: 0.8, ELITE: 0.2 } },
  { time: 300, interval: 1.5, count: 8,  gradeWeights: { MOB: 0.6, ELITE: 0.4 } },
  { time: 390, interval: 1.0, count: 10, gradeWeights: { MOB: 0.5, ELITE: 0.5 } },
];
```

---

## 8. HP / Gold 드롭 임시값

```typescript
// HP 오브 (밸런싱 시 조정)
const HP_DROP = {
  MOB:      { chance: 0.05, healPercent: 0.02 },
  ELITE:    { chance: 0.20, healPercent: 0.05 },
  CHAMPION: { chance: 0.60, healPercent: 0.10 },
  BOSS:     { chance: 1.00, healPercent: 0.20 },
};

// Gold 드롭 (밸런싱 시 조정)
// Mob은 드롭 없음. Elite 이상부터 드롭.
const GOLD_DROP = {
  MOB:        { chance: 0,    min: 0,   max: 0   },
  ELITE:      { chance: 0.40, min: 5,   max: 10  },
  CHAMPION:   { chance: 1.00, min: 30,  max: 50  },
  STAGE_BOSS: { chance: 1.00, min: 80,  max: 120 },
  FINAL_BOSS: { chance: 1.00, min: 200, max: 300 },
};
```

---

## 9. 치명타 시스템 임시값

```typescript
// 기본 치명타 스탯 (밸런싱 시 조정)
const DEFAULT_CRIT = {
  chance: 0.05,    // 5% 기본 치명타 확률
  multiplier: 1.5, // 150% 피해 (기본 대비 1.5배)
};
```

---

## 10. 피격 처리

```typescript
// 플레이어 피격 시 무적시간
const INVINCIBILITY_DURATION = 0.5; // 초 (임시값)

// 피격 시:
// 1. 피해 적용
// 2. 무적 상태 시작 (0.5초)
// 3. 시각적 피드백 (추후 구현)
```

---

## 11. 저장 시스템

```typescript
// localStorage 키 구조
const SAVE_KEYS = {
  GOLD:           'eclipsia_gold',
  META_UPGRADES:  'eclipsia_meta_upgrades',
  UNLOCKED_CHARS: 'eclipsia_unlocked_chars',
};

// 런 중 데이터는 저장하지 않음 (런은 항상 처음부터)
// SaveManager.ts에서 get/set/reset 래퍼 함수로 관리
```

---

## 12. HUD 구성

```
상단 중앙 : 타이머 + 현재 Stage 표시
상단 좌측 : 플레이어 HP 바
상단 우측 : 현재 레벨 + 경험치 바
하단 중앙 : Ability 슬롯 6칸 (각 슬롯에 현재 Level 표시)
하단 우직 : Relic 슬롯 3칸
하단 좌측 : Gold 표시
캐릭터 위 : 고유 메카닉 게이지 (필요한 경우만 작은 bar로 표시)
```

---

## 13. 1단계 구현 목록 (체크리스트)

```
□ 프로젝트 세팅 (Vite + Phaser 3 + TypeScript)
□ 맵 / 배경 구현 + 경계 충돌 처리 (단일 고정 화면)
□ 기본 이동 시스템 (WASD / 방향키)
□ 피격 판정 / 적 처치 판정
□ 일시정지 시스템 (레벨업 UI 등장 시 게임 정지)
□ DamageCalculator 모듈 (모든 피해 계산 중앙화)
□ ObjectPool 유틸리티
□ 캐릭터 Ara 구현
   - Normal Attack: Ember Shot (FIRE / LONG / AUTO / PROJECTILE)
   - Starting Gear: Flame Burst (FIRE / ACTIVE / MELEE / ZONE) — 슬롯 1개 선점
   - 고유 패시브: 광기의 불꽃 (FIRE Ability 2개 이상 보유 시 FIRE 피해 +15%)
   - 고유 메카닉: Overheat 게이지
□ 치명타 시스템 (기본값: 확률 5%, 배율 1.5x)
□ 경험치 시스템 (XP 오브 드롭 + 일정 반경 자동 흡수)
□ 레벨업 시스템
□ Ability 슬롯 시스템 (기본 4슬롯)
□ AbilityManager (Stack 누적, Level 상승, 슬롯 관리)
□ LevelUpManager (선택지 생성 5:1 랜덤, 중복 불가)
□ LevelUpUI (카드 3장 + Discard 버튼 하단 상시 노출)
□ Discard 시스템 (봉인 5레벨 + fallback)
□ Attribute Card 기본 구조
□ ARMORED / ETHEREAL 저항 계산 (DamageCalculator 내부)
□ Ability 6개 구현
   - Flame Burst  (FIRE / ACTIVE / MELEE / ZONE / TIME)
   - Fire Bolt    (FIRE / ACTIVE / LONG / PROJECTILE / TIME / AUTO)
   - Frost Lance  (FROST / ACTIVE / LONG / PROJECTILE / TIME / AUTO)
   - Slash        (PHYSICAL / ACTIVE / MELEE / MELEE_HIT / TIME / DIRECTIONAL)
   - Holy Nova    (HOLY / ACTIVE / MELEE / ZONE / TIME)
   - Arcane Missile (ARCANE / ACTIVE / LONG / PROJECTILE / TIME / AUTO)
□ HP 오브 시스템 (드롭 + 흡수 + 회복)
□ Gold 드롭 + 수집 시스템
□ DropManager (HP오브 / XP오브 / Gold 드롭 통합 관리)
□ Mob 3종 구현
   - Grunt        (직선 추적, 접촉 피해)
   - ArmoredGrunt (직선 추적, ARMORED 태그, 물리 피해 50% 감소)
   - Spitter      (거리 유지, 투사체 발사, 근접 시 도주)
□ WaveManager (화면 밖 4방향 스폰, 시간 기반 밀도 곡선)
□ Stage 1 구현 (7분 타이머, Champion 등장 체크)
□ Champion: Stone Warden 구현
   - ARMORED 태그
   - 패턴 1: 전방 충격파 발사 (넉백)
   - 패턴 2: HP 50% 이하 시 이동속도 증가
   - 처치 시 Relic Box 드롭 (임시: 빈 Relic Box)
□ HUD 구현 (HP바, 타이머, 레벨, 경험치바, 슬롯, Gold)
□ 게임 오버 화면 (기본)
□ 레벨업 시 HP 일부 회복
```

---

## 14. 주의사항 및 금지사항

```
✗ DamageCalculator를 거치지 않은 피해 직접 적용 금지
✗ AbilityManager.addStack() 외 Stack 직접 조작 금지
✗ new Enemy() / new Projectile() 등 풀링 없는 직접 생성 금지
✗ 요청 범위 외 파일 임의 수정 금지
✗ 확신 없는 구현은 "불확실함" 명시 후 대안 제시
✗ 여러 파일 수정 시 목록 먼저 나열 후 승인 대기
✗ 기존 함수명/클래스명/인터페이스명 명시적 요청 없이 변경 금지
```

---

## 15. 임시값 목록 (밸런싱 단계에서 조정 예정)

```
- 치명타 확률: 5%
- 치명타 배율: 1.5x
- 피격 무적시간: 0.5초
- HP 오브 드롭 확률/회복량
- Gold 드롭 확률/수량
- 웨이브 스폰 간격/수량 곡선
- 레벨업 시 HP 회복량
- XP 오브 자동 흡수 반경
- 각 Ability의 구체적 수치 (damage, cooldown, area 등)
```

---

## 17. 이동 및 공격 방향 방식

### 플레이어 이동
```
8방향 고정 이동 (WASD)
위 / 아래 / 좌 / 우 + 대각선 4방향 포함 총 8방향.
대각선 이동 시 속도 정규화 필수 (대각선이 빠르지 않도록).
```

### DIRECTIONAL Ability 발사 방향
```
플레이어의 마지막 이동 방향 기준으로 발사.
멈춰있을 때는 마지막 이동 방향 유지.
해당 Ability: Slash, Shockwave
```

### AUTO Ability 조준 방식
```
가장 가까운 적을 자동 조준.
해당 Ability: Fire Bolt, Frost Lance, Arcane Missile 등
```

### 적 이동
```
Simple Follow — 매 프레임 플레이어를 향해 직선으로 이동.
1단계 맵은 장애물 없는 단일 화면이므로 A* 불필요.
```

에셋 파일 없이 구현한다.
모든 게임 오브젝트는 Phaser Graphics 도형으로 대체한다.
텍스처 로딩 코드는 작성하지 않는다.

### 오브젝트별 도형

```
플레이어     : 흰색 원
Grunt        : 빨간색 원
ArmoredGrunt : 회색 사각형
Spitter      : 주황색 삼각형
Champion     : 크고 밝은 색 원 (일반 몹보다 1.5배 크기)
투사체       : 작은 원 (속성 색상으로 구분)
XP 오브      : 초록 작은 원
HP 오브      : 빨간 십자 모양
Gold 오브    : 노란 작은 원
```

### 속성별 색상 코드

```typescript
const ATTRIBUTE_COLORS = {
  FIRE:      0xff4400,
  FROST:     0x44aaff,
  LIGHTNING: 0xffee00,
  SHADOW:    0x6600cc,
  ARCANE:    0xff44aa,
  PHYSICAL:  0x888888,
  HOLY:      0xffdd44,
};
```

### UI 구현 방식

```
HUD, 레벨업 카드, 슬롯 UI 등
모두 Phaser Text + Rectangle + Graphics 조합으로 구현.
외부 이미지/폰트 로딩 없이 Phaser 기본 기능만 사용.
```

---

*ECLIPSIA — 1단계 코어 구현 지시서 / 설계 문서: game_design_blueprint_v2.md 참조*
