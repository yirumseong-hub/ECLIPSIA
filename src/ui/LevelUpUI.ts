// ============================================================
// src/ui/LevelUpUI.ts
// 레벨업 선택 UI. 카드 3~4장 + 하단 Discard 버튼 상시 노출.
//
// 표시 / 숨김:
//   show()  — 메인 카드 UI 생성. physics pause는 GameScene에서 처리.
//   hide()  — 모든 UI 제거. GameScene.resumeFromLevelUp() 직전 호출.
//
// Discard 흐름:
//   Discard 버튼 클릭 → showDiscardPanel() → 보유 Ability 목록 표시
//   → 선택 시 onDiscard(abilityId) → GameScene.handleDiscard()
//   → GameScene이 hide() 호출 여부 결정
//
// 카드 선택 흐름:
//   카드 클릭 → onSelect(choice) → GameScene.handleLevelUpChoice()
//   → GameScene이 hide() 호출 여부 결정 (슬롯 없으면 Discard 대기)
//
// 사용처:
//   GameScene.ts — levelUpUI 인스턴스 보유, show/hide 호출
// ============================================================

import Phaser from 'phaser';
import { Choice } from '../systems/LevelUpManager';
import { AbilitySlot } from '../abilities/AbilityManager';
import { ATTRIBUTE_COLORS } from '../abilities/AbilityData';

