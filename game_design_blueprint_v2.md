# 게임 설계 청사진 v2.0
> 뱀서라이크 판타지 게임 — 중간 저장 (브레인스토밍 단계)

---

## 핵심 철학

> **"무엇을 버릴 것인가"가 "무엇을 얻을 것인가"만큼 중요한 뱀서라이크**

---

## 확정된 기본 설정

| 항목 | 결정값 |
|---|---|
| 장르 | 뱀서라이크 (Vampire Survivors류) |
| 뷰 | 탑다운 고정 시점 |
| 테마 | 판타지 기본 (추후 타 장르 요소 추가 가능) |
| 캐릭터 방식 | 멀티 캐릭터 선택 (각자 고유 스타트) |
| 초기 캐릭터 수 | 3명 (틀 완성 후 추가) |
| Ability 슬롯 | 기본 4, 최대 6 |
| Relic 슬롯 | 기본 3, 고정 |
| 임시 코드네임 | ECLIPSIA |

---

## 기술 스택

| 항목 | 결정값 |
|---|---|
| 언어 | TypeScript |
| 게임 프레임워크 | Phaser 3 (최신 안정 버전) |
| 번들러 | Vite |
| 배포 | GitHub + Vercel |
| 저장 | localStorage |
| 에셋 | 픽셀아트 (Kenney.nl, OpenGameArt 등 무료 에셋) |

### TypeScript 선택 이유
```
데이터 구조(Ability, Enemy, Relic 등)가 복잡하므로
타입 안전성 확보가 버그 방지에 결정적.
정확도와 코드 일관성을 최우선으로 하는 개발 방향과 일치.
```

### 프로젝트 구조 (Vite + Phaser 3 + TypeScript)
```
eclipsia/
  src/
    main.ts              — 진입점
    scenes/              — Phaser Scene 클래스
      GameScene.ts
      UIScene.ts
      MenuScene.ts
    entities/            — 게임 오브젝트
      Player.ts
      Enemy.ts
      Projectile.ts
      XPOrb.ts
      HPOrb.ts
    abilities/           — Ability 데이터 및 로직
      AbilityData.ts     — 전체 Ability 풀 정의
      AbilityManager.ts  — 슬롯, 스택, 레벨 관리
    systems/             — 핵심 시스템
      DamageCalculator.ts
      WaveManager.ts
      LevelUpManager.ts
      DropManager.ts
    data/                — 정적 데이터
      enemies.ts
      relics.ts
      attributeCards.ts
    ui/                  — UI 컴포넌트
      HUD.ts
      LevelUpUI.ts
      BoxUI.ts
    utils/               — 유틸리티
      ObjectPool.ts
      SaveManager.ts     — localStorage 래퍼
  public/
    assets/              — 이미지, 사운드
  index.html
  vite.config.ts
  tsconfig.json
```

---

## 1. Ability Level 시스템

### 레벨 상승 조건 (중복 획득 누적)

| 전환 | 추가 중복 획득 수 | 총 누적 획득 수 |
|---|---|---|
| Level 1 → 2 | 1회 | 2개 |
| Level 2 → 3 | 3회 | 5개 |
| Level 3 → 4 (MAX) | 5회 | 10개 |

### 레벨별 강화 원칙

- **Level 1 → 2** : 핵심 수치 상승 (피해량, 범위, 쿨다운 감소 등)
- **Level 2 → 3** : 부가 효과 추가 (관통 부여, DoT 추가, 보조 투사체 등)
- **Level 3 → 4** : 동작 방식 자체 변형 (단발→다발, 전방→360도, 새 메카닉 추가)

### 설계 의도

Level 4(MAX) 하나를 완성하려면 동일 Ability를 총 10회 획득해야 한다.
슬롯이 최대 6개인 환경에서 MAX는 빌드 전체를 헌신하는 수준의 투자이므로,
**MAX는 기본 전략이 아니라 희귀한 목표**로 설계된다.

---

## 2. 레벨업 보상 시스템

### 일반 레벨업 선택지 생성 규칙

```
선택지 3장 각각 독립적으로 다음 확률로 결정:
  5/6 확률 → Ability 풀에서 랜덤 1개
  1/6 확률 → Attribute Card 풀에서 랜덤 1개

3장은 모두 다른 항목이어야 함 (동일 Ability는 레벨 무관 중복 불가).
A슬롯/B슬롯 구분 없음. 전부 동일한 랜덤 로직.

특수 케이스 — Kael 패시브 "냉철한 판단" 발동 시:
  해당 레벨업에서만 선택지가 4장으로 증가.
  4장 모두 동일한 랜덤 로직 적용.
  (다음 레벨업부터 다시 3장으로 복귀)
```

### 선택 시 처리 규칙

```
Ability 선택지를 고른 경우:
  이미 보유 중인 Ability → Stack +1 자동 누적
  미보유 Ability + 빈 슬롯 있음 → 슬롯 소모 후 신규 장착
  미보유 Ability + 슬롯 꽉 참 → Discard로 슬롯 비운 후 장착 가능

Attribute Card 선택지를 고른 경우:
  슬롯 소모 없음. 즉시 해당 속성 전체에 영구 효과 부여.
```

### 기본 레벨업에서는 Level 1 Ability만 등장
Level 2 이상은 Level Box / 캐릭터 특성 / Relic / Curse 보상으로만 획득 가능.

### Level Box
Ability만 등장. Attribute Card 없음. 동일 Ability 중복 불가. 나머지 처리 규칙은 일반 레벨업과 동일.

### Discard 시스템

```
선택창(레벨업 / 상자 보상)이 열릴 때 언제든 사용 가능한 별도 버튼.
선택지와 독립적으로 항상 하단에 노출.

동작:
  보유 Ability 목록 팝업 → 버릴 Ability 선택 → 슬롯 반환
  버린 Ability는 5레벨 동안 선택지 풀에서 제외 (봉인)
  봉인된 Ability가 많아 선택지 구성이 불가능해지면
  가장 오래된 봉인부터 자동 해제 (fallback)
```

### Attribute Card

슬롯을 소모하지 않으며 특정 속성 전체에 영구 효과를 부여한다.
수치는 카드마다 고정 범위 내 랜덤으로 결정. 예) FIRE 피해 +8~15%.
**추후 등급 시스템(Common / Rare / Epic) 추가 가능성 명시.**

| 속성 | 효과 예시 |
|---|---|
| FIRE | 화염 속성 피해 +X% |
| FIRE | 화염 DoT 피해량 +X% |
| FROST | 냉기 속성 피해 +X% |
| FROST | 빙결 지속시간 +X초 |
| LIGHTNING | 연쇄 횟수 +1 |
| LIGHTNING | 번개 속성 피해 +X% |
| SHADOW | 치명타 확률 +X% |
| SHADOW | 그림자 속성 피해 +X% |
| ARCANE | 버프 지속시간 +X% |
| ARCANE | 디버프 효과 강도 +X% |
| HOLY | 보호막 생성량 +X% |
| HOLY | 회복량 +X% |
| PHYSICAL | 방어 관통 +X% |
| PHYSICAL | 물리 피해 +X% |

---

## 3. 시너지 시스템

### 삭제된 것

- 조건부 자동 시너지 전부 삭제
- "특정 속성 2개 이상 보유 시 추가 효과 발동" 류의 자동 발동 없음

### 재배치된 것

