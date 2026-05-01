// 메인 메뉴 씬 - layer_001_bg 배경 + 좌측 세로 버튼 + 우측 캐릭터(번아웃 말풍선)
// 진입 시 메뉴 BGM 재생, 오프라인 보상 팝업 자동 검사
// 게임 시작 버튼 탭 시 풀스크린 요청 (브라우저 주소창 숨기기)
import Phaser from 'phaser';
import CurrencyManager from '../managers/CurrencyManager.js';
import OfflineRewardManager from '../managers/OfflineRewardManager.js';
import SoundManager from '../managers/SoundManager.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // ━━━━ 1) 배경 - layer_001_bg cover-fit + 어두운 반투명 오버레이 0.45 ━━━━
        if (this.textures.exists('layer_001_bg')) {
            const bg = this.add.image(width / 2, height / 2, 'layer_001_bg').setOrigin(0.5);
            // 비율 유지 cover-fit (CSS background-size: cover와 동일)
            const sw = bg.width, sh = bg.height;
            if (sw && sh) {
                const scale = Math.max(width / sw, height / sh);
                bg.setScale(scale);
            }
        } else {
            // 폴백 색
            this.add.rectangle(width / 2, height / 2, width, height, 0x5a2d0c);
        }
        // 가독성용 어두운 오버레이 rgba(0, 0, 0, 0.45)
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45);

        // ━━━━ 2) 타이틀 (화면 상단 25%, 황금색, 검정 외곽 8px, 둥실둥실 floating) ━━━━
        const titleContainer = this.add.container(width / 2, height * 0.25);

        // 그림자 (입체감)
        const titleShadow = this.add.text(4, 4, '삽질왕', {
            font: 'bold 120px sans-serif',
            color: '#000000'
        }).setOrigin(0.5);

        // 본 타이틀 #FFD700 + 검정 외곽 8px
        const titleMain = this.add.text(0, 0, '삽질왕', {
            font: 'bold 120px sans-serif',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        // 서브타이틀 흰색 36px
        const subtitle = this.add.text(0, 80, 'Just Dig It', {
            font: 'bold 36px sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        titleContainer.add([titleShadow, titleMain, subtitle]);

        // 둥실둥실 floating 애니메이션 (y±8, 1초 yo-yo = 총 2초 한 사이클)
        this.tweens.add({
            targets: titleContainer,
            y: titleContainer.y - 8,
            duration: 1000,
            ease: 'Sine.inOut',
            yoyo: true,
            repeat: -1
        });

        // ━━━━ 3) 박삽돌 캐릭터 - 우측 하단, 화면 40% 크기, 5° 기울임 + 말풍선 ━━━━
        if (this.textures.exists('char_001_idle')) {
            const charX = width * 0.78;
            const charY = height * 0.74;
            const char = this.add.image(charX, charY, 'char_001_idle').setOrigin(0.5);

            // 세로 = 화면 높이의 40%, 가로는 비율 유지
            const targetH = height * 0.40;
            const ratio = char.width / char.height;
            char.setDisplaySize(targetH * ratio, targetH);
            char.setAngle(5); // 삽에 기댄 듯 살짝 우측 기울임

            // 말풍선 (캐릭터 머리 위)
            const bubbleY = charY - char.displayHeight * 0.55;
            this.createSpeechBubble(charX - 20, bubbleY, '...번아웃...');
        }

        // ━━━━ 4) 좌측 세로 버튼 4개 (둥근 사각 + 아이콘) ━━━━
        const btnW = Math.floor(width * 0.55);
        const btnH = 80;
        const btnX = btnW / 2 + 22;          // 좌측 22px 마진
        const btnYs = [560, 660, 760, 860];   // 100px 간격

        this.createIconButton(btnX, btnYs[0], btnW, btnH, '⛏️', '게임 시작', () => {
            // 풀스크린 요청 후 GameScene 전환
            this.tryRequestFullscreen();
            this.scene.start('GameScene');
        });
        this.createIconButton(btnX, btnYs[1], btnW, btnH, '👷', '캐릭터', () => {
            console.log('CharacterScene 미구현');
        });
        this.createIconButton(btnX, btnYs[2], btnW, btnH, '🛒', '상점', () => {
            this.scene.start('ShopScene');
        });
        this.createIconButton(btnX, btnYs[3], btnW, btnH, '🏛️', '삽질박물관', () => {
            this.scene.start('MuseumScene');
        });

        // ━━━━ 5) BGM/SFX 시스템 (기존 유지) ━━━━
        this.soundManager = new SoundManager(this);
        this.soundManager.playBGM('bgm_menu');
        this.createBGMToggleButton(width - 60, 60);

        // ━━━━ 6) 오프라인 보상 검사 (기존 시스템) ━━━━
        const cm = new CurrencyManager();
        const orm = new OfflineRewardManager(cm);
        const reward = orm.getPendingReward();
        if (reward > 0) {
            this.soundManager.playOfflineRewardSound();
            this.showOfflineRewardPopup(reward, orm.formatElapsed(), () => orm.claim());
        } else {
            orm.markSeen();
        }
        if (!this._beforeunloadHooked) {
            window.addEventListener('beforeunload', () => orm.markSeen());
            this._beforeunloadHooked = true;
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 풀스크린 요청 (브라우저별 prefix 처리, 사용자 제스처 컨텍스트에서만 동작)
    // 실패해도 게임은 정상 진행 (try/catch + .catch())
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    tryRequestFullscreen() {
        const el = document.documentElement;
        try {
            if (el.requestFullscreen) {
                const p = el.requestFullscreen();
                if (p && p.catch) p.catch(() => {});
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (el.msRequestFullscreen) {
                el.msRequestFullscreen();
            }
        } catch (e) {}
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3D 라운드 버튼 (그림자판 + 상단판 + scale 눌림 피드백)
    // 클릭 안정성을 위해 y-shift 애니 대신 container.scale 사용
    //   → 모바일 터치에서 y-shift는 pointer 이벤트와 미묘하게 충돌해 1탭 누락 발생
    //   → scale 0.96 짧게 줬다 복귀 + pointerup 항상 onClick 호출 패턴이 가장 안정
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createIconButton(x, y, w, h, icon, label, onClick) {
        const container = this.add.container(x, y);
        const radius = 16;
        const colorTop    = 0xFFD700;
        const colorBottom = 0xc49a00;
        const SHADOW_OFFSET = 6;

        // 하단 그림자판 (정적 — 입체 레이어드 비주얼)
        const shadow = this.add.graphics();
        shadow.fillStyle(colorBottom, 1);
        shadow.fillRoundedRect(-w / 2, -h / 2 + SHADOW_OFFSET, w, h, radius);

        // 상단판
        const top = this.add.graphics();
        top.fillStyle(colorTop, 1);
        top.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        top.lineStyle(3, 0x000000, 1);
        top.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

        // 아이콘 + 라벨
        const iconText = this.add.text(-w / 2 + 50, 0, icon, {
            font: '38px sans-serif'
        }).setOrigin(0.5);
        const labelText = this.add.text(-w / 2 + 100, 0, label, {
            font: 'bold 34px sans-serif',
            color: '#000000'
        }).setOrigin(0, 0.5);

        container.add([shadow, top, iconText, labelText]);

        // 히트 영역 (그림자 SHADOW_OFFSET 포함)
        container.setSize(w, h + SHADOW_OFFSET);
        container.setInteractive(
            new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h + SHADOW_OFFSET),
            Phaser.Geom.Rectangle.Contains
        );

        // scale 기반 눌림 피드백 — 가장 안정적인 패턴
        container.on('pointerdown',      () => container.setScale(0.96));
        container.on('pointerout',       () => container.setScale(1));
        container.on('pointerupoutside', () => container.setScale(1));
        container.on('pointerup', () => {
            container.setScale(1);
            if (onClick) onClick();
        });

        return container;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 말풍선 (둥근 흰색 사각 + 아래 꼬리 + 텍스트)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createSpeechBubble(x, y, text) {
        const container = this.add.container(x, y).setDepth(20);
        const bw = 220, bh = 60;
        const g = this.add.graphics();

        // 흰색 배경 + 검정 외곽
        g.fillStyle(0xffffff, 0.95);
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
        g.lineStyle(3, 0x000000, 1);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);

        // 아래 꼬리 (말풍선이 캐릭터를 가리키도록)
        g.fillStyle(0xffffff, 0.95);
        g.fillTriangle(-12, bh / 2 - 1, 12, bh / 2 - 1, 0, bh / 2 + 18);
        g.lineStyle(3, 0x000000, 1);
        g.lineBetween(-12, bh / 2 - 1, 0, bh / 2 + 18);
        g.lineBetween(12, bh / 2 - 1, 0, bh / 2 + 18);

        const txt = this.add.text(0, 0, text, {
            font: 'bold 24px sans-serif',
            color: '#5a2d0c'
        }).setOrigin(0.5);

        container.add([g, txt]);

        // 살짝 둥실둥실 (캐릭터 위에서 흔들림)
        this.tweens.add({
            targets: container,
            y: y - 5,
            duration: 1400,
            ease: 'Sine.inOut',
            yoyo: true,
            repeat: -1
        });

        return container;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BGM ON/OFF 토글 (우상단, 검정 배경 더 어둡게 - 0.45 오버레이 위에서도 잘 보임)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createBGMToggleButton(x, y) {
        const updateIcon = () => {
            this.bgmToggleBtn.setText(this.soundManager.isBGMMuted ? '🔇' : '🔊');
        };

        // 더 어두운 검정 배경 (0.7 alpha) + 황금 테두리
        this.add.circle(x, y, 38, 0x000000, 0.75)
            .setStrokeStyle(3, 0xffd700)
            .setDepth(50);

        this.bgmToggleBtn = this.add.text(x, y, '🔊', {
            font: '40px sans-serif'
        }).setOrigin(0.5)
          .setDepth(51)
          .setInteractive({ useHandCursor: true });

        updateIcon();

        this.bgmToggleBtn.on('pointerdown', () => this.bgmToggleBtn.setAlpha(0.6));
        this.bgmToggleBtn.on('pointerout',  () => this.bgmToggleBtn.setAlpha(1));
        this.bgmToggleBtn.on('pointerup',   () => {
            this.bgmToggleBtn.setAlpha(1);
            this.soundManager.toggleBGM();
            updateIcon();
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 오프라인 보상 팝업 (기존 시스템 유지)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    showOfflineRewardPopup(rewardCoin, elapsedStr, onClaim) {
        const { width, height } = this.cameras.main;

        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setInteractive({ useHandCursor: true })
            .setDepth(100);

        const card = this.add.container(width / 2, height / 2).setDepth(101);
        const cardW = width * 0.84;
        const cardH = 480;

        const cardBg = this.add.rectangle(0, 0, cardW, cardH, 0x2a1a0a, 1)
            .setStrokeStyle(6, 0xffd700);

        const sleepIcon = this.add.text(0, -160, '💤', { font: '96px sans-serif' }).setOrigin(0.5);

        const line1 = this.add.text(0, -50, '오프라인 동안', {
            font: 'bold 32px sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        const line2 = this.add.text(0, -10, '박삽돌이 혼자 팠어요!', {
            font: 'bold 32px sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        const elapsed = this.add.text(0, 40, `(${elapsedStr} 동안)`, {
            font: '22px sans-serif', color: '#cccccc'
        }).setOrigin(0.5);

        const reward = this.add.text(0, 110, `🪙 +${rewardCoin.toLocaleString()} 삽코인 획득!`, {
            font: 'bold 36px sans-serif', color: '#ffd700',
            stroke: '#5a2d0c', strokeThickness: 5
        }).setOrigin(0.5);

        const tapHint = this.add.text(0, 195, '👆 탭해서 받기', {
            font: 'italic 22px sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);

        card.add([cardBg, sleepIcon, line1, line2, elapsed, reward, tapHint]);

        card.setScale(0.6);
        card.alpha = 0;
        this.tweens.add({
            targets: card, scale: 1, alpha: 1,
            duration: 350, ease: 'Back.out'
        });

        overlay.once('pointerdown', () => {
            // 즉시 입력 차단 해제 → 200ms 페이드 동안 추가 탭이 메뉴 버튼으로 통과되도록
            overlay.disableInteractive();
            if (typeof onClaim === 'function') onClaim();
            this.tweens.add({
                targets: [card, overlay],
                alpha: 0, scale: 0.85,
                duration: 200,
                onComplete: () => {
                    card.destroy();
                    overlay.destroy();
                }
            });
        });
    }
}
