// 삽질박물관 씬 - 수집한 보물 전시 + 뻘짓 점수 표시
// 그리드: 한 줄 2개. 보물 많을 땐 드래그로 스크롤.
// 카드: 등급별 어두운 배경 + 컬러 테두리 (보물 팝업과 톤 통일)
import Phaser from 'phaser';
import CurrencyManager from '../managers/CurrencyManager.js';

// 등급별 카드 스타일 (border 색을 fill alpha 0.15 + stroke 0.85에 함께 사용 → 유리 장식장 톤)
const RARITY_STYLES = {
    legendary: { border: 0xFFD700, accent: '#FFD700', label: '전설', score: 10  },
    epic:      { border: 0x9B59B6, accent: '#c77dff', label: '에픽', score: 30  },
    rare:      { border: 0x3498DB, accent: '#7df9ff', label: '희귀', score: 50  },
    common:    { border: 0x95A5A6, accent: '#cccccc', label: '일반', score: 100 }
};

// 그리드 레이아웃 상수
const GRID_COLS         = 2;
const CARD_W            = 320;
const CARD_H            = 240;
const CARD_GAP_X        = 30;
const CARD_GAP_Y        = 25;
const VIEWPORT_TOP      = 240;     // 헤더 영역 아래 (고정)
const BACK_BTN_RESERVE  = 120;     // 뒤로 버튼 + 패딩 영역 (하단 동적 계산용)
const HEADER_BG_COLOR   = 0x3a2515;