| 기존 시너지 유형 | 재배치 위치 |
|---|---|
| 속성 강화 효과 | Attribute Card (레벨업 선택지) |
| 조건부 시너지 | 캐릭터 고유 특성으로 이전 |
| Cross 시너지 | Relic 효과로 이전 |

시너지는 시스템이 자동 발동하는 것이 아니라 **플레이어가 능동적으로 설계하는 것**이다.

---

## 4. 상자 시스템

런 중 이벤트로 등장. 모든 상자는 선택 또는 스킵 가능.

### 등장 방식
```
① 랜덤 이벤트 기반 스폰
   일정 시간 범위 내 확률적으로 맵에 오브젝트로 스폰.
   플레이어가 다가가면 선택 UI 팝업 (게임 일시정지).

② Champion 이상 처치 시 드롭
   Champion / Stage Boss / 최종 Boss 처치 시
   일정 확률로 처치 위치에 상자 드롭.
   플레이어가 다가가면 선택 UI 팝업.
```

### 등장 빈도 (희귀도 순)
```
가장 흔함  : Big Box     (Level 1 Ability 5개 제시)
보통       : Level Box   (Level 2 이상 Ability 3개 제시)
희귀       : Relic Box   (Relic 3개 제시)
가장 희귀  : Curse Box   (Curse 카드 3개 제시)
```

### 상자별 상세

**Curse Box**
```
Curse 카드 3장 제시
수락 시: 즉시 패널티 발동 + 보상 지급
스킵 시: 아무 일 없음
```

**Level Box**
```
Level 2 이상 Ability 3개 제시
보유 중인 Ability와 동일 → Stack 즉시 누적
보유하지 않은 Ability    → 슬롯 1개 소모 후 해당 Level로 장착
슬롯이 없는 상태         → Discard 먼저 진행 후 선택 가능
```

**Relic Box**
```
Relic 3개 제시
Relic 슬롯이 가득 찬 경우 → 기존 Relic과 교체 선택 가능
버린 Relic은 해당 런에서 다시 등장하지 않음
```

**Big Box**
```
Level 1 Ability 5개 제시
일반 레벨업보다 선택지 넓음
슬롯 처리 규칙은 일반 레벨업과 동일
```

---

## 5. Curse 시스템

패널티와 보상의 자발적 거래. 스킵해도 불이익 없음.

### 등급

| 등급 | 패널티 강도 | 보상 수준 |
|---|---|---|
| Minor | 약함 | 소보상 |
| Major | 강함 | 대보상 |
| Lethal | 런을 위협하는 수준 | 극대 보상 |

### 예시

| 등급 | 패널티 | 보상 |
|---|---|---|
| Minor | 이동속도 -10% | Attribute Card 2장 즉시 선택 |
| Minor | 다음 Champion 체력 2배 | 골드 +80 |
| Major | 현재 HP 50%로 즉시 감소 | Relic Box 즉시 발동 |
| Major | 다음 레벨업 3회 선택지 2장으로 감소 | Level Box 즉시 발동 |
| Lethal | 현재 슬롯의 Ability 중 1개 랜덤 Discard | Ability 슬롯 +1 확장 |
| Lethal | 남은 런 동안 HP 회복 불가 | 원하는 Attribute Card 3장 자유 선택 |

---

## 6. Relic 시스템

- 슬롯: 기본 3개 고정 (별도 확장 없음)
- 획득 경로: Relic Box / Champion 처치 보장 드롭 / Stage 클리어 보상 / Curse 수락 보상
- 교체: 언제든 가능, 버린 Relic은 해당 런 내 재등장 없음

### Relic 카테고리

| 카테고리 | 설명 |
|---|---|
| Ability Relic | 특정 Ability 또는 Ability 유형에 연동된 효과 |
| 속성 Relic | 특정 속성 전체에 영향 |
| 조건 Relic | 특정 행동 발생 시 발동 (Discard, 처치, 피격 등) |
| 빌드 Relic | 슬롯 구성 자체에 반응 |

### 빌드 Relic 예시

```
"빈 슬롯 1개당 모든 피해 +6%"
  → 슬롯을 일부러 비워두는 전략 유도

"MAX 레벨 Ability 보유 시 CD -20%"
  → Level 4 달성에 대한 보상 강화

"Discard 총 횟수 × 3% 만큼 이동속도 증가"
  → 적극적인 빌드 재편을 장려

"Level Box에서 획득한 Ability 피해 +25%"
  → Level Box 활용 전략 강화

"보유 Ability가 모두 동일 속성이면 해당 속성 피해 +30%"
  → 단일 속성 집중 빌드의 극대화 보상
```

---

## 7. 스테이지 구조

### 기본 구성

```
1 Run = Stage 1 → Stage 2 → Stage 3 → 최종 Boss
최대 런 시간 : 약 26분 (Stage Boss 즉시 처치 시 더 짧아짐)
```

### 시간 배분

| 구간 | 제한시간 | 비고 |
|---|---|---|
| Stage 1 | 7분 | Stage Boss 처치 시 즉시 다음 Stage 이동 |
| Stage 2 | 7분 | Stage Boss 처치 시 즉시 다음 Stage 이동 |
| Stage 3 | 7분 | Stage Boss 처치 시 즉시 최종 Boss 등장 |
| 최종 Boss | 최대 5분 | 처치 실패 시 런 패배 |

### 웨이브 방식

```
뱀서 방식과 동일.
화면 밖 4방향 가장자리에서 스폰.

스폰 밀도 곡선 (시간 경과에 따라 동시 적용):
  ① 스폰 간격 감소 — 시간이 지날수록 더 자주 스폰
  ② 동시 스폰 수 증가 — 한 번에 더 많은 적이 나옴
  ③ 적 평균 등급 상승 — Mob 위주 → Elite 혼합 → Elite 비율 증가
     (Elite 최초 등장 시점: Stage 1 기준 3분 이후)

구체적인 수치 곡선은 Claude Code에서 임시값으로 구현 후 밸런싱 단계에서 조정.
```

### XP 오브 흡수 방식

```
기본: 일정 반경 내 자동 흡수 (고정 범위)
특수: 특정 Relic 또는 조건 달성 시 화면 전체 XP 오브 일괄 흡수 발동
```

### HP 오브 드롭 (임시값 — 밸런싱 시 조정)

```
Mob      : 드롭 확률 5%,  회복량 최대 HP의 2%
Elite    : 드롭 확률 20%, 회복량 최대 HP의 5%
Champion : 드롭 확률 60%, 회복량 최대 HP의 10%
Boss     : 드롭 확률 100%, 회복량 최대 HP의 20%
```

### Gold 드롭 (임시값 — 밸런싱 시 조정)

```
Mob      : 드롭 없음
Elite    : 드롭 확률 40%, 획득량 5~10 Gold
Champion : 드롭 확률 100%, 획득량 30~50 Gold
Stage Boss (처치 성공 시) : 80~120 Gold
최종 Boss (처치 성공 시) : 200~300 Gold
```

### Champion 등장 (Stage당 7분 기준)

```
2분 30초 : 1차 Champion 등장 확률 체크
5분 00초 : 2차 Champion 등장 확률 체크
6분 30초 : Stage Boss 등장 (고정)

- 각 확률 체크 시 70~80% 확률로 등장
- 미등장 시 다음 확률 체크에서 등장 확률 상승
```

### Champion 처치 보상

