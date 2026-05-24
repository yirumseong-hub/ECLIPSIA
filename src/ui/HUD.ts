// ============================================================
// src/ui/HUD.ts
// HUD 컴포넌트. UIScene 내에서 create()/update(data)로 사용.
//
// HUD 레이아웃 (CLAUDE.md §12):
//   상단 좌측 : HP 바 + Overheat 게이지 (Ara 전용)
//   상단 중앙 : 카운트다운 타이머 + Stage 번호
//   상단 우측 : XP 바 + 레벨 텍스트
//   하단 좌측 : Gold
//   하단 중앙 : Ability 슬롯 6칸 (레벨 + 쿨다운 오버레이)
//   하단 우측 : Relic 슬롯 3칸 (빈 슬롯 시각화)
//   플레이어 위: 소형 Overheat 게이지 (플레이어 좌표 기준)
//
// GameScene에서 'hud-update' 이벤트로 HUDData를 받아 매 프레임 갱신.
//
// 사용처:
//   UIScene.ts — create()에서 생성, GameScene 이벤트 수신 시 update()
// ============================================================

import Phaser from 'phaser';

// ── HUD 갱신 데이터 인터페이스 ────────────────────────────────
// GameScene이 매 프레임 'hud-update' 이벤트로 발행.

export interface SlotDisplayData {
  isEmpty:        boolean;
  abilityName:    string | null;
  levelLabel:     string | null;
  colorHex:       number;        // ATTRIBUTE_COLORS 값
  cooldownRatio:  number;        // 0 = 준비, 1 = 방금 발동
}

export interface HUDData {
  hp:             number;
  maxHp:          number;
  level:          number;
  xp:             number;
  xpThreshold:    number;
  gold:           number;
  elapsedTime:    number;        // 경과 초 (stage 기준)
  stageNumber:    number;
  overheatValue:  number;
  overheatMax:    number;        // 0이면 비표시
  isOverheated:   boolean;
  slots:          SlotDisplayData[];  // 항상 6개 원소
  playerX:        number;        // 플레이어 화면 좌표
  playerY:        number;
}

// ── 레이아웃 상수 ─────────────────────────────────────────────
const PAD       = 8;
const HP_W      = 200;
const HP_H      = 18;
const OH_W      = 200;
const OH_H      = 8;
const XP_W      = 200;
const XP_H      = 16;
const SLOT_W    = 56;
const SLOT_H    = 64;
const SLOT_GAP  = 4;
const SLOT_N    = 6;
const RELIC_W   = 42;
const RELIC_H   = 50;
const RELIC_GAP = 4;
const RELIC_N   = 3;
const DEPTH     = 50;

// 속성 색상을 어둡게 변환 (슬롯 배경용)
function darkenHex(color: number): number {
  const r = ((color >> 16) & 0xff) * 0.22 | 0;
  const g = ((color >>  8) & 0xff) * 0.22 | 0;
  const b = ( color        & 0xff) * 0.22 | 0;
  return (r << 16) | (g << 8) | b;
}

export class HUD {
  // ── HP 바 ────────────────────────────────────────────────
  private hpFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;

  // ── Overheat 바 (HUD 고정) ────────────────────────────────
  private ohBg!:    Phaser.GameObjects.Rectangle;
  private ohFill!:  Phaser.GameObjects.Rectangle;
  private ohLabel!: Phaser.GameObjects.Text;

  // ── Overheat 미니 게이지 (플레이어 위) ───────────────────────
  private poHBg!:   Phaser.GameObjects.Rectangle;
  private poHFill!: Phaser.GameObjects.Rectangle;

  // ── 타이머 + Stage ──────────────────────────────────────
  private timerText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;

  // ── XP 바 + 레벨 ───────────────────────────────────────
  private xpBg!:     Phaser.GameObjects.Rectangle;
  private xpFill!:   Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;

  // ── Gold ───────────────────────────────────────────────
  private goldText!: Phaser.GameObjects.Text;

  // ── Ability 슬롯 ───────────────────────────────────────
  private slotBgs:       Phaser.GameObjects.Rectangle[] = [];
  private slotCdFills:   Phaser.GameObjects.Rectangle[] = [];
  private slotNameTexts: Phaser.GameObjects.Text[]      = [];
  private slotLvTexts:   Phaser.GameObjects.Text[]      = [];