// Phaser 16진수 색상 → CSS 문자열 (Text 색상 인자용)
function toCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export class LevelUpUI {
  private scene: Phaser.Scene;

  // 메인 레벨업 UI 컨테이너. null이면 숨겨진 상태.
  private mainContainer: Phaser.GameObjects.Container | null = null;

  // Discard 서브 패널. 메인 위에 독립적으로 표시.
  private discardContainer: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── 공개 API ─────────────────────────────────────────────

  // 레벨업 UI 표시.
  // choices: LevelUpManager.generateChoices() 결과.
  // equippedSlots: Discard 패널에 표시할 현재 장착 목록.
  // onSelect: 카드 선택 시 콜백 (GameScene이 hide 여부 결정).
  // onDiscard: Ability 봉인 선택 시 콜백 (abilityId 전달).
  show(
    choices: Choice[],
    equippedSlots: AbilitySlot[],
    onSelect: (choice: Choice) => void,
    onDiscard: (abilityId: string) => void,
  ): void {
    this.hide();

    const { width, height } = this.scene.scale;
    this.mainContainer = this.scene.add.container(0, 0);
    this.mainContainer.setDepth(100);

    // 반투명 배경 (클릭 이벤트 차단)
    const overlay = this.scene.add.rectangle(
      width / 2, height / 2, width, height, 0x000000, 0.76,
    );
    overlay.setInteractive();
    this.mainContainer.add(overlay);

    // 타이틀
    const title = this.scene.add.text(width / 2, 58, 'LEVEL UP!', {
      fontSize: '36px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.mainContainer.add(title);

    const hint = this.scene.add.text(width / 2, 102, '업그레이드를 선택하세요', {
      fontSize: '15px', color: '#aaaaaa',
    }).setOrigin(0.5);
    this.mainContainer.add(hint);

    // 카드 레이아웃
    const cardW = 250;
    const cardH = 330;
    const gap   = 24;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (width - totalW) / 2 + cardW / 2;

    choices.forEach((choice, i) => {
      this.buildCard(
        startX + i * (cardW + gap),
        height / 2 + 12,
        cardW, cardH,
        choice,
        onSelect,
      );
    });

    // Discard 버튼 — 하단 상시 노출 (CLAUDE.md §6)
    const discardBtn = this.scene.add.text(
      width / 2, height - 46, '[ DISCARD ]',
      { fontSize: '18px', color: '#777777' },
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    discardBtn.on('pointerover',  () => discardBtn.setColor('#cccccc'));
    discardBtn.on('pointerout',   () => discardBtn.setColor('#777777'));
    discardBtn.on('pointerdown',  () => this.showDiscardPanel(equippedSlots, onDiscard));
    this.mainContainer.add(discardBtn);
  }

  // 전체 UI 제거 (메인 + Discard 패널).
  // GameScene.resumeFromLevelUp() 호출 전에 실행.
  hide(): void {
    this.hideDiscardPanel();
    if (this.mainContainer) {
      this.mainContainer.destroy();
      this.mainContainer = null;
    }
  }

  // ── 내부: 카드 생성 ──────────────────────────────────────

  private buildCard(
    cx: number, cy: number,
    w: number, h: number,
    choice: Choice,
    onSelect: (choice: Choice) => void,
  ): void {
    const color    = ATTRIBUTE_COLORS[choice.data.attribute];
    const cssColor = toCSS(color);

    // 배경
    const bg = this.scene.add.rectangle(cx, cy, w, h, color, 0.18);
    bg.setStrokeStyle(2, color, 0.9);
    bg.setInteractive({ useHandCursor: true });
    this.mainContainer!.add(bg);

    // 속성 뱃지
    const badge = this.scene.add.text(
      cx, cy - h / 2 + 22,
      `[ ${choice.data.attribute} ]`,
      { fontSize: '12px', color: cssColor },
    ).setOrigin(0.5);
    this.mainContainer!.add(badge);

    // 이름
    const nameStr = choice.type === 'ABILITY'
      ? choice.data.name
      : `${choice.data.attribute} 속성 카드`;
    const nameObj = this.scene.add.text(cx, cy - h / 2 + 55, nameStr, {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      wordWrap: { width: w - 24, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5, 0);
    this.mainContainer!.add(nameObj);

    // 효과 설명
    const descStr = choice.type === 'ABILITY'
      ? choice.data.effectDesc[0]
      : choice.data.effectDesc;
    const descObj = this.scene.add.text(cx, cy + 16, descStr, {
      fontSize: '13px', color: '#cccccc',
      wordWrap: { width: w - 28, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5);
    this.mainContainer!.add(descObj);

    // 타입 표시
    const typeStr = choice.type === 'ABILITY' ? choice.data.type : 'CARD';
    const typeObj = this.scene.add.text(cx, cy + h / 2 - 22, typeStr, {
      fontSize: '11px', color: '#666666',
    }).setOrigin(0.5);
    this.mainContainer!.add(typeObj);

    // 호버 / 클릭
    bg.on('pointerover',  () => bg.setFillStyle(color, 0.42));
    bg.on('pointerout',   () => bg.setFillStyle(color, 0.18));
    bg.on('pointerdown',  () => onSelect(choice));
  }

  // ── 내부: Discard 패널 ───────────────────────────────────

  // 장착된 Ability 목록 표시. 선택 시 onDiscard(abilityId) 호출 후 패널 닫힘.
  private showDiscardPanel(
    equippedSlots: AbilitySlot[],
    onDiscard: (abilityId: string) => void,
  ): void {
    this.hideDiscardPanel();

    const { width, height } = this.scene.scale;
    this.discardContainer = this.scene.add.container(0, 0);
    this.discardContainer.setDepth(110); // 메인 UI 위

    const panelH = Math.max(220, 80 + equippedSlots.length * 52 + 44);
    const panelBg = this.scene.add.rectangle(
      width / 2, height / 2, 420, panelH, 0x0e0e22, 0.97,
    );
    panelBg.setStrokeStyle(2, 0x5555aa);
    this.discardContainer.add(panelBg);

    // 패널 제목
    const title = this.scene.add.text(
      width / 2, height / 2 - panelH / 2 + 28,
      'DISCARD ABILITY',
      { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' },
    ).setOrigin(0.5);
    this.discardContainer.add(title);

    const sub = this.scene.add.text(
      width / 2, height / 2 - panelH / 2 + 52,
      '선택한 Ability는 5레벨 동안 봉인됩니다',
      { fontSize: '12px', color: '#888888' },
    ).setOrigin(0.5);
    this.discardContainer.add(sub);

    if (equippedSlots.length === 0) {
      const empty = this.scene.add.text(
        width / 2, height / 2, '장착된 Ability가 없습니다',
        { fontSize: '14px', color: '#666666' },
      ).setOrigin(0.5);
      this.discardContainer.add(empty);
    } else {
      equippedSlots.forEach((slot, i) => {
        const y      = height / 2 - panelH / 2 + 86 + i * 52;
        const col    = ATTRIBUTE_COLORS[slot.ability.attribute];
        const label  = `${slot.ability.name}   Lv.${slot.level}   [${slot.ability.attribute}]`;
        const btn    = this.scene.add.text(width / 2, y, label, {
          fontSize: '15px', color: toCSS(col),
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover',  () => btn.setColor('#ffffff'));
        btn.on('pointerout',   () => btn.setColor(toCSS(col)));
        btn.on('pointerdown',  () => {
          this.hideDiscardPanel();
          onDiscard(slot.ability.id);
        });
        this.discardContainer!.add(btn);
      });
    }

    // 취소 버튼
    const cancel = this.scene.add.text(
      width / 2, height / 2 + panelH / 2 - 26,
      '[ 취소 ]',
      { fontSize: '14px', color: '#555555' },
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancel.on('pointerover',  () => cancel.setColor('#999999'));
    cancel.on('pointerout',   () => cancel.setColor('#555555'));
    cancel.on('pointerdown',  () => this.hideDiscardPanel());
    this.discardContainer.add(cancel);
  }

  private hideDiscardPanel(): void {
    if (this.discardContainer) {
      this.discardContainer.destroy();
      this.discardContainer = null;
    }
  }
}