```
처치 위치에 Relic 오브젝트 드롭.
플레이어가 다가가면 Relic 선택 UI 팝업 (게임 일시정지).
Relic 슬롯이 가득 찬 경우 → 교체 선택 가능.
```

### Stage 전환

```
Stage Boss 처치
  → 처치 위치에 전리품 드롭 (Relic Box 등)
  → 플레이어가 전리품 획득
  → 페이드 아웃
  → HP 일부 회복
  → 다음 Stage 페이드 인
  → 남은 적 전부 소멸 처리

Stage Boss 처치 실패 (시간 초과)
  → 전리품 없음
  → 페이드 아웃/인 후 다음 Stage로 자동 진행
  → HP 회복 없음
```

### Stage Boss

```
처치 시 : 전리품 드롭 + 다음 Stage 전환
처치 실패 시 : 사망 처리 없음. 전리품 없음. 다음 Stage 자동 진행.
```

### 사망 조건

```
① 캐릭터 HP가 0이 되는 경우   → 런 패배
② 최종 Boss 5분 제한 초과     → 런 패배
```

---

## 7-1. 회복 시스템

```
① 몹 처치 시 일정 확률로 HP 오브 드롭
   플레이어가 다가가면 즉시 HP 회복.
   등급이 높을수록 드롭 확률 높고 회복량 큼.
   (Champion, Boss는 높은 확률 + 큰 회복량)

② 레벨업 시 HP 일부 회복

③ Stage 전환 시 HP 일부 회복 (Boss 처치 성공 시에만)

④ 일부 Ability 회복 효과 (Holy Nova, Sacred Ground 등)

⑤ 회복 관련 Relic : 추후 설계
```

---

## 8. Meta Upgrade 시스템

- **방식** : Gold 소모로 기본 스탯 영구 강화. 수치 해금 방식.
- **런 시작 조건 변형 없음** (추후 확장 가능성은 열어둠)
- 구체적인 항목과 수치는 3단계(밸런싱) 단계에서 확정

**강화 항목 예시**
```
최대 HP +5%
피해량 +3%
이동속도 +2%
Gold 획득량 +5%
경험치 획득량 +5%
쿨다운 감소 +2%
치명타 확률 +1%
```

각 캐릭터는 다음을 고유하게 가진다:

| 항목 | 설명 |
|---|---|
| 고유 시작 Ability | 처음부터 1개 장착된 채로 시작 |
| 고유 패시브 특성 | 시스템 자체에 영향을 주는 룰 변형 (슬롯 수, Stack 요구량 변형 등) |
| 고유 스탯 분포 | HP, 이동속도, 피해 배율의 기본값 차이 |
| 고유 특수 메카닉 | 해당 캐릭터만 가진 별도 시스템 |

---

## 9. 용어 사전

### 핵심 시스템 용어

| 용어 | 정의 |
|---|---|
| **Ability** | 슬롯에 장착하는 능력 단위. Active / Passive / Aura / Summon / Reaction 유형 존재 |
| **Slot** | Ability 장착 칸. 기본 4, 최대 6. Curse·Relic·캐릭터 특성으로만 확장 가능 |
| **Level** | Ability 강화 단계. 1~4 (MAX). 중복 획득 누적으로 상승 |
| **Stack** | 레벨 상승을 위해 누적하는 중복 획득 수 |
| **Discard** | Ability를 슬롯에서 제거하고 슬롯을 반환. 5레벨간 해당 Ability 봉인 |
| **Attribute** | Ability가 가진 속성 태그. Fire / Frost / Lightning / Shadow / Arcane / Physical / Holy |
| **Attribute Card** | 특정 속성 전체를 강화하는 레벨업 선택지. 슬롯 소모 없음 |
| **Relic** | 별도 3슬롯에 장착하는 패시브 아이템. Ability 슬롯 미소모 |
| **Curse** | 패널티 + 보상의 자발적 거래. Minor / Major / Lethal 등급 |
| **Run** | 하나의 플레이 세션. 사망 시 종료 |
| **Stage** | Run 내 구분 구간. 기본 3스테이지 + 최종 Boss |
| **Meta Upgrade** | 런 외부 영구 강화. Gold를 누적해 해금 |
| **Gold** | 런 중 획득하는 재화. Champion 처치, Curse 수락 보상 등으로 획득. 런 종료 후 Meta Upgrade 해금에 사용되는 영구 누적 통화 |
| **Normal Attack** | 모든 캐릭터가 보유하는 슬롯 미소모 고유 공격. 레벨업으로 교체 불가 |
| **Starting Gear** | 런 시작 시 Ability 슬롯 / Relic 슬롯 / Curse 칸에 미리 장착된 채로 시작하는 것. 모든 캐릭터가 갖는 것은 아님 |

### Ability 유형

| 유형 | 설명 |
|---|---|
| **Active** | 쿨다운/조건에 따라 자동 발동. 핵심 딜 소스 |
| **Passive** | 장착만 해도 상시 효과 적용. 스탯 강화 또는 조건부 발동 |
| **Aura** | 주변 범위에 지속 효과. 적에게 디버프 또는 아군에게 버프 |
| **Summon** | 소환물을 생성해 대신 싸우게 함 |
| **Reaction** | 특정 조건(피격, 처치 등) 달성 시 자동 발동 |

### Ability 속성 (Attribute)

| 속성 | 특화 방향 |
|---|---|
| **FIRE** | DoT, 광역 폭발 |
| **FROST** | CC (둔화/빙결) |
| **LIGHTNING** | 연쇄(Chain) 공격 |
| **SHADOW** | 단일 고피해, 이동기 |
| **ARCANE** | 버프/디버프, 증폭 |
| **PHYSICAL** | 속성 저항 무시, 범용 |
| **HOLY** | 힐/보호막, 언데드 특효 |

### 전투/스탯 용어

| 용어 | 정의 |
|---|---|
| **DoT** | Damage over Time. 지속 피해 효과 |
| **CC** | Crowd Control. 둔화 / 빙결 / 기절 등 행동 제한 효과 |
| **AoE** | Area of Effect. 범위 공격 |
| **Pierce** | 투사체 관통 횟수 |
| **Burst** | 단시간 집중 피해 패턴 |
| **CD** | Cooldown. Active Ability 재발동 대기 시간 |
| **Critical Hit** | 모든 캐릭터/Ability에 존재하는 공용 스탯. 기본 치명타 확률과 치명타 배율을 가짐. 확률 충족 시 피해량이 배율만큼 증가. SHADOW 계열 Ability는 치명타를 특히 잘 활용하도록 설계됨 |

### 적 관련 용어

| 용어 | 정의 |
|---|---|
| **Mob** | 일반 잡몹 |
| **Elite** | 강화 일반 몹. 특수 패턴 보유 |
| **Champion** | 중간 보스. 스테이지마다 2~3회 등장. Relic 드롭 보장 |
| **Boss** | 최종 적. 스테이지 종료 또는 런 종료 조건 |
| **Wave** | 시간대별 적 집단. 시간 경과에 따라 조성 변화 |
| **Knockback** | 피해를 준 방향의 반대 방향으로 적을 강제로 밀어내는 효과. 밀려나는 거리는 Ability마다 고정값으로 지정. 넉백 중인 적은 이동 불가 상태이며 끝나면 즉시 플레이어 추적 재개. 벽/맵 경계에 닿으면 즉시 정지. CC의 일종이나 둔화/빙결과 별개로 중첩 적용 가능 |
| **Ethereal** | 마법 피해 감소 속성 적 |