export default class MuseumScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MuseumScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        this.currencyManager = new CurrencyManager();
        const treasures = (this.currencyManager.collectedTreasures || []).slice();

        // 등급 가중치로 정렬 (legendary > epic > rare > common, 같으면 발견 시각 역순)
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
        treasures.sort((a, b) => {
            const ra = rarityOrder[a.rarity] ?? 99;
            const rb = rarityOrder[b.rarity] ?? 99;
            if (ra !== rb) return ra - rb;
            return (b.foundAt || 0) - (a.foundAt || 0);
        });

        // ━━━ 배경 ━━━
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a0a00);

        // ━━━ 헤더 (스크롤 위에 고정) ━━━
        this.add.rectangle(width / 2, 105, width, 220, HEADER_BG_COLOR);

        // 타이틀
        this.add.text(width / 2, 60, '⛏️ 삽질박물관', {
            font: 'bold 52px sans-serif',
            color: '#ffd700',
            stroke: '#5a2d0c', strokeThickness: 6
        }).setOrigin(0.5);

        // 통계 라인 (보물 종류 / 뻘짓 점수)
        const uniqueCount = this.currencyManager.getUniqueTreasureCount();
        const sillyScore  = this.currencyManager.getSillyScore();

        this.add.text(width / 2, 130, `🏺 수집한 보물 ${uniqueCount}종`, {
            font: 'bold 28px sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(width / 2, 170, `🎭 뻘짓 점수 ${sillyScore.toLocaleString()}점`, {
            font: 'bold 26px sans-serif',
            color: '#ffd700',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);

        // ━━━ 그리드 (스크롤 컨테이너) ━━━
        if (treasures.length === 0) {
            this.showEmptyState(width, height);
        } else {
            this.buildScrollableGrid(treasures, width, height);
        }

        // ━━━ 뒤로가기 버튼 ━━━
        this.createBackButton(width / 2, height - 60);
    }

    // 보물 0개일 때 빈 상태 안내
    showEmptyState(width, height) {
        const viewportBottom = height - BACK_BTN_RESERVE;
        const cy = (VIEWPORT_TOP + viewportBottom) / 2;

        this.add.text(width / 2, cy - 50, '🔍', {
            font: '120px sans-serif'
        }).setOrigin(0.5);

        this.add.text(width / 2, cy + 50, '아직 발굴한 보물이 없어요!', {
            font: 'bold 30px sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(width / 2, cy + 100, '게임에서 5% 확률로 보물이 나옵니다', {
            font: '22px sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);
    }

    // 보물 카드들을 컨테이너에 담고 마스크 + 드래그로 스크롤
    buildScrollableGrid(treasures, width, height) {
        // 뷰포트 하단을 캔버스 height 기준으로 동적 계산
        // → 1180 하드코딩 시 실제 캔버스가 더 클 때 카드들이 일찍 잘려서
        //   "검은 박스가 보물을 가린 것처럼" 보이는 문제 해결
        const viewportBottom = height - BACK_BTN_RESERVE;
        const viewportH = viewportBottom - VIEWPORT_TOP;

        // 마스크 (뷰포트 영역만 보이도록 클립)
        const maskShape = this.make.graphics({ x: 0, y: 0 }).setVisible(false);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(0, VIEWPORT_TOP, width, viewportH);
        const mask = maskShape.createGeometryMask();

        // 컨테이너 - 카드들을 안에 담음. y가 변하면 스크롤됨
        this.scrollContainer = this.add.container(0, VIEWPORT_TOP + 30);
        this.scrollContainer.setMask(mask);

        // 카드 배치
        const totalRowSpan = CARD_H + CARD_GAP_Y;
        const cardOffsetX = (width - GRID_COLS * CARD_W - (GRID_COLS - 1) * CARD_GAP_X) / 2;

        treasures.forEach((t, i) => {
            const row = Math.floor(i / GRID_COLS);
            const col = i % GRID_COLS;
            const cx  = cardOffsetX + col * (CARD_W + CARD_GAP_X) + CARD_W / 2;
            const cy  = row * totalRowSpan + CARD_H / 2;
            const card = this.createTreasureCard(t, cx, cy);
            this.scrollContainer.add(card);
        });

        // 스크롤 한계 계산
        const totalRows  = Math.ceil(treasures.length / GRID_COLS);
        const totalH     = totalRows * totalRowSpan - CARD_GAP_Y;
        const scrollMin  = Math.min(0, viewportH - 30 - totalH);  // 음수 (위로 올림)
        const scrollMax  = 0;
        const startY     = VIEWPORT_TOP + 30;

        // 드래그 스크롤 - 뷰포트 영역에 invisible zone
        const dragZone = this.add.zone(width / 2, VIEWPORT_TOP + viewportH / 2, width, viewportH)
            .setInteractive();

        let dragStartY    = null;
        let scrollStartY  = null;
        this.isDragging   = false;

        dragZone.on('pointerdown', (p) => {
            dragStartY = p.y;
            scrollStartY = this.scrollContainer.y;
            this.isDragging = false;
        });

        this.input.on('pointermove', (p) => {
            if (dragStartY == null || !p.isDown) return;
            const dy = p.y - dragStartY;
            if (Math.abs(dy) > 5) this.isDragging = true;
            if (this.isDragging) {
                this.scrollContainer.y = Phaser.Math.Clamp(
                    scrollStartY + dy,
                    startY + scrollMin,
                    startY + scrollMax
                );
            }
        });

        this.input.on('pointerup', () => {
            dragStartY = null;
        });
    }

    // 보물 카드 1장 (Container) - 등급별 색상 + 5필드 (등급/이름/레이어/설명/점수)
    createTreasureCard(treasure, x, y) {
        const style = RARITY_STYLES[treasure.rarity] || RARITY_STYLES.common;
        const card = this.add.container(x, y);
        const radius = 12;

        // 카드 배경 (둥근 모서리 + 등급 색상 반투명 + 두꺼운 등급 테두리)
        // 검정 바탕 + 네온 외곽이 SF같던 톤 → 등급 색을 alpha 0.15로 살짝 깔아 "유리 장식장" 느낌
        const bg = this.add.graphics();
        bg.fillStyle(style.border, 0.15);
        bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, radius);
        bg.lineStyle(3, style.border, 0.85);
        bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, radius);

        // 등급 라벨 (좌상단)
        const rarityTag = this.add.text(-CARD_W / 2 + 14, -CARD_H / 2 + 14, `[${style.label}]`, {
            font: 'bold 18px sans-serif', color: style.accent
        }).setOrigin(0, 0);

        // 보물 이름 (위쪽 중앙, 주인공)
        const name = this.add.text(0, -CARD_H / 2 + 60, treasure.name, {
            font: 'bold 26px sans-serif', color: '#ffffff',
            wordWrap: { width: CARD_W - 30 },
            align: 'center'
        }).setOrigin(0.5);

        // 발견 레이어 (작게)
        const layer = this.add.text(0, -CARD_H / 2 + 105, `📍 ${treasure.layerName || '?'}`, {
            font: '18px sans-serif', color: '#dddddd'
        }).setOrigin(0.5);

        // 웃긴 설명 (이탤릭, 줄바꿈)
        const desc = this.add.text(0, 25, treasure.desc || '', {
            font: 'italic 17px sans-serif', color: '#cccccc',
            wordWrap: { width: CARD_W - 30 },
            align: 'center'
        }).setOrigin(0.5);

        // 뻘짓 점수 (하단)
        const sillyText = this.add.text(0, CARD_H / 2 - 25, `🎭 뻘짓 +${style.score}점`, {
            font: 'bold 20px sans-serif', color: '#ffd700'
        }).setOrigin(0.5);

        card.add([bg, rarityTag, name, layer, desc, sillyText]);

        // 같은 보물 여러 번 발견 시 우상단에 x{count} 표시
        if (treasure.count && treasure.count > 1) {
            const countBadge = this.add.text(CARD_W / 2 - 14, -CARD_H / 2 + 14, `x${treasure.count}`, {
                font: 'bold 18px sans-serif', color: '#ffd700'
            }).setOrigin(1, 0);
            card.add(countBadge);
        }

        return card;
    }

    // 메인 메뉴로 돌아가는 버튼 - 스크롤과 무관하게 항상 화면 하단에 고정
    createBackButton(x, y) {
        const btn = this.add.text(x, y, '⬅ 메인 메뉴', {
            font: 'bold 30px sans-serif',
            color: '#ffffff',
            backgroundColor: '#5a2d0c',
            padding: { x: 28, y: 16 }
        }).setOrigin(0.5)
          .setScrollFactor(0)                  // 카메라 스크롤 영향 받지 않음 (UI 고정)
          .setDepth(200)                       // 보물 카드 / 마스크 위에 항상 보이게
          .setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => btn.setAlpha(0.7));
        btn.on('pointerout', () => btn.setAlpha(1));
        btn.on('pointerup', () => {
            btn.setAlpha(1);
            this.scene.start('MenuScene');
        });
    }
}
