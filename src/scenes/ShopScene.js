// 상점 씬 - 삽 업그레이드 (MVP)
// 추후 캐릭터 / 부적 / 시즌패스 등 확장 예정
import Phaser from 'phaser';
import CurrencyManager from '../managers/CurrencyManager.js';
import SoundManager from '../managers/SoundManager.js';
import { SHOVELS } from '../data/shovels.js';

export default class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
        this.currencyManager = null;
        this.soundManager = null;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.soundManager = new SoundManager(this);

        this.currencyManager = new CurrencyManager();

        // 배경
        this.add.rectangle(width / 2, height / 2, width, height, 0x4a3520);

        // 타이틀
        this.add.text(width / 2, 70, '🔨 상점', {
            font: 'bold 56px sans-serif',
            color: '#ffd700',
            stroke: '#5a2d0c', strokeThickness: 6
        }).setOrigin(0.5);

        // 코인 표시 (실시간 갱신용 보관)
        this.coinText = this.add.text(width / 2, 145, `🪙 ${this.currencyManager.coin.toLocaleString()}`, {
            font: 'bold 36px sans-serif',
            color: '#ffffff',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        // 부제
        this.add.text(width / 2, 210, '━━ 삽 업그레이드 ━━', {
            font: 'bold 26px sans-serif',
            color: '#ffd700'
        }).setOrigin(0.5);

        // 삽 카드 3장 — 카드 모서리(둥근) + 상단 스트로크가 "삽 업그레이드" 헤더와 닿지 않게 320→360
        const cardStartY = 360;
        const cardSpacing = 230;
        SHOVELS.forEach((shovel, i) => {
            this.createShovelCard(shovel, width / 2, cardStartY + i * cardSpacing);
        });

        // 뒤로 가기 버튼
        this.createBackButton(width / 2, height - 80);
    }

    // 삽 카드 1장 (둥근 흙색 패널 + 상태별 테두리 + 우측 뱃지/3D 구매 버튼)
    // 레이아웃: [아이콘 컬럼 130px] [텍스트 컬럼 350px] [버튼 컬럼 160px] = 640
    createShovelCard(shovel, x, y) {
        const cardW  = 640;
        const cardH  = 200;
        const radius = 16;

        // 컬럼 경계 (카드 좌측 기준 상대좌표)
        const ICON_COL_W = 130;
        const BTN_COL_W  = 160;
        const TEXT_PAD   = 20;
        const iconCenterRelX = ICON_COL_W / 2;
        const textStartRelX  = ICON_COL_W + TEXT_PAD;
        const btnCenterRelX  = cardW - BTN_COL_W / 2;

        const myLevel = this.currencyManager.shovelLevel;

        const isCurrent = shovel.level === myLevel;
        const isOwned   = shovel.level < myLevel;
        const isBuyable = shovel.level > myLevel;
        const canAfford = isBuyable && this.currencyManager.coin >= shovel.cost;

        // ━━ 카드 배경 (둥근 모서리 + 어두운 흙색 통일 + 상태별 테두리) ━━
        // 쨍한 초록 덮어씌움 대신, 어두운 패널 위에 상태색을 테두리로만 강조 → 톤 충돌 해소
        const bg = this.add.graphics();
        bg.fillStyle(0x3e2723, 1); // 짙은 나무/흙 색 (모든 상태 공통)
        bg.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);

        if (isCurrent) {
            bg.lineStyle(4, 0x4caf50, 1);   // 사용중 - 두꺼운 초록 테두리로 강조
        } else if (isOwned) {
            bg.lineStyle(3, 0xa67c52, 1);   // 보유중 - 은은한 황토색
        } else {
            bg.lineStyle(2, 0x8b5a2b, 1);   // 미보유 - 일반 갈색
        }
        bg.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);

        // ━━ 아이콘 컬럼 ━━
        this.add.text(x - cardW / 2 + iconCenterRelX, y, shovel.icon, {
            font: '56px sans-serif'
        }).setOrigin(0.5);

        // ━━ 텍스트 컬럼 ━━
        const textX = x - cardW / 2 + textStartRelX;

        this.add.text(textX, y - 50, shovel.name, {
            font: 'bold 32px sans-serif',
            color: '#ffffff',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0, 0.5);

        this.add.text(textX, y - 5, shovel.desc, {
            font: '20px sans-serif',
            color: '#dddddd'
        }).setOrigin(0, 0.5);

        if (shovel.cost > 0) {
            this.add.text(textX, y + 38, `🪙 ${shovel.cost.toLocaleString()}`, {
                font: 'bold 24px sans-serif',
                color: canAfford || isOwned || isCurrent ? '#ffd700' : '#aa5555'
            }).setOrigin(0, 0.5);
        }

        // ━━ 우측 컬럼: 상태에 따라 뱃지 or 3D 버튼 ━━
        const btnX = x - cardW / 2 + btnCenterRelX;
        if (isCurrent) {
            this._createBadge(btnX, y, BTN_COL_W - 20, 64, '✓ 사용중', 0x4caf50, '#ffffff');
        } else if (isOwned) {
            this._createBadge(btnX, y, BTN_COL_W - 20, 64, '보유중', 0x666666, '#ffffff');
        } else if (canAfford) {
            // 구매 가능 → 통통 튀는 3D 버튼
            this._create3DButton(
                btnX, y, BTN_COL_W - 20, 64,
                '구매',
                0xffcc00, 0xc49a00,
                () => this.purchase(shovel.level)
            );
        } else {
            this._createBadge(btnX, y, BTN_COL_W - 20, 64, '코인 부족', 0x884444, '#ffffff');
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 비인터랙티브 둥근 뱃지 (사용중/보유중/코인부족 표시용)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    _createBadge(x, y, w, h, text, fillColor, textColor) {
        const radius = 14;
        const g = this.add.graphics();
        g.fillStyle(fillColor, 1);
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
        this.add.text(x, y, text, {
            font: 'bold 22px sans-serif',
            color: textColor
        }).setOrigin(0.5);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3D 라운드 버튼 (그림자판 + 상단판 + scale 눌림 피드백)
    // 모바일 터치 안정성을 위해 y-shift 애니 대신 container.scale 사용
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    _create3DButton(x, y, w, h, text, colorTop, colorBottom, onClick) {
        const container = this.add.container(x, y);
        const radius = 14;
        const SHADOW_OFFSET = 6;

        const shadow = this.add.graphics();
        shadow.fillStyle(colorBottom, 1);
        shadow.fillRoundedRect(-w / 2, -h / 2 + SHADOW_OFFSET, w, h, radius);

        const top = this.add.graphics();
        top.fillStyle(colorTop, 1);
        top.fillRoundedRect(-w / 2, -h / 2, w, h, radius);

        const label = this.add.text(0, 0, text, {
            font: 'bold 24px sans-serif',
            color: '#5a2d0c'
        }).setOrigin(0.5);

        container.add([shadow, top, label]);

        container.setInteractive(
            new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h + SHADOW_OFFSET),
            Phaser.Geom.Rectangle.Contains
        );

        container.on('pointerdown',      () => container.setScale(0.96));
        container.on('pointerout',       () => container.setScale(1));
        container.on('pointerupoutside', () => container.setScale(1));
        container.on('pointerup', () => {
            container.setScale(1);
            if (onClick) onClick();
        });

        return container;
    }

    // 구매 처리 → 성공 시 씬 재시작 (UI 자동 갱신)
    purchase(targetLevel) {
        const success = this.currencyManager.upgradeShovel(targetLevel);
        if (success) {
            // 업그레이드 임팩트 사운드 (쾅! + 상승음)
            if (this.soundManager) this.soundManager.playUpgradeSound();
            // 가벼운 피드백 후 씬 재시작 (HUD 갱신, 카드 상태 자동 반영)
            this.cameras.main.flash(150, 255, 215, 0); // 황금 플래시
            this.time.delayedCall(180, () => this.scene.restart());
        } else {
            this.cameras.main.shake(200, 0.005);
        }
    }

    createBackButton(x, y) {
        // 카메라 스크롤과 무관하게 항상 화면 하단에 고정 (setScrollFactor(0))
        // 추후 스크롤 도입 시에도 안전하게 보임
        const btn = this.add.text(x, y, '⬅ 메인 메뉴', {
            font: 'bold 30px sans-serif',
            color: '#ffffff',
            backgroundColor: '#5a2d0c',
            padding: { x: 28, y: 16 }
        }).setOrigin(0.5)
          .setScrollFactor(0)                  // 카메라 따라가지 않음 = UI 고정
          .setDepth(200)                       // 다른 컨텐츠 위로
          .setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => btn.setAlpha(0.7));
        btn.on('pointerout', () => btn.setAlpha(1));
        btn.on('pointerup', () => {
            btn.setAlpha(1);
            this.scene.start('MenuScene');
        });
    }
}