---

## 9. 이동 및 공격 방향 방식

### 플레이어 이동
```
8방향 고정 이동 (WASD)
위 / 아래 / 좌 / 우 + 대각선 포함 총 8방향.
대각선 이동 시 속도 정규화 필수.
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
1단계 맵은 장애물 없는 단일 화면이므로 경로탐색 불필요.
```

---

## 10. 데이터 구조 정의

### 열거형 (Enum)

```
Attribute     : FIRE | FROST | LIGHTNING | SHADOW | ARCANE | PHYSICAL | HOLY
AbilityType   : ACTIVE | PASSIVE | AURA | SUMMON | REACTION
RangeType     : MELEE | MID | LONG | SELF | GLOBAL
TriggerType   : TIME | CONDITION
AimType       : AUTO | DIRECTIONAL
AttackForm    : PROJECTILE | FALLING | ZONE | MELEE_HIT
AuraTarget    : ENEMY | SELF
TargetType    : RANDOM | ON_ENEMY
ValueType     : PERCENT | FLAT
EnemyGrade    : MOB | ELITE | CHAMPION | BOSS
CurseGrade    : MINOR | MAJOR | LETHAL
```

### Ability 구조

```javascript
Ability {
  // 식별
  id               : string            // 고유 식별자. 예) "fire_flame_burst"
  name             : string            // 표시 이름. 예) "Flame Burst"

  // 분류 태그 (Relic, 캐릭터 특성이 이 태그로 참조)
  attribute        : Attribute
  type             : AbilityType
  range            : RangeType

  // 발동 방식 (ACTIVE 전용, 나머지 타입은 null)
  triggerType      : TriggerType | null
  cooldown         : number | null     // TIME 방식일 때 초 단위 발동 주기
  triggerCondition : string | null     // CONDITION 방식일 때 조건 설명
                                       // 예) "적 처치 3회마다"

  // 투사체 방향 (투사체가 있는 ACTIVE Ability 전용, 나머지는 null)
  aimType          : AimType | null

  // 공격 형태 (ACTIVE 전용, 나머지 타입은 null)
  attackShape      : AttackShape | null

  // SUMMON 전용 데이터 (SUMMON 타입 전용, 나머지는 null)
  summonData       : SummonData | null

  // REACTION 발동 조건 (REACTION 타입 전용, 나머지는 null)
  reactionTrigger  : string | null     // 예) "피격 시", "처치 시", "HP 30% 이하일 때"

  // AURA 적용 대상 (AURA 타입 전용, 나머지는 null)
  auraTarget       : AuraTarget | null

  // 레벨 데이터
  stackRequired    : number[]          // 다음 레벨까지 필요한 추가 스택. [1, 3, 5] 고정
                                       // 캐릭터 특성으로 변형 가능하므로 Ability에도 보유
  stats            : LevelStats[]      // 레벨별 수치 배열 (인덱스 0=Lv1 ~ 3=Lv4)
  effectDesc       : string[]          // 레벨별 효과 텍스트. 길이 4 고정
}

AttackShape {
  form             : AttackForm

  // PROJECTILE 전용
  speed            : number | null     // 투사체 이동 속도
  pierce           : number | null     // 기본 관통 횟수 (LevelStats에서 추가 가능)

  // FALLING 전용
  targetType       : TargetType | null // 낙하 위치 선정 방식

  // ZONE 전용
  duration         : number | null     // 장판 지속 시간 (초). 0이면 즉발
  interval         : number | null     // 장판 틱 간격 (지속형 장판일 때)
}

SummonData {
  maxCount         : number            // 최대 동시 소환 수
  duration         : number | null     // 소환물 지속 시간 (초). null이면 무한
  attackForm       : AttackForm        // 소환물의 공격 형태
}

LevelStats {
  damage           : number | null     // 기본 피해량
  cooldown         : number | null     // 레벨별 CD 오버라이드. null이면 부모 cooldown 사용
  area             : number | null     // 범위 반지름 (단위: 게임 내 unit, 렌더러에서 픽셀 변환)
  pierce           : number | null     // 레벨업으로 추가되는 관통 횟수
  projectileCount  : number | null     // 투사체 수
  dotDamage        : number | null     // DoT 1틱 피해량
  dotDuration      : number | null     // DoT 지속 시간 (초)
  dotInterval      : number | null     // DoT 틱 간격 (초)
  chainCount       : number | null     // 연쇄 횟수
  shieldAmount     : number | null     // 보호막 수치
  healAmount       : number | null     // 회복량
  // 추후 필요한 수치는 여기에 추가
}
```

### Normal Attack 구조

Ability와 유사하나 슬롯 미소모, 레벨 시스템 없음, 캐릭터에 종속됨.

```javascript
NormalAttack {
  id               : string
  name             : string
  ownerCharacter   : string            // 귀속 캐릭터 id. 예) "ara"
  attribute        : Attribute
  range            : RangeType
  aimType          : AimType
  attackShape      : AttackShape
  cooldown         : number            // 자동 발사 주기 (초). TIME 고정
  stats            : NormalAttackStats
}

NormalAttackStats {
  damage           : number
  projectileCount  : number | null
  area             : number | null
  dotDamage        : number | null
  dotDuration      : number | null
  dotInterval      : number | null
  chainCount       : number | null
}
```

### Attribute Card 구조

```javascript
AttributeCard {
  id               : string
  attribute        : Attribute
  effectDesc       : string            // 표시 텍스트. 예) "FIRE 피해 +12%"
  targetTag        : Tag               // 적용 대상 태그
  statKey          : string            // 적용할 수치 키. 예) "damage", "dotDuration"
  value            : number
  valueType        : ValueType         // PERCENT | FLAT
}
```

### Relic 구조

```javascript
Relic {
  id               : string
  name             : string
  desc             : string
  targetTag        : Tag | null        // null이면 태그 무관 전체 적용
  condition        : string | null     // 발동 조건. 예) "Discard 사용 시". null이면 상시
  statKey          : string
  value            : number
  valueType        : ValueType
}
```

### Curse 구조

```javascript
Curse {
  id               : string
  name             : string
  grade            : CurseGrade
  penaltyDesc      : string
  rewardDesc       : string
  penaltyType      : string            // 패널티 종류 코드
  rewardType       : string            // 보상 종류 코드
}
```

### Enemy 구조

```javascript
Enemy {
  id               : string
  name             : string
  grade            : EnemyGrade
  hp               : number
  moveSpeed        : number
  damage           : number            // 플레이어 접촉 피해
  resistances      : Resistance[]      // 속성별 피해 감소율
  specialTags      : string[]          // 예) "UNDEAD", "ARMORED", "ETHEREAL"
  dropTable        : DropTable
}

Resistance {
  attribute        : Attribute
  reduction        : number            // 0.0 ~ 1.0 (0.2 = 20% 감소)
}
```

### 태그 참조 방식 (Relic / 캐릭터 특성)

attribute / type / range 태그 조합으로 Ability를 참조한다. id 직접 참조는 사용하지 않음.

```javascript
{ targetTag: { attribute: "FIRE", type: "ACTIVE" }, effect: "damage +10%" }
// → FIRE이면서 ACTIVE인 모든 Ability에 피해 +10%

{ targetTag: { type: "SUMMON" }, effect: "cooldown -15%" }
// → 유형이 SUMMON인 모든 Ability에 CD -15%

{ targetTag: { range: "MELEE" }, effect: "area +20%" }
// → 범위가 MELEE인 모든 Ability에 AoE +20%
```

