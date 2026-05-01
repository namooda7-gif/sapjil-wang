// 핵심 게임 씬 - 탭 → 삽질 → 코인 획득 (가장 중요!)
// layers.js의 레이어 객체와 연결되어 배경/필요삽질수/사운드/코믹이벤트/보물이 자동 적용됨
import Phaser from 'phaser';
import SoundManager from '../managers/SoundManager.js';
import CurrencyManager from '../managers/CurrencyManager.js';
import {
    getLayerByOrder,
    rollTreasureRarity,
    rollTreasureFromLayer,
    TREASURE_RARITY
} from '../data/layers.js';

// 보물 출현 기본 확률 (CLAUDE.md: 5%)
const TREASURE_BASE_RATE = 0.05;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 배경 이미지 / 캐릭터 위치 상수 (사장님 명세)
//
// 배경 이미지 구조 (720×2580):
//   - 전체 높이: 2580px (9:16 이미지 2장 이어붙임)
//   - 첫번째 이미지(상단 1290px): 70% 지상(하늘+건물) + 30% 지하
//   - 두번째 이미지(하단 1290px): 100% 지하
//   - 지표면 라인 위치: 상단 903px 지점 (= 1290 × 0.70)
//
// TileSprite 설정:
//   - tileScaleX = tileScaleY = 1.0 (균일 스케일, 왜곡 0)
//     → 게임 가로(720) ÷ 이미지 가로(720) = 1.0
//   - 초기 tilePositionY = 0 (이미지 상단부터 화면에 표시)
//
// 캐릭터 위치 (origin 0.5, 1.0 = 가로 중앙 + 세로 발 기준):
//   - character.y = 903 (고정, 화면 사이즈 무관)
//   - 즉 캐릭터 발이 항상 게임 y 좌표 903 = 지표면 라인 위
//
// 동작:
//   - 탭할수록 tilePositionY 증가 → 배경 텍스처 위로 스크롤
//   - 지표면이 game y 903에서 위로 올라감 (= (903 - tilePositionY) × 1.0)
//   - 시각적으로 캐릭터가 점점 지하로 파고 들어가는 느낌
//   - 캐릭터 자체는 game y 903에 가만히 서 있음
//
// 레이어 클리어 시:
//   - tilePositionY = 0 리셋 (새 레이어 이미지 상단부터 다시 시작)
//   - character.y = 903 유지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BG_IMAGE_HEIGHT = 2580;       // 배경 이미지 원본 세로 픽셀
const BG_IMAGE_WIDTH  = 720;        // 배경 이미지 원본 가로 픽셀
const SURFACE_TEXTURE_Y = 903;      // 지표면 라인의 텍스처 row (= 1290 × 0.70)

// 캐릭터를 지표면 위로 살짝 띄우기 위한 오프셋 (사장님 피드백: 화면 세로 약 3%)
//   - 음수 = 위로 이동
//   - 시각적으로 "흙 위에 서 있는" 느낌 (반쯤 묻힌 게 아니라)
//   - 게임 좌표 픽셀 기준이라 화면 사이즈와 무관하게 일관된 위치
const CHARACTER_VERTICAL_OFFSET = -45;
const CHARACTER_Y = SURFACE_TEXTURE_Y + CHARACTER_VERTICAL_OFFSET; // = 903 - 45 = 858

const INITIAL_TILE_POSITION_Y = 0;  // 시작 시 텍스처 스크롤 위치 (이미지 상단부터)

// 하단 HUD(깊이 표시 / 메뉴 버튼) 화면 바닥에서 띄우는 마진 (게임 좌표 px)
//   - 폰 하단의 시스템 UI(제스처 바, 내비 버튼) 영역에 가리지 않도록 충분히 띄움
//   - 30 → 100으로 늘림 (사장님 피드백: 메뉴/지하10m가 절반 잘림)
const HUD_BOTTOM_MARGIN = 100;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 구덩이 시스템 (사장님 명세 - hole.png 이미지 사용)
//   ★ Phaser Graphics 그리기 코드 전부 제거됨, hole.png 한 장으로 교체 ★
//
// 배치:
//   - origin (0.5, 1.0) = 가로 중앙 + 세로 하단 기준
//   - x = character.x
//   - y = character.y + HOLE_Y_OFFSET (발 아래에서 구멍이 감싸는 느낌)
//   - 가로(displayWidth) = 화면 너비 × HOLE_WIDTH_RATIO (고정)
//   - 세로(displayHeight) = 탭에 따라 MIN ~ MAX 범위로 증가
//
// 탭할수록:
//   - displayHeight만 증가 → 구멍이 점점 깊어지는 느낌
//   - 가로는 고정, 비율 안 맞춰도 OK (사장님 명세)
//
// 레이어 클리어 시:
//   - displayHeight 최소값으로 리셋 → 새 레이어 시작 시 구멍 작아짐
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 구덩이 (hole.jpeg) — 높이는 지표면~발끝 동적 계산, 최대 제한 없음
const HOLE_TAPS_TO_MAX       = 100;      // (현재 미사용, 향후 이징용으로 보존)
const HOLE_WIDTH_RATIO       = 0.85;     // 화면 폭 대비 구덩이 너비 (0.75 → 0.85: 좌우도 더 넓게)
const HOLE_MIN_HEIGHT        = 80;       // 최소 높이
const HOLE_MAX_HEIGHT        = 120;      // (현재 미사용)
const HOLE_Y_OFFSET          = 35;       // 캐릭터 발 아래로 구덩이 바닥이 떨어지는 오프셋
const HOLE_PADDING_FACTOR    = 1.25;     // 비례 보정: 이미지 상단 padding을 깊이에 비례해 가림
                                         //   → 깊이 깊어져도 갭 안 생김 (근본 해결)
                                         //   → padding 비율 추정값: 1.25 = 20% padding 가정
                                         //   → 갭 보이면 1.30, 1.35로. 너무 솟구치면 1.20, 1.15로

// ━━ 흙더미 시스템 (mound_right.png 이미지) ━━
//   - 오른쪽용 1장만 로드, 왼쪽은 flipX로 좌우 반전 재활용
//   - 탭에 따라 scale 증가 (Cubic Ease-out)
//   - 색상은 setTint로 레이어 색 반영
//   - 캐릭터와 살짝 겹치도록 음수 갭 → 원근감/입체감
const MOUND_TAPS_TO_MAX     = 100;
const MOUND_MIN_SCALE       = 0.05;
const MOUND_MAX_SCALE       = 0.35;      // 캐릭터를 너무 압도하지 않게 조절
const MOUND_GAP_FROM_CHAR   = -10;       // 음수 = 캐릭터와 겹침 → 입체감 부여

// 레이어별 흙더미 tint 색상 (사장님 명세)
const MOUND_LAYER_COLORS = {
    'layer_001': 0x8B4513,   // 진한 갈색
    'layer_002': 0xC2B280,   // 모래색
    'layer_003': 0x556B2F,   // 흙+풀 섞인 색
    'layer_004': 0x8B4513,   // 타일 아래 흙
    'layer_005': 0x696969,   // 단단한 흙
    'layer_006': 0x4A4A4A    // 콘크리트
};