  // ── Relic 슬롯 ─────────────────────────────────────────
  private relicBgs: Phaser.GameObjects.Rectangle[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  // UIScene.create()에서 1회 호출.
  create(): void {
    const { width, height } = this.scene.scale;

    // ─── 상단 좌측: HP 바 ──────────────────────────────────
    this.scene.add
      .rectangle(PAD, PAD, HP_W, HP_H, 0x333333)
      .setOrigin(0, 0).setDepth(DEPTH);
    this.hpFill = this.scene.add
      .rectangle(PAD, PAD, HP_W, HP_H, 0x44cc44)
      .setOrigin(0, 0).setDepth(DEPTH + 1);
    this.hpText = this.scene.add
      .text(PAD + 4, PAD + 2, 'HP', { fontSize: '12px', color: '#ffffff' })
      .setDepth(DEPTH + 2);

    // ─── 상단 좌측 (HP 아래): Overheat 바 ─────────────────
    const ohY = PAD + HP_H + 3;
    this.ohBg = this.scene.add
      .rectangle(PAD, ohY, OH_W, OH_H, 0x222222)
      .setOrigin(0, 0).setDepth(DEPTH);
    this.ohFill = this.scene.add
      .rectangle(PAD, ohY, 0, OH_H, 0xff8800)
      .setOrigin(0, 0).setDepth(DEPTH + 1);
    this.ohLabel = this.scene.add
      .text(PAD + OH_W + 5, ohY - 1, 'HEAT', { fontSize: '10px', color: '#ff8800' })
      .setDepth(DEPTH + 2);

    // ─── 상단 중앙: 타이머 + Stage ─────────────────────────
    this.timerText = this.scene.add
      .text(width / 2, PAD, '07:00', {
        fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      })
      .setOrigin(0.5, 0).setDepth(DEPTH);
    this.stageText = this.scene.add
      .text(width / 2, PAD + 28, 'Stage 1', {
        fontSize: '13px', color: '#aaaaaa',
      })
      .setOrigin(0.5, 0).setDepth(DEPTH);

    // ─── 상단 우측: XP 바 + 레벨 텍스트 ───────────────────
    const xpX = width - PAD - XP_W;
    this.xpBg = this.scene.add
      .rectangle(xpX, PAD, XP_W, XP_H, 0x333333)
      .setOrigin(0, 0).setDepth(DEPTH);
    this.xpFill = this.scene.add
      .rectangle(xpX, PAD, 0, XP_H, 0x44ee44)
      .setOrigin(0, 0).setDepth(DEPTH + 1);
    this.levelText = this.scene.add
      .text(width - PAD, PAD + XP_H + 3, 'Lv.1', {
        fontSize: '14px', color: '#88ff88',
      })
      .setOrigin(1, 0).setDepth(DEPTH + 2);

    // ─── 하단 좌측: Gold ────────────────────────────────────
    this.goldText = this.scene.add
      .text(PAD, height - PAD, 'Gold: 0', {
        fontSize: '16px', color: '#ffdd44',
      })
      .setOrigin(0, 1).setDepth(DEPTH);

    // ─── 하단 중앙: Ability 슬롯 6칸 ──────────────────────
    const totalSlotW = SLOT_N * SLOT_W + (SLOT_N - 1) * SLOT_GAP;
    const slotStartX = (width - totalSlotW) / 2;
    const slotY      = height - PAD - SLOT_H;

    for (let i = 0; i < SLOT_N; i++) {
      const sx = slotStartX + i * (SLOT_W + SLOT_GAP);

      const bg = this.scene.add
        .rectangle(sx, slotY, SLOT_W, SLOT_H, 0x111122)
        .setOrigin(0, 0).setDepth(DEPTH)
        .setStrokeStyle(1, 0x333366);

      // 쿨다운 오버레이: 위에서 아래로 채움 (ratio → 높이)
      const cdFill = this.scene.add
        .rectangle(sx, slotY, SLOT_W, 0, 0x000000, 0.6)
        .setOrigin(0, 0).setDepth(DEPTH + 1);

      const nameText = this.scene.add
        .text(sx + SLOT_W / 2, slotY + 8, '', {
          fontSize: '9px', color: '#ffffff',
          wordWrap: { width: SLOT_W - 4 }, align: 'center',
        })
        .setOrigin(0.5, 0).setDepth(DEPTH + 2);

      const lvText = this.scene.add
        .text(sx + SLOT_W / 2, slotY + SLOT_H - 14, '', {
          fontSize: '11px', color: '#aaaaaa',
        })
        .setOrigin(0.5, 0).setDepth(DEPTH + 2);

      this.slotBgs.push(bg);
      this.slotCdFills.push(cdFill);
      this.slotNameTexts.push(nameText);
      this.slotLvTexts.push(lvText);
    }

    // ─── 하단 우측: Relic 슬롯 3칸 ────────────────────────
    const totalRelicW = RELIC_N * RELIC_W + (RELIC_N - 1) * RELIC_GAP;
    const relicStartX = width - PAD - totalRelicW;
    const relicY      = height - PAD - RELIC_H;

    for (let i = 0; i < RELIC_N; i++) {
      const rx = relicStartX + i * (RELIC_W + RELIC_GAP);
      const rb = this.scene.add
        .rectangle(rx, relicY, RELIC_W, RELIC_H, 0x221133)
        .setOrigin(0, 0).setDepth(DEPTH)
        .setStrokeStyle(1, 0x664488);
      this.relicBgs.push(rb);
    }

    // ─── 플레이어 위: 소형 Overheat 게이지 ────────────────
    this.poHBg = this.scene.add
      .rectangle(0, 0, 40, 5, 0x333333)
      .setOrigin(0.5, 0).setDepth(DEPTH).setVisible(false);
    this.poHFill = this.scene.add
      .rectangle(0, 0, 0, 5, 0xff8800)
      .setOrigin(0, 0).setDepth(DEPTH + 1).setVisible(false);
  }

  // 매 프레임 UIScene에서 GameScene 이벤트 수신 시 호출.
  update(data: HUDData): void {
    const { width } = this.scene.scale;

    // ─── HP 바 ──────────────────────────────────────────────
    const hpRatio = data.maxHp > 0 ? Math.max(0, Math.min(1, data.hp / data.maxHp)) : 0;
    this.hpFill.setSize(HP_W * hpRatio, HP_H);
    const hpColor = hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xffaa00 : 0xff2222;
    this.hpFill.setFillStyle(hpColor);
    this.hpText.setText(`HP  ${data.hp} / ${data.maxHp}`);

    // ─── Overheat 바 ─────────────────────────────────────────
    const ohVisible = data.overheatMax > 0;
    this.ohBg.setVisible(ohVisible);
    this.ohFill.setVisible(ohVisible);
    this.ohLabel.setVisible(ohVisible);
    if (ohVisible) {
      const ohRatio = Math.max(0, Math.min(1, data.overheatValue / data.overheatMax));
      this.ohFill.setSize(OH_W * ohRatio, OH_H);
      this.ohFill.setFillStyle(data.isOverheated ? 0xffff00 : 0xff8800);
      this.ohLabel.setColor(data.isOverheated ? '#ffff00' : '#ff8800');
    }

    // ─── 타이머 ──────────────────────────────────────────────
    const remaining = Math.max(0, 7 * 60 - data.elapsedTime);
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    this.timerText.setText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    this.timerText.setColor(remaining < 60 ? '#ff4444' : '#ffffff');
    this.stageText.setText(`Stage ${data.stageNumber}`);

    // ─── XP 바 + 레벨 ─────────────────────────────────────
    const xpRatio = data.xpThreshold > 0 ? Math.min(1, data.xp / data.xpThreshold) : 0;
    this.xpFill.setSize(XP_W * xpRatio, XP_H);
    this.levelText.setText(`Lv.${data.level}`);

    // ─── Gold ─────────────────────────────────────────────
    this.goldText.setText(`Gold: ${data.gold}`);

    // ─── Ability 슬롯 ──────────────────────────────────────
    for (let i = 0; i < SLOT_N; i++) {
      const slot = data.slots[i];
      if (!slot || slot.isEmpty) {
        this.slotBgs[i].setFillStyle(0x111122).setStrokeStyle(1, 0x333366);
        this.slotCdFills[i].setSize(SLOT_W, 0);
        this.slotNameTexts[i].setText('');
        this.slotLvTexts[i].setText('');
      } else {
        this.slotBgs[i].setFillStyle(darkenHex(slot.colorHex)).setStrokeStyle(1, slot.colorHex);
        this.slotCdFills[i].setSize(SLOT_W, SLOT_H * slot.cooldownRatio);
        this.slotNameTexts[i].setText(slot.abilityName ?? '');
        this.slotLvTexts[i].setText(slot.levelLabel ?? '');
      }
    }

    // ─── 플레이어 위 Overheat 미니 게이지 ──────────────────
    if (data.overheatMax > 0 && data.overheatValue > 0) {
      const px  = data.playerX;
      const py  = data.playerY - 30;
      const ohr = Math.max(0, Math.min(1, data.overheatValue / data.overheatMax));
      this.poHBg.setPosition(px, py).setVisible(true);
      this.poHFill.setPosition(px - 20, py).setVisible(true);
      this.poHFill.setSize(40 * ohr, 5);
      this.poHFill.setFillStyle(data.isOverheated ? 0xffff00 : 0xff8800);
    } else {
      this.poHBg.setVisible(false);
      this.poHFill.setVisible(false);
    }

    // XP 바 우측 정렬 보정 (width가 바뀔 때를 대비)
    const xpX = width - PAD - XP_W;
    this.xpBg.setPosition(xpX, PAD);
    this.xpFill.setPosition(xpX, PAD);
  }
}