### 데이터 구조 결정 요약

| 항목 | 결정값 |
|---|---|
| CD 방식 | TIME / CONDITION 혼합, Ability마다 지정 |
| 투사체 방향 | AUTO / DIRECTIONAL 혼합, Ability마다 지정 |
| 공격 형태 | PROJECTILE / FALLING / ZONE / MELEE_HIT, Ability마다 지정 |
| SUMMON | summonData로 별도 분리 |
| REACTION 발동 조건 | reactionTrigger 필드로 분리 |
| AURA 적용 대상 | auraTarget 필드로 분리 |
| area 수치 기준 | 반지름 기준, 게임 내 unit 단위 |
| 효과 기술 | 수치 배열 + 텍스트 설명 둘 다 보유 |
| 상호작용 참조 | attribute / type / range 태그 조합 |

---

### Attribute Card 수치 방식

- 카드마다 고정 범위 내 랜덤 수치로 등장
- 예) FIRE 피해 +8~15% → 실제 등장 시 해당 범위 내 랜덤값 확정
- **추후 등급 시스템(Common / Rare / Epic) 추가 가능성 명시**
  - Common: 낮은 범위 / Rare: 중간 범위 / Epic: 높은 범위

---

## 11. 캐릭터 초안

### 캐릭터 공통 구조

| 항목 | 설명 |
|---|---|
| **Normal Attack** | 모든 캐릭터가 보유하는 슬롯 미소모 고유 공격. 부가 효과 없는 단순 피해. 레벨업으로 교체 불가 |
| **Starting Gear** | 런 시작 시 Ability 슬롯 / Relic 슬롯 / Curse 칸에 미리 장착된 채로 시작하는 것. 모든 캐릭터가 갖는 것은 아님 |

### Normal Attack 확정

공통 원칙: 부가 효과 없음. 단순 피해만. 슬롯 미소모. 수치는 Claude Code에서 임시값으로 설정 후 밸런싱 단계에서 조정.

```
Ara   — Ember Shot
        attribute   : FIRE
        range       : LONG
        aimType     : AUTO
        attackShape : { form: PROJECTILE, speed: 보통, pierce: 0 }

Kael  — Frost Bolt
        attribute   : FROST
        range       : LONG
        aimType     : AUTO
        attackShape : { form: PROJECTILE, speed: 보통, pierce: 0 }

Sera  — Sacred Slash
        attribute   : HOLY
        range       : MELEE
        aimType     : DIRECTIONAL
        attackShape : { form: MELEE_HIT }
```

---

### Ara (아라)

**컨셉**: 불꽃을 다루는 마법사. 공격적인 단일 속성 집중 빌드의 교과서.

| 항목 | 값 |
|---|---|
| HP | 낮음 |
| 사거리 | 원 |
| 공격 방식 | 마법 공격 |
| 피해 배율 | 높음 |
| 이동속도 | 보통 |
| 유틸성 | 낮음 |

```
Normal Attack    : Ember Shot (FIRE)
                  전방으로 작은 화염구를 발사. 슬롯 미소모.

Starting Gear    : Flame Burst (FIRE / Active) — Ability 슬롯 1개 선점
                  주변 근거리 범위에 화염을 폭발시킴. 적중 시 DoT 부착.

고유 패시브      : 광기의 불꽃
                  FIRE Ability를 2개 이상 보유 시 모든 FIRE 피해 +15%

고유 특수 메카닉 : 과열 (Overheat)
                  FIRE Ability 발동 시마다 과열 게이지 누적.
                  게이지 MAX 시 다음 FIRE Ability가 피해 2배 + 범위 1.5배로 발동 후 초기화.
```

---

### Kael (카엘)

**컨셉**: 냉기와 번개를 다루는 전술가. Discard를 적극 활용하는 빌드 재편형.

| 항목 | 값 |
|---|---|
| HP | 보통 |
| 사거리 | 중 |
| 공격 방식 | 마법 공격 |
| 피해 배율 | 보통 |
| 이동속도 | 빠름 |
| 유틸성 | 높음 |

```
Normal Attack    : Frost Bolt (FROST)
                  전방으로 냉기 투사체 발사. 슬롯 미소모.

고유 패시브      : 냉철한 판단
                  Discard 사용 시 다음 레벨업 선택지가
                  3장에서 4장으로 증가 (해당 레벨업 시점에서만 적용).

고유 특수 메카닉 : 전도체 (Conductor)
                  FROST로 둔화된 적에게 LIGHTNING Ability 적중 시 연쇄 횟수 +2 추가 발동.
```

---

### Sera (세라)

**컨셉**: 빛과 그림자를 다루는 성기사. 슬롯을 덜 쓸수록 강해지는 역발상 빌드.

| 항목 | 값 |
|---|---|
| HP | 높음 |
| 사거리 | 근 |
| 공격 방식 | 물리 공격 |
| 피해 배율 | 보통 |
| 이동속도 | 느림 |
| 유틸성 | 보통 |

```
Normal Attack    : Sacred Slash (HOLY)
                  근접 범위 성스러운 베기. 슬롯 미소모.

고유 패시브      : 공허의 의지
                  비어있는 Ability 슬롯 1개당 모든 피해 +8%, 받는 피해 -3%.

고유 특수 메카닉 : 성흔 (Stigma)
                  피격 시 Stigma 게이지 누적.
                  게이지 MAX 시 다음 Active Ability가 무적 판정 + 피해 1.5배로 발동 후 초기화.
```

---

## 13. Ability 풀 초안

### FIRE

**Flame Burst** (ACTIVE / MELEE / ZONE)
```
Lv1 : 주변 범위에 화염을 즉발 폭발시킴. 적중 시 DoT 부착.
Lv2 : 피해량 및 범위 증가.
Lv3 : DoT 틱 수 증가.
Lv4 : 폭발이 0.5초 간격으로 3회 연속 발생.
      각 폭발마다 범위가 이전보다 50% 확장.
```

**Fire Bolt** (ACTIVE / LONG / PROJECTILE / AUTO)
```
Lv1 : 가장 가까운 적에게 화염 투사체 발사.
Lv2 : 피해량 증가. 투사체 수 +1.
Lv3 : 적중 시 DoT 부착.
Lv4 : 투사체가 무한 관통으로 변경.
      관통한 적의 수만큼 다음 투사체 피해 +15% 누적.
```

**Meteor** (ACTIVE / LONG / FALLING / ON_ENEMY)
```
Lv1 : 랜덤한 적의 위치에 운석 낙하. 착지 시 범위 폭발.
Lv2 : 피해량 및 폭발 범위 증가.
Lv3 : 낙하 수 +1 (동시에 2개 낙하).
Lv4 : 낙하 수 +2 추가 (총 4개 동시 낙하).
      모든 착지 지점에 지속 화염 장판 생성.
      장판 위 적에게 DoT가 2배 속도로 틱.
```

---

### FROST

**Frost Lance** (ACTIVE / LONG / PROJECTILE / AUTO)
```
Lv1 : 가장 가까운 적에게 빙창 발사. 적중 시 이동속도 감소.
Lv2 : 피해량 증가. 이동속도 감소 강도 증가.
Lv3 : 적중 시 일정 확률로 완전 빙결 (짧은 시간 행동 불가).
Lv4 : 투사체가 분열형으로 변경.
      첫 적중 시 3갈래로 분열되어 주변 적에게 추가 발사.
      분열된 투사체도 빙결 확률 동일하게 적용.
```

