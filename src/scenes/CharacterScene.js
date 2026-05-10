// 캐릭터 선택 씬 — 무료 6종(char_001~006) 그리드 + 보유/선택/구매 흐름
// MVP v1:
//   - 무료 6종만 노출 (char_007~030 자산 미도착, "곧 추가" 안내만)
//   - char_001 박삽돌 기본 보유 (튜토리얼)
//   - char_002~006: characters.js price.type(coin/relic) 따라 구매
//   - 카드 상태별 외곽선: 사용 중(황금) / 보유(초록) / 미보유(갈색)
import Phaser from 'phaser';
import CurrencyManager from '../managers/CurrencyManager.js';
import SoundManager from '../managers/SoundManager.js';
import { CHARACTERS, getCharacterById } from '../data/characters.js';

// 화면 720×1280 기준 그리드 레이아웃
const GRID_COLS    = 2;
const CARD_W       = 320;
const CARD_H       = 280;
const CARD_GAP_X   = 30;
const CARD_GAP_Y   = 20;
const HEADER_H     = 200;     // 타이틀 + 재화 영역
const BACK_BTN_Y_OFFSET = 70;  // 화면 하단에서의 거리

export default class CharacterScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterScene' });
        this.currencyManager = null;
        this.soundManager = null;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.currencyManager = new CurrencyManager();
        this.soundManager = new SoundManager(this);

        // 배경 (어두운 흙색 — ShopScene 톤 일관)
        this.add.rectangle(width / 2, height / 2, width, height, 0x4a3520);

        // 헤더 영역 (타이틀 + 재화)
        this.createHeader(width);

        // 캐릭터 그리드 (무료 6종)
        this.buildGrid(width);

        // "곧 추가" 안내 (유료 24종 미도착)
        this.createComingSoonNote(width, height);

        // 뒤로가기
        this.createBackButton(width / 2, height - BACK_BTN_Y_OFFSET);

        // 토스트 메시지 영역 (구매/선택 결과 안내용)
        this.toastText = null;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 헤더 (타이틀 + 재화 카운터)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createHeader(width) {
        // 타이틀
        this.add.text(width / 2, 60, '👷 캐릭터 선택', {
            font: 'bold 50px sans-serif',
            color: '#ffd700',
            stroke: '#5a2d0c', strokeThickness: 6
        }).setOrigin(0.5);

        // 부제
        this.add.text(width / 2, 110, '━━ 무료 캐릭터 6종 ━━', {
            font: 'bold 22px sans-serif',
            color: '#ffd700'
        }).setOrigin(0.5);

        // 재화 카운터 (실시간 갱신용 보관)
        const cm = this.currencyManager;
        this.currencyText = this.add.text(
            width / 2, 160,
            this.formatCurrency(),
            { font: 'bold 26px sans-serif', color: '#ffffff', stroke: '#000', strokeThickness: 4 }
        ).setOrigin(0.5);
    }

    formatCurrency() {
        const cm = this.currencyManager;
        return `🪙 ${cm.coin.toLocaleString()}    🏺 ${cm.relic}    💎 ${cm.diamond}`;
    }

    refreshCurrency() {
        if (this.currencyText) this.currencyText.setText(this.formatCurrency());
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 캐릭터 그리드 (2열 × 3행 = 무료 6종)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    buildGrid(width) {
        const freeChars = CHARACTERS.filter(c =>
            c.price && (c.price.type === 'free' || c.price.type === 'coin' || c.price.type === 'relic')
        );

        const totalGridW = CARD_W * GRID_COLS + CARD_GAP_X * (GRID_COLS - 1);
        const gridLeft   = (width - totalGridW) / 2 + CARD_W / 2;
        const gridTop    = HEADER_H + CARD_H / 2;

        freeChars.forEach((charDef, idx) => {
            const col = idx % GRID_COLS;
            const row = Math.floor(idx / GRID_COLS);
            const x = gridLeft + col * (CARD_W + CARD_GAP_X);
            const y = gridTop  + row * (CARD_H + CARD_GAP_Y);
            this.createCharacterCard(charDef, x, y);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 캐릭터 카드 1장
    //   레이아웃: [PNG 130px] [텍스트 컬럼 175px]
    //   상태별 외곽선: 사용 중(황금) / 보유(초록) / 미보유(갈색)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createCharacterCard(charDef, x, y) {
        const radius = 16;
        const cm = this.currencyManager;

        const isOwned    = cm.ownsCharacter(charDef.id);
        const isSelected = cm.selectedCharacterId === charDef.id;
        const price      = charDef.price || {};
        const canAfford  = !isOwned && this.canAfford(price);

        // 카드 배경 (둥근 사각형 + 상태별 테두리)
        const bg = this.add.graphics();
        bg.fillStyle(0x3e2723, 1);
        bg.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, radius);

        if (isSelected) {
            bg.lineStyle(5, 0xffd700, 1);   // 사용 중 — 두꺼운 황금
        } else if (isOwned) {
            bg.lineStyle(3, 0x4caf50, 1);   // 보유 — 초록
        } else {
            bg.lineStyle(2, 0x8b5a2b, 1);   // 미보유 — 갈색
        }
        bg.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, radius);

        // ━━ 좌측: 캐릭터 PNG (있으면 idle, 없으면 이모지 폴백) ━━
        const PNG_COL_W = 130;
        const pngX = x - CARD_W / 2 + PNG_COL_W / 2;
        const idleKey = `${charDef.id}_idle`;
        if (this.textures.exists(idleKey)) {
            const img = this.add.image(pngX, y, idleKey);
            const ratio = img.width / img.height;
            const targetH = CARD_H - 30;        // 카드 높이 - 패딩 30
            img.setDisplaySize(targetH * ratio, targetH);
        } else {
            this.add.text(pngX, y, '👤', { font: '90px sans-serif' }).setOrigin(0.5);
        }

        // ━━ 우측: 텍스트 컬럼 (이름 + 등급 + 보너스 + 가격/버튼) ━━
        const textX = x - CARD_W / 2 + PNG_COL_W + 15;

        // 이름
        this.add.text(textX, y - CARD_H / 2 + 18, charDef.name, {
            font: 'bold 26px sans-serif',
            color: '#ffd700',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0, 0);

        // 등급 별
        const stars = '⭐'.repeat(Math.min(charDef.rarity || 1, 5));
        this.add.text(textX, y - CARD_H / 2 + 56, stars, {
            font: '18px sans-serif'
        }).setOrigin(0, 0);

        // 보너스 설명 (자동 줄바꿈)
        const descText = charDef.desc || '';
        this.add.text(textX, y - 50, descText, {
            font: '16px sans-serif',
            color: '#ffffff',
            wordWrap: { width: 170 }
        }).setOrigin(0, 0);

        // ━━ 하단: 상태별 표시 (사용 중 / 선택 / 가격+구매) ━━
        const btnX = textX + 87;   // 우측 컬럼 중앙
        const btnY = y + CARD_H / 2 - 35;

        if (isSelected) {
            this.add.text(btnX, btnY, '✓ 사용 중', {
                font: 'bold 22px sans-serif',
                color: '#ffd700',
                stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
        } else if (isOwned) {
            this.createCardButton(btnX, btnY, 160, 50, '선택', 0xffd700, '#000000',
                () => this.handleSelect(charDef.id));
        } else {
            // 가격 라벨 (버튼 위)
            const priceLabel = this.formatPrice(price);
            this.add.text(btnX, y + CARD_H / 2 - 75, priceLabel, {
                font: 'bold 20px sans-serif',
                color: canAfford ? '#ffd700' : '#888888',
                stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);

            const btnColor = canAfford ? 0x4caf50 : 0x666666;
            const btnLabel = canAfford ? '구매' : '잔액 부족';
            const btnTextColor = canAfford ? '#ffffff' : '#cccccc';
            this.createCardButton(btnX, btnY, 160, 50, btnLabel, btnColor, btnTextColor,
                canAfford ? () => this.handlePurchase(charDef.id) : null);
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 가격 포맷 + 잔액 충분한지
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    formatPrice(price) {
        if (!price) return '';
        const t = price.type;
        const a = price.amount || 0;
        if (t === 'free')    return '무료';
        if (t === 'coin')    return `🪙 ${a.toLocaleString()}`;
        if (t === 'relic')   return `🏺 ${a}`;
        if (t === 'diamond') return `💎 ${a}`;
        if (t === 'krw')     return `₩ ${a.toLocaleString()}`;
        return '';
    }

    canAfford(price) {
        if (!price) return false;
        const cm = this.currencyManager;
        const a = price.amount || 0;
        if (price.type === 'free')    return true;
        if (price.type === 'coin')    return cm.coin    >= a;
        if (price.type === 'relic')   return cm.relic   >= a;
        if (price.type === 'diamond') return cm.diamond >= a;
        return false;   // krw는 인앱결제 미연동 → 차단
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 인터랙션
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    handleSelect(id) {
        if (!this.currencyManager.selectCharacter(id)) {
            this.showToast('선택 실패');
            return;
        }
        if (this.soundManager) this.soundManager.playSpeechBubbleSound();
        this.cameras.main.flash(180, 255, 215, 0);
        const def = getCharacterById(id);
        this.showToast(`${def?.name || id} 선택됨!`);
        // 선택 변경 후 카드 외곽선 갱신을 위해 씬 재시작 (간단/안정 — UI state 동기화 부담 X)
        this.time.delayedCall(450, () => this.scene.restart());
    }

    handlePurchase(id) {
        const def = getCharacterById(id);
        if (!def) return;
        if (!this.currencyManager.purchaseCharacter(id)) {
            this.showToast('구매 실패 (잔액 부족 또는 이미 보유)');
            return;
        }
        if (this.soundManager) this.soundManager.playUpgradeSound();
        this.cameras.main.flash(220, 76, 175, 80);
        this.showToast(`🎉 ${def.name} 획득!`);
        // 카드/재화 갱신 위해 재시작
        this.time.delayedCall(550, () => this.scene.restart());
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 카드 안 작은 버튼 (구매/선택)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createCardButton(x, y, w, h, label, fillColor, textColor, onClick) {
        const radius = 12;
        const SHADOW_OFFSET = 5;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.5);
        shadow.fillRoundedRect(x - w / 2, y - h / 2 + SHADOW_OFFSET, w, h, radius);

        const bg = this.add.graphics();
        bg.fillStyle(fillColor, 1);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);

        const txt = this.add.text(x, y, label, {
            font: 'bold 22px sans-serif',
            color: textColor
        }).setOrigin(0.5);

        if (typeof onClick === 'function') {
            // hit area를 시각보다 ±15px 확장 (모바일 손가락 마진)
            const HIT_PAD = 15;
            const hitZone = this.add.zone(x, y, w + HIT_PAD * 2, h + HIT_PAD * 2)
                .setInteractive({ useHandCursor: true });
            // 시각 피드백: pointerdown 시 살짝 작아짐, up 시 복원
            const visualGroup = [bg, txt];
            hitZone.on('pointerdown', () => visualGroup.forEach(g => g.setScale && g.setScale(0.96)));
            const restore = () => visualGroup.forEach(g => g.setScale && g.setScale(1));
            hitZone.on('pointerout', restore);
            hitZone.on('pointerup', () => {
                restore();
                onClick();
            });
            hitZone.on('pointerupoutside', restore);
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 뒤로가기 (메뉴로 복귀)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createBackButton(x, y) {
        const w = 220, h = 60, radius = 14;
        const SHADOW_OFFSET = 6;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x2a1810, 1);
        shadow.fillRoundedRect(x - w / 2, y - h / 2 + SHADOW_OFFSET, w, h, radius);

        const bg = this.add.graphics();
        bg.fillStyle(0x8b5a2b, 1);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
        bg.lineStyle(3, 0x000000, 1);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);

        const txt = this.add.text(x, y, '← 메뉴로', {
            font: 'bold 26px sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);

        const HIT_PAD = 20;
        const hitZone = this.add.zone(x, y, w + HIT_PAD * 2, h + HIT_PAD * 2)
            .setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => { bg.setScale(0.96); txt.setScale(0.96); });
        const restore = () => { bg.setScale(1); txt.setScale(1); };
        hitZone.on('pointerout', restore);
        hitZone.on('pointerupoutside', restore);
        hitZone.on('pointerup', () => {
            restore();
            this.scene.start('MenuScene');
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // "유료 캐릭터 곧 추가" 안내 (그리드 아래)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createComingSoonNote(width, height) {
        // 그리드 끝 + 뒤로가기 버튼 사이 안전 영역
        const gridBottomY = HEADER_H + CARD_H * 3 + CARD_GAP_Y * 2;
        const noteY = (gridBottomY + (height - BACK_BTN_Y_OFFSET - 30)) / 2;
        if (noteY <= gridBottomY + 20) return;   // 화면 너무 좁으면 스킵
        this.add.text(width / 2, noteY,
            '⚔️ 유료 캐릭터 24종은 곧 추가됩니다',
            {
                font: 'italic 18px sans-serif',
                color: '#cccccc'
            }
        ).setOrigin(0.5);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 토스트 (구매/선택 결과 안내, 1.5초 후 페이드아웃)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    showToast(msg) {
        const { width, height } = this.cameras.main;
        if (this.toastText && this.toastText.scene) this.toastText.destroy();
        this.toastText = this.add.text(width / 2, height - BACK_BTN_Y_OFFSET - 80, msg, {
            font: 'bold 22px sans-serif',
            color: '#ffffff',
            backgroundColor: '#000000cc',
            padding: { x: 18, y: 10 },
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(60);
        this.tweens.add({
            targets: this.toastText,
            alpha: 0, y: this.toastText.y - 30,
            delay: 1500, duration: 400,
            onComplete: () => { if (this.toastText) this.toastText.destroy(); }
        });
    }
}