// soilType → 흙 파티클 색상 팔레트 (3색 변주로 풍부함 + 시각 다양성)
// 각 발사마다 이 셋 중 랜덤 픽 → 같은 흙도 입자마다 미묘하게 다른 색
const SOIL_TYPE_COLORS = {
    dirt:     [0x6b4423, 0x8b5a2b, 0x4a2f1a],   // 갈색 톤 3종
    sand:     [0xd4a574, 0xe8c190, 0xc09060],   // 모래 톤
    tile:     [0xc89640, 0xe0b060, 0xa07020],   // 황토타일
    concrete: [0x707070, 0x909090, 0x505050],   // 콘크리트 회색
    rock:     [0x5a5a5a, 0x7a7a7a, 0x3a3a3a],   // 돌 짙은 회색
    lava:     [0xcc4422, 0xff6633, 0x992200]    // 용암 빨강~주황
};

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        this.layerOrder = 1;            // 현재 레이어 번호 (1~)
        this.layerData = null;          // layers.js의 현재 레이어 객체
        this.digCount = 0;              // 현재 레이어 삽질 횟수
        this.combo = 0;                 // 연속 콤보
        this.lastDigTime = 0;           // 마지막 탭 시각
        this.comboWindow = 1500;        // 콤보 유지 시간(ms)

        this.firedComicTriggers = new Set(); // 이번 레이어에서 이미 발동한 코믹 트리거 값들
        this.treasurePopupActive = false;    // 보물 팝업이 떠있는 동안 입력 차단
        this.comicBubble = null;             // 현재 떠있는 NPC 말풍선 컨테이너

        this.clearActive = false;            // 레이어 클리어 연출 진행 중 (입력 차단 + clear 텍스처)
        this.digRevertTimer = null;          // dig 텍스처 → 베이스 상태 복귀 타이머
        this.characterId = 'char_001';       // 현재 캐릭터 ID (추후 캐릭터 선택 시 동적)

        // 흙 파티클 색상 팔레트 (3색, loadLayer에서 soilType 기반 갱신) / 흙더미 단색
        this.currentDirtPalette = SOIL_TYPE_COLORS.dirt;  // [기본, 밝게, 어둡게]
        this.currentMoundColor  = 0x4a2f1a;

        // 캐릭터 좌우 삽질 모션 (탭 시 왼쪽으로 이동 후 복귀)
        this.charBaseX = null;       // 정지 위치 X (create에서 설정)
        this.charMoveTween = null;   // 진행 중인 좌우 이동 트윈

        // 배경 스크롤 TileSprite (create에서 생성)
        this.scrollBg = null;

        // 구덩이 + 흙더미 시스템
        this.holeImage = null;                // 구덩이 Image (hole.png)
        this.leftMound = null;                // 좌 흙더미 Image (mound_right.png + flipX)
        this.rightMound = null;               // 우 흙더미 Image (mound_right.png)
        this.leftMoundBBox = null;            // 파티클 충돌 검사용 (월드 좌표 bbox)
        this.rightMoundBBox = null;

        // 깊이 누적 (탭마다 +10cm) - 세션 동안만 유지
        this.totalDepthCm = 0;
        this.depthText = null;                // create()에서 생성
    }

    create() {
        const { width, height } = this.cameras.main;

        // 매니저 초기화
        this.soundManager = new SoundManager(this);
        this.currencyManager = new CurrencyManager();

        // 배경 (loadLayer에서 색만 갱신) - bgImage 로딩 실패 시 폴백 색
        this.bg = this.add.rectangle(width / 2, height / 2, width, height, 0x6b4423);

        // ━━━ 레이어 배경 이미지 (TileSprite로 무한 세로 스크롤) ━━━
        // 이미지 구조: 상단 72% = 지상 풍경 / 하단 28% = 지하 단면
        // 지표면 라인은 이미지 높이의 72% 지점 → 화면 72% 지점에 맞춰 캐릭터 발이 닿음
        // 탭마다 tilePositionY가 증가 → 텍스처가 위로 스크롤(= 파고 내려가는 느낌)
        // tileScale은 화면을 꽉 채우도록 X/Y 둘 다 스트레치 → 이미지의 72% = 화면의 72% 정확 일치
        this.bgImage = this.add.tileSprite(width / 2, height / 2, width, height, 'layer_001_bg')
            .setOrigin(0.5);
        this.applyBackgroundCoverFit();

        // ━━━ 단색 반투명 오버레이 (배경 사진 위에 흙톤 통일감 부여) ━━━
        // rgba(101, 67, 33, 0.2) → 0x654321 + alpha 0.2
        this.scrollBg = this.add.rectangle(width / 2, height / 2, width, height, 0x654321, 0.2);

        // (구) bgUnder 단색 Rectangle 제거됨 - 배경 이미지 자체에 지하 단면이 포함

        // 상단 HUD (재화)
        this.coinText = this.add.text(30, 30, '🪙 0', {
            font: 'bold 32px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 4
        });
        this.diamondText = this.add.text(30, 75, '💎 0', {
            font: 'bold 28px sans-serif', color: '#7df9ff', stroke: '#000', strokeThickness: 4
        });
        this.relicText = this.add.text(30, 115, '🏺 0', {
            font: 'bold 28px sans-serif', color: '#d2691e', stroke: '#000', strokeThickness: 4
        });

        // 우상단: 레이어 정보
        this.layerText = this.add.text(width - 30, 30, '', {
            font: 'bold 28px sans-serif', color: '#ffffff', stroke: '#000', strokeThickness: 4
        }).setOrigin(1, 0);
        this.layerNameText = this.add.text(width - 30, 65, '', {
            font: '22px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 3
        }).setOrigin(1, 0);
        this.progressText = this.add.text(width - 30, 100, '', {
            font: '24px sans-serif', color: '#ffffff', stroke: '#000', strokeThickness: 3
        }).setOrigin(1, 0);

        // 캐릭터 이미지 (idle 상태로 시작, 상태에 따라 텍스처 자동 교체)
        // 위치: 화면 가로 중앙, 세로 y = CHARACTER_Y(=903) 고정
        //   → 배경 이미지(720×2580)의 지표면 라인(텍스처 row 903)과 정확히 일치
        //   → tilePositionY=0, tileScale=1.0이므로 (903 - 0) × 1.0 = 903이 캐릭터 발 위치
        //   → 화면 사이즈와 무관하게 캐릭터 발은 항상 지표면 위
        // origin (0.5, 1) = 가로 중앙 + 세로 하단 기준 → character.y가 곧 발 위치
        // 크기: 세로 = 화면 높이의 30%, 가로는 원본 비율 유지
        this.character = this.add.image(width / 2, CHARACTER_Y, `${this.characterId}_idle`)
            .setOrigin(0.5, 1);
        // 목표 세로 길이 보관 → 텍스처 교체 시 매번 같은 세로로 재적용
        this.charTargetHeight = height * 0.30;
        this.applyCharacterDisplaySize();
        this.characterBaseScale = this.character.scaleX; // 추가 효과용 보관
        this.charBaseX = this.character.x;               // 좌우 삽질 모션 정지 위치

        // 캐릭터 이름 (발 아래) - origin (0.5, 1)이라 character.y가 발 위치
        this.characterLabel = this.add.text(
            width / 2,
            this.character.y + 20,
            '박삽돌',
            { font: 'bold 24px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 4 }
        ).setOrigin(0.5);

        // ━━━ 구덩이 이미지 + 흙더미 ━━━
        // 위치는 character.x / character.y(=발) 기준
        // 흙더미 X 오프셋은 drawMounds()에서 매 프레임 동적 계산 (현재 스케일 기반)

        // 지하 마스킹 오버레이 (depth 1, 배경 위 / shaft·hole 아래)
        // TileSprite 텍스처가 wrap-around되어 지상 부분이 화면 아래쪽에 보일 때 단색으로 덮음
        // → "거의 다 팠을 때 화면에 지상 이미지가 다시 나타나는" 현상 방지
        this.undergroundOverlay = this.add.graphics().setDepth(1);

        // 구덩이 터널 그래픽스 (현재 미사용 - 만약을 위해 유지)
        this.shaftGraphics = this.add.graphics().setDepth(3);

        // 구덩이 바닥 (hole.jpeg, depth 4)
        // origin (0.5, 1.0) → 이미지 바닥이 y 위치
        // 초기: 가로 = 화면 너비 × 0.65, 세로 = MIN(40px)
        const holeW = width * HOLE_WIDTH_RATIO;
        this.holeImage = this.add.image(
            this.character.x,
            this.character.y + HOLE_Y_OFFSET,
            'hole'
        )
            .setOrigin(0.5, 1.0)
            .setDepth(4)
            .setDisplaySize(holeW, HOLE_MIN_HEIGHT)
            .setVisible(false);

        // 흙더미 좌/우 (mound_right.png, depth 11 = 캐릭터(10)보다 앞)
        // 캐릭터 발 앞쪽에 쌓이는 입체감 → 진짜 땅속에 파묻힌 느낌
        this.leftMound = this.add.image(this.character.x, this.character.y, 'mound_right')
            .setOrigin(0.5, 1)
            .setFlipX(true)
            .setDepth(11)
            .setScale(MOUND_MIN_SCALE)
            .setVisible(false);

        this.rightMound = this.add.image(this.character.x, this.character.y, 'mound_right')
            .setOrigin(0.5, 1)
            .setDepth(11)
            .setScale(MOUND_MIN_SCALE)
            .setVisible(false);

        this.character.setDepth(10); // 캐릭터는 구덩이 위 / 흙더미 아래

        // ━━━ 흙 파티클 (강화: 3배 개수 + 2배 크기 + 더 빠르고 넓게) ━━━
        // 원/사각 두 가지 모양을 섞어서 발사 (혼합 입자 → 다양성)
        if (!this.textures.exists('__dirtParticle')) {
            const ptg = this.make.graphics({ x: 0, y: 0, add: false });
            ptg.fillStyle(0xffffff, 1);
            ptg.fillCircle(7, 7, 7);
            ptg.generateTexture('__dirtParticle', 14, 14);
            ptg.destroy();
        }
        if (!this.textures.exists('__dirtSquare')) {
            const stg = this.make.graphics({ x: 0, y: 0, add: false });
            stg.fillStyle(0xffffff, 1);
            stg.fillRect(2, 2, 10, 10);                       // 안쪽으로 살짝 inset된 사각
            stg.generateTexture('__dirtSquare', 14, 14);
            stg.destroy();
        }

        // 공통 emitter 설정 (원/사각 둘 다 동일 - 단지 텍스처만 다름)
        const dirtConfig = {
            speed: { min: 450, max: 900 },                     // 더 빠르게
            // 좌상/우상 더 넓게 + 위로도 튀어오름 (180~270 = 좌상~위, 270~360 = 위~우상)
            angle: {
                onEmit: () => Math.random() < 0.5
                    ? Phaser.Math.Between(180, 270)
                    : Phaser.Math.Between(270, 360)
            },
            gravityY: 1500,                                    // 강한 중력 → 흙더미에 빨리 쌓이는 느낌
            lifespan: { min: 700, max: 1200 },
            scale: { min: 1.14, max: 2.14 },                   // 16~30px (이전 8~15의 2배)
            alpha: { start: 1, end: 0 },
            rotate: { min: 0, max: 360 },
            // 매 입자마다 팔레트에서 랜덤 픽 → 같은 흙도 미묘한 색 변주로 풍부함
            tint: { onEmit: () => {
                const pal = this.currentDirtPalette;
                return pal[(Math.random() * pal.length) | 0];
            }},
            quantity: 0,
            emitting: false
        };

        this.dirtEmitter       = this.add.particles(0, 0, '__dirtParticle', dirtConfig).setDepth(15);
        this.dirtEmitterSquare = this.add.particles(0, 0, '__dirtSquare',   dirtConfig).setDepth(15);

        // 콤보 표시
        this.comboText = this.add.text(width / 2, height * 0.35, '', {
            font: 'bold 56px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0);

        // 탭 영역 (화면 아래쪽 절반)
        this.tapZone = this.add.rectangle(width / 2, height * 0.75, width, height * 0.5, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        this.tapZone.on('pointerdown', (pointer) => {
            this.dig(pointer.x, pointer.y);
        });

        // 안내 텍스트 (resize 핸들러에서 위치 갱신용으로 인스턴스 필드에 저장)
        this.tapHintText = this.add.text(width / 2, height * 0.92, '👆 화면을 탭해서 삽질!', {
            font: 'bold 28px sans-serif', color: '#ffffff', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        // 현재 깊이 표시 (좌하단, 탭마다 갱신)
        // y는 height - HUD_BOTTOM_MARGIN → 시스템 UI 영역 회피
        this.depthText = this.add.text(30, height - HUD_BOTTOM_MARGIN, '지하 0.0m', {
            font: 'bold 26px sans-serif',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 14, y: 8 },
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 1).setDepth(20);

        // 메뉴 복귀 버튼 (히트 영역 충분히 크게 + depth 20 = HUD 레벨)
        // resize 핸들러에서 위치 갱신용으로 인스턴스 필드에 저장
        // y는 height - HUD_BOTTOM_MARGIN → 시스템 UI 영역 회피
        this.menuBtn = this.add.text(width - 30, height - HUD_BOTTOM_MARGIN, '⬅ 메뉴', {
            font: 'bold 26px sans-serif',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 22, y: 14 }
        }).setOrigin(1, 1)
          .setDepth(20)
          .setInteractive({ useHandCursor: true });
        const menuBtn = this.menuBtn;

        menuBtn.on('pointerdown', () => menuBtn.setAlpha(0.6));
        menuBtn.on('pointerup', () => {
            menuBtn.setAlpha(1);
            this.scene.start('MenuScene');
        });
        menuBtn.on('pointerout', () => menuBtn.setAlpha(1));

        // 모든 의존 객체(라벨/구멍/흙더미) 위치를 캐릭터 y 기준으로 동기화
        // (create 안에서 이미 character.y 기반으로 만들어졌지만 안전망)
        this.updateCharacterDependentPositions();

        // ━━━ 화면 리사이즈 대응 (주소창 토글, 회전 등으로 viewport 변경 시) ━━━
        // main.js의 resize 핸들러가 game.scale.setGameSize 호출 → cameras.main 갱신됨
        // 하지만 씬 안의 bgImage/bg/HUD는 생성 시점 사이즈 그대로라 새 카메라 못 채움
        //   → 화면 아래에 검정 letterbox 보이는 원인
        // 여기서 핸들러 등록 → 카메라 사이즈 바뀔 때마다 자동으로 모든 사이즈 동기화
        this.scale.on('resize', this.handleResize, this);
        // 씬 종료 시 핸들러 해제 (메모리 누수 방지)
        this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this));
        this.events.once('destroy',  () => this.scale.off('resize', this.handleResize, this));

        // 첫 레이어 로드
        this.loadLayer(this.layerOrder);
        this.updateHUD();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 화면 리사이즈 핸들러
    //   - main.js가 viewport 변화 감지 → setGameSize 호출 → 이 핸들러 자동 호출됨
    //   - 모든 화면-의존 객체(배경/HUD/탭존)를 새 사이즈에 맞춰 갱신
    //   - 캐릭터.y는 CHARACTER_Y 고정 (텍스처 좌표 기준이라 화면과 무관)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    handleResize(gameSize) {
        const width  = gameSize.width;
        const height = gameSize.height;

        // 배경 폴백 사각형 + TileSprite 배경 + 흙톤 오버레이 → 모두 새 화면 사이즈로 갱신
        if (this.bg) {
            this.bg.setSize(width, height);
            this.bg.setPosition(width / 2, height / 2);
        }
        if (this.bgImage) {
            this.bgImage.setSize(width, height);
            this.bgImage.setPosition(width / 2, height / 2);
            // 텍스처 사이즈 변경은 없으니 tileScale은 그대로 유지 (1.0 균일)
            // 하지만 안전망으로 재계산
            this.applyBackgroundCoverFit();
        }
        if (this.scrollBg) {
            this.scrollBg.setSize(width, height);
            this.scrollBg.setPosition(width / 2, height / 2);
        }

        // 우상단 HUD (레이어 정보)
        if (this.layerText)     this.layerText.setPosition(width - 30, 30);
        if (this.layerNameText) this.layerNameText.setPosition(width - 30, 65);
        if (this.progressText)  this.progressText.setPosition(width - 30, 100);

        // 화면 중앙 콤보 텍스트
        if (this.comboText) this.comboText.setPosition(width / 2, height * 0.35);

        // 탭 영역 (화면 아래쪽 절반) - 위치 + 사이즈 + 히트 영역까지 갱신
        if (this.tapZone) {
            this.tapZone.setPosition(width / 2, height * 0.75);
            this.tapZone.setSize(width, height * 0.5);
            // 히트 영역도 함께 갱신 (Phaser는 자동 갱신 안 함)
            if (this.tapZone.input && this.tapZone.input.hitArea) {
                this.tapZone.input.hitArea.setTo(0, 0, width, height * 0.5);
            }
        }

        // 안내 텍스트 (탭 힌트)
        if (this.tapHintText) this.tapHintText.setPosition(width / 2, height * 0.92);

        // 좌하단 깊이 표시 + 우하단 메뉴 버튼 (시스템 UI 영역 회피용 마진)
        if (this.depthText) this.depthText.setPosition(30, height - HUD_BOTTOM_MARGIN);
        if (this.menuBtn)   this.menuBtn.setPosition(width - 30, height - HUD_BOTTOM_MARGIN);

        // 캐릭터 라벨 위치 재동기화 (character.y는 안 바뀌지만 width/2 기준 X는 바뀔 수 있음)
        if (this.characterLabel && this.character) {
            this.characterLabel.setPosition(this.character.x, this.character.y + 20);
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 레이어 로딩 (배경/필요삽질수/소일타입 모두 layerData에서 가져옴)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    loadLayer(order) {
        const layer = getLayerByOrder(order);

        // 마지막 레이어 (layer_006) 클리어 후 다음이 없으면 메뉴로 복귀
        if (!layer) {
            const { width, height } = this.cameras.main;
            this.showFloatingText(width / 2, height / 2, '🎉 한국 정복 완료!\n다음 업데이트를 기다려줘!', '#ffd700');
            this.time.delayedCall(2500, () => this.scene.start('MenuScene'));
            return;
        }

        this.layerOrder = order;
        this.layerData = layer;
        this.digCount = 0;
        this.combo = 0;
        this.firedComicTriggers.clear();

        // 캐릭터 y는 모든 레이어에서 CHARACTER_Y(=903) 고정 (배경 이미지 지표면과 정확히 일치)
        // (구) bgUnder 단색 Rectangle 갱신 코드 제거 - 배경 이미지에 지하 단면 포함됨

        // 캐릭터 의존 객체(구멍/흙더미/라벨) 위치 재동기화 (안전망)
        this.updateCharacterDependentPositions();

        // 클리어 연출 종료 → 캐릭터 idle 복귀
        this.clearActive = false;
        this.cancelDigRevert();
        if (this.character) this.setCharacterState('idle');

        // 배경색 자동 적용 (이미지 미로드 시 폴백)
        this.bg.fillColor = layer.bgColor;

        // 레이어 배경 이미지 교체 + 타일 스케일 재계산 + 초기 tilePositionY 리셋
        const bgKey = `${layer.id}_bg`;
        if (this.bgImage && this.textures.exists(bgKey)) {
            this.bgImage.setTexture(bgKey);
            this.applyBackgroundCoverFit();
            // 새 레이어 진입 → 텍스처 스크롤 위치를 0으로 리셋
            //   → 새 이미지 상단(하늘)부터 다시 표시
            //   → 지표면 라인(row 903)이 게임 y 903 = 캐릭터 발 위치에 자동으로 맞춰짐
            if (this.bgImage.type === 'TileSprite') {
                this.bgImage.tilePositionY = INITIAL_TILE_POSITION_Y;
            }
            this.bgImage.setVisible(true);

            // 캐릭터.y는 CHARACTER_Y(=903) 고정. 텍스처 교체 후에도 동일 위치 유지
            if (this.character) {
                this.character.y = CHARACTER_Y;
                this.updateCharacterDependentPositions();
            }
        } else if (this.bgImage) {
            // 텍스처 없으면 숨기고 색만 보이도록
            this.bgImage.setVisible(false);
        }

        // 흙더미 색상 = 레이어 id별 명시 매핑
        this.currentMoundColor = MOUND_LAYER_COLORS[layer.id]
            || layer.groundColor
            || this.darkenColor(layer.bgColor, 0.65);
        // 파티클은 soilType 기반 3색 팔레트 (시각 다양성)
        this.currentDirtPalette = SOIL_TYPE_COLORS[layer.soilType] || SOIL_TYPE_COLORS.dirt;

        // 흙더미 이미지 tint 적용 + alpha 복원 (clear 디졸브 후 재진입 대응)
        if (this.leftMound) {
            this.leftMound.setTint(this.currentMoundColor);
            this.leftMound.alpha = 1;
            this.leftMound.setVisible(false); // digCount 0 → 안 보이게
        }
        if (this.rightMound) {
            this.rightMound.setTint(this.currentMoundColor);
            this.rightMound.alpha = 1;
            this.rightMound.setVisible(false);
        }

        // 구덩이 이미지 리셋 → 사이즈 최소값 + 숨김 (digCount 0)
        if (this.holeImage) {
            const w = this.cameras.main.width * HOLE_WIDTH_RATIO;
            this.holeImage.setDisplaySize(w, HOLE_MIN_HEIGHT);
            this.holeImage.alpha = 1;
            this.holeImage.setVisible(false);
        }

        // 터널 그래픽스 리셋 → alpha 복원 + 클리어 (다음 레이어에서 다시 보이게)
        if (this.shaftGraphics) {
            this.shaftGraphics.alpha = 1;
            this.shaftGraphics.clear();
        }

        // 레이어별 BGM 자동 전환 (id 'layer_001' → 키 'bgm_layer001')
        // 같은 BGM 중복 호출은 SoundManager 내부에서 무시되므로 안전
        if (this.soundManager && layer.id) {
            const bgmKey = layer.id.replace('layer_', 'bgm_layer');
            this.soundManager.playBGM(bgmKey);
        }

        // 안내 메시지
        const { width, height } = this.cameras.main;
        if (layer.unlockMessage) {
            this.showFloatingText(width / 2, height * 0.4, layer.unlockMessage, '#ffffff');
        }

        this.updateHUD();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 핵심 삽질 로직
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    dig(x, y) {
        // 보물 팝업 / 클리어 연출 중엔 삽질 차단
        if (this.treasurePopupActive) return;
        if (this.clearActive) return;
        if (!this.layerData) return;

        const now = this.time.now;

        // 콤보 판정
        if (now - this.lastDigTime < this.comboWindow) {
            this.combo += 1;
        } else {
            this.combo = 1;
        }
        this.lastDigTime = now;

        this.digCount += 1;

        // 캐릭터: dig 텍스처로 즉시 전환 → 0.3초 후 베이스 상태(idle/combo)로 복귀
        this.playDigAnimation();

        // 캐릭터 좌측 15px 이동 후 복귀 (삽질 모션)
        this.playDigShovelMotion();

        // 흙 파티클 분출 - 원 50개 + 사각 25개 = 총 75개 (이전 25의 3배)
        // origin (0.5, 1)이라 character.y가 발 위치 = 삽이 흙을 파는 지점
        const emitX = this.charBaseX;
        const emitY = this.character.y;
        // 발사량 2배 (50→100 / 25→50) — 더 폭발적인 흙 분출감
        if (this.dirtEmitter)       this.dirtEmitter.explode(100, emitX, emitY);
        if (this.dirtEmitterSquare) this.dirtEmitterSquare.explode(50,  emitX, emitY);

        // 충격파 원형 이펙트 (흰색 반투명 링이 빠르게 퍼졌다 사라짐)
        this.playTapShockwave(emitX, emitY);

        // 탭 카메라 흔들림 (살짝 - 매 탭마다 부담되지 않을 정도)
        this.cameras.main.shake(60, 0.005);

        // 배경 위로 스크롤 (탭마다 2~3px, 콤보 10+ 시 4~5px) - 파고 내려가는 느낌
        if (this.bgImage && this.bgImage.type === 'TileSprite') {
            const scrollAmount = this.combo >= 10
                ? Phaser.Math.Between(4, 5)
                : Phaser.Math.Between(2, 3);
            this.bgImage.tilePositionY += scrollAmount;
        }

        // 깊이 누적 (1탭 = 10cm) + 텍스트 갱신
        this.totalDepthCm = (this.totalDepthCm || 0) + 10;
        if (this.depthText) {
            this.depthText.setText(`지하 ${(this.totalDepthCm / 100).toFixed(1)}m`);
        }

        // 흙더미는 매 프레임 update()에서 redraw (digCount 기반 fraction 사용)
        // → 별도 trigger 불필요

        // 코인 획득 (기본 1~5 + 삽 레벨 보너스 + 콤보 10+ 시 1.5배)
        let coinGain = Phaser.Math.Between(1, 5) + this.currencyManager.getShovelBonus();
        if (this.combo >= 10) coinGain = Math.floor(coinGain * 1.5);
        this.currencyManager.addCoin(coinGain);
        // 코인 획득 사운드 (매 탭마다 살짝 다른 피치)
        this.soundManager.playCoinSound();

        // 콤보 보상
        if (this.combo === 50) {
            this.currencyManager.addRelic(1);
            this.showFloatingText(x, y - 60, '🏺 +1 유물조각!', '#d2691e');
        } else if (this.combo === 100) {
            this.currencyManager.addDiamond(1);
            this.showFloatingText(x, y - 60, '💎 +1 다이아삽!', '#7df9ff');
        }

        // 코인 획득 이펙트
        this.showFloatingText(x, y, `+${coinGain}`, '#ffd700');

        // 콤보 표시
        if (this.combo >= 2) {
            this.comboText.setText(`COMBO x${this.combo}`);
            this.comboText.setAlpha(1);
            this.tweens.killTweensOf(this.comboText);
            this.tweens.add({
                targets: this.comboText, alpha: 0, duration: 800, delay: 600
            });
        }

        // 콤보 단계 도달 시 사운드 (10 / 30 / 50 정확히 그 순간만)
        if (this.combo === 10 || this.combo === 30 || this.combo === 50) {
            this.soundManager.playComboSound(this.combo);
        }

        // 사운드 + 햅틱 (soilType 기반) — 매 탭에 medium 진동으로 손맛 강화
        this.soundManager.playDigSound(this.layerData.soilType);
        this.soundManager.triggerHaptic('medium');

        // 코믹 이벤트 트리거 체크
        this.checkComicEvent();

        // 보물 출현 체크 (5% 확률)
        if (Math.random() < TREASURE_BASE_RATE) {
            this.spawnTreasure();
        }

        // 레이어 클리어 체크
        if (this.digCount >= this.layerData.requiredDigs) {
            this.clearLayer();
        }

        this.updateHUD();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 코믹 이벤트 - layerData.comicEvent.triggerAt 도달 시 NPC 말풍선
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    checkComicEvent() {
        const event = this.layerData.comicEvent;
        if (!event || !event.triggerAt) return;

        for (const trigger of event.triggerAt) {
            if (this.digCount === trigger && !this.firedComicTriggers.has(trigger)) {
                this.firedComicTriggers.add(trigger);
                this.showComicEvent(event);
                return;
            }
        }
    }

    showComicEvent(event) {
        // 카메라 흔들기 (action에 따라 강도 차등)
        const cam = this.cameras.main;
        if (event.action === 'shake_camera_strong') {
            cam.shake(450, 0.014);
        } else {
            cam.shake(280, 0.007);
        }

        // NPC별 사운드 (layers.js의 soundType 키 사용)
        if (event.soundType) {
            this.soundManager.playComicEventSound(event.soundType);
        }

        // 햅틱
        this.soundManager.triggerHaptic('medium');

        // 기존 말풍선이 떠있으면 즉시 제거
        if (this.comicBubble && this.comicBubble.active) {
            this.comicBubble.destroy();
            this.comicBubble = null;
        }

        const { width } = this.cameras.main;
        const bubble = this.add.container(width / 2, this.cameras.main.height * 0.18);

        // 말풍선 배경
        const bubbleBg = this.add.rectangle(0, 0, width * 0.88, 150, 0xffffff, 0.97)
            .setStrokeStyle(5, 0x5a2d0c);

        // 말풍선 꼬리 (아래 방향)
        const tail = this.add.triangle(0, 80, -20, 0, 20, 0, 0, 30, 0xffffff)
            .setStrokeStyle(5, 0x5a2d0c);

        // NPC 이름 라인
        const npcLine = this.add.text(0, -45, `${event.emoji || '👤'} ${event.npc}`, {
            font: 'bold 24px sans-serif',
            color: '#5a2d0c'
        }).setOrigin(0.5);

        // 메시지
        const msg = this.add.text(0, 5, event.message, {
            font: 'bold 26px sans-serif',
            color: '#000',
            wordWrap: { width: width * 0.8 },
            align: 'center'
        }).setOrigin(0.5);

        bubble.add([bubbleBg, tail, npcLine, msg]);
        bubble.setDepth(50);
        this.comicBubble = bubble;

        // 등장 애니
        bubble.setScale(0);
        this.tweens.add({
            targets: bubble, scale: 1, duration: 250, ease: 'Back.out'
        });

        // 3초 후 자동 사라짐
        this.time.delayedCall(event.duration || 3000, () => {
            if (bubble.active) {
                this.tweens.add({
                    targets: bubble,
                    alpha: 0, scale: 0.85,
                    duration: 300,
                    onComplete: () => {
                        if (bubble.active) bubble.destroy();
                        if (this.comicBubble === bubble) this.comicBubble = null;
                    }
                });
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 보물 시스템
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    spawnTreasure() {
        if (this.treasurePopupActive) return;
        if (!this.layerData) return;

        const rarityKey = rollTreasureRarity();
        const treasure = rollTreasureFromLayer(this.layerData, rarityKey);
        if (!treasure) return;

        // 보상 적용
        const r = treasure.reward || {};
        if (r.coin)    this.currencyManager.addCoin(r.coin);
        if (r.relic)   this.currencyManager.addRelic(r.relic);
        if (r.diamond) this.currencyManager.addDiamond(r.diamond);

        // 박물관 수집 목록 등록 (id 기준 dedupe + count 증가)
        this.currencyManager.addCollectedTreasure({
            id: treasure.id,
            name: treasure.name,
            rarity: rarityKey,
            desc: treasure.desc,
            layerId: this.layerData.id,
            layerName: this.layerData.name,
            foundAt: Date.now()
        });

        // 등급별 보물 사운드 (common 2음 ~ legendary 5음 화음)
        this.soundManager.playTreasureSound(rarityKey);

        // 강한 햅틱 3회
        this.soundManager.triggerTreasureHaptic();

        // 게임 멈추지 않고 인게임에서 보물이 발 근처에서 튀어나와 우상단으로 비행
        // (treasurePopupActive 안 건드림 → 캐릭터 상태/입력 그대로 유지)
        this.flyTreasureToHUD(treasure, rarityKey);

        // legendary 등급은 화면 전체 황금빛 플래시 (300ms)
        if (rarityKey === 'legendary') {
            this.cameras.main.flash(300, 255, 215, 0);
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 인게임 보물 파밍 (팝업 없이 인게임 연출):
    //  Phase 1) 발 근처에서 큰 아이콘 + 보물 이름 텍스트 펑 등장 (250ms)
    //  Phase 2) 그 자리에서 holdMs 유지 (common/rare/epic: 600ms / legendary: 1000ms)
    //  Phase 3) 우상단으로 포물선 비행하면서 점점 작아짐 (flyMs)
    //  Phase 4) 도착 시 HUD '+이름' 텍스트 표시, 2초 후 페이드아웃
    // legendary는 별 파티클 폭발 + 더 천천히 비행 (별도 spawnLegendaryStars 호출)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    flyTreasureToHUD(treasure, rarityKey) {
        const { width } = this.cameras.main;

        // 등급별 스타일 - 색상 / 폰트 크기 / 유지시간 / 비행시간
        const STYLES = {
            legendary: { hex: '#FFD700', int: 0xFFD700, fontPx: 48, holdMs: 1000, flyMs: 1200 },
            epic:      { hex: '#c77dff', int: 0x9B59B6, fontPx: 42, holdMs: 600,  flyMs: 900 },
            rare:      { hex: '#7df9ff', int: 0x3498DB, fontPx: 38, holdMs: 600,  flyMs: 900 },
            common:    { hex: '#ffffff', int: 0x95A5A6, fontPx: 34, holdMs: 600,  flyMs: 900 }
        };
        const style = STYLES[rarityKey] || STYLES.common;

        // 시작 위치 (캐릭터 발 라인) / 도착 위치 (화면 우상단 HUD 옆)
        // origin (0.5, 1)이라 character.y가 발 위치 = 보물이 튀어나오는 지점
        const startX = this.charBaseX;
        const startY = this.character.y;
        const targetX = width - 80;
        const targetY = 80;

        // 컨테이너 - 아이콘 + 이름 텍스트가 함께 등장/유지/비행
        const container = this.add.container(startX, startY).setDepth(50);

        // 아이콘 (반지름 80, 이모지 100px = 이전 대비 약 3배)
        const iconRelX = -90;                 // 컨테이너 안에서 아이콘 중심 X
        const iconBg = this.add.circle(iconRelX, 0, 80, style.int, 1)
            .setStrokeStyle(6, 0xffffff);
        const iconEmoji = this.add.text(iconRelX, 0, '🏺', {
            font: '100px sans-serif'
        }).setOrigin(0.5);

        // 보물 이름 텍스트 (아이콘 오른쪽, 등급별 색상/크기)
        const nameText = this.add.text(10, 0, treasure.name, {
            font: `bold ${style.fontPx}px sans-serif`,
            color: style.hex,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0, 0.5);

        container.add([iconBg, iconEmoji, nameText]);

        // ━━ Phase 1: 펑 등장 (250ms) ━━
        container.setScale(0.3);
        container.alpha = 0;
        this.tweens.add({
            targets: container,
            scale: 1, alpha: 1,
            duration: 250, ease: 'Back.out'
        });

        // legendary 전용: 별 파티클 폭발 + 황금 화면 플래시는 spawnTreasure에서 이미 처리됨
        if (rarityKey === 'legendary') {
            this.spawnLegendaryStars(startX, startY);
        }

        // ━━ Phase 2: holdMs 유지 후 비행 시작 ━━
        this.time.delayedCall(250 + style.holdMs, () => {
            // ━━ Phase 3: 우상단으로 비행 + 점점 작아짐 ━━
            // X: 선형 가속
            this.tweens.add({
                targets: container,
                x: targetX,
                scale: 0.3,                    // 도착 시 작아진 상태
                duration: style.flyMs,
                ease: 'Quad.in'
            });
            // Y: 포물선 (위로 솟구쳤다 떨어짐)
            this.tweens.chain({
                targets: container,
                tweens: [
                    { y: startY - 180, duration: Math.floor(style.flyMs * 0.4), ease: 'Quad.out' },
                    { y: targetY,      duration: Math.floor(style.flyMs * 0.6), ease: 'Quad.in'  }
                ]
            });
            // 회전
            this.tweens.add({
                targets: container,
                angle: 360, duration: style.flyMs, ease: 'Linear'
            });

            // ━━ Phase 4: 도착 후 정리 + HUD '+이름' 텍스트 ━━
            this.time.delayedCall(style.flyMs, () => {
                this.tweens.add({
                    targets: container,
                    scale: 0.1, alpha: 0,
                    duration: 150,
                    onComplete: () => container.destroy()
                });

                // HUD 우상단 '+이름' (4단 순환 오프셋으로 연속 보물 시 텍스트 겹침 방지)
                this._arrivalIdx = ((this._arrivalIdx || 0) + 1) % 4;
                const offsetY = this._arrivalIdx * 32;

                const arrivalText = this.add.text(width - 30, 130 + offsetY, `+${treasure.name}`, {
                    font: 'bold 24px sans-serif',
                    color: style.hex,
                    stroke: '#000', strokeThickness: 4
                }).setOrigin(1, 0).setDepth(60);

                arrivalText.setAlpha(0);
                this.tweens.add({
                    targets: arrivalText,
                    alpha: 1, y: arrivalText.y - 8,
                    duration: 200, ease: 'Quad.out'
                });
                this.tweens.add({
                    targets: arrivalText,
                    alpha: 0,
                    delay: 2000, duration: 500,
                    onComplete: () => arrivalText.destroy()
                });
            });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // legendary 전용 - 별 모양 파티클 20개를 발 근처에서 사방으로 폭발
    // 5각 별 텍스처는 코드로 즉석 생성 (PNG 불필요)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    spawnLegendaryStars(x, y) {
        // 5각 별 텍스처 (10점 폴리곤: 외곽 5점 + 내부 5점 교대)
        if (!this.textures.exists('__starParticle')) {
            const stg = this.make.graphics({ x: 0, y: 0, add: false });
            stg.fillStyle(0xffffff, 1);
            const cx = 18, cy = 18;
            const rOuter = 16, rInner = 7;
            const pts = [];
            for (let i = 0; i < 10; i++) {
                // -π/2부터 시계방향, 외곽/내부 반복
                const ang = (Math.PI / 5) * i - Math.PI / 2;
                const r = (i % 2 === 0) ? rOuter : rInner;
                pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
            }
            stg.fillPoints(pts, true);
            stg.generateTexture('__starParticle', 36, 36);
            stg.destroy();
        }

        const burst = this.add.particles(0, 0, '__starParticle', {
            speed: { min: 240, max: 560 },
            angle: { min: 0, max: 360 },               // 사방으로 폭발
            scale: { start: 1.4, end: 0 },             // 점점 작아져 사라짐
            alpha: { start: 1, end: 0 },
            lifespan: { min: 700, max: 1300 },
            rotate: { min: 0, max: 360 },
            gravityY: 250,                             // 살짝 떨어지면서
            // 황금/노랑/흰색 톤 무작위 (legendary 분위기)
            tint: [0xffd700, 0xffeb3b, 0xffffff, 0xfff8dc, 0xffe066],
            emitting: false
        }).setDepth(52);

        burst.explode(20, x, y);

        // 1.4초 후 자동 정리 (라이프스팬 끝나고 한 박자 후)
        this.time.delayedCall(1400, () => {
            if (burst && burst.scene) burst.destroy();
        });
    }

    showTreasurePopup(treasure, rarityKey) {
        this.treasurePopupActive = true;

        const { width, height } = this.cameras.main;
        const rarityInfo = TREASURE_RARITY[rarityKey] || TREASURE_RARITY.common;

        // 등급별 어두운 배경 + 강조 테두리 (사용자 스펙)
        const RARITY_STYLES = {
            legendary: { bg: 0x2a1a00, border: 0xFFD700, accent: '#FFD700' }, // 황금
            epic:      { bg: 0x1a0a2a, border: 0x9B59B6, accent: '#c77dff' }, // 보라
            rare:      { bg: 0x0a1a2a, border: 0x3498DB, accent: '#7df9ff' }, // 파랑
            common:    { bg: 0x1a1a1a, border: 0x95A5A6, accent: '#cccccc' }  // 회색
        };
        const style = RARITY_STYLES[rarityKey] || RARITY_STYLES.common;

        // 딤 오버레이 rgba(0, 0, 0, 0.7)
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setInteractive({ useHandCursor: true })
            .setDepth(100);

        // 카드 컨테이너 - 화면 위에서 시작 (300ms drop 시작점)
        const card = this.add.container(width / 2, -400).setDepth(101);
        const cardW = width * 0.86;
        const cardH = 540;

        // 카드 배경 (어두운 색 + 등급 색 굵은 테두리)
        const cardBg = this.add.rectangle(0, 0, cardW, cardH, style.bg, 1)
            .setStrokeStyle(8, style.border, 1);

        // 제목 (흰색 - 어두운 배경에 잘 보임)
        const title = this.add.text(0, -210, '🏺 보물 발견!', {
            font: 'bold 40px sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        // 등급 라벨 (36px, 등급 색)
        const rarityLabel = this.add.text(0, -150, `[${rarityInfo.label}]`, {
            font: 'bold 36px sans-serif', color: style.accent,
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // 보물 이름 (48px 볼드)
        const name = this.add.text(0, -70, treasure.name, {
            font: 'bold 48px sans-serif', color: '#ffffff',
            wordWrap: { width: cardW - 60 },
            align: 'center'
        }).setOrigin(0.5);

        // 설명 (28px 이탤릭)
        const desc = this.add.text(0, 30, treasure.desc || '', {
            font: 'italic 28px sans-serif', color: '#dddddd',
            wordWrap: { width: cardW - 80 },
            align: 'center'
        }).setOrigin(0.5);

        // 보상 (36px 황금)
        const rewardParts = [];
        const r = treasure.reward || {};
        if (r.coin)    rewardParts.push(`🪙 +${r.coin}`);
        if (r.relic)   rewardParts.push(`🏺 +${r.relic}`);
        if (r.diamond) rewardParts.push(`💎 +${r.diamond}`);
        const rewardText = this.add.text(0, 140, rewardParts.join('   '), {
            font: 'bold 36px sans-serif', color: '#ffd700',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        // 닫기 안내
        const tapHint = this.add.text(0, 215, '👆 탭해서 닫기', {
            font: '20px sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);

        card.add([cardBg, title, rarityLabel, name, desc, rewardText, tapHint]);

        // 위에서 아래로 떨어지는 애니메이션 (300ms, Cubic.out)
        this.tweens.add({
            targets: card,
            y: height / 2,
            duration: 300,
            ease: 'Cubic.out'
        });

        // 반짝이 파티클 (카드 영역 주변, 모든 등급)
        this.spawnTreasureSparkles(width / 2, height / 2, cardW, cardH);

        // legendary/epic 등급별 추가 버스트 (one-shot)
        if (rarityKey === 'legendary') {
            this.spawnRarityBurst(width / 2, height / 2, 20, [0xFFD700, 0xfff8dc, 0xffeb3b, 0xffe066]);
            // 착지 후 카드 떨림 (강조)
            this.tweens.add({
                targets: card,
                angle: { from: -2, to: 2 },
                duration: 80, yoyo: true, repeat: 4, delay: 320
            });
        } else if (rarityKey === 'epic') {
            this.spawnRarityBurst(width / 2, height / 2, 15, [0x9B59B6, 0xc77dff, 0xb39ddb, 0xd0a3e8]);
        }

        // 닫기 핸들러
        const close = () => {
            // 신규 반짝이 emission 즉시 중단 (기존 파티클은 자연스럽게 페이드)
            if (this.sparkleEmitter) this.sparkleEmitter.stop();

            this.tweens.add({
                targets: [card, overlay],
                alpha: 0, scale: 0.85,
                duration: 250,
                onComplete: () => {
                    card.destroy();
                    overlay.destroy();
                    if (this.sparkleEmitter) {
                        this.sparkleEmitter.destroy();
                        this.sparkleEmitter = null;
                    }
                    this.treasurePopupActive = false;
                    this.revertCharacterToBase();
                    this.updateHUD();
                }
            });
        };
        overlay.once('pointerdown', close);
    }

    // 등급별 일회성 버스트 파티클 (legendary 20개 황금 / epic 15개 보라)
    // 카드 착지 직후(300ms) 폭발적으로 펑 → 1.3초 후 자동 정리
    spawnRarityBurst(x, y, count, tints) {
        // sparkle 텍스처 재사용 (없으면 즉석 생성)
        if (!this.textures.exists('__sparkle')) {
            const stg = this.make.graphics({ x: 0, y: 0, add: false });
            stg.fillStyle(0xffffff, 1);
            stg.fillCircle(6, 6, 6);
            stg.generateTexture('__sparkle', 12, 12);
            stg.destroy();
        }

        const burst = this.add.particles(0, 0, '__sparkle', {
            speed: { min: 250, max: 580 },
            angle: { min: 0, max: 360 },          // 사방으로 폭발
            scale: { start: 1.6, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 700, max: 1200 },
            gravityY: 250,                         // 살짝 떨어지면서 사라짐
            rotate: { min: 0, max: 360 },
            tint: tints,
            emitting: false                        // explode()로만
        }).setDepth(103);

        // 카드 착지(300ms drop) 직후 폭발 → 라이프스팬 후 자동 정리
        this.time.delayedCall(280, () => {
            burst.explode(count, x, y);
            this.time.delayedCall(1300, () => {
                if (burst && burst.scene) burst.destroy();
            });
        });
    }

    // 보물 팝업 카드 영역에 황금/흰색 반짝이 파티클을 지속 생성
    spawnTreasureSparkles(centerX, centerY, areaW, areaH) {
        // 반짝이 텍스처 (흰색 원, 코드로 즉석 생성)
        if (!this.textures.exists('__sparkle')) {
            const stg = this.make.graphics({ x: 0, y: 0, add: false });
            stg.fillStyle(0xffffff, 1);
            stg.fillCircle(6, 6, 6);
            stg.generateTexture('__sparkle', 12, 12);
            stg.destroy();
        }

        const halfW = areaW / 2 + 30;
        const halfH = areaH / 2 + 30;

        this.sparkleEmitter = this.add.particles(0, 0, '__sparkle', {
            x: { min: centerX - halfW, max: centerX + halfW },
            y: { min: centerY - halfH, max: centerY + halfH },
            speed: { min: 0, max: 30 },
            angle: { min: 0, max: 360 },
            // sin(πt) 곡선 → 0에서 시작해 중간에 최대, 다시 0으로 (반짝 효과)
            scale: {
                onEmit: () => 0,
                onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 1.4
            },
            alpha: {
                onEmit: () => 0,
                onUpdate: (p, k, t) => Math.sin(t * Math.PI)
            },
            lifespan: { min: 700, max: 1300 },
            frequency: 70,                                   // 70ms마다 한 개
            quantity: 1,
            tint: [0xffd700, 0xffffff, 0xffeb3b, 0xffe066]   // 금/흰/연노랑 랜덤
        }).setDepth(102);
    }

    // 코인 획득 시 위로 떠오르는 텍스트
    showFloatingText(x, y, msg, color) {
        const txt = this.add.text(x, y, msg, {
            font: 'bold 36px sans-serif',
            color: color, stroke: '#000', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: txt,
            y: y - 120, alpha: 0,
            duration: 1000, ease: 'Quad.out',
            onComplete: () => txt.destroy()
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 레이어 클리어
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    clearLayer() {
        this.soundManager.triggerHaptic('heavy');
        // 레이어 클리어 6음 팡파레
        this.soundManager.playLayerClearSound();

        // 클리어 연출 중엔 입력 차단 + 캐릭터 clear 텍스처
        this.clearActive = true;
        this.cancelDigRevert();
        this.setCharacterState('clear');

        // 흙더미 + 구덩이 서서히 사라지는 디졸브 애니 (1초)
        // (loadLayer가 alpha=1 + 사이즈 리셋 + visible=false로 다시 초기화)
        const dissolveTargets = [];
        if (this.leftMound)     dissolveTargets.push(this.leftMound);
        if (this.rightMound)    dissolveTargets.push(this.rightMound);
        if (this.holeImage)     dissolveTargets.push(this.holeImage);
        if (this.shaftGraphics) dissolveTargets.push(this.shaftGraphics);
        if (dissolveTargets.length) {
            this.tweens.add({
                targets: dissolveTargets,
                alpha: 0,
                duration: 1000,
                ease: 'Quad.in'
            });
        }

        // 배경 빠르게 위로 쭉 스크롤 (1초) → 1.5초 뒤 loadLayer가 새 레이어 텍스처로 교체
        if (this.bgImage && this.bgImage.type === 'TileSprite') {
            this.tweens.add({
                targets: this.bgImage,
                tilePositionY: this.bgImage.tilePositionY + 800,
                duration: 1000,
                ease: 'Cubic.in'
            });
        }

        const reward = this.layerData.clearReward || { coin: 0, relic: 0, diamond: 0 };
        if (reward.coin)    this.currencyManager.addCoin(reward.coin);
        if (reward.relic)   this.currencyManager.addRelic(reward.relic);
        if (reward.diamond) this.currencyManager.addDiamond(reward.diamond);

        const { width, height } = this.cameras.main;
        const rewardLine = [
            reward.coin    ? `🪙+${reward.coin}` : null,
            reward.relic   ? `🏺+${reward.relic}` : null,
            reward.diamond ? `💎+${reward.diamond}` : null
        ].filter(Boolean).join('  ');

        const clearMsg = this.layerData.clearMessage || '레이어 클리어!';
        this.showFloatingText(
            width / 2, height / 2,
            `🎉 ${clearMsg}\n${rewardLine}`,
            '#ffd700'
        );

        // 1.5초 후 다음 레이어로 (loadLayer가 clearActive와 텍스처를 리셋)
        this.time.delayedCall(1500, () => {
            this.loadLayer(this.layerOrder + 1);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 캐릭터 좌우 삽질 모션 - 탭 시 왼쪽 15px → 0.3초 안에 원위치 복귀
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playDigShovelMotion() {
        if (!this.character || this.charBaseX == null) return;

        // 진행 중인 트윈이 있으면 중단하고 정지 위치로 스냅 후 새로 시작
        if (this.charMoveTween && this.charMoveTween.isPlaying()) {
            this.charMoveTween.stop();
            this.character.x = this.charBaseX;
        }

        // 0.15s 왼쪽 → 0.15s 복귀 = 총 0.3s (yoyo)
        this.charMoveTween = this.tweens.add({
            targets: this.character,
            x: this.charBaseX - 15,
            duration: 150,
            yoyo: true,
            ease: 'Quad.out',
            onComplete: () => {
                this.character.x = this.charBaseX; // 부동소수점 오차 보정
                this.charMoveTween = null;
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 구덩이 이미지 갱신 - hole.png를 탭 비례로 키움
    //
    //   - 가로(width)는 화면 너비 × HOLE_WIDTH_RATIO 고정
    //   - 세로(displayHeight)는 탭에 따라 MIN(50) → MAX(300) 선형 증가
    //   - 위치는 updateCharacterDependentPositions가 동기화
    //   - digCount 0이면 숨김
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    drawHole() {
        if (!this.holeImage || !this.character) return;

        // 더 이상 사용하지 않는 shaftGraphics 흔적 제거
        if (this.shaftGraphics) this.shaftGraphics.clear();

        if (this.digCount <= 0) {
            this.holeImage.setVisible(false);
            return;
        }

        this.holeImage.setVisible(true);
        // 검정 실루엣/dim 효과 해제 — 클리어 디졸브 alpha 트윈은 방해 안 하게 가드
        if (!this.clearActive) this.holeImage.setAlpha(1);
        this.holeImage.clearTint();

        const w = this.cameras.main.width * HOLE_WIDTH_RATIO;

        // ━━ 지표면 Y 계산 ━━
        // 화면 y = (textureY - tilePositionY) × tileScaleY
        // 모든 레이어 동일 처리 — 각 레이어는 자체 지표면을 가진 새 배경이고, loadLayer가 tilePositionY=0으로 리셋함
        const bgScrollY = (this.bgImage && this.bgImage.tilePositionY) ? this.bgImage.tilePositionY : 0;
        const tileScale = (this.bgImage && this.bgImage.tileScaleY)   ? this.bgImage.tileScaleY   : 1;
        const surfaceY  = (SURFACE_TEXTURE_Y - bgScrollY) * tileScale;

        // 구덩이 바닥 = 캐릭터 발 + HOLE_Y_OFFSET (살짝 아래)
        const holeBottomY = this.character.y + HOLE_Y_OFFSET;

        // 높이 = (바닥 - 지표면) × PADDING_FACTOR
        // 비례 보정: 깊이 깊어져도 이미지 padding이 같은 비율로 가려지므로 갭 절대 안 생김
        // origin (0.5, 1.0)이라 displayHeight를 키우면 바닥은 holeBottomY 고정 + 위로 자람
        const h = Math.max(HOLE_MIN_HEIGHT, (holeBottomY - surfaceY) * HOLE_PADDING_FACTOR);

        this.holeImage.setDisplaySize(w, h);
        this.holeImage.y = holeBottomY;
    }

    // 두 색상 보간 (0xRRGGBB hex)
    lerpColor(c1, c2, t) {
        const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
        const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return (r << 16) | (g << 8) | b;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 지하 마스킹 오버레이 — TileSprite wrap-around 영역을 단색으로 덮음
    //
    // TileSprite는 텍스처가 끝나면 자동으로 wrap돼서 처음부터 다시 보여줌.
    // 깊이 많이 팠을 때(tilePositionY 큼) 화면 아래쪽이 wrap돼서 지상 부분이
    // 다시 나타나는 현상 발생 → 이 영역을 underground 단색으로 덮어 차단.
    //
    // wrap 발생 화면 Y = (textureHeight - tilePositionY) × tileScaleY
    // → 이 위치부터 화면 바닥까지 단색 사각형으로 덮음
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    drawUndergroundOverlay() {
        if (!this.undergroundOverlay || !this.bgImage) return;
        this.undergroundOverlay.clear();
        if (this.bgImage.type !== 'TileSprite') return;

        const tex = this.bgImage.texture && this.bgImage.texture.getSourceImage
            ? this.bgImage.texture.getSourceImage()
            : null;
        const texH = (tex && tex.height) ? tex.height : 2580;
        const tileScale = this.bgImage.tileScaleY || 1;
        const tilePos   = this.bgImage.tilePositionY || 0;

        // wrap이 발생하는 화면 Y 좌표
        const wrapScreenY = (texH - tilePos) * tileScale;

        const screenW = this.cameras.main.width;
        const screenH = this.cameras.main.height;

        // wrap이 화면 바깥(아래)이면 덮을 필요 없음
        if (wrapScreenY >= screenH) return;

        // 덮을 영역: wrap 라인부터 화면 바닥까지
        const top = Math.max(0, wrapScreenY);
        const undergroundColor = this.darkenColor(this.currentMoundColor || 0x4a2f1a, 0.7);
        this.undergroundOverlay.fillStyle(undergroundColor, 1);
        this.undergroundOverlay.fillRect(0, top, screenW, screenH - top);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 흙더미 갱신 (mound_right.png 이미지 기반)
    //   - digCount에 따라 scale만 조정
    //   - 색상은 setTint로 레이어 색 반영 (loadLayer에서 적용)
    //   - 좌측은 setFlipX로 좌우 반전된 같은 이미지
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    drawMounds() {
        if (!this.leftMound || !this.rightMound || !this.character) return;

        if (this.digCount <= 0) {
            this.leftMound.setVisible(false);
            this.rightMound.setVisible(false);
            this.leftMoundBBox = null;
            this.rightMoundBBox = null;
            return;
        }

        // Cubic Ease-out — 초반에 빠르게 커지고 점차 둔화
        const fraction     = Math.min(this.digCount / MOUND_TAPS_TO_MAX, 1);
        const easeFraction = 1 - Math.pow(1 - fraction, 3);
        const scale        = MOUND_MIN_SCALE + (MOUND_MAX_SCALE - MOUND_MIN_SCALE) * easeFraction;

        this.leftMound.setVisible(true).setScale(scale);
        this.rightMound.setVisible(true).setScale(scale);

        // 검정 실루엣(setTintFill) 효과 제거 — 원본 텍스처 + 레이어 색(currentMoundColor) 복원
        // 디졸브 트윈을 방해하지 않게 alpha는 clearActive 중엔 건드리지 않음
        if (!this.clearActive) {
            this.leftMound.setAlpha(1);
            this.rightMound.setAlpha(1);
        }
        if (this.currentMoundColor) {
            this.leftMound.setTint(this.currentMoundColor);
            this.rightMound.setTint(this.currentMoundColor);
        } else {
            this.leftMound.clearTint();
            this.rightMound.clearTint();
        }

        // X 오프셋: 캐릭터 살짝 가리도록 -15 음수 갭
        const charHalfW  = this.character.displayWidth * 0.5;
        const moundHalfW = this.leftMound.width * 0.5 * scale;
        const offsetX    = charHalfW + moundHalfW - 15;

        // Y는 파낼수록 캐릭터 앞쪽(아래)으로 더 튀어나오는 입체감 (15 → 25)
        const moundYOffset = 25 * easeFraction;

        this.leftMound.x  = this.character.x - offsetX;
        this.leftMound.y  = this.character.y + moundYOffset;
        this.rightMound.x = this.character.x + offsetX;
        this.rightMound.y = this.character.y + moundYOffset;

        // 파티클 충돌용 bbox 갱신 (월드 좌표)
        const lb = this.leftMound.getBounds();
        const rb = this.rightMound.getBounds();
        this.leftMoundBBox  = { left: lb.left, right: lb.right, top: lb.top, bottom: lb.bottom };
        this.rightMoundBBox = { left: rb.left, right: rb.right, top: rb.top, bottom: rb.bottom };
    }

    // (구 _computeBBoxFromPoints는 폴리곤 흙더미 전용 → 이미지 흙더미 getBounds로 대체되어 제거)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 탭 충격파 - 흰색 반투명 링이 빠르게 퍼졌다 사라짐
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playTapShockwave(x, y) {
        const ring = this.add.circle(x, y, 30, 0xffffff, 0)
            .setStrokeStyle(5, 0xffffff, 0.85)
            .setDepth(20);
        ring.setScale(0.3);

        this.tweens.add({
            targets: ring,
            scale: 1.8,
            alpha: 0,
            duration: 280,
            ease: 'Quad.out',
            onComplete: () => ring.destroy()
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 매 프레임 호출 (Phaser가 자동으로 호출) - 구멍/흙더미 redraw + 파티클 충돌
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    update() {
        this.drawHole();
        this.drawMounds();
        this.drawUndergroundOverlay();

        // 파티클이 흙더미 bbox 안에 들어오면 즉시 사라짐 (alpha 0 처리)
        // 원/사각 두 emitter 모두 검사
        if (this.leftMoundBBox || this.rightMoundBBox) {
            const killIfInMound = (p) => {
                if (this._isInMoundBBox(p.x, p.y)) p.alpha = 0;
            };
            if (this.dirtEmitter)       this.dirtEmitter.forEachAlive(killIfInMound, this);
            if (this.dirtEmitterSquare) this.dirtEmitterSquare.forEachAlive(killIfInMound, this);
        }
    }

    _isInMoundBBox(x, y) {
        const lb = this.leftMoundBBox;
        const rb = this.rightMoundBBox;
        if (lb && x >= lb.left && x <= lb.right && y >= lb.top && y <= lb.bottom) return true;
        if (rb && x >= rb.left && x <= rb.right && y >= rb.top && y <= rb.bottom) return true;
        return false;
    }

    // 색상 어둡게 (factor < 1)
    darkenColor(hex, factor) {
        const r = Math.max(0, Math.floor(((hex >> 16) & 0xff) * factor));
        const g = Math.max(0, Math.floor(((hex >> 8) & 0xff) * factor));
        const b = Math.max(0, Math.floor((hex & 0xff) * factor));
        return (r << 16) | (g << 8) | b;
    }

    // 색상 밝게 (factor > 1)
    lightenColor(hex, factor) {
        const r = Math.min(255, Math.floor(((hex >> 16) & 0xff) * factor));
        const g = Math.min(255, Math.floor(((hex >> 8) & 0xff) * factor));
        const b = Math.min(255, Math.floor((hex & 0xff) * factor));
        return (r << 16) | (g << 8) | b;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 캐릭터 상태 머신 (idle / dig / combo / surprise / clear)
    // 우선순위: clear > surprise > combo > idle (dig는 transient 0.3초)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 현재 게임 상태로부터 표시해야 할 베이스 텍스처 결정
    getBaseCharacterState() {
        if (this.clearActive) return 'clear';
        if (this.treasurePopupActive) return 'surprise';
        if (this.combo >= 10) return 'combo';
        return 'idle';
    }

    // 캐릭터 텍스처 교체 (현재와 같으면 무시 → 불필요한 재할당 방지)
    setCharacterState(state) {
        if (!this.character) return;
        const key = `${this.characterId}_${state}`;
        if (this.character.texture && this.character.texture.key === key) return;
        if (!this.textures.exists(key)) return; // 이미지 미로드 시 안전 처리
        this.character.setTexture(key);
        // 텍스처마다 원본 픽셀 크기가 다르면 표시 크기가 튀므로 매번 재계산
        this.applyCharacterDisplaySize();
    }

    // 보관된 charTargetHeight 기준으로 displaySize 재적용 (가로는 원본 비율 유지)
    applyCharacterDisplaySize() {
        if (!this.character || !this.charTargetHeight) return;
        const ratio = this.character.width / this.character.height;
        this.character.setDisplaySize(this.charTargetHeight * ratio, this.charTargetHeight);
    }

    // 캐릭터 y 변경 시 의존 객체(라벨/구멍/흙더미) 위치 일괄 갱신
    // origin (0.5, 1)이라 character.y가 곧 발 위치
    //   - 구덩이 이미지는 (character.x, character.y + HOLE_Y_OFFSET) - 발 아래로 살짝
    //   - 흙더미 X는 drawMounds()가 현재 스케일 기준으로 매 프레임 동적 계산
    //     → 여기선 X/Y만 동기화
    updateCharacterDependentPositions() {
        if (!this.character) return;

        if (this.holeImage) {
            this.holeImage.setPosition(this.character.x, this.character.y + HOLE_Y_OFFSET);
        }
        // 흙더미 위치는 drawMounds에서 갱신 (스케일 변화 따라가야 하므로)
        // 단 Y 기준점만 character.y로 동기화 - drawMounds가 X offset 더해줌
        if (this.leftMound)  this.leftMound.y  = this.character.y;
        if (this.rightMound) this.rightMound.y = this.character.y;

        if (this.characterLabel) {
            this.characterLabel.setPosition(this.character.x, this.character.y + 20);
        }
    }

    // 배경 이미지를 화면에 맞게 스케일
    // TileSprite: tileScaleX = tileScaleY = width / imageWidth (균일 스케일, 비율 유지)
    //   → 가로로 이미지 1개만 정확히 표시 (가로 타일링 없음)
    //   → 세로는 비율 유지된 채로 화면 위로 스크롤될 영역
    //   → 이미지 높이 × scale > 화면 높이일 경우 윗부분만 보이고 나머지는 스크롤로 노출
    // Image: 기존 cover-fit (비율 유지)
    applyBackgroundCoverFit() {
        if (!this.bgImage || !this.bgImage.texture) return;

        const { width, height } = this.cameras.main;

        if (this.bgImage.type === 'TileSprite') {
            // 텍스처 원본 픽셀 크기
            const tex = this.bgImage.texture.getSourceImage();
            const srcW = (tex && tex.width)  || this.bgImage.width;
            const srcH = (tex && tex.height) || this.bgImage.height;
            if (!srcW || !srcH) return;
            // 균일 스케일 = width / imageWidth → 가로 1개만 보이고 비율 유지
            const scale = width / srcW;
            this.bgImage.setTileScale(scale, scale);
            return;
        }

        // Image: cover-fit (비율 유지 + 큰 쪽 기준 스케일)
        const sourceW = this.bgImage.width;
        const sourceH = this.bgImage.height;
        if (!sourceW || !sourceH) return;
        const scale = Math.max(width / sourceW, height / sourceH);
        this.bgImage.setScale(scale);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 레이어 시작 시 tilePositionY 초기값
    //   - 항상 0 (이미지 상단부터 화면에 표시)
    //   - tileScale=1.0 + character.y=903이면
    //     자동으로 지표면 라인(텍스처 row 903)이 캐릭터 발 위치에 옴
    //
    // 검산:
    //   화면 y = (textureY - tilePositionY) × tileScaleY
    //          = (903 - 0) × 1.0
    //          = 903 = CHARACTER_Y ✓
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    getInitialTilePositionY() {
        return INITIAL_TILE_POSITION_Y;
    }

    // 즉시 베이스 상태로 복귀
    revertCharacterToBase() {
        this.setCharacterState(this.getBaseCharacterState());
    }

    // 진행 중인 dig 복귀 타이머 취소
    cancelDigRevert() {
        if (this.digRevertTimer) {
            this.digRevertTimer.remove(false);
            this.digRevertTimer = null;
        }
    }

    // 탭 시 호출 - dig 텍스처로 전환 후 0.3초 뒤 베이스 복귀
    playDigAnimation() {
        // surprise/clear 상태일 땐 dig로 덮지 않음 (거기서는 dig() 자체가 차단되니 안전장치)
        if (this.treasurePopupActive || this.clearActive) return;

        this.setCharacterState('dig');
        this.cancelDigRevert();
        this.digRevertTimer = this.time.delayedCall(300, () => {
            this.digRevertTimer = null;
            this.revertCharacterToBase();
        });
    }

    // HUD 갱신
    updateHUD() {
        this.coinText.setText(`🪙 ${this.currencyManager.coin}`);
        this.diamondText.setText(`💎 ${this.currencyManager.diamond}`);
        this.relicText.setText(`🏺 ${this.currencyManager.relic}`);
        if (this.layerData) {
            this.layerText.setText(`레이어 ${this.layerOrder}`);
            this.layerNameText.setText(this.layerData.name);
            this.progressText.setText(`${this.digCount} / ${this.layerData.requiredDigs}`);
        }
    }
}