**Blizzard** (ACTIVE / GLOBAL / FALLING / RANDOM)
```
Lv1 : 화면 전체 랜덤 위치에 빙편 낙하. 적중 시 이동속도 감소.
Lv2 : 피해량 증가. 낙하 수 증가.
Lv3 : 빙편 낙하 범위 증가. 이동속도 감소 지속시간 증가.
Lv4 : 빙편 착지 시 지속 냉기 장판으로 변환.
      장판 위 적은 이동속도 감소 + 받는 FROST 피해 +30%.
```

**Glacial Tomb** (ACTIVE / MID / ZONE / CONDITION — FROST 피해 5회 누적 시)
```
Lv1 : FROST 피해 5회 누적 적을 3초간 완전 빙결.
      빙결 중 받는 모든 피해 +20%.
Lv2 : 피해 증폭 수치 증가. 빙결 지속시간 증가.
Lv3 : 누적 조건 횟수 감소 (5회 → 3회).
Lv4 : 빙결 해제 시 폭발 발생.
      폭발 피해는 빙결 중 받은 누적 피해의 40%.
      주변 적에게 AoE로 적용.
```

---

### LIGHTNING

**Chain Lightning** (ACTIVE / LONG / PROJECTILE / AUTO)
```
Lv1 : 가장 가까운 적에게 번개 발사. 인접 적에게 2회 연쇄.
      연쇄마다 피해 20% 감소.
Lv2 : 피해량 증가. 연쇄 횟수 +1 (총 3회).
Lv3 : 연쇄 피해 감소 없음. 모든 연쇄 대상 동일 피해.
Lv4 : 연쇄 횟수 +3 (총 6회).
      마지막 연쇄 대상에게 누적 피해 전체를 한 번에 방출.
```

**Static Field** (AURA / MELEE / ENEMY)
```
Lv1 : 플레이어 주변 범위 내 적에게 지속 감전 피해.
      감전된 적은 이동속도 소폭 감소.
Lv2 : 피해량 증가. 범위 증가.
Lv3 : 감전 적끼리 인접 시 아크 발생. 추가 피해 양쪽 적용.
Lv4 : 범위 내 적 5명 이상 시 자동 대형 방전.
      범위 내 모든 적에게 누적 감전 횟수 × 고정 피해.
      방전 후 감전 스택 초기화.
```

**Thunderclap** (ACTIVE / MELEE / ZONE / CONDITION — LIGHTNING 피해 3회 누적 시)
```
Lv1 : 조건 충족 시 해당 적 위치에 낙뢰 즉발.
      소범위 AoE 피해 + 짧은 기절.
Lv2 : 피해량 증가. 기절 지속시간 증가.
Lv3 : AoE 범위 대폭 증가. 범위 내 적 감전 부여.
Lv4 : 낙뢰 3회 연속 (0.2초 간격).
      각 낙뢰마다 범위 30% 확장.
      3번째 낙뢰는 기절 대신 2초 완전 마비.
```

---

### SHADOW

**Shadow Bolt** (ACTIVE / LONG / PROJECTILE / AUTO)
```
Lv1 : 가장 가까운 적에게 암흑 투사체 발사. 단일 고피해.
Lv2 : 피해량 대폭 증가. 치명타 확률 +15%.
Lv3 : 치명타 적중 시 쿨다운 즉시 초기화.
Lv4 : 치명타 적중 시 반경 내 모든 적에게
      치명타 피해의 60%를 AoE로 방출.
```

**Death Mark** (ACTIVE / LONG / PROJECTILE / CONDITION — 10초마다)
```
Lv1 : 체력이 가장 높은 적 1명에게 Death Mark 부여 (8초).
      대상은 받는 모든 피해 +25%.
Lv2 : 피해 증폭 수치 증가. 지속시간 증가.
Lv3 : Death Mark 대상 처치 시 주변 적에게 자동 전이.
      전이 Mark 지속시간 절반.
Lv4 : Death Mark 대상 처치 시 폭발.
      폭발 피해는 해당 적 최대 체력의 20%.
      전이 횟수 제한 없음.
```

**Void Step** (REACTION / SELF / ZONE — 피격 시)
```
Lv1 : 피격 시 0.5초 무적 + 피격 반대 방향으로 짧게 이동.
      착지 지점에 암흑 폭발 (소피해).
Lv2 : 무적 시간 증가. 폭발 피해 증가.
Lv3 : 이동 거리 증가. 폭발 범위 대폭 증가.
Lv4 : 그림자화 중 적 이동/공격 0.5배속 슬로우.
      착지 시 폭발 3회 연속.
      발동 쿨다운 없음.
```

---

### ARCANE

**Arcane Missile** (ACTIVE / LONG / PROJECTILE / AUTO)
```
Lv1 : 가장 가까운 적에게 마력 투사체 발사.
Lv2 : 피해량 증가. 투사체 수 +1.
Lv3 : 투사체 수 +1 (총 3발). 각 투사체가 다른 적을 조준.
Lv4 : 모든 투사체가 동시에 부채꼴로 퍼지며 발사.
      각 투사체 관통 +1 획득.
```

**Mana Shield** (REACTION / SELF — 피격 시)
```
Lv1 : 피격 시 피해의 30%를 보호막으로 흡수. 보호막 3초 후 소멸.
Lv2 : 흡수 비율 증가. 보호막 지속시간 증가.
Lv3 : 보호막 소멸 시 잔여 수치만큼 주변 적에게 반사 피해.
Lv4 : 보호막 활성 중 모든 Ability 피해 +20%.
      보호막 반사 피해 150%로 증가.
```

**Void Pulse** (ACTIVE / GLOBAL / ZONE / CONDITION — Ability 20회 발동마다)
```
Lv1 : 화면 전체 모든 적에게 마력 충격파 방출.
Lv2 : 피해량 증가. 발동 조건 횟수 감소 (20회 → 15회).
Lv3 : 충격파 적중 적에게 3초간 받는 피해 +15%.
Lv4 : 발동 조건 횟수 추가 감소 (15회 → 10회).
      충격파 2회 연속 방출 (0.5초 간격).
      2번째 충격파 피해는 1번째의 200%.
```

---

### PHYSICAL

**Slash** (ACTIVE / MELEE / MELEE_HIT / DIRECTIONAL)
```
Lv1 : 이동 방향으로 전방 부채꼴 범위를 베어냄. 속성 저항 무시.
Lv2 : 피해량 증가. 부채꼴 범위 확장.
Lv3 : 베기 횟수 +1 (0.1초 간격으로 2회 연속).
Lv4 : 베기 횟수 +1 (총 3회 연속).
      마지막 베기는 피해량 2배 + 전방 전체 관통.
```

**Shockwave** (ACTIVE / MID / PROJECTILE / DIRECTIONAL / 전체 관통)
```
Lv1 : 이동 방향으로 충격파 발사. 전방 모든 적 관통. 적중 적 넉백.
Lv2 : 피해량 증가. 넉백 거리 증가.
Lv3 : 충격파 폭 확장. 적중 적 방어력 감소.
Lv4 : 충격파가 맵 끝에서 반사되어 되돌아옴.
      되돌아오는 충격파 피해는 원래의 150%.
```

**Juggernaut** (PASSIVE / SELF)
```
Lv1 : 이동 중 물리 피해 +8%. 이동속도가 빠를수록 추가 보너스 증가.
Lv2 : 피해 보너스 수치 증가.
Lv3 : 이동 중 받는 피해 -10% 추가.
Lv4 : 3초 이상 연속 이동 시 다음 PHYSICAL Ability 피해 2배 + 넉백 2배.
```

---

### HOLY

**Sacred Ground** (ACTIVE / MELEE / ZONE 지속형)
```
Lv1 : 플레이어 발 아래 성스러운 장판 생성 (4초 지속).
      장판 위 적에게 지속 피해. 언데드 계열 특효.
Lv2 : 피해량 증가. 장판 범위 증가.
Lv3 : 장판 위에 있는 동안 플레이어 HP 소량 회복.
Lv4 : 장판 지속시간 무한 (플레이어가 떠나면 소멸).
      장판 위 적은 받는 모든 피해 +20%.
```

**Holy Nova** (ACTIVE / MELEE / ZONE 즉발)
```
Lv1 : 주변 범위에 성스러운 폭발 방출.
      적에게 피해, 플레이어 소량 HP 회복.
Lv2 : 피해량 및 회복량 증가.
Lv3 : 폭발 범위 대폭 증가. 언데드 계열 추가 피해.
Lv4 : 현재 HP가 낮을수록 피해/회복량 증가.
      HP 30% 이하일 때 최대 효과 (피해 2배, 회복 3배).
```

**Aegis** (AURA / SELF)
```
Lv1 : 상시 보호막 생성. 일정 피해 흡수 후 소멸.
      소멸 후 일정 시간 경과 시 자동 재생성.
Lv2 : 보호막 수치 증가. 재생성 대기시간 감소.
Lv3 : 보호막 활성 중 받는 피해 추가 감소.
Lv4 : 보호막 소멸 시 주변 적에게 소멸된 수치만큼 피해.
      보호막 재생성 시 주변 적 짧은 기절.
```

## 14. 적 설계

### 저항 시스템 원칙
```
Mob / Elite  : ARMORED (물리 피해 감소) 또는 ETHEREAL (마법 피해 감소) 태그만 사용
Champion     : ARMORED / ETHEREAL 태그 + 선택적 속성 저항 1개 가능
Stage Boss   : 속성 저항 자유 설계
최종 Boss    : 속성 저항 자유 설계, 런 중 저항 변화 구조 고려
```

### MOB 등급

**Grunt** (기본 돌격형)
```
specialTag : 없음
행동 패턴  : 플레이어를 향해 직선 추적. 접촉 시 피해.
```

**Armored Grunt** (방어형)
```
specialTag : ARMORED — 물리 피해 50% 감소
행동 패턴  : Grunt와 동일하나 이동속도 느림.
```

**Shade** (유령형)
```
specialTag : ETHEREAL — 마법 피해 50% 감소
행동 패턴  : 플레이어를 향해 부유하며 접근. 벽 통과 가능.
```

**Spitter** (원거리형)
```
specialTag : 없음
행동 패턴  : 플레이어와 일정 거리 유지하며 투사체 발사.
             근접 시 도망치려 함.
```

**Swarmer** (군집형)
```
specialTag : 없음
행동 패턴  : 항상 5~8마리 무리로 등장. 단독으로는 매우 약함.
```

### ELITE 등급

**Iron Golem** (강화 방어형)
```
specialTag : ARMORED — 물리 피해 70% 감소
행동 패턴  : 느리게 접근. 일정 간격으로 전방 충격파 발동 (넉백).
             체력 50% 이하 시 이동속도 증가.
```

**Wraith** (강화 유령형)
```
specialTag : ETHEREAL — 마법 피해 70% 감소
행동 패턴  : 빠르게 접근. 플레이어 근처에서 순간이동 반복.
```

**Brute** (강화 돌격형)
```
specialTag : 없음
행동 패턴  : 빠른 속도로 직선 돌진. 돌진 후 짧은 경직.
             돌진 중 피해 무시. 경직 구간이 유일한 공략 타이밍.
```

**Summoner** (소환형)
```
specialTag : 없음
행동 패턴  : 플레이어와 거리 유지. 주기적으로 Grunt 2마리 소환.
             소환수 생존 중 본체 피해 50% 감소.
```

### CHAMPION 등급 (Stage 1)

**Stone Warden**
```
specialTag : ARMORED
속성 저항  : 없음
행동 패턴  :
  - 기본 : 플레이어를 향해 천천히 접근.
  - 패턴 1 : 일정 간격으로 전방 직선 충격파 발사 (넉백).
  - 패턴 2 : 체력 50% 이하 시 이동속도 증가.
드롭      : Relic 1개 보장
```

**Plague Witch**
```
specialTag : 없음
속성 저항  : 없음
행동 패턴  :
  - 기본 : 플레이어와 거리 유지하며 독성 투사체 발사 (DoT 부착).
  - 패턴 1 : 주기적으로 Swarmer 3마리 소환.
  - 패턴 2 : 체력 50% 이하 시 투사체 발사 속도 증가.
드롭      : Relic 1개 보장
```

### STAGE BOSS (Stage 1)

**The Hollow King**
```
specialTag : UNDEAD
속성 저항  : HOLY 특효 (+50%), SHADOW 저항 (-30%)

페이즈 1 (HP 100~60%) :
  - 플레이어를 향해 천천히 접근.
  - 주기적으로 3방향 암흑 투사체 발사.
  - Shade 2마리 소환.

페이즈 2 (HP 60~30%) :
  - 이동속도 증가.
  - 투사체 5방향으로 증가.
  - 소환 주기 단축.

페이즈 3 (HP 30~0%) :
  - 전체 화면 랜덤 암흑 장판 생성.
  - 투사체 발사 + 소환 동시 진행.
  - 접촉 피해 증가.

드롭      : Relic 2개 보장 + Gold 대량
```

### CHAMPION / BOSS 방향성 (Stage 2~3 및 최종)

```
Stage 2 Champion : 패턴 1개 추가. 속성 저항 1개 선택적 부여 시작.
Stage 3 Champion : 패턴 복잡화. 속성 저항 보편화.
Stage 2 Boss     : 페이즈 전환 시 맵 환경 변화 (장판, 지속 피해 구역 등).
Stage 3 Boss     : 복수 속성 저항. 소환 + 투사체 + 장판 동시 운용.

최종 Boss 방향성 (구체화는 3단계에서):
  - 모든 메카닉의 집합체. 런 내내 플레이어가 쌓아온 빌드를 압박.
  - 속성 저항이 페이즈마다 변화 → 단일 속성 집중 빌드 카운터.
  - 페이즈 수: 4페이즈 (HP 100→75→50→25% 전환).
  - 페이즈마다 완전히 다른 공격 패턴 세트로 교체.
  - 최후 페이즈에서 기존 등장했던 Champion 패턴 일부를 재활용.
```

### 캐릭터 해금

```
현재: 3명 모두 처음부터 해금된 상태.
추후 해금 시스템 추가 가능성 열어둠 (보류).
```

---

## 15. 개발 단계

구상한 모든 시스템은 유지. 구현 순서만 현실적으로 조정.

## 15. 디자인 / UI 방향

### 비주얼 방향
```
픽셀아트 기반
- 레트로 감성의 탑다운 2D 픽셀아트
- 무료 픽셀 에셋 활용 (Kenney.nl, OpenGameArt 등)
- 이펙트(폭발, 투사체, DoT)도 픽셀 스타일로 통일
```

### 인게임 HUD
```
상단 중앙 : 타이머 + 현재 Stage 표시
상단 좌측 : 플레이어 HP 바
상단 우측 : 현재 레벨 + 경험치 바
하단 중앙 : Ability 슬롯 6칸 (각 슬롯에 현재 Level 표시)
하단 우측 : Relic 슬롯 3칸
하단 좌측 : Gold 표시
```

### 레벨업 선택 화면
```
게임 일시정지 후 화면 중앙에 카드 3장 배치
각 카드 구성 : 속성 색상 배경 + 아이콘 + 이름 + 효과 설명
Discard 옵션 : 카드 하단 별도 버튼으로 분리
```

### 캐릭터 선택 화면
```
3명 캐릭터 카드 나열
각 카드 구성 : 캐릭터 픽셀 일러스트 + 스탯 표 + 특성 설명 + Normal Attack 표시
```

### 게임 오버 / 클리어 화면
```
결과 요약 : 생존 시간, 처치 수, 획득 Gold
획득한 Ability / Relic 목록
다시하기 / 메인 메뉴 버튼
```

### 속성별 색상 코드 (UI 통일성)
```
FIRE      : 주황/빨강 계열
FROST     : 하늘/파랑 계열
LIGHTNING : 노랑/보라 계열
SHADOW    : 진보라/검정 계열
ARCANE    : 분홍/자주 계열
PHYSICAL  : 회색/갈색 계열
HOLY      : 흰색/금색 계열
```

### 캐릭터 고유 게이지 UI
```
단순한 메카닉 (Stigma 피격 누적 등) : 캐릭터 위/옆 작은 bar로 표시
복잡하지 않은 메카닉 : 별도 표시 없음
위치/형태는 구현 시 결정
```

### 피격 처리
```
피격 시 플레이어 무적시간 : 0.5초 (임시값, 밸런싱 시 조정)
피격 시 시각적 피드백 : 추후 토의
```

### 저장 시스템
```
브라우저 기반 → localStorage 사용
저장 항목 : Meta Upgrade 상태 / Gold 누적량 / 해금된 캐릭터
런 중 데이터는 저장하지 않음 (런은 항상 처음부터)
```

---

## 16. 개발 단계

구상한 모든 시스템은 유지. 구현 순서만 현실적으로 조정.

### 구현 전 필수 원칙 (Claude Code 시작 전 명시)
```
① 모든 피해 계산은 단일 DamageCalculator 모듈을 반드시 거침
   Relic/Attribute Card 효과가 누락/중복 적용되는 버그 방지

② Stack 누적은 addStack() 단일 함수로 통합
   레벨업 선택지 / Level Box / Big Box 어디서 획득하든 동일 함수 호출

③ Discard 봉인 fallback 로직 필수
   봉인 후 남은 Ability 풀이 선택지 수보다 적으면
   봉인 중 가장 오래된 것부터 자동 해제

④ CONDITION 기반 Ability용 hitCounter
   Enemy 객체에 { abilityId: count } 형태의 Map 보유
   적 사망 시 카운터 자동 삭제

⑤ 오브젝트 풀링 필수
   적 / 투사체 / XP 오브 모두 풀링으로 구현
   후반부 수백 마리 환경에서 프레임 드롭 방지
```

### 1단계 — 코어 (실제 플레이 가능한 최소 단위)
```
□ 프로젝트 세팅 (Phaser 3 기반)
□ 맵 / 배경 구현 + 경계 충돌 처리
□ 기본 이동 시스템
□ 피격 판정 / 적 처치 판정
□ 일시정지 시스템 (레벨업 UI 등장 시 게임 정지)
□ 캐릭터 1명 (Ara)
   - Normal Attack (Ember Shot)
   - Starting Gear (Flame Burst 슬롯 선점)
□ 치명타 시스템 (기본 확률/배율 임시값)
□ 경험치 시스템 (XP 오브 드롭 + 흡수)
□ 레벨업 시스템
□ Ability 슬롯 시스템 (4슬롯)
□ Stack + Level 시스템 (1→2→3→4) — addStack() 단일 함수
□ 레벨업 선택지 UI (카드 3장)
   - 선택지 A : 새 Ability (Level 1)
   - 선택지 B : 보유 Ability 중복
   - 선택지 C : Attribute Card 또는 Discard
□ Discard 시스템 (슬롯 반환 + 5레벨 봉인 + fallback 로직)
□ Attribute Card 기본 구조
□ ARMORED / ETHEREAL 저항 계산
□ DamageCalculator 모듈
□ Ability 6개 구현
   → Flame Burst, Fire Bolt, Frost Lance, Slash, Holy Nova, Arcane Missile
□ Gold 드롭 + 수집 시스템
□ Mob 3종 (Grunt, Armored Grunt, Spitter)
□ 오브젝트 풀링 (적 / 투사체 / XP 오브)
□ 시간 기반 웨이브 스폰
□ Stage 1 구현
□ Champion 1종 (Stone Warden)
□ 기본 HUD (HP 바, 타이머, 레벨, 경험치 바, 슬롯, Gold)
□ 게임 오버 화면 (기본)
```

### 2단계 — 시스템 확장
```
□ 메인 메뉴 화면
□ 캐릭터 선택 화면
□ 나머지 캐릭터 추가 (Kael, Sera)
□ Relic 시스템
□ 상자 시스템 (Level Box, Relic Box, Big Box)
□ Attribute Card 시스템 완성 (랜덤 수치 범위)
□ Stage 클리어 보상 화면 (Relic 선택 UI)
□ Discard 봉인 상태 시각적 표시
□ 나머지 Mob 추가 (Shade, Swarmer)
□ Elite 4종 추가 (Iron Golem, Wraith, Brute, Summoner)
   - Wraith 순간이동 AI 주의
   - Summoner 소환수 연동 피해 감소 주의
□ Champion 완성 (Plague Witch 추가)
□ Stage Boss 구현 (The Hollow King — 페이즈 1~2만 우선)
□ Stage 2~3 구현
□ 나머지 Ability 추가 (15개)
□ 게임 오버 / 클리어 화면 완성 (결과 요약)
```

### 3단계 — 완성
```
□ 맵 구조 단일 화면 → 스크롤 맵으로 전환
□ Curse 시스템 + Curse Box 구현
□ The Hollow King 페이즈 3 완성
□ 최종 Boss 구현 (4페이즈, 속성 저항 변화)
□ 복잡한 Ability Lv4 구현 (개별 구현 + 개별 테스트 후 통합)
□ Meta Upgrade 시스템 (Gold 소모 영구 강화)
□ Boss 페이즈 시스템 고도화
□ 픽셀아트 에셋 교체 (임시 그래픽 → 정식 에셋)
□ 사운드 / 이펙트 (Phaser 3 내장 기능 + 무료 에셋)
□ 밸런싱 전반
□ 배포 (GitHub + Vercel)
```

---

*마지막 수정: 청사진 v2.0 — 4차 검토 완료. 전체 설계 확정. 코드네임: ECLIPSIA. 다음: Claude Code용 개발 계획 md 작성 후 개발 진입*
