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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 지하 무한 루프 (B-2 방식)
//   - 원본 텍스처(2580px) 스크롤이 LOOP_START_ROW(=1000)에 도달하면
//     "지하 전용" 잘라낸 텍스처(rows 1000~2580 = 1580px)로 seamless 전환
//   - 루프 텍스처는 TileSprite 자체 wrap으로 무한 반복
//   - 결과: 깊이 파면 그 레이어 고유의 지하 패턴(파이프/벌레/지층 등)이
//     끝없이 이어지면서 보임 (단색 어둠으로 덮지 않음)
//   - LOOP_START_ROW = 1000: 지표면 라인(903) 살짝 아래 = 안전하게 지하 영역
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOOP_START_ROW = 1300: 화면 height(~1280)와 LOOP_TEXTURE_HEIGHT(1280)가 맞아야
// wrap이 정확히 화면 끝에서 이어짐. 1000이면 LOOP_TEXTURE_HEIGHT=1580이 화면보다 커서
// 학교 거의 다 팠을 때 지상 이미지가 화면 아래에 잘못 보이는 wrap 오류 발생
const LOOP_START_ROW = 1300;
const LOOP_TEXTURE_HEIGHT = BG_IMAGE_HEIGHT - LOOP_START_ROW; // = 1280

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
// 사용자 요청: 굴 바닥이 캐릭터 발과 거의 비슷한 높이여야 함 (이전 35 → 0)
// hole.png는 origin (0.5, 1.0)이라 holeImage.y = character.y면 이미지 하단=발 라인
const HOLE_Y_OFFSET          = 0;        // 캐릭터 발 라인에 굴 바닥 정렬
const HOLE_PADDING_FACTOR    = 1.10;     // 1.25 너무 위 / 1.0 너무 아래 — 0.10 padding 가정
                                         // 사장님 검증 후 1.05~1.20 사이 미세 조정 가능

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

// soilType → 흙 파티클 색상 팔레트 (5색 변주로 풍부함 + 시각 다양성)
// 각 발사마다 이 셋 중 랜덤 픽 → 같은 흙도 입자마다 미묘하게 다른 색
// (사용자 요청: 2가지 이상 → 5색으로 확장)
const SOIL_TYPE_COLORS = {
    dirt:     [0x6b4423, 0x8b5a2b, 0x4a2f1a, 0xa67c52, 0x3d2310],   // 갈색~밝은 흙~짙은 흙 5종
    sand:     [0xd4a574, 0xe8c190, 0xc09060, 0xf0d4a8, 0xb08050],   // 모래 톤 5종
    tile:     [0xc89640, 0xe0b060, 0xa07020, 0xd8a850, 0x886015],   // 황토타일 5종
    concrete: [0x707070, 0x909090, 0x505050, 0xa0a0a0, 0x404040],   // 콘크리트 회색 5종
    rock:     [0x5a5a5a, 0x7a7a7a, 0x3a3a3a, 0x6b5a4a, 0x4a4035],   // 돌 짙은 회색 5종 (갈색 끼 추가)
    lava:     [0xcc4422, 0xff6633, 0x992200, 0xff9944, 0x661100]    // 용암 빨강~주황 5종
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 삽 레벨별 이펙트 차별화 (사용자 스펙)
//   shovelLevel 0: 나무삽  → 파티클 25개 / 햅틱 light
//   shovelLevel 1: 철삽    → 파티클 50개 / 햅틱 medium
//   shovelLevel 2: 강철삽  → 파티클 75개 / 햅틱 heavy
//   shovelLevel 3+: 미스릴 → 파티클 100개 (반짝임 효과는 후속 업데이트)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 사용자 요청: 흙 날림 2배 강화 (이전 25/50/75/100 → 50/100/150/200)
const SHOVEL_PARTICLE_COUNTS  = [50, 100, 150, 200];               // 원형 파티클
const SHOVEL_PARTICLE_SQUARE  = [25, 50,  75,  100];               // 사각 파티클 (1/2 비율)
const SHOVEL_HAPTIC_INTENSITY = ['light', 'medium', 'heavy', 'heavy'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 랜덤 장애물 시스템 (사용자 스펙)
//   - 20탭마다 10% 확률로 등장
//   - 등장 중에는 일반 dig 차단, 장애물 전용 탭으로 카운트
//   - 부수면 보물 확률 +20% (10초간 부스트)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const OBSTACLE_TAP_INTERVAL  = 20;        // 매 N탭마다 무조건 등장 (확률 X)
const OBSTACLE_BOOST_MS      = 10000;     // 보물 확률 부스트 지속 (10초)
const OBSTACLE_BOOST_AMOUNT  = 0.20;      // +20% 추가 확률
// type별로 sound 키를 부여해 SoundManager.playObstacleHitSound(type)에서 거친 사운드 분기
const OBSTACLE_TYPES = {
    rock:    { emoji: '🪨', name: '단단한 바위',    tapsRequired: 3, tint: 0x808080 },
    bone:    { emoji: '🦴', name: '거대한 뼈',      tapsRequired: 5, tint: 0xf0e6c8 },
    root:    { emoji: '🪵', name: '굵은 뿌리',      tapsRequired: 4, tint: 0x6b4423 },
    ice:     { emoji: '🧊', name: '얼음 덩어리',    tapsRequired: 4, tint: 0x9bd4e4 },
    iron:    { emoji: '🔩', name: '낡은 철판',      tapsRequired: 6, tint: 0x4a4a4a },
    skull:   { emoji: '💀', name: '수상한 두개골',  tapsRequired: 5, tint: 0xe8e0c8 },
    pot:     { emoji: '🏺', name: '깨진 항아리',    tapsRequired: 3, tint: 0xa0522d },
    crystal: { emoji: '💎', name: '수정 결정체',    tapsRequired: 5, tint: 0x7df9ff }
};
const OBSTACLE_KEYS = Object.keys(OBSTACLE_TYPES);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 캐릭터 혼잣말 시스템 (사용자 스펙)
//   - 50탭마다 일반 라인 중 랜덤 노출
//   - 콤보 도달 시 콤보 라인 우선 노출 (10/30/50/100)
//   - NPC 코믹 이벤트 발생 시 1초 후 캐릭터 반응 (NPC_REACTIONS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MONOLOGUE_INTERVAL = 50;            // 매 N탭마다 일반 혼잣말
const MONOLOGUE_BUBBLE_MS = 2000;         // 말풍선 유지 시간
const MONOLOGUE_LINES_GENERAL = [
    '아 허리야...',
    '이게 뭐가 나오려나...',
    '퇴근하고 싶다...',
    '사장님 몰래 파는 중...',
    '왜 파는 거지...'
];
const MONOLOGUE_LINES_COMBO = {
    10:  '나 잘하고 있는 거지?',
    30:  '삽질왕이 될 것 같아!',
    50:  '멈출 수가 없어!!',
    100: '아엠 킹 오브 삽질!!!'
};
// soundType(layers.js) → 캐릭터 반응 라인
const NPC_REACTIONS = {
    foreman:     '아 아무것도 안 했어요!',
    pe_teacher:  '다음엔 안 그럴게요!',
    security:    '죄송합니다 죄송합니다!',
    sauna_owner: '아이고 사장님!',
    military:    '충성! 열심히 하겠습니다!',
    fans:        '저 팬이에요 진짜로요!'
};
const BURNOUT_LINE     = '더 이상 못 파...';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// foreshadow (잔상 플래시) — 초기 레이어(1~3)에서만 가끔 깜빡이며
// 후속 레이어(찜질방 황금/콘서트장 보라/군부대 카키 등) 색을 살짝 보여줌
//   - 보상 X, 시각만, 호기심 유발용
//   - 1.5% / 탭, 30탭 쿨다운
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FORESHADOW_CHANCE         = 0.015;     // 1.5%
const FORESHADOW_COOLDOWN_TAPS  = 30;
const FORESHADOW_MAX_LAYER_ORDER = 3;        // layer 1~3에서만 (4 이상은 진짜 그 레이어니까 노출 X)
// 후속 레이어 컬러 팔레트 (찜질방 황금 / 군부대 카키 / 콘서트장 네온 보라 / 마지막은 신비 청록)
const FORESHADOW_COLORS = [
    { r: 255, g: 215, b:  60 },   // 찜질방 황금
    { r: 130, g: 160, b:  80 },   // 군부대 카키
    { r: 200, g:  90, b: 240 },   // 콘서트장 네온 보라
    { r:  90, g: 220, b: 240 }    // 미래 레이어 신비 청록
];
const FORESHADOW_LINES = [
    '어? 방금 뭐였지?',
    '뭔가 번쩍였는데...',
    '내 눈이 이상한가?'
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 에너지 드링크 (패러디 — Google Play 글로벌 출시 trademark 회피)
//   화면 위에서 캐릭터 머리로 떨어짐 → 자동 캐치 → 일정 시간 버프
//   - 40탭마다 12% 확률로 등장, 등급은 weighted random
//   - 같은 효과 재획득 시 지속시간 갱신 (스택 X)
//   - DRINK_FIRST_GUARANTEED_AT: 매 레이어 진입 후 이 탭에서 무조건 1회 등장
//     → 모든 레이어에서 드링크 시스템 인지 보장 (이전엔 평생 1회라 거의 안 보임)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DRINK_SPAWN_INTERVAL      = 40;
const DRINK_SPAWN_CHANCE        = 0.12;
const DRINK_FIRST_GUARANTEED_AT = 20;
const DRINK_TYPES = {
    sapcas:    { name: '삽카스',   rarity: 'common',    emoji: '🥤', color: 0x4a9d3a, hex: '#4a9d3a', effect: 'coin',    durationMs: 30000, line: '어우 시원~ 삽카스!' },
    hotsaps:   { name: '핫삽스',   rarity: 'rare',      emoji: '🧃', color: 0xff5544, hex: '#ff5544', effect: 'combo',   durationMs: 30000, line: '핫삽스! 손이 빨라진다!' },
    redsap:    { name: '레드삽',   rarity: 'epic',      emoji: '🍹', color: 0x4499ff, hex: '#4499ff', effect: 'digMult', durationMs: 60000, line: '레드삽! 진행이 빠르다!' },
    energasap: { name: '에너자삽', rarity: 'legendary', emoji: '⚡', color: 0xffd700, hex: '#ffd700', effect: 'all',     durationMs: 30000, line: '에너자삽! 무적이다!!!' }
};
const DRINK_RARITY_WEIGHTS = { sapcas: 60, hotsaps: 25, redsap: 12, energasap: 3 };
const DRINK_BONUS = {
    coin:    1.20,    // 코인 +20%
    combo:   1.50,    // 콤보 윈도우 1.5배 (잘 안 끊김)
    digMult: 1.50     // 진행 카운트 1.5배
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POWER DIG LIMITED DROP — 스윗스팟 정조준 보너스
//   캐릭터 아래쪽에 강조 박스 + 금색 곡괭이 아이콘이 둥실 떠다니다
//   "정확히" 탭하면 ×2 코인 + 콤보 +5 보너스. 빗나가도 일반 dig는 정상 작동.
//   - 캐주얼 톤 유지: 페널티 없음. 정조준은 "추가 보상" 개념 (놓쳐도 손해 X)
//   - 첫 레이어에서 보장 1회 등장 → 시스템 인지 + 그 후 25탭마다 25% 굴림
//   - 위치: 캐릭터 아래(엄지 도달 영역) → 한 손 그립에서 탭 용이
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const POWERDIG_SPAWN_INTERVAL      = 25;        // 매 N탭마다 굴림
const POWERDIG_SPAWN_CHANCE        = 0.25;      // 25% 등장 확률
const POWERDIG_FIRST_GUARANTEED_AT = 15;        // 매 레이어 진입 후 이 탭에 무조건 1회
const POWERDIG_LIFETIME_MS         = 5000;      // 5초 머무르고 자동 페이드아웃
const POWERDIG_HIT_RADIUS          = 225;       // 정조준 히트 반경 (px) — 박스 + 살짝 패딩 (시각 3배 확대 대응)
const POWERDIG_BONUS_COIN_MULT     = 2.0;       // 명중 시 그 탭 코인 ×2
const POWERDIG_BONUS_COMBO_ADD     = 5;         // 명중 시 콤보 +5
const POWERDIG_REACTION_LINES = [
    '오! 파워곡괭이!',
    'POWER DIG 떴다!',
    '이거 한 방이면!',
    '풀파워 가즈아!'
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 기상 악화 (실외 레이어 한정 코스메틱)
//   40탭마다 8% 굴림 + 한 번 발동하면 12초 지속
//   페널티 X (모바일 캐주얼 짜증 회피) — 시각/사운드/독백만
//   WEATHER_FIRST_GUARANTEED_AT: 매 실외 레이어 진입 후 이 탭에 무조건 1회
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const WEATHER_INTERVAL            = 40;
const WEATHER_CHANCE              = 0.08;
const WEATHER_DURATION            = 12000;
const WEATHER_FIRST_GUARANTEED_AT = 30;
// 실내 레이어 (날씨 발동 X)
const WEATHER_INDOOR_LAYERS = new Set(['layer_004']);   // 찜질방
const WEATHER_TYPES = {
    rain:    { name: '비바람', tint: 0x2244aa, tintAlpha: 0.25, line: '비가 오고 지랄이야...',     particleColor: 0xaaccff },
    snow:    { name: '눈보라', tint: 0xc0d4e8, tintAlpha: 0.30, line: '춥다... 손가락 얼겠어',      particleColor: 0xffffff },
    typhoon: { name: '태풍',   tint: 0x111133, tintAlpha: 0.40, line: '이거 진짜 미친 거 아냐?',    particleColor: 0xbbccdd }
};
const WEATHER_KEYS = Object.keys(WEATHER_TYPES);
const COLLAPSE_LINE    = '쓰러질 것 같아...';
const JACKPOT_LINE     = '대박!!!';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOUL-OUT 게이지 시스템 (사용자 스펙)
//   - 시작 100, 탭마다 -0.5
//   - 시간당 회복 (초당 +2.0) → 가만히 있으면 ~50초에 0→100
//   - 단계: 100~70 열정(combo) / 70~40 보통(dig) / 40~10 지침(idle+👻) / 10~0 번아웃(👻×3+흔들림+효율-50%)
//   - 0% 도달 시: 5초간 dig 차단 → 자동 20%로 회복
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SOUL_MAX               = 100;
const SOUL_DRAIN_PER_TAP     = 0.5;
const SOUL_REGEN_PER_SECOND  = 2.0;       // 가만 두면 초당 +2 회복
const SOUL_BURNOUT_PAUSE_MS  = 5000;      // 0% 도달 시 멈춤 시간
const SOUL_BURNOUT_RECOVER   = 20;        // 멈춤 후 회복되는 게이지 값
const SOUL_BURNOUT_EFFICIENCY = 0.5;      // 10% 미만 시 코인 효율 (×0.5)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 보물 발견 강화 (사용자 스펙)
//   - 보물 출현 직전 0.3초 황금빛 반짝 + 두근두근 (heartbeat)
//   - 발견 순간 surprise 텍스처 + 0.5초 슬로우모션 (timeScale)
//   - legendary는 '대박!!!' 말풍선 + 승리 멜로디 + 화면 가장자리 유령 10마리
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TREASURE_FORESHADOW_MS = 300;
const JACKPOT_GHOST_COUNT    = 10;
const JACKPOT_GHOST_DURATION = 3000;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 코믹 디테일 (사장님 요청 — 땀방울 / 영혼 / 마음의 소리 / 쪽잠 / 코피)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 땀방울: SOUL ≤ SWEAT_SOUL_THRESHOLD OR 콤보 ≥ SWEAT_COMBO_THRESHOLD에서 활성
const SWEAT_SOUL_THRESHOLD   = 50;   // SOUL 50% 이하면 땀
const SWEAT_COMBO_THRESHOLD  = 50;   // 콤보 50+면 땀
const SWEAT_FREQ_NORMAL      = 800;  // 기본 빈도 (ms당 1방울)
const SWEAT_FREQ_HOT         = 400;  // 콤보 100+ 굵게
const SWEAT_FREQ_FLOOD       = 200;  // 콤보 200+ 폭포

// 영혼: SOUL ≤ SOUL_GHOST_OUT에서 등장, ≥ SOUL_GHOST_IN에서 회수
const SOUL_GHOST_OUT         = 20;   // 20% 이하 → 영혼 둥실
const SOUL_GHOST_IN          = 30;   // 30% 회복 → 머리로 회수 (히스테리시스)

// 마음의 소리 (혼잣말 monologue와 다른 톤 — 작고 흐릿한 thought bubble)
const THOUGHT_INTERVAL_MIN   = 25000;  // 25~45초 간격 무작위
const THOUGHT_INTERVAL_MAX   = 45000;
const THOUGHT_LINES = [
    '오늘만 일하고 그만둔다...',
    '이 돈이면 라면 몇 봉...',
    '팔이 떨어질 거 같아',
    '사장님 어디 갔지',
    '5분만 더...',
    '집에 가고 싶다...',
    '이 정도면 충분하지',
    '월급은 언제...',
    '나 왜 여기 있지',
    '엄마 보고 싶다'
];

// 쪽잠: 무탭 N초 지나면 졸음. 다시 탭하면 깜짝 깨어남
const SLEEP_AFTER_MS         = 30000;  // 30초 무탭 → 졸음

// 코피: 콤보 100 도달 정확히 그 시점에 한 번 발동
const NOSEBLEED_COMBO_TRIGGER = 100;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        this.layerOrder = 1;            // 현재 레이어 번호 (1~)
        this.layerData = null;          // layers.js의 현재 레이어 객체
        this.digCount = 0;              // 현재 레이어 삽질 횟수 (정수, 콤보+삽 배율 누적 후 floor)
        this.digFraction = 0;           // 멀티플라이어 누적용 소수 캐리 (1탭=1.5배 같은 비정수 처리)
        this.foreshadowCooldown = 0;    // foreshadow 발동 후 N탭 동안 재발동 차단

        // ━━ 에너지 드링크 버프 ━━
        // 각 효과의 만료 timestamp (this.time.now 기준). 0 = 비활성
        this.tapsSinceLastDrinkCheck = 0;
        this.activeBuffs = { coin: 0, combo: 0, digMult: 0 };
        this.buffEdgeGlow = null;       // 화면 가장자리 글로우 graphics
        this.buffHUD = null;            // 활성 버프 텍스트 컨테이너 (SOUL 게이지 옆)
        this._lastBuffHudState = '';    // 변경 감지 캐시 (매 프레임 재생성 방지)
        // 게임 처음 실행 시 첫 드링크/기상 보장 플래그 (인스턴스 단위 — 씬 재시작 시 리셋)
        this.firstDrinkEverSpawned = false;
        this.firstWeatherEverSpawned = false;

        // ━━ 기상 악화 ━━
        this.tapsSinceLastWeatherCheck = 0;
        this.weatherActive = null;      // { type, particles, tintRect, endsAt, cleanupTimer }
        this.combo = 0;                 // 연속 콤보
        this.lastDigTime = 0;           // 마지막 탭 시각
        this.comboWindow = 1500;        // 콤보 유지 시간(ms)

        this.firedComicTriggers = new Set(); // 이번 레이어에서 이미 발동한 코믹 트리거 값들
        this.treasurePopupActive = false;    // 보물 팝업이 떠있는 동안 입력 차단
        this.comicBubble = null;             // 현재 떠있는 NPC 말풍선 컨테이너

        this.clearActive = false;            // 레이어 클리어 연출 진행 중 (입력 차단 + clear 텍스처)
        this.digRevertTimer = null;          // dig 텍스처 → 베이스 상태 복귀 타이머
        this.panicRevertTimer = null;        // panic 텍스처 → 베이스 상태 복귀 타이머 (3초)
        this.surpriseRevertTimer = null;     // surprise 텍스처 → 베이스 상태 복귀 타이머 (보물·장애물 등장)
        this.characterId = 'char_001';       // 현재 캐릭터 ID (추후 캐릭터 선택 시 동적)

        // 흙 파티클 색상 팔레트 (3색, loadLayer에서 soilType 기반 갱신) / 흙더미 단색
        this.currentDirtPalette = SOIL_TYPE_COLORS.dirt;  // [기본, 밝게, 어둡게]
        this.currentMoundColor  = 0x4a2f1a;

        // 캐릭터 좌우 삽질 모션 (탭 시 왼쪽으로 이동 후 복귀)
        this.charBaseX = null;       // 정지 위치 X (create에서 설정)
        this.charMoveTween = null;   // 진행 중인 좌우 이동 트윈

        // 배경 스크롤 TileSprite (create에서 생성)
        this.scrollBg = null;

        // 지하 무한 루프 텍스처 사용 중 플래그
        // false → 원본 텍스처(레이어 지상~지하 전체) 스크롤 중
        // true  → 지하 전용 잘라낸 텍스처로 무한 wrap 스크롤 중
        this.usingLoopTexture = false;

        // 누적 스크롤량 (텍스처 wrap에 무관하게 항상 증가)
        // → drawHole의 hole 크기 계산에 사용 (루프 전환 시 점프 방지)
        // → loadLayer에서 0으로 리셋
        this.virtualScrollY = 0;

        // 구덩이 + 흙더미 시스템
        this.holeImage = null;                // 구덩이 Image (hole.png)
        this.leftMound = null;                // 좌 흙더미 Image (mound_right.png + flipX)
        this.rightMound = null;               // 우 흙더미 Image (mound_right.png)
        this.leftMoundBBox = null;            // 파티클 충돌 검사용 (월드 좌표 bbox)
        this.rightMoundBBox = null;

        // 깊이 누적 (탭마다 +10cm) - 세션 동안만 유지
        this.totalDepthCm = 0;
        this.depthText = null;                // create()에서 생성

        // ━━ SOUL-OUT 게이지 ━━
        this.soulGauge          = SOUL_MAX;   // 0~100
        this.soulRegenAccum     = 0;          // delta 누적 (초당 SOUL_REGEN_PER_SECOND 적용)
        this.lastSoulUpdateTime = 0;          // 회복 보간용 (ms)
        this.burnoutActive      = false;      // 번아웃 중이면 dig 차단
        this.burnoutEndTime     = 0;          // 번아웃 종료 ms (시각 비교)
        this.soulGhostEmojis    = [];         // 입에서 떠다니는 👻 텍스트들 (최대 3개)
        this.soulShakeTween     = null;       // 번아웃 캐릭터 흔들림 트윈

        // ━━ 랜덤 장애물 ━━
        this.tapsSinceLastObstacleCheck = 0;  // 매 OBSTACLE_TAP_INTERVAL 탭마다 확률 굴림
        this.currentObstacle    = null;       // { type, tapsLeft, container, emojiText, hpBar, hpBarBg }
        this.treasureBoostUntil = 0;          // 장애물 깬 후 추가 보물 확률 부스트 만료 ms

        // ━━ 캐릭터 혼잣말 ━━
        this.tapsSinceLastMonologue = 0;
        this.characterBubble = null;          // 캐릭터 머리 위 말풍선 컨테이너
        this.firedComboMonologues = new Set(); // 콤보 라인 1회씩만 (10/30/50/100)

        // ━━ 보물 강화 ━━
        this.foreshadowGfx = null;            // 발견 직전 황금빛 반짝 graphics
        this.foreshadowTween = null;

        // ━━ POWER DIG 스윗스팟 ━━
        // powerDigBox = { container, glow, radius, expiresAt } 또는 null
        this.tapsSinceLastPowerDigCheck = 0;
        this.firstPowerDigEverSpawned = false;
        this.powerDigBox = null;

        // ━━ 코믹 디테일 (땀/영혼/마음의 소리/쪽잠/코피) ━━
        this.sweatEmitterLeft  = null;        // 캐릭터 머리 좌측 땀 emitter
        this.sweatEmitterRight = null;        // 우측 땀 emitter
        this.soulGhost = null;                // SOUL 낮을 때 머리 위 둥실 👻
        this.soulGhostTween = null;
        this.thoughtBubble = null;            // 현재 떠있는 마음의 소리 풍선
        this.nextThoughtAt = 0;               // 다음 마음의 소리 시각 (this.time.now 기준)
        this.sleepIcon = null;                // 졸음 💤 (쪽잠 활성 시)
        this.sleepingActive = false;          // 쪽잠 중 (다음 탭에 깜짝 깨어남)
    }

    create() {
        const { width, height } = this.cameras.main;

        // 매니저 초기화
        this.soundManager = new SoundManager(this);
        this.currencyManager = new CurrencyManager();

        // 현재 사용 중인 캐릭터 ID — CurrencyManager에서 매번 갱신 (씬 재진입 시도 반영)
        // 선택 캐릭터 idle 자산 미로드 시 char_001 폴백 → 게임 깨짐 방지
        const selectedId = this.currencyManager.selectedCharacterId || 'char_001';
        this.characterId = this.textures.exists(`${selectedId}_idle`) ? selectedId : 'char_001';

        // ━━ 캐릭터 lazy load (BootScene은 char_001 8장 + char_002~006 idle만 로드) ━━
        // 게임 진입 시 currentCharacter의 나머지 7 상태(dig/combo/surprise/clear/tired/panic/dig_hard)
        // 백그라운드 로드. 1~2초 안에 완료. 그 동안엔 idle 유지(setCharacterState textures.exists 체크 폴백)
        this.lazyLoadCharacterStates(this.characterId);

        // 진행 중인 레이어 — CurrencyManager에서 가져와 이어가기 보장
        // 캐릭터 변경 / 앱 재시작 무관하게 마지막 레이어부터 재개
        this.layerOrder = this.currencyManager.currentLayer || 1;

        // 배경 폴백 사각형 — 어두운 흙 (사장님 보고: 황토색 깜빡 → 지하 톤으로 통일)
        // 깊이 들어간 후 wrap 직전 1프레임 노출돼도 황토색 대신 자연스러운 어두운 흙
        this.bg = this.add.rectangle(width / 2, height / 2, width, height, 0x2a1a0a);

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

        // 상단 HUD (재화) - depth 20: hole(4)/캐릭터(10)/흙더미(11) 위로 항상 노출
        this.coinText = this.add.text(30, 30, '🪙 0', {
            font: 'bold 32px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 4
        }).setDepth(20);
        this.diamondText = this.add.text(30, 75, '💎 0', {
            font: 'bold 28px sans-serif', color: '#7df9ff', stroke: '#000', strokeThickness: 4
        }).setDepth(20);
        this.relicText = this.add.text(30, 115, '🏺 0', {
            font: 'bold 28px sans-serif', color: '#d2691e', stroke: '#000', strokeThickness: 4
        }).setDepth(20);

        // 우상단: 레이어 정보 - depth 20: 깊이 파면 hole이 화면 위쪽까지 자라도 글자 가리지 않음
        this.layerText = this.add.text(width - 30, 30, '', {
            font: 'bold 28px sans-serif', color: '#ffffff', stroke: '#000', strokeThickness: 4
        }).setOrigin(1, 0).setDepth(20);
        this.layerNameText = this.add.text(width - 30, 65, '', {
            font: '22px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 3
        }).setOrigin(1, 0).setDepth(20);
        this.progressText = this.add.text(width - 30, 100, '', {
            font: '24px sans-serif', color: '#ffffff', stroke: '#000', strokeThickness: 3
        }).setOrigin(1, 0).setDepth(20);

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

        // 캐릭터 이름 (화면 최상단 중앙) - 콤보/팝업 텍스트와 겹치지 않도록 상단 고정
        // origin (0.5, 0) → x = 화면 중앙, y = 30이 텍스트 상단 위치
        this.characterLabel = this.add.text(
            width / 2,
            30,
            '박삽돌',
            { font: 'bold 24px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 4 }
        ).setOrigin(0.5, 0).setDepth(20);

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

        // hole.png 자체의 하단 투명 padding 자동 측정 (drawHole에서 보정용)
        //   문제: hole 이미지에 하단 padding이 있으면 origin (0.5, 1.0) 기준 이미지 하단(=character.y)이
        //         시각적 굴 바닥보다 아래에 있어 캐릭터 발이 굴 밖으로 노출됨 (layer 3+에서 사용자 인지)
        //   해결: PNG 픽셀 분석해서 하단부터 첫 alpha>0 row까지를 padding ratio로 보관
        //         drawHole에서 이미지를 그만큼 아래로 내려서 시각 바닥이 character.y와 일치하게
        this.holeBottomPaddingRatio = this.measureBottomPaddingRatio('hole');

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

        // ━━ 땀방울 파티클 (사장님 요청 — 코믹 디테일) ━━
        // 작은 푸른 물방울 텍스처 즉석 생성, 머리 양옆에서 사선 아래로 튀김
        // SOUL/콤보 임계 따라 update()에서 frequency 조절. 시작은 비활성(-1).
        if (!this.textures.exists('__sweatDrop')) {
            const wg = this.make.graphics({ x: 0, y: 0, add: false });
            wg.fillStyle(0x6ec6ff, 1);                  // 푸른빛 물방울
            wg.fillCircle(4, 4, 4);
            wg.generateTexture('__sweatDrop', 8, 8);
            wg.destroy();
        }
        const sweatBaseConfig = {
            speed: { min: 120, max: 200 },
            gravityY: 600,
            lifespan: { min: 500, max: 800 },
            scale: { start: 1.4, end: 0.6 },
            alpha: { start: 1, end: 0 },
            quantity: 1,
            frequency: -1                                // 시작은 비활성
        };
        this.sweatEmitterLeft = this.add.particles(0, 0, '__sweatDrop', {
            ...sweatBaseConfig,
            angle: { min: 200, max: 240 }                // 좌측은 좌하 사선
        }).setDepth(11);
        this.sweatEmitterRight = this.add.particles(0, 0, '__sweatDrop', {
            ...sweatBaseConfig,
            angle: { min: 300, max: 340 }                // 우측은 우하 사선
        }).setDepth(11);

        // 콤보 표시 — 캐릭터 머리 위 충분히 위로 (혼잣말 말풍선과 겹치지 않도록 130px 마진)
        // 말풍선은 머리 위 20px에 등장(높이 ~60~70px)이라 그 위로 더 띄워야 함
        // depth 16: 사장님 보고 "콤보가 굴 뒤로 숨어 안 보임" — hole(4)/캐릭터(10)/dirtEmitter(15) 위로
        //           HUD(20)는 안 가림
        const comboY = this.character.y - this.character.displayHeight - 130;
        this.comboText = this.add.text(width / 2, comboY, '', {
            font: 'bold 56px sans-serif', color: '#ffd700', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0).setDepth(16);

        // 탭 영역 (화면 전체) - 장애물이 화면 정중앙에 등장하므로 어디 탭해도 인식되어야 함
        // depth 0 (배경 위, HUD/캐릭터/장애물 아래) → 다른 UI 클릭 차단 안 함
        this.tapZone = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
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

        // ━━━ SOUL-OUT 게이지 (좌측 세로바) ━━━
        // 위치: x=14, y=170 (재화 HUD 아래) ~ height-220 (depthText 위)
        // 폭 12, depth 20 = HUD 레벨
        const SOUL_X = 14;
        const SOUL_Y = 170;
        const SOUL_W = 12;
        const SOUL_H = Math.max(120, height * 0.28);
        // 배경 (검은 테두리)
        this.soulGaugeBg = this.add.rectangle(SOUL_X, SOUL_Y, SOUL_W, SOUL_H, 0x000000, 0.55)
            .setOrigin(0, 0).setDepth(20).setStrokeStyle(2, 0xffffff, 0.7);
        // 채우기 (위에서 아래로 줄어들도록 origin (0,1) → 아래 기준 위로 자람)
        this.soulGaugeFill = this.add.rectangle(SOUL_X, SOUL_Y + SOUL_H, SOUL_W, SOUL_H, 0xff5577, 1)
            .setOrigin(0, 1).setDepth(21);
        // 위쪽 영혼 아이콘 라벨 (👻)
        this.soulGaugeLabel = this.add.text(SOUL_X + SOUL_W / 2, SOUL_Y - 4, '👻', {
            font: '22px sans-serif'
        }).setOrigin(0.5, 1).setDepth(22);
        // 백분율 텍스트 (게이지 아래)
        this.soulGaugeText = this.add.text(SOUL_X + SOUL_W / 2, SOUL_Y + SOUL_H + 4, '100%', {
            font: 'bold 14px sans-serif', color: '#ffffff',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5, 0).setDepth(22);
        // 보관 (resize용)
        this._soulGaugeRect = { x: SOUL_X, y: SOUL_Y, w: SOUL_W, h: SOUL_H };

        // ━━━ 활성 버프 HUD (SOUL 게이지 오른쪽) ━━━
        // 드링크 마시면 여기에 [이모지 + 효과 + 남은 초] 라인이 추가됨
        // 가장자리 글로우는 "뭔가 활성됨"만 알려주고, 어떤 효과인지/얼마 남았는지는 여기서 확인
        this.buffHUD = this.add.container(SOUL_X + SOUL_W + 10, SOUL_Y).setDepth(22);

        // ━━━ 보물 발견 직전 황금빛 foreshadow graphics ━━━
        // 캐릭터 발 주변에 잠시 황금빛 반짝임 표시 (depth 9 = 캐릭터 바로 아래)
        this.foreshadowGfx = this.add.graphics().setDepth(9).setAlpha(0);

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

        // 콤보 텍스트 — 캐릭터 머리 위 위치 재동기화 (캐릭터.y 고정이라 X만 갱신해도 충분)
        if (this.comboText && this.character) {
            const comboY = this.character.y - this.character.displayHeight - 130;
            this.comboText.setPosition(width / 2, comboY);
        }

        // 탭 영역 (화면 전체) - 위치 + 사이즈 + 히트 영역까지 갱신
        if (this.tapZone) {
            this.tapZone.setPosition(width / 2, height / 2);
            this.tapZone.setSize(width, height);
            // 히트 영역도 함께 갱신 (Phaser는 자동 갱신 안 함)
            if (this.tapZone.input && this.tapZone.input.hitArea) {
                this.tapZone.input.hitArea.setTo(0, 0, width, height);
            }
        }

        // 안내 텍스트 (탭 힌트)
        if (this.tapHintText) this.tapHintText.setPosition(width / 2, height * 0.92);

        // 좌하단 깊이 표시 + 우하단 메뉴 버튼 (시스템 UI 영역 회피용 마진)
        if (this.depthText) this.depthText.setPosition(30, height - HUD_BOTTOM_MARGIN);
        if (this.menuBtn)   this.menuBtn.setPosition(width - 30, height - HUD_BOTTOM_MARGIN);

        // 캐릭터 라벨 위치 재동기화 (상단 중앙 고정 - 화면 너비 변화 시 X만 갱신)
        if (this.characterLabel) {
            this.characterLabel.setPosition(width / 2, 30);
        }

        // SOUL-OUT 게이지 (높이만 화면 비율에 맞춰 갱신, X는 좌측 고정)
        if (this.soulGaugeBg && this._soulGaugeRect) {
            const newH = Math.max(120, height * 0.28);
            this._soulGaugeRect.h = newH;
            this.soulGaugeBg.setSize(this._soulGaugeRect.w, newH);
            this.soulGaugeFill.setSize(this._soulGaugeRect.w, newH);
            // origin (0,1)이라 y는 게이지 바닥 위치
            this.soulGaugeFill.y = this._soulGaugeRect.y + newH;
            this.soulGaugeText.setPosition(
                this._soulGaugeRect.x + this._soulGaugeRect.w / 2,
                this._soulGaugeRect.y + newH + 4
            );
            this.drawSoulGauge();   // 사이즈 변경 후 즉시 재계산
        }

        // 기상 tint 오버레이 사이즈/위치 갱신 (화면 회전 등)
        if (this.weatherActive && this.weatherActive.tintRect) {
            this.weatherActive.tintRect.setSize(width, height);
            this.weatherActive.tintRect.setPosition(width / 2, height / 2);
        }
        // 버프 가장자리 글로우 재그림 (사이즈 바뀐 만큼 새 테두리)
        this.refreshBuffEdgeGlow();
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
        this.digFraction = 0;           // 새 레이어 진입 시 fraction 캐리도 리셋
        // 영구 저장 — 캐릭터 변경 / 앱 재시작 후도 이 레이어부터 이어가기
        if (this.currencyManager && typeof this.currencyManager.setCurrentLayer === 'function') {
            this.currencyManager.setCurrentLayer(order);
        }
        this.foreshadowCooldown = 0;    // foreshadow 쿨다운도 리셋
        this.tapsSinceLastDrinkCheck = 0;
        this.tapsSinceLastWeatherCheck = 0;
        this.tapsSinceLastPowerDigCheck = 0;
        // 매 레이어 진입마다 첫 드링크/기상/POWER DIG 보장 → 모든 레이어에서 시스템 인지 + 자주 노출
        this.firstDrinkEverSpawned = false;
        this.firstWeatherEverSpawned = false;
        this.firstPowerDigEverSpawned = false;
        // 진행 중이던 POWER DIG 박스가 있으면 즉시 정리 (다음 레이어로 이월 X)
        if (this.powerDigBox) {
            if (this.powerDigBox.container) this.powerDigBox.container.destroy();
            this.powerDigBox = null;
        }
        this.combo = 0;
        this.firedComicTriggers.clear();

        // 진행 중이던 날씨 즉시 종료 (다음 레이어가 실내일 수 있음 + 시각적으로 깔끔)
        if (this.weatherActive) this.endWeather();
        // 가장자리 글로우 즉시 재계산 (새 화면 사이즈 대응)
        this.refreshBuffEdgeGlow();

        // 캐릭터 y는 모든 레이어에서 CHARACTER_Y(=903) 고정 (배경 이미지 지표면과 정확히 일치)
        // (구) bgUnder 단색 Rectangle 갱신 코드 제거 - 배경 이미지에 지하 단면 포함됨

        // 캐릭터 의존 객체(구멍/흙더미/라벨) 위치 재동기화 (안전망)
        this.updateCharacterDependentPositions();

        // 클리어 연출 종료 → 캐릭터 idle 복귀
        this.clearActive = false;
        this.cancelDigRevert();
        if (this.character) this.setCharacterState('idle');

        // 배경 폴백 (bgImage 로드 실패 시) - 레이어 색
        this.bg.fillColor = layer.bgColor;

        // 레이어 배경 이미지 교체 + 타일 스케일 재계산 + 초기 tilePositionY 리셋
        // 새 레이어는 항상 원본 텍스처(지상~지하 전체)부터 시작 → 루프 플래그도 리셋
        const bgKey = `${layer.id}_bg`;
        this.usingLoopTexture = false;
        this.virtualScrollY = 0;
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

        // ━━ 번아웃 중이면 dig 차단 (5초 자동 정지) ━━
        if (this.burnoutActive) return;

        // ━━ 쪽잠 모드 깨어남 — 졸음 중이었으면 깜짝 깨어남만 처리하고 이번 탭은 dig 안 함 ━━
        // 첫 탭은 깨어나는 데 소비, 다음 탭부터 정상 dig (모바일 게임 패턴 — 깨어남 시각 인지)
        if (this.sleepingActive) {
            this.exitSleepMode();
            this.lastDigTime = this.time.now;
            return;
        }

        // ━━ POWER DIG 정조준 명중 체크 (장애물보다 먼저, 보너스 플래그만 세움) ━━
        // 박스 안에 떨어진 탭은 일반 dig + 보너스(코인×2, 콤보+5) 둘 다 적용
        // 빗나가도 정상 dig 진행 → 캐주얼 톤 유지
        let powerDigHit = false;
        if (this.powerDigBox && this._isInPowerDig(x, y)) {
            powerDigHit = true;
            this._consumePowerDig();
        }

        // ━━ 장애물 활성 중이면 → 일반 dig 대신 장애물에 탭 카운트 ━━
        if (this.currentObstacle) {
            this.hitObstacle(x, y);
            return;
        }

        const now = this.time.now;

        // ━━ 콤보 판정 (강화: 윈도우 보호 — 고콤보일수록 잘 안 끊김) ━━
        // 기본 1500ms / 콤보 50+: ×1.33 (2000ms) / 콤보 100+: ×1.67 (2500ms)
        // 핫삽스 버프(×1.5)와 max로 합성 → 둘 중 더 큰 윈도우 적용
        let comboProtectMult = 1.0;
        if (this.combo >= 100)      comboProtectMult = 1.67;
        else if (this.combo >= 50)  comboProtectMult = 1.33;
        const drinkComboMult = (this.activeBuffs.combo > now) ? DRINK_BONUS.combo : 1.0;
        const effComboWindow = this.comboWindow * Math.max(comboProtectMult, drinkComboMult);
        const prevCombo = this.combo;
        if (now - this.lastDigTime < effComboWindow) {
            this.combo += 1;
        } else {
            this.combo = 1;
            this.firedComboMonologues.clear();   // 콤보 끊기면 콤보 라인 다시 노출 가능
        }
        // POWER DIG 명중 시 콤보 +5 추가 부스트 (정상 콤보 +1 위에 누적)
        if (powerDigHit) this.combo += POWERDIG_BONUS_COMBO_ADD;
        this.lastDigTime = now;

        // ━━ 코피/초집중 — 콤보가 100 임계를 넘는 순간 한 번만 발동 ━━
        // prevCombo<100 → combo>=100. POWER DIG +5 보너스로 한 번에 넘는 케이스도 OK
        if (prevCombo < NOSEBLEED_COMBO_TRIGGER && this.combo >= NOSEBLEED_COMBO_TRIGGER) {
            this.triggerNosebleed();
        }

        // ━━ 진행 카운트 멀티플라이어 (강화: 100+ 단계 추가) ━━
        //   콤보:  10+ → 1.5x  /  50+ → 2.0x  /  100+ → 3.0x (NEW)
        //   삽:    나무 1.0 / 철 1.5 / 강철 2.0 / 미스릴+ 2.5
        //   기본 1 × 콤보배율 × 삽배율 → 이번 탭의 카운트 가산값
        // 비정수 처리: digFraction에 누적 → floor만 digCount에 반영
        let digMult = 1.0;
        if (this.combo >= 100)     digMult *= 3.0;
        else if (this.combo >= 50) digMult *= 2.0;
        else if (this.combo >= 10) digMult *= 1.5;
        const SHOVEL_DIG_MULT = [1.0, 1.5, 2.0, 2.5];
        const sLvl = Math.min(this.currencyManager.shovelLevel || 0, SHOVEL_DIG_MULT.length - 1);
        digMult *= SHOVEL_DIG_MULT[sLvl];
        // 레드삽 버프 활성 시 진행 1.5배 추가
        if (this.activeBuffs.digMult > now) digMult *= DRINK_BONUS.digMult;

        this.digFraction += digMult;
        const inc = Math.floor(this.digFraction);
        this.digFraction -= inc;
        const prevDigCount = this.digCount;
        this.digCount += inc;

        // 장애물 체크/혼잣말은 "탭 횟수" 기반 (배율 X) → 그대로 +1
        this.tapsSinceLastObstacleCheck += 1;
        this.tapsSinceLastMonologue     += 1;

        // 캐릭터: dig 텍스처로 즉시 전환 → 0.3초 후 베이스 상태(idle/combo)로 복귀
        this.playDigAnimation();

        // 캐릭터 좌측 15px 이동 후 복귀 (삽질 모션)
        this.playDigShovelMotion();

        // ━━ 흙 파티클 분출 (삽 레벨에 따라 개수 차등) ━━
        // 사용자 스펙: 나무25 / 철50 / 강철75 / 미스릴100
        const lvl = Math.min(this.currencyManager.shovelLevel || 0, SHOVEL_PARTICLE_COUNTS.length - 1);
        const circleCount = SHOVEL_PARTICLE_COUNTS[lvl];
        const squareCount = SHOVEL_PARTICLE_SQUARE[lvl];
        // origin (0.5, 1)이라 character.y가 발 위치 = 삽이 흙을 파는 지점
        const emitX = this.charBaseX;
        const emitY = this.character.y;
        if (this.dirtEmitter)       this.dirtEmitter.explode(circleCount, emitX, emitY);
        if (this.dirtEmitterSquare) this.dirtEmitterSquare.explode(squareCount, emitX, emitY);

        // 충격파 원형 이펙트 (흰색 반투명 링이 빠르게 퍼졌다 사라짐)
        this.playTapShockwave(emitX, emitY);

        // ━━ 카메라 셰이크 - hard soil(돌/타일)이면 더 강한 충격 + 흰색 플래시 + 돌 이모지 분출 ━━
        const isHard = this.soundManager.isHardSoil(this.layerData.soilType);
        if (isHard) {
            this.cameras.main.shake(180, 0.020);     // 셰이크 강화 (120ms/0.012 → 180ms/0.020)
            this.cameras.main.flash(150, 255, 255, 255, false);  // 흰색 플래시 (손저린 연출)
            // 돌 부딪힘 시각 효과: 🪨 이모지 + 💥 스파크가 발치에서 튀어오름
            this.spawnHardHitEffect(emitX, emitY);
        } else {
            this.cameras.main.shake(60, 0.005);
        }

        // 배경 위로 스크롤 (탭마다 2~3px, 콤보 10+ 시 4~5px) - 파고 내려가는 느낌
        // ━━ B-2 무한 지하 루프 ━━
        //   Phase 1: 원본 텍스처(지상→지하 전체) 스크롤. tilePos가 LOOP_START_ROW에 도달하면
        //            "지하 전용" 잘라낸 텍스처로 seamless 전환 (overshoot만큼 새 tilePos에 반영).
        //   Phase 2: 루프 텍스처(높이 LOOP_TEXTURE_HEIGHT). tilePositionY를 그 높이로 모듈로
        //            연산해서 무한 wrap → 그 레이어 고유의 지하 패턴이 끝없이 이어짐.
        if (this.bgImage && this.bgImage.type === 'TileSprite') {
            // ━━ 진행도 비례 가속 (2차 강화) ━━
            // 1차(2.5x)도 끝에 지상 보임 — 배율 부족. 4.5x로 상향.
            //   요구 처방: 100탭 레이어 기준 평균 baseScroll 3.5px × 4.5 = 15.75px/탭
            //   누적 ≈ 1500px. LOOP_START_ROW(1300) 충분히 넘김.
            const required = (this.layerData && this.layerData.requiredDigs) || 100;
            const progress = Math.min(1, this.digCount / required);
            const accelMult = 1.0 + progress * 3.5;   // 시작 1.0 → 끝 4.5
            const baseScroll = this.combo >= 10
                ? Phaser.Math.Between(4, 5)
                : Phaser.Math.Between(2, 3);
            const scrollAmount = Math.round(baseScroll * accelMult);

            // 누적 스크롤량 갱신 (루프 wrap에 무관하게 항상 증가) → drawHole에서 사용
            this.virtualScrollY += scrollAmount;

            if (!this.usingLoopTexture) {
                const newTilePos = this.bgImage.tilePositionY + scrollAmount;
                if (newTilePos >= LOOP_START_ROW) {
                    // 임계점 도달 → 루프 텍스처로 전환 (시각적으로 seamless)
                    const loopKey = this.ensureLoopTexture(this.layerData && this.layerData.id);
                    if (loopKey) {
                        this.bgImage.setTexture(loopKey);
                        this.applyBackgroundCoverFit();
                        // 루프 텍스처 row 0 = 원본 row LOOP_START_ROW와 동일한 픽셀
                        // 따라서 overshoot(=newTilePos - LOOP_START_ROW)만 새 tilePos로 설정
                        this.bgImage.tilePositionY = newTilePos - LOOP_START_ROW;
                        this.usingLoopTexture = true;
                    } else {
                        // 루프 텍스처 생성 실패(에셋 누락 등) - 안전망: 원본 끝에서 정지
                        this.bgImage.tilePositionY = LOOP_START_ROW;
                    }
                } else {
                    this.bgImage.tilePositionY = newTilePos;
                }
            } else {
                // Phase 2: 루프 텍스처 - 높이로 모듈로 연산하여 무한 wrap
                this.bgImage.tilePositionY =
                    (this.bgImage.tilePositionY + scrollAmount) % LOOP_TEXTURE_HEIGHT;
            }
        }

        // 깊이 누적 (1탭 = 10cm) + 텍스트 갱신
        this.totalDepthCm = (this.totalDepthCm || 0) + 10;
        if (this.depthText) {
            this.depthText.setText(`지하 ${(this.totalDepthCm / 100).toFixed(1)}m`);
        }

        // ━━ 코인 획득 ━━
        // 기본 1~5 + 삽 레벨 보너스 + 콤보 10+ 시 1.5배
        // SOUL 10% 미만이면 효율 ×0.5 ('번아웃 직전 지침')
        let coinGain = Phaser.Math.Between(1, 5) + this.currencyManager.getShovelBonus();
        if (this.combo >= 100)     coinGain = Math.floor(coinGain * 2.0);   // 100+ NEW
        else if (this.combo >= 10) coinGain = Math.floor(coinGain * 1.5);
        if (this.soulGauge < 10) coinGain = Math.max(1, Math.floor(coinGain * SOUL_BURNOUT_EFFICIENCY));
        // 삽카스 버프 활성 시 코인 +20%
        if (this.activeBuffs.coin > now) coinGain = Math.floor(coinGain * DRINK_BONUS.coin);
        // POWER DIG 정조준 보너스: 이번 탭 코인 ×2 (다른 모든 보너스 곱 후 마지막 적용)
        if (powerDigHit) coinGain = Math.floor(coinGain * POWERDIG_BONUS_COIN_MULT);
        this.currencyManager.addCoin(coinGain);
        // 코인 획득 사운드 (매 탭마다 살짝 다른 피치)
        this.soundManager.playCoinSound();

        // ━━ 콤보 보상 (강화: 금괴 시각으로 모던화 + 단계 추가 + 다이아 강화) ━━
        // 사장님 피드백: 유물조각 너무 올드 → 🪙 금괴 시각으로 변경 (실제 재화는 다이아삽)
        // 단계: 50 / 75 / 100 / 150 / 200 — 후반으로 갈수록 묵직
        if (this.combo === 50) {
            this.currencyManager.addDiamond(1);
            this.showFloatingText(x, y - 60, '🪙 +1 금괴!', '#ffd700');
        } else if (this.combo === 75) {
            this.currencyManager.addDiamond(2);
            this.showFloatingText(x, y - 60, '🪙 +2 금괴!', '#ffd700');
        } else if (this.combo === 100) {
            this.currencyManager.addDiamond(3);
            this.showFloatingText(x, y - 60, '🪙 +3 금괴! 100 콤보!', '#ffd700');
        } else if (this.combo === 150) {
            this.currencyManager.addDiamond(5);
            this.showFloatingText(x, y - 60, '🪙 +5 금괴! 150 콤보!', '#ffd700');
        } else if (this.combo === 200) {
            this.currencyManager.addDiamond(10);
            this.showFloatingText(x, y - 60, '🪙 +10 금괴! 200 콤보 전설!', '#ffd700');
        }

        // 코인 획득 이펙트
        this.showFloatingText(x, y, `+${coinGain}`, '#ffd700');

        // ━━ 콤보 표시 (강화: 단계별 색상 + 100+ 글로우 + 펄스) ━━
        // 2~49: 흰색 / 50~99: 빨강 / 100+: 황금 + setShadow 글로우 + scale 펄스
        if (this.combo >= 2) {
            this.comboText.setText(`COMBO x${this.combo}`);
            this.comboText.setAlpha(1);
            this.tweens.killTweensOf(this.comboText);

            if (this.combo >= 100) {
                // 황금 + 글로우 + 펄스 (전설)
                this.comboText.setColor('#ffd700');
                this.comboText.setShadow(0, 0, '#ffd700', 18, false, true);
                this.comboText.setScale(1.0);
                this.tweens.add({
                    targets: this.comboText,
                    scale: { from: 1.0, to: 1.25 },
                    duration: 200, yoyo: true, repeat: 1, ease: 'Sine.inOut'
                });
            } else if (this.combo >= 50) {
                // 빨강 (열정)
                this.comboText.setColor('#ff4444');
                this.comboText.setShadow(0, 0, '#ff0000', 10, false, true);
                this.comboText.setScale(1.0);
            } else {
                // 흰색 (기본)
                this.comboText.setColor('#ffffff');
                this.comboText.setShadow(0, 0, '#000000', 0, false, false);
                this.comboText.setScale(1.0);
            }

            this.tweens.add({
                targets: this.comboText, alpha: 0, duration: 800, delay: 600
            });
        }

        // ━━ 콤보 단계 도달 시 사운드 (강화: 9단계로 확장, 정확히 그 순간만) ━━
        // 10/20/30/40/50/75/100/150/200 — SoundManager.playComboSound 내부에서 단계별 다른 화음
        if (this.combo === 10 || this.combo === 20 || this.combo === 30 || this.combo === 40 ||
            this.combo === 50 || this.combo === 75 ||
            this.combo === 100 || this.combo === 150 || this.combo === 200) {
            this.soundManager.playComboSound(this.combo);
        }

        // ━━ 콤보 단계별 캐릭터 혼잣말 (10/30/50/100, 한 번씩만) ━━
        if (MONOLOGUE_LINES_COMBO[this.combo] && !this.firedComboMonologues.has(this.combo)) {
            this.firedComboMonologues.add(this.combo);
            this.showCharacterMonologue(MONOLOGUE_LINES_COMBO[this.combo]);
        }

        // ━━ 사운드 + 햅틱 (soilType 기반) ━━
        // hard(돌/타일)는 트리플 펄스 강진동 + 추가 보조 임팩트 사운드, 그 외는 삽 레벨별 차등
        this.soundManager.playDigSound(this.layerData.soilType);
        if (isHard) {
            this.soundManager.playHardSoilImpactSound();   // 두께 +1 레이어 (boom + clang)
            this.soundManager.triggerHardSoilHaptic();
        } else {
            this.soundManager.triggerHaptic(SHOVEL_HAPTIC_INTENSITY[lvl]);
        }

        // 코믹 이벤트 트리거 체크 (배율로 인해 카운트가 trigger를 넘어 점프할 수 있어 범위 검사)
        this.checkComicEvent(prevDigCount);

        // 잔상 플래시 (foreshadow) — 초기 레이어 1~3에서 가끔 후속 레이어 색 잠깐 깜빡
        this.maybeTriggerForeshadow();

        // 에너지 드링크 / 기상 악화 굴림
        this.tapsSinceLastDrinkCheck   += 1;
        this.tapsSinceLastWeatherCheck += 1;

        // 첫 드링크 보장 — 게임 처음 시작한 신규 유저가 layer_001(50탭)에서도 1번은 보게
        // (이전엔 INTERVAL 100탭이라 layer_001에서 spawn 굴림 자체가 없었음)
        if (!this.firstDrinkEverSpawned && this.digCount >= DRINK_FIRST_GUARANTEED_AT) {
            this.firstDrinkEverSpawned = true;
            this.tapsSinceLastDrinkCheck = 0;
            this.spawnDrink();
        } else if (this.tapsSinceLastDrinkCheck >= DRINK_SPAWN_INTERVAL) {
            this.tapsSinceLastDrinkCheck = 0;
            if (Math.random() < DRINK_SPAWN_CHANCE) this.spawnDrink();
        }

        // 첫 기상 보장 — 실외 레이어에서만 (찜질방 등 실내는 스킵)
        const layerOutdoor = this.layerData && !WEATHER_INDOOR_LAYERS.has(this.layerData.id);
        if (!this.firstWeatherEverSpawned && layerOutdoor && this.digCount >= WEATHER_FIRST_GUARANTEED_AT) {
            this.firstWeatherEverSpawned = true;
            this.tapsSinceLastWeatherCheck = 0;
            this.maybeStartWeather();
        } else if (this.tapsSinceLastWeatherCheck >= WEATHER_INTERVAL) {
            this.tapsSinceLastWeatherCheck = 0;
            if (Math.random() < WEATHER_CHANCE) this.maybeStartWeather();
        }

        // ━━ POWER DIG 스윗스팟 등장 굴림 ━━
        // 첫 레이어에서 보장 1회 → 시스템 인지. 그 후 25탭마다 25% 확률
        // 이미 박스가 떠 있으면 spawnPowerDig이 내부에서 자동 차단
        this.tapsSinceLastPowerDigCheck += 1;
        if (!this.firstPowerDigEverSpawned && this.digCount >= POWERDIG_FIRST_GUARANTEED_AT) {
            this.firstPowerDigEverSpawned = true;
            this.tapsSinceLastPowerDigCheck = 0;
            this.spawnPowerDig();
        } else if (this.tapsSinceLastPowerDigCheck >= POWERDIG_SPAWN_INTERVAL) {
            this.tapsSinceLastPowerDigCheck = 0;
            if (Math.random() < POWERDIG_SPAWN_CHANCE) this.spawnPowerDig();
        }

        // ━━ SOUL 게이지 감소 (탭당 -0.5%) ━━
        this.drainSoul(SOUL_DRAIN_PER_TAP);

        // ━━ 50탭마다 일반 혼잣말 (콤보 라인이 이미 떴으면 스킵) ━━
        if (this.tapsSinceLastMonologue >= MONOLOGUE_INTERVAL && !this.characterBubble) {
            this.tapsSinceLastMonologue = 0;
            const line = MONOLOGUE_LINES_GENERAL[
                Math.floor(Math.random() * MONOLOGUE_LINES_GENERAL.length)
            ];
            this.showCharacterMonologue(line);
        }

        // ━━ 20탭마다 장애물 무조건 등장 (확률 X) ━━
        // 단, 이미 활성 장애물이 있으면 spawnObstacle 내부에서 자동 차단됨
        if (this.tapsSinceLastObstacleCheck >= OBSTACLE_TAP_INTERVAL) {
            this.tapsSinceLastObstacleCheck = 0;
            this.spawnObstacle();
        }

        // ━━ 보물 출현 체크 ━━
        // 기본 5% + 장애물 부순 직후 부스트(+20%) 시간이면 추가
        let treasureRate = TREASURE_BASE_RATE;
        if (this.time.now < this.treasureBoostUntil) {
            treasureRate += OBSTACLE_BOOST_AMOUNT;
        }
        if (Math.random() < treasureRate) {
            // 직전 0.3초 황금빛 + 두근두근 → 그 후 spawnTreasure
            this.playTreasureForeshadow(() => this.spawnTreasure());
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
    checkComicEvent(prevDigCount = this.digCount - 1) {
        const event = this.layerData.comicEvent;
        if (!event || !event.triggerAt) return;

        // 배율(콤보×삽) 적용으로 1탭에 카운트가 +2~+4 점프할 수 있음
        // → 정확한 카운트 일치(===) 대신 "이번 탭으로 trigger를 통과했는가"로 판정
        for (const trigger of event.triggerAt) {
            if (
                prevDigCount < trigger &&
                this.digCount >= trigger &&
                !this.firedComicTriggers.has(trigger)
            ) {
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

        // ━━ 화면 하단 만화 말풍선 ━━
        // 위치: height * 0.78 = 캐릭터(y=858) 아래 + 하단 HUD(y=height-100) 위 안전 영역
        // 디자인: 둥근 모서리 + 두꺼운 검정 외곽선 + 드롭 섀도우 + 위로 향하는 꼬리
        //         + 살짝 기울임 + 등장 바운스 → 만화 톤 (사용자 피드백: 그냥 사각박스 → 재미)
        const { width, height } = this.cameras.main;
        const bubble = this.add.container(width / 2, height * 0.78).setDepth(50);

        // 말풍선 사이즈 (좌우 마진 충분히)
        const bw = Math.min(width * 0.86, 620);
        const bh = 140;
        const radius = 32;

        // 드롭 섀도우 (검정 반투명, 살짝 우하단 어긋나게)
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.35);
        shadow.fillRoundedRect(-bw / 2 + 7, -bh / 2 + 8, bw, bh, radius);

        // 메인 말풍선 본체 (크림색 + 두꺼운 검정 외곽 6px)
        const bg = this.add.graphics();
        bg.fillStyle(0xfff8e0, 1);
        bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, radius);
        bg.lineStyle(6, 0x000000, 1);
        bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, radius);

        // 위쪽 꼬리 (말풍선이 하단이라 꼬리는 위로 → 화면 위 캐릭터 방향)
        // 좌측으로 살짝 치우쳐서 더 만화 같은 느낌
        const tail = this.add.graphics();
        tail.fillStyle(0xfff8e0, 1);
        tail.lineStyle(6, 0x000000, 1);
        tail.beginPath();
        tail.moveTo(-30, -bh / 2 + 2);
        tail.lineTo(-5, -bh / 2 - 32);
        tail.lineTo(20, -bh / 2 + 2);
        tail.closePath();
        tail.fillPath();
        tail.strokePath();
        // 꼬리 안쪽 외곽선 가림 (말풍선과 꼬리 경계의 검정 라인 제거 — 안 그러면 가로 줄 보임)
        const tailMask = this.add.graphics();
        tailMask.fillStyle(0xfff8e0, 1);
        tailMask.fillRect(-30 + 3, -bh / 2 - 1, 50 - 6, 4);

        // NPC 이름 + 이모지 (상단 빨간 강조 — 만화 톤)
        const npcLine = this.add.text(0, -bh / 2 + 28, `${event.emoji || '👤'} ${event.npc}`, {
            font: 'bold italic 22px sans-serif',
            color: '#c8102e'
        }).setOrigin(0.5);

        // 메시지 (굵은 검정, 한 줄 큰 글씨)
        const msg = this.add.text(0, 16, event.message, {
            font: 'bold 30px sans-serif',
            color: '#000',
            wordWrap: { width: bw - 40 },
            align: 'center'
        }).setOrigin(0.5);

        bubble.add([shadow, bg, tail, tailMask, npcLine, msg]);

        // 살짝 비뚤어짐 (만화 액션감)
        bubble.setRotation(-0.045);   // 약 -2.6°

        this.comicBubble = bubble;

        // 등장: 펑! 튀어나오기 (스케일 + 회전 정착)
        bubble.setScale(0);
        this.tweens.add({
            targets: bubble,
            scale: 1,
            duration: 350,
            ease: 'Back.out'
        });
        // 등장 직후 살짝 흔들림 (1회만, 0.4초)
        this.tweens.add({
            targets: bubble,
            rotation: { from: -0.045, to: -0.025 },
            yoyo: true,
            repeat: 1,
            duration: 200,
            delay: 350,
            ease: 'Sine.inOut'
        });

        // 자동 사라짐 (펑 회전하며 축소)
        this.time.delayedCall(event.duration || 3000, () => {
            if (bubble.active) {
                this.tweens.killTweensOf(bubble);
                this.tweens.add({
                    targets: bubble,
                    alpha: 0,
                    scale: 0.7,
                    rotation: 0.18,
                    duration: 320,
                    ease: 'Quad.in',
                    onComplete: () => {
                        if (bubble.active) bubble.destroy();
                        if (this.comicBubble === bubble) this.comicBubble = null;
                    }
                });
            }
        });

        // ━━ NPC 등장 1초 후 캐릭터 반응 (NPC_REACTIONS 매핑 + panic 표정) ━━
        // soundType이 매핑 키가 됨 (foreman/pe_teacher/security/sauna_owner/military/fans)
        // panic 텍스처를 3초간 표시 (revertCharacterToBase 자동 차단)
        const reaction = NPC_REACTIONS[event.soundType];
        if (reaction) {
            this.time.delayedCall(1000, () => {
                this.showCharacterMonologue(reaction);

                // 진행 중인 dig transient 정리 후 panic 표정으로 전환
                this.cancelDigRevert();
                this.cancelPanicRevert();
                this.setCharacterState('panic');
                this.panicRevertTimer = this.time.delayedCall(3000, () => {
                    this.panicRevertTimer = null;
                    this.revertCharacterToBase();
                });
            });
        }
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

        // 모든 등급 공통: 보물이 발 근처에서 튀어나오는 동안 0.7초 surprise 표정
        //   (legendary는 아래 playJackpotEffect가 더 긴 surprise로 덮음)
        this.triggerSurprise(700);

        // legendary 등급은 "대박!!!" 풀 연출 (surprise + 슬로우 + 멜로디 + 유령 댄스)
        if (rarityKey === 'legendary') {
            this.cameras.main.flash(300, 255, 215, 0);
            this.playJackpotEffect();
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 인게임 보물 파밍 (팝업 없이 인게임 연출):
    //  Phase 1) 발 근처에서 큰 아이콘 + 보물 이름 텍스트 펑 등장 (250ms)
    //  Phase 1.5) 좌/우 showcase 위치로 부드럽게 이동 (300ms)
    //         — 보물마다 좌/우 교대(_treasureLaneIdx) → 연속 출현 시 겹침 방지
    //  Phase 2) showcase 위치에서 holdMs 유지 (common/rare/epic: 600ms / legendary: 1000ms)
    //         — 사용자가 어떤 보물인지 식별할 시간
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

        // ━━ 좌/우 lane 교대 (보물별로 번갈아) ━━
        //   문제: 연속 보물이 같은 경로로 비행해서 겹쳐 보이면 어떤 보물인지 식별 불가
        //   해결: 보물마다 좌/우 showcase 위치를 교대 → 사용자가 식별 시간 확보
        this._treasureLaneIdx = ((this._treasureLaneIdx ?? -1) + 1) % 2;
        const direction = this._treasureLaneIdx === 0 ? -1 : 1;        // -1=왼쪽, +1=오른쪽
        const lateralOffset = width * 0.22 * direction;                 // 화면 22% 좌/우
        // 컨테이너에 아이콘(왼쪽 -90)과 이름(오른쪽)이 둘 다 있어 폭이 넓음 → 화면 끝 여유 130
        const showcaseX = Phaser.Math.Clamp(startX + lateralOffset, 130, width - 130);
        const showcaseY = startY - 70;                                  // 살짝 위로 (캐릭터 머리 근처)

        // 컨테이너 - 아이콘 + 이름 텍스트가 함께 등장/유지/비행
        const container = this.add.container(startX, startY).setDepth(50);

        // 아이콘 (반지름 65 = 직경 130, 이미지와 동일 크기 → 원이 외곽 액자 역할만)
        // 사장님 피드백: 보물 이미지가 원보다 작아 도드라지지 않음 → 원 80→65, stroke 6→4 가늘게
        // 텍스처가 있으면 image, 없으면 emoji fallback (treasure.emoji or 기본 🏺)
        const iconRelX = -90;                 // 컨테이너 안에서 아이콘 중심 X
        const iconBg = this.add.circle(iconRelX, 0, 65, style.int, 1)
            .setStrokeStyle(4, 0xffffff);

        let iconChild;
        if (this.textures.exists(treasure.id)) {
            iconChild = this.add.image(iconRelX, 0, treasure.id).setDisplaySize(130, 130);
        } else {
            iconChild = this.add.text(iconRelX, 0, treasure.emoji || '🏺', {
                font: '100px sans-serif'
            }).setOrigin(0.5);
        }

        // 보물 이름 텍스트 (아이콘 오른쪽, 등급별 색상/크기)
        const nameText = this.add.text(10, 0, treasure.name, {
            font: `bold ${style.fontPx}px sans-serif`,
            color: style.hex,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0, 0.5);

        container.add([iconBg, iconChild, nameText]);

        // ━━ Phase 1: 펑 등장 (250ms, 발 근처) ━━
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

        // ━━ Phase 1.5: 좌/우 showcase 위치로 부드럽게 이동 (300ms) ━━
        const SHOWCASE_TRAVEL_MS = 300;
        this.time.delayedCall(250, () => {
            this.tweens.add({
                targets: container,
                x: showcaseX, y: showcaseY,
                duration: SHOWCASE_TRAVEL_MS, ease: 'Sine.out'
            });
        });

        // ━━ Phase 2: showcase 도착 + holdMs 유지 후 비행 시작 ━━
        this.time.delayedCall(250 + SHOWCASE_TRAVEL_MS + style.holdMs, () => {
            // ━━ Phase 3: 우상단으로 비행 + 점점 작아짐 ━━
            // X: showcaseX → targetX 가속
            this.tweens.add({
                targets: container,
                x: targetX,
                scale: 0.3,                    // 도착 시 작아진 상태
                duration: style.flyMs,
                ease: 'Quad.in'
            });
            // Y: showcaseY → 위 솟구침 → targetY (포물선)
            this.tweens.chain({
                targets: container,
                tweens: [
                    { y: showcaseY - 150, duration: Math.floor(style.flyMs * 0.4), ease: 'Quad.out' },
                    { y: targetY,         duration: Math.floor(style.flyMs * 0.6), ease: 'Quad.in'  }
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

        // 보물 이미지 (이름 위에 배치)
        if (this.textures.exists(treasure.id)) {
            const popupIcon = this.add.image(0, -70, treasure.id)
                .setDisplaySize(180, 180);
            card.add(popupIcon);
            // 이름 위치를 이미지 아래로 조정
            var nameY = 50;
            var descY = 130;
            var rewardY = 210;
        } else {
            // 이미지가 없으면 기존 텍스트 레이아웃 유지
            var nameY = -70;
            var descY = 30;
            var rewardY = 140;
        }

        // 보물 이름
        const name = this.add.text(0, nameY, treasure.name, {
            font: 'bold 48px sans-serif', color: '#ffffff',
            wordWrap: { width: cardW - 60 },
            align: 'center'
        }).setOrigin(0.5);

        // 설명
        const desc = this.add.text(0, descY, treasure.desc || '', {
            font: 'italic 28px sans-serif', color: '#dddddd',
            wordWrap: { width: cardW - 80 },
            align: 'center'
        }).setOrigin(0.5);

        // 보상
        const rewardParts = [];
        const r = treasure.reward || {};
        if (r.coin)    rewardParts.push(`🪙 +${r.coin}`);
        if (r.relic)   rewardParts.push(`🏺 +${r.relic}`);
        if (r.diamond) rewardParts.push(`💎 +${r.diamond}`);
        const rewardText = this.add.text(0, rewardY, rewardParts.join('   '), {
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
    // POWER DIG LIMITED DROP — 스윗스팟 정조준 보너스
    //   빨간 박스(POWER DIG 로고) + 골드삽 아이콘이 화면 가운데 영역에 둥실
    //   히트 반경(POWERDIG_HIT_RADIUS) 안에 정확히 탭 → 코인 ×2 + 콤보 +5
    //   빗나가도 일반 dig는 정상 (캐주얼 톤 유지). 5초 후 자동 페이드아웃.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    spawnPowerDig() {
        // 이미 활성 중이거나 차단 상태면 스킵 (중복 박스 방지)
        if (this.powerDigBox) return;
        if (this.clearActive || this.treasurePopupActive || this.burnoutActive) return;

        const { width, height } = this.cameras.main;

        // 등장 위치: 캐릭터 아래쪽 (엄지 도달 영역) — 한 손 그립에서 정조준 용이
        //   캐릭터(CHARACTER_Y=858) 아래 ~400px, 하단 HUD 위 최소 ~280px 마진 확보
        //   x는 화면 중앙 30~70% (양쪽 끝 회피)
        const baseY = CHARACTER_Y + 420;
        const safeMaxY = Math.max(baseY, height - 280);
        const startX = Phaser.Math.Between(Math.floor(width * 0.30), Math.floor(width * 0.70));
        const startY = Phaser.Math.Between(baseY - 30, Math.min(baseY + 30, safeMaxY));

        const c = this.add.container(startX, startY).setDepth(15);

        // 외곽 빨강 글로우 존 (가장 뒤) — 영역 시그널
        const glow = this.add.circle(0, 0, 240, 0xc8102e, 0.40);

        // 곡괭이 금색 후광 — 곡괭이가 "특별한 아이템"임을 더 뚜렷하게
        const halo = this.add.circle(0, 15, 180, 0xffd700, 0.55);

        // 강조 빨간 박스 로고 (상단) — 글자 키운 만큼 박스도 확대
        //   330×90 → 420×120, 폰트 54 → 76, 검정 stroke 가독성
        const box = this.add.rectangle(0, -141, 420, 120, 0xc8102e)
            .setStrokeStyle(6, 0x000000, 0.85);
        const brandText = this.add.text(0, -141, 'POWER DIG', {
            font: 'italic bold 76px serif',
            color: '#ffffff',
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        // 곡괭이 아이콘 (중앙) — 또렷함 강화
        //   크기 230 → 260, 금색 stroke 18 → 22, 검정 drop shadow 추가 (입체)
        const shovel = this.add.text(0, 15, '⛏️', {
            font: '260px sans-serif',
            stroke: '#ffd700',
            strokeThickness: 22
        }).setOrigin(0.5).setShadow(0, 6, '#000000', 14, true, true);

        // 아이템 명칭 라벨 (하단) — 박스 확대 + 곡괭이 키운 만큼 같이 내림
        const limitedText = this.add.text(0, 188, 'POWER DIG 곡괭이', {
            font: 'bold 42px sans-serif',
            color: '#ffd700',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5);

        // 그리는 순서: glow → halo → box → brand → shovel(맨 위) → label
        c.add([glow, halo, box, brandText, shovel, limitedText]);

        // 글로우 펄스 (영역 어필)
        this.tweens.add({
            targets: glow,
            scale: { from: 0.85, to: 1.20 },
            alpha: { from: 0.55, to: 0.20 },
            yoyo: true, repeat: -1,
            duration: 600, ease: 'Sine.inOut'
        });

        // 곡괭이 후광 펄스 (곡괭이 두근두근 강조)
        this.tweens.add({
            targets: halo,
            scale: { from: 0.92, to: 1.12 },
            alpha: { from: 0.55, to: 0.30 },
            yoyo: true, repeat: -1,
            duration: 500, ease: 'Sine.inOut'
        });

        // 컨테이너 자체 둥실둥실 (yoyo Y) → 살짝 움직이는 타깃
        this.tweens.add({
            targets: c,
            y: c.y - 18,
            yoyo: true, repeat: -1,
            duration: 1300, ease: 'Sine.inOut'
        });

        // 등장 펑 (scale 0 → 1 백 이즈)
        c.setScale(0);
        this.tweens.add({
            targets: c, scale: 1, duration: 280, ease: 'Back.out'
        });

        // 등장 사운드 (콤보 10 효과음 재활용 - 짧은 ding)
        if (this.soundManager && this.soundManager.playComboSound) {
            this.soundManager.playComboSound(10);
        }

        this.powerDigBox = {
            container: c,
            glow,
            radius: POWERDIG_HIT_RADIUS,
            expiresAt: this.time.now + POWERDIG_LIFETIME_MS
        };
    }

    // 탭 좌표(x, y)가 POWER DIG 박스 히트 반경 안에 있는지
    _isInPowerDig(x, y) {
        if (!this.powerDigBox || !this.powerDigBox.container) return false;
        const c = this.powerDigBox.container;
        const dx = x - c.x;
        const dy = y - c.y;
        const r = this.powerDigBox.radius;
        return (dx * dx + dy * dy) <= (r * r);
    }

    // POWER DIG 명중 → 보너스 효과 + 박스 펑 사라짐 (보너스 수치 자체는 dig()에서 적용)
    _consumePowerDig() {
        if (!this.powerDigBox) return;
        const ref = this.powerDigBox;
        const c = ref.container;
        // 즉시 powerDigBox 클리어 → 같은 탭에 두 번 적중 방지 + update()의 만료 체크와 충돌 방지
        this.powerDigBox = null;

        if (c) {
            // 펑! 사라지는 연출 (스케일 업 + 페이드)
            this.tweens.killTweensOf(c);
            if (ref.glow) this.tweens.killTweensOf(ref.glow);
            this.tweens.add({
                targets: c,
                scale: 1.7,
                alpha: 0,
                duration: 220,
                ease: 'Quad.out',
                onComplete: () => c.destroy()
            });
            // 보너스 텍스트 (박스 위치에서 솟구침)
            this.showFloatingText(c.x, c.y - 30, '🔥 POWER DIG ×2!', '#ffd700');
        }

        // 캐릭터 코믹 반응 (말풍선)
        const line = POWERDIG_REACTION_LINES[
            Math.floor(Math.random() * POWERDIG_REACTION_LINES.length)
        ];
        this.showCharacterMonologue(line);

        // 햅틱 + 전설 보물용 강한 사운드 재활용 (dopamine 한 방)
        if (this.soundManager) {
            if (this.soundManager.triggerHaptic) {
                this.soundManager.triggerHaptic('heavy');
            }
            if (this.soundManager.playTreasureSound) {
                this.soundManager.playTreasureSound('rare');
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 에너지 드링크 (패러디 — 삽카스/핫삽스/레드삽/에너자삽)
    //   화면 위에서 캐릭터로 떨어짐 → 자동 캐치 → 일정 시간 버프
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    spawnDrink() {
        if (this.clearActive || this.treasurePopupActive || this.burnoutActive) return;
        if (!this.character) return;

        // 등급 weighted random
        const totalW = Object.values(DRINK_RARITY_WEIGHTS).reduce((s, v) => s + v, 0);
        let r = Math.random() * totalW;
        let pickedKey = 'sapcas';
        for (const [k, w] of Object.entries(DRINK_RARITY_WEIGHTS)) {
            r -= w;
            if (r <= 0) { pickedKey = k; break; }
        }
        const def = DRINK_TYPES[pickedKey];

        const { width } = this.cameras.main;

        // ━━━━ 1단계: 사전 경고 배너 (700ms) ━━━━
        //   사용자 피드백: 드링크가 너무 빨리 내려와서 인식 못 함
        //   → 화면 상단에 "🥤 드링크 온다! ↓" 배너 깜빡 → 시선 유도
        const banner = this.add.container(width / 2, 110).setDepth(48);
        const bannerW = 280, bannerH = 70;
        const bannerBg = this.add.graphics();
        bannerBg.fillStyle(0x000000, 0.85);
        bannerBg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 16);
        bannerBg.lineStyle(4, def.color, 1);
        bannerBg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 16);
        const bannerEmoji = this.add.text(-95, 0, def.emoji, { font: '42px sans-serif' }).setOrigin(0.5);
        const bannerTxt = this.add.text(20, 0, '드링크 온다!', {
            font: 'bold 24px sans-serif', color: def.hex,
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);
        const bannerArrow = this.add.text(115, 4, '↓', {
            font: 'bold 42px sans-serif', color: def.hex,
            stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5);
        banner.add([bannerBg, bannerEmoji, bannerTxt, bannerArrow]);
        banner.setScale(0.5).setAlpha(0);
        this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 220, ease: 'Back.out' });
        // 화살표 깜빡깜빡 (방향 안내)
        this.tweens.add({
            targets: bannerArrow,
            y: bannerArrow.y + 8,
            duration: 200, yoyo: true, repeat: 2, ease: 'Sine.inOut'
        });

        // ━━━━ 2단계: 700ms 후 배너 정리 + 드링크 등장 ━━━━
        this.time.delayedCall(700, () => {
            if (this.clearActive || this.treasurePopupActive || this.burnoutActive) {
                if (banner && banner.scene) banner.destroy();
                return;
            }
            if (banner && banner.scene) {
                this.tweens.add({
                    targets: banner, alpha: 0, y: banner.y - 12,
                    duration: 240,
                    onComplete: () => banner.destroy()
                });
            }
            this.launchDrinkFall(pickedKey);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 드링크 실제 낙하 (사전 배너 후 호출)
    //   - PNG 이미지 (이모지 폴백) + 글로우 펄스
    //   - 회오리 궤적: 진폭 200, 사이클 3.5, quad 감쇠 → 캐릭터 위로 정확 수렴
    //   - 불꽃 trail (등급색 위로 솟구침) + 등급색 trail
    //   - 도착 시 불꽃 ring 폭발
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    launchDrinkFall(pickedKey) {
        if (!this.character) return;
        const def = DRINK_TYPES[pickedKey];
        const startX = this.character.x;
        const startY = -110;
        const endX   = this.character.x;
        const endY   = this.character.y - this.character.displayHeight * 0.6;
        const FALL_MS = 1700;   // 회오리감 위해 약간 길게 (1500 → 1700)

        // 회오리 궤적 파라미터 — 사장님 요청 "원/회오리처럼 떨어지고"
        const SWAY_AMPLITUDE = 220;   // 진폭 강화 (140 → 220, 캐릭터 옆 충분히 넘어감)
        const SWAY_CYCLES    = 3.5;   // 회전 수 강화 (2.5 → 3.5)

        const container = this.add.container(startX, startY).setDepth(46);

        // 글로우 배경 원 (등급 색)
        const glow = this.add.circle(0, 0, 70, def.color, 0.55).setStrokeStyle(5, def.color, 1);
        container.add(glow);

        // PNG 이미지 우선, 미로드 시 이모지 폴백
        const pngKey = `drink_${pickedKey}`;
        if (this.textures.exists(pngKey)) {
            const img = this.add.image(0, -4, pngKey).setDisplaySize(110, 110);
            container.add(img);
        } else {
            const emoji = this.add.text(0, -4, def.emoji, { font: '64px sans-serif' }).setOrigin(0.5);
            container.add(emoji);
        }

        // 이름 라벨 (PNG/이모지 아래)
        const nameTxt = this.add.text(0, 60, def.name, {
            font: 'bold 22px sans-serif', color: def.hex,
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);
        container.add(nameTxt);

        // glow 펄스 (낙하 동안 계속 깜빡 → 시선 끌기)
        const glowPulse = this.tweens.add({
            targets: glow,
            scale: { from: 1.0, to: 1.3 },
            alpha: { from: 0.55, to: 0.9 },
            duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });

        // 트레일 잔상 텍스처
        if (!this.textures.exists('__drinkTrail')) {
            const tg = this.make.graphics({ x: 0, y: 0, add: false });
            tg.fillStyle(0xffffff, 1);
            tg.fillCircle(7, 7, 7);
            tg.generateTexture('__drinkTrail', 14, 14);
            tg.destroy();
        }
        const trail = this.add.particles(0, 0, '__drinkTrail', {
            follow: container,
            tint: def.color,
            lifespan: 480,
            scale: { start: 1.5, end: 0.2 },
            alpha: { start: 0.7, end: 0 },
            frequency: 30,
            quantity: 1
        }).setDepth(45);

        // ━━ 불꽃 파티클 (사장님 요청 "불꽃이 피게") ━━
        // 드링크 따라가며 빨강/주황/노랑 작은 불꽃이 위로 솟구침
        if (!this.textures.exists('__fireParticle')) {
            const fg = this.make.graphics({ x: 0, y: 0, add: false });
            fg.fillStyle(0xffffff, 1);
            fg.fillCircle(6, 6, 6);
            fg.generateTexture('__fireParticle', 12, 12);
            fg.destroy();
        }
        const fire = this.add.particles(0, 0, '__fireParticle', {
            follow: container,
            tint: [0xff3030, 0xff8a00, 0xffd700, 0xffffff],   // 빨강 → 주황 → 노랑 → 흰
            lifespan: 600,
            speedY: { min: -180, max: -120 },                  // 위로 솟구침
            speedX: { min: -60, max: 60 },
            scale: { start: 1.4, end: 0 },
            alpha: { start: 0.95, end: 0 },
            frequency: 35,
            quantity: 2,
            blendMode: 'ADD'                                    // 더 화려한 빛 합성
        }).setDepth(46);

        // ━━ 낙하 (1700ms, Quad.in = 가속) — 회오리 궤적 + quad 진폭 감쇠 ━━
        this.tweens.add({
            targets: container,
            y: endY,
            duration: FALL_MS, ease: 'Quad.in',
            onUpdate: (tween) => {
                const t = tween.progress;                              // 0 ~ 1
                const angleRad = t * Math.PI * 2 * SWAY_CYCLES;        // 회전 각도 누적 (3.5바퀴)
                const decay    = Math.pow(1 - t, 1.5);                 // quad 감쇠 — 끝에 부드럽게 수렴
                container.x = endX + Math.sin(angleRad) * SWAY_AMPLITUDE * decay;
            }
        });
        this.tweens.add({
            targets: container,
            angle: 720, duration: FALL_MS, ease: 'Linear'              // 2바퀴 spin (회오리감 강화)
        });

        // 도착 시 캐치 + 정리 + 불꽃 ring 폭발
        this.time.delayedCall(FALL_MS, () => {
            if (glowPulse) glowPulse.stop();
            if (trail && trail.stop) trail.stop();
            if (fire && fire.stop) fire.stop();
            this.time.delayedCall(700, () => {
                if (trail && trail.scene) trail.destroy();
                if (fire && fire.scene)  fire.destroy();
            });
            this.spawnFireRing(this.character.x, endY, def.color);   // 불꽃 폭발
            this.catchDrink(pickedKey, container);
        });
    }

    // 캐치 시점 불꽃 ring — 황금/등급색 외곽이 짧게 확산하며 페이드아웃
    spawnFireRing(cx, cy, color) {
        const ring = this.add.graphics().setDepth(47);
        ring.lineStyle(8, color || 0xff8a00, 1);
        ring.strokeCircle(0, 0, 40);
        ring.setPosition(cx, cy);
        this.tweens.add({
            targets: ring,
            scale: { from: 0.5, to: 2.4 },
            alpha: { from: 0.95, to: 0 },
            duration: 460, ease: 'Quad.out',
            onComplete: () => ring.destroy()
        });
        // 외곽 빨강 ring 한 장 더 (밀도)
        const innerRing = this.add.graphics().setDepth(47);
        innerRing.lineStyle(5, 0xff3030, 1);
        innerRing.strokeCircle(0, 0, 25);
        innerRing.setPosition(cx, cy);
        this.tweens.add({
            targets: innerRing,
            scale: { from: 0.4, to: 1.8 },
            alpha: { from: 0.9, to: 0 },
            duration: 380, ease: 'Quad.out',
            onComplete: () => innerRing.destroy()
        });
    }

    catchDrink(key, container) {
        if (!container || !container.scene) return;
        const def = DRINK_TYPES[key];
        const now = this.time.now;
        const expiresAt = now + def.durationMs;

        // 효과 적용 (스택 X — 더 늦은 만료시간으로 갱신)
        if (def.effect === 'all') {
            this.activeBuffs.coin    = Math.max(this.activeBuffs.coin,    expiresAt);
            this.activeBuffs.combo   = Math.max(this.activeBuffs.combo,   expiresAt);
            this.activeBuffs.digMult = Math.max(this.activeBuffs.digMult, expiresAt);
        } else {
            this.activeBuffs[def.effect] = Math.max(this.activeBuffs[def.effect], expiresAt);
        }

        // 캐치 사운드 + 햅틱
        this.soundManager.playDrinkCatchSound(def.rarity);
        this.soundManager.triggerHaptic('medium');

        // "꿀꺽" 흡입 애니 (캐릭터 위치로 빨려들어감)
        this.tweens.add({
            targets: container,
            x: this.character.x,
            y: this.character.y - this.character.displayHeight * 0.5,
            scale: 0.2, alpha: 0,
            duration: 200, ease: 'Quad.in',
            onComplete: () => container.destroy()
        });

        // 캐릭터 surprise 표정 + 라인
        this.triggerSurprise(800);
        this.showCharacterMonologue(def.line);

        // 화면 가장자리 글로우 갱신 (가장 화려한 활성 버프 색)
        this.refreshBuffEdgeGlow();
    }

    // 가장자리 글로우 — 활성 버프 동안 화면 테두리에 등급 색 옅게
    refreshBuffEdgeGlow() {
        const now = this.time.now;
        // 우선순위: legendary 색(에너자삽=all 활성 시) > epic > rare > common
        let color = null;
        if (this.activeBuffs.coin > now && this.activeBuffs.combo > now && this.activeBuffs.digMult > now) {
            color = DRINK_TYPES.energasap.color;
        } else if (this.activeBuffs.digMult > now) {
            color = DRINK_TYPES.redsap.color;
        } else if (this.activeBuffs.combo > now) {
            color = DRINK_TYPES.hotsaps.color;
        } else if (this.activeBuffs.coin > now) {
            color = DRINK_TYPES.sapcas.color;
        }

        if (this.buffEdgeGlow) { this.buffEdgeGlow.destroy(); this.buffEdgeGlow = null; }
        if (color == null) return;

        const { width, height } = this.cameras.main;
        const g = this.add.graphics().setDepth(19);  // HUD 텍스트(20) 아래, 게임월드 위
        g.lineStyle(14, color, 0.55);
        g.strokeRect(7, 7, width - 14, height - 14);
        g.setAlpha(0.85);
        // 펄스 (살짝 깜빡)
        this.tweens.add({
            targets: g,
            alpha: { from: 0.85, to: 0.45 },
            duration: 700, yoyo: true, repeat: -1
        });
        this.buffEdgeGlow = g;

        // 가장 늦게 끝나는 buff에 맞춰 자동 정리
        const latest = Math.max(this.activeBuffs.coin, this.activeBuffs.combo, this.activeBuffs.digMult);
        const remain = Math.max(0, latest - now);
        this.time.delayedCall(remain + 50, () => this.refreshBuffEdgeGlow());
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 활성 버프 HUD — SOUL 게이지 옆에 [이모지 + 효과 + 남은 초] 세로 나열
    //   변경 감지 캐시(_lastBuffHudState)로 활성 키/초 변화 시에만 텍스트 재생성
    //   → 매 프레임 호출돼도 GC 압박 X
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    drawBuffHUD() {
        if (!this.buffHUD) return;
        const now = this.time.now;
        const items = [
            { key: 'coin',    icon: '🪙', label: '코인×1.2' },
            { key: 'combo',   icon: '🔥', label: '콤보×1.5' },
            { key: 'digMult', icon: '⚡', label: '진행×1.5' }
        ];

        // 활성 키 + 남은 초 시그니처 (초 단위만 변해도 갱신)
        const sig = items
            .filter(it => this.activeBuffs[it.key] > now)
            .map(it => `${it.key}:${Math.ceil((this.activeBuffs[it.key] - now) / 1000)}`)
            .join('|');
        if (this._lastBuffHudState === sig) return;
        this._lastBuffHudState = sig;

        this.buffHUD.removeAll(true);
        let row = 0;
        for (const it of items) {
            const ends = this.activeBuffs[it.key];
            if (ends <= now) continue;
            const remain = Math.ceil((ends - now) / 1000);
            const txt = this.add.text(0, row * 30,
                `${it.icon} ${it.label} ${remain}s`,
                {
                    font: 'bold 18px sans-serif',
                    color: '#ffd700',
                    stroke: '#000', strokeThickness: 3,
                    backgroundColor: '#00000099',
                    padding: { x: 8, y: 4 }
                });
            this.buffHUD.add(txt);
            row += 1;
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 기상 악화 (실외 한정 코스메틱) - rain/snow/typhoon
    //   파티클 + tint 오버레이 + 독백, 12초 후 페이드아웃
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    maybeStartWeather() {
        if (this.weatherActive) return;
        if (this.clearActive || this.treasurePopupActive || this.burnoutActive) return;
        if (!this.layerData) return;
        if (WEATHER_INDOOR_LAYERS.has(this.layerData.id)) return;   // 찜질방 등 실내 X

        const key = WEATHER_KEYS[Math.floor(Math.random() * WEATHER_KEYS.length)];
        this.startWeather(key);
    }

    startWeather(key) {
        const def = WEATHER_TYPES[key];
        if (!def) return;
        const { width, height } = this.cameras.main;

        // ━━━━ 사전 인지 강화 — 카메라 flash + 큰 배너 1.2초 ━━━━
        //   사용자 피드백: 날씨 시작이 인식 안 됨 (파티클이 갑자기 떨어져도 못 알아챔)
        //   → 화면 전체 한 번 flash + 중앙 큰 배너로 "비바람!/눈보라!/태풍!" 명확 안내
        this.cameras.main.flash(240, 200, 200, 220);
        const weatherEmoji = key === 'rain'  ? '🌧️'
                           : key === 'snow'  ? '❄️'
                           : '🌪️';
        // 사장님 피드백: "캐릭터 가려" → 화면 상단(0.32) → 장애물 아래(0.86)로 이동
        //   장애물 cy=character.y+95(~74%) + HP바(~85%) → 그 아래 0.86 = tapHint(0.92) 위 안전 마진
        const banner = this.add.container(width / 2, height * 0.86).setDepth(60);
        const bannerW = 380, bannerH = 110;
        const bannerBg = this.add.graphics();
        bannerBg.fillStyle(0x000000, 0.85);
        bannerBg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 20);
        bannerBg.lineStyle(5, def.particleColor, 1);
        bannerBg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 20);
        const bannerEmoji = this.add.text(-115, 0, weatherEmoji, { font: '64px sans-serif' }).setOrigin(0.5);
        const bannerTxt = this.add.text(45, 0, def.name + '!', {
            font: 'bold 42px sans-serif', color: '#ffffff',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5);
        banner.add([bannerBg, bannerEmoji, bannerTxt]);
        banner.setScale(0.4).setAlpha(0);
        this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 280, ease: 'Back.out' });
        this.time.delayedCall(1000, () => {
            if (banner && banner.scene) {
                this.tweens.add({
                    targets: banner, scale: 1.25, alpha: 0,
                    duration: 380,
                    onComplete: () => banner.destroy()
                });
            }
        });

        // ━━ 파티클 텍스처 3종 (사장님 피드백: "비바람 막 몰아쳐야") ━━
        // __weatherDot:    3×3 흰 점 — 작은 입자 (typhoon, 눈보라 잔눈)
        // __weatherStreak: 2×22 길쭉한 비줄 — rain용. rotate로 바람 각도 표현
        // __weatherFlake:  6×6 통통한 눈송이 — snow용. 큼직해야 휘몰아치는 게 보임
        if (!this.textures.exists('__weatherDot')) {
            const wg = this.make.graphics({ x: 0, y: 0, add: false });
            wg.fillStyle(0xffffff, 1);
            wg.fillRect(0, 0, 3, 3);
            wg.generateTexture('__weatherDot', 3, 3);
            wg.destroy();
        }
        if (!this.textures.exists('__weatherStreak')) {
            const sg = this.make.graphics({ x: 0, y: 0, add: false });
            sg.fillStyle(0xffffff, 1);
            sg.fillRect(0, 0, 2, 22);                      // 길쭉한 비줄
            sg.generateTexture('__weatherStreak', 2, 22);
            sg.destroy();
        }
        if (!this.textures.exists('__weatherFlake')) {
            const fg = this.make.graphics({ x: 0, y: 0, add: false });
            fg.fillStyle(0xffffff, 1);
            fg.fillCircle(3, 3, 3);                        // 둥근 눈송이
            fg.generateTexture('__weatherFlake', 6, 6);
            fg.destroy();
        }

        // tint 오버레이 (반투명 사각형) — 폭풍감 위해 alpha 1.4배로 살짝 더 진하게
        const tintRect = this.add.rectangle(width / 2, height / 2, width, height, def.tint, 0)
            .setDepth(18);
        const finalTintAlpha = Math.min(0.55, def.tintAlpha * 1.4);
        this.tweens.add({ targets: tintRect, alpha: finalTintAlpha, duration: 800 });

        // ━━ 파티클 설정 (종류별 — 사장님 피드백 반영해 전부 강화) ━━
        // rain: 강한 좌측 바람 + 길쭉한 비줄, 밀도 3배
        // snow: 양방향 휘몰아침 + 큼직한 눈송이, 밀도 4배 + 주기적 돌풍
        // typhoon: 기존 강풍 유지 (이미 강함)
        let cfg, textureKey = '__weatherDot';
        if (key === 'rain') {
            textureKey = '__weatherStreak';
            cfg = {
                x: { min: -100, max: width + 100 }, y: -40,
                // 좌측으로 강하게 몰아침 (이전 -40 → -350) + 더 빠른 낙하
                speedY: { min: 1400, max: 1900 },
                speedX: { min: -380, max: -240 },
                lifespan: 1000,
                scale: { start: 2.4, end: 1.8 },
                alpha: { start: 0.85, end: 0.55 },
                // quantity 4→9, frequency 30→18 → 밀도 3.3배 다운푸어
                quantity: 9, frequency: 18,
                tint: def.particleColor,
                // 비줄을 바람 방향으로 기울임 (좌측 바람 → 시계 반대 -14°)
                rotate: { min: -18, max: -10 }
            };
        } else if (key === 'snow') {
            textureKey = '__weatherFlake';
            cfg = {
                x: { min: -80, max: width + 80 }, y: -40,
                // 양방향 휘몰아침 (이전 ±60 → ±320) + 낙하속도 2배
                speedY: { min: 200, max: 520 },
                speedX: { min: -320, max: 320 },
                lifespan: 4500,
                // 눈송이 크기 차등 (큰 송이~작은 송이 섞여 입체감)
                scale: { start: 2.6, end: 1.2 },
                alpha: { start: 0.95, end: 0.55 },
                // quantity 3→8, frequency 70→32 → 밀도 약 5배
                quantity: 8, frequency: 32,
                tint: def.particleColor,
                rotate: { min: 0, max: 360 }
            };
        } else { // typhoon
            cfg = {
                x: { min: -50, max: width }, y: { min: 0, max: height * 0.6 },
                speedY: { min: 200, max: 400 }, speedX: { min: 600, max: 1000 },
                lifespan: 1200, scale: { start: 2.2, end: 1.2 }, alpha: { start: 0.8, end: 0.4 },
                quantity: 6, frequency: 25, tint: def.particleColor
            };
        }
        const particles = this.add.particles(0, 0, textureKey, cfg).setDepth(19);

        // ━━ 보조 emitter: 비는 잔비(작은 dot), 눈은 눈가루(작은 dot) — 깊이감 부여 ━━
        let particlesFine = null;
        if (key === 'rain') {
            // 작은 빗방울 안개 — 더 빠르고 덜 보이는 잔비
            particlesFine = this.add.particles(0, 0, '__weatherDot', {
                x: { min: 0, max: width }, y: -20,
                speedY: { min: 1100, max: 1600 },
                speedX: { min: -420, max: -300 },
                lifespan: 900,
                scale: { start: 1.4, end: 1.0 },
                alpha: { start: 0.5, end: 0.25 },
                quantity: 5, frequency: 22,
                tint: def.particleColor
            }).setDepth(19);
        } else if (key === 'snow') {
            // 잔눈가루 — 작고 빨리 휘날리는 백그라운드 레이어
            particlesFine = this.add.particles(0, 0, '__weatherDot', {
                x: { min: -50, max: width + 50 }, y: -20,
                speedY: { min: 280, max: 600 },
                speedX: { min: -480, max: 480 },
                lifespan: 3500,
                scale: { start: 1.4, end: 0.8 },
                alpha: { start: 0.7, end: 0.3 },
                quantity: 6, frequency: 28,
                tint: def.particleColor
            }).setDepth(18);
        }

        // 사운드 + 독백
        this.soundManager.playWeatherSound(key);
        if (!this.characterBubble) this.showCharacterMonologue(def.line);

        // ━━ 카메라 셰이크 — 폭풍감을 몸으로 느끼게 (캐주얼 페널티 X, 시각만) ━━
        if (key === 'typhoon')   this.cameras.main.shake(WEATHER_DURATION, 0.0008);
        else if (key === 'rain') this.cameras.main.shake(WEATHER_DURATION, 0.0004);    // 비바람 살짝 흔들림
        else if (key === 'snow') this.cameras.main.shake(WEATHER_DURATION, 0.0003);    // 눈보라 더 약하게

        // ━━ 비바람 한정: 번개 플래시 (2~4초마다 흰 섬광) ━━
        // 카메라 flash + 짧은 thunder 효과 (memory의 코스메틱 페널티 룰 충족)
        let lightningTimer = null;
        if (key === 'rain') {
            const fireLightning = () => {
                if (!this.weatherActive) return;
                this.cameras.main.flash(180, 220, 220, 255, false);
                // 다음 번개 예약 (2.0~4.0초 랜덤)
                lightningTimer = this.time.delayedCall(
                    Phaser.Math.Between(2000, 4000), fireLightning
                );
            };
            // 첫 번개는 0.8~1.5초 후
            lightningTimer = this.time.delayedCall(
                Phaser.Math.Between(800, 1500), fireLightning
            );
        }

        // ━━ 눈보라 한정: 주기적 돌풍 (1.8초마다 speedX 방향 반전 + 부스트) ━━
        // 시각적으로 "휘몰아치는" 느낌 — 항상 한쪽으로만 날리지 않게
        let gustTimer = null;
        if (key === 'snow') {
            let gustDir = 1;     // +1 = 우측 강풍, -1 = 좌측 강풍
            const fireGust = () => {
                if (!this.weatherActive || !particles) return;
                gustDir *= -1;
                const base = 380 * gustDir;
                // 메인 + 보조 emitter 모두 speedX 갱신
                if (particles.setEmitterAngle) {
                    // Phaser 3.60+: ParticleEmitter 직접 메서드
                    particles.speedX = { min: base - 80, max: base + 80 };
                }
                if (particlesFine && particlesFine.speedX) {
                    particlesFine.speedX = { min: base - 150, max: base + 150 };
                }
                gustTimer = this.time.delayedCall(1800, fireGust);
            };
            gustTimer = this.time.delayedCall(1800, fireGust);
        }

        const endsAt = this.time.now + WEATHER_DURATION;
        this.weatherActive = { key, particles, particlesFine, tintRect, endsAt, lightningTimer, gustTimer };

        // 종료 타이머
        this.time.delayedCall(WEATHER_DURATION, () => this.endWeather());
    }

    endWeather() {
        if (!this.weatherActive) return;
        const { particles, particlesFine, tintRect, lightningTimer, gustTimer } = this.weatherActive;

        // 번개/돌풍 타이머 즉시 해제 (재예약 차단)
        if (lightningTimer && lightningTimer.remove) lightningTimer.remove(false);
        if (gustTimer && gustTimer.remove)           gustTimer.remove(false);

        // 파티클 emission 중단 (잔여 입자는 자연스럽게 떨어지며 사라짐)
        // Phaser 3.60+에서 add.particles는 ParticleEmitter 직접 반환 → .stop() 호출
        if (particles && particles.stop)         particles.stop();
        if (particlesFine && particlesFine.stop) particlesFine.stop();

        // tint 페이드아웃
        if (tintRect) {
            this.tweens.add({
                targets: tintRect,
                alpha: 0,
                duration: 1200, ease: 'Quad.in',
                onComplete: () => tintRect.destroy()
            });
        }
        // 파티클 객체는 1.5초 후 정리 (잔여 입자 lifespan 만료까지 여유)
        this.time.delayedCall(1500, () => {
            if (particles && particles.scene)         particles.destroy();
            if (particlesFine && particlesFine.scene) particlesFine.destroy();
        });
        this.weatherActive = null;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 잔상 플래시 (foreshadow) - 후속 레이어 색을 살짝 미리 노출
    //   - layer 1~3에서만, 1.5% 확률 / 탭, 30탭 쿨다운
    //   - 보상 X (순수 시각/사운드), 캐릭터가 호기심 라인 1번 뱉음
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    maybeTriggerForeshadow() {
        if (this.foreshadowCooldown > 0) {
            this.foreshadowCooldown -= 1;
            return;
        }
        if (!this.layerData || this.layerData.order > FORESHADOW_MAX_LAYER_ORDER) return;
        if (this.clearActive || this.treasurePopupActive || this.burnoutActive) return;
        if (Math.random() >= FORESHADOW_CHANCE) return;

        // 색 픽 + 카메라 플래시 (220ms, 짧게 → 자연스럽게 약하게 느껴짐)
        const c = FORESHADOW_COLORS[Math.floor(Math.random() * FORESHADOW_COLORS.length)];
        this.cameras.main.flash(220, c.r, c.g, c.b, false);

        this.soundManager.playForeshadowChime();

        // 캐릭터 호기심 라인 (현재 다른 말풍선 떠있으면 스킵)
        if (!this.characterBubble) {
            const line = FORESHADOW_LINES[Math.floor(Math.random() * FORESHADOW_LINES.length)];
            this.showCharacterMonologue(line);
        }

        this.foreshadowCooldown = FORESHADOW_COOLDOWN_TAPS;
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
        // 어차피 1.5초 후 loadLayer가 텍스처/tilePos 모두 리셋하므로 cap 불필요
        // (루프 텍스처 모드여도 자동 wrap이라 시각적 안전)
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

        // 1.1초 후 "다음 레이어 프리뷰" 0.8초 노출 → 0.6초 페이드아웃 → 2.5초 시점 loadLayer
        // (clear 팡파레/리워드 텍스트가 거의 사라진 시점에 다음 무대 살짝 보여 동기 부여)
        this.time.delayedCall(1100, () => this.showNextLayerPreview());
        this.time.delayedCall(2500, () => {
            this.loadLayer(this.layerOrder + 1);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 다음 레이어 프리뷰 (clearLayer 후 1.1~2.5s 사이 노출)
    //   - 화면 중앙에 다음 레이어 배경 썸네일 + "다음: <name>" 텍스트
    //   - 0.25s 페이드인 → 0.7s 유지 → 0.5s 페이드아웃
    //   - 다음 레이어 없으면 (마지막 클리어) 스킵
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    showNextLayerPreview() {
        const next = getLayerByOrder(this.layerOrder + 1);
        if (!next) return;   // 마지막 레이어 클리어 - 메뉴 복귀라 스킵
        if (!this.cameras || !this.cameras.main) return;

        const { width, height } = this.cameras.main;
        const bgKey = `${next.id}_bg`;
        if (!this.textures.exists(bgKey)) return;

        // 어두운 오버레이 (현재 화면 살짝 가림 → 프리뷰 가독성)
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
            .setDepth(95);

        // 썸네일 - 화면 중앙, 폭 70% / 높이 30% (배경 jpg 비율 무시 강제 fit)
        const thumbW = width * 0.70;
        const thumbH = height * 0.30;
        const thumbCenterY = height * 0.45;
        const thumb = this.add.image(width / 2, thumbCenterY, bgKey)
            .setDisplaySize(thumbW, thumbH)
            .setDepth(96)
            .setAlpha(0);
        // 테두리 (Image는 stroke 없어서 graphics로 별도 그림)
        const border = this.add.graphics().setDepth(97).setAlpha(0);
        border.lineStyle(4, 0xffd700, 1);
        border.strokeRect(width / 2 - thumbW / 2, thumbCenterY - thumbH / 2, thumbW, thumbH);

        // "다음: <name>" 라벨 (썸네일 아래 30px)
        const label = this.add.text(width / 2, thumbCenterY + thumbH / 2 + 30, `다음: ${next.name}`, {
            font: 'bold 32px sans-serif',
            color: '#ffd700',
            stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(97).setAlpha(0);

        // 페이드인 / 유지 / 페이드아웃 (0.25 + 0.7 + 0.5 = 1.45초, loadLayer 전 여유 0.05s)
        const fadeIn = 250, hold = 700, fadeOut = 500;
        this.soundManager.playLayerPreviewSound();

        this.tweens.add({
            targets: [overlay],
            alpha: { from: 0, to: 0.55 },
            duration: fadeIn, ease: 'Quad.out'
        });
        this.tweens.add({
            targets: [thumb, border, label],
            alpha: { from: 0, to: 1 },
            duration: fadeIn, ease: 'Quad.out'
        });

        // 페이드아웃
        this.time.delayedCall(fadeIn + hold, () => {
            this.tweens.add({
                targets: [overlay],
                alpha: 0,
                duration: fadeOut, ease: 'Quad.in'
            });
            this.tweens.add({
                targets: [thumb, border, label],
                alpha: 0,
                duration: fadeOut, ease: 'Quad.in',
                onComplete: () => {
                    overlay.destroy();
                    thumb.destroy();
                    border.destroy();
                    label.destroy();
                }
            });
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
        // 화면 y = (textureY - virtualScrollY) × tileScaleY
        // virtualScrollY는 텍스처 wrap에 무관하게 누적되는 스크롤량
        // → 루프 텍스처로 전환돼도 hole 크기는 끊김 없이 계속 자라남
        // → loadLayer에서 0으로 리셋됨 (새 레이어 hole = MIN_HEIGHT)
        const bgScrollY = this.virtualScrollY || 0;
        const tileScale = (this.bgImage && this.bgImage.tileScaleY)   ? this.bgImage.tileScaleY   : 1;
        const surfaceY  = (SURFACE_TEXTURE_Y - bgScrollY) * tileScale;

        // 구덩이 바닥 = 캐릭터 발 + HOLE_Y_OFFSET (살짝 아래)
        const holeBottomY = this.character.y + HOLE_Y_OFFSET;

        // 높이 = (바닥 - 지표면) × PADDING_FACTOR
        // origin (0.5, 1.0)이라 displayHeight를 키우면 바닥은 holeBottomY 고정 + 위로 자람
        const h = Math.max(HOLE_MIN_HEIGHT, (holeBottomY - surfaceY) * HOLE_PADDING_FACTOR);

        this.holeImage.setDisplaySize(w, h);
        // 하단 padding 보정 — 사장님 보고: cap 10px 때문에 100탭 부근에서 시각 굴 바닥이 캐릭터 발보다 위로 어긋남
        //   원인: rawPad = h × ratio가 cap 10 초과 → bottomPad 부족 → 시각 hole 하단 < character.y
        //   처방: cap 제거, paddingRatio 측정값 그대로 적용 → 시각 굴 바닥 = 캐릭터 발 항상 일치
        //   ratio가 부정확해서 hole이 지표면 아래로 어긋나는 문제 재발 시 별도 진단 필요
        const bottomPad = h * (this.holeBottomPaddingRatio || 0);
        this.holeImage.y = holeBottomY + bottomPad;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PNG 텍스처의 하단 투명 padding 자동 측정 (0~1 ratio)
    //   - 이미지 픽셀을 canvas로 읽어 alpha=0 row를 하단부터 카운트
    //   - 결과: padding_pixels / image_height
    //   - 같은 도메인 정적 자산이라 cross-origin 차단 없음 (자기 호스트)
    //   - 측정 실패 시 0 반환 → 기존 동작과 동일
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    measureBottomPaddingRatio(textureKey) {
        if (!this.textures.exists(textureKey)) return 0;
        const tex = this.textures.get(textureKey).getSourceImage();
        if (!tex || !tex.width || !tex.height) return 0;
        const w = tex.width, h = tex.height;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return 0;
            ctx.drawImage(tex, 0, 0);
            const data = ctx.getImageData(0, 0, w, h).data;
            // 하단 row부터 위로 → 첫 alpha > 0 row 찾기
            for (let y = h - 1; y >= 0; y--) {
                for (let x = 0; x < w; x++) {
                    if (data[(y * w + x) * 4 + 3] > 0) {
                        const paddingPx = h - 1 - y;
                        return paddingPx / h;
                    }
                }
            }
        } catch (e) {
            console.warn(`[hole padding] 측정 실패 (${textureKey}):`, e);
        }
        return 0;
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
    // 지하 무한 루프 텍스처 캐싱 (B-2 방식)
    //   - 원본 레이어 텍스처(720×2580)에서 row LOOP_START_ROW 이하만 잘라내
    //     별도 캔버스 텍스처로 등록 → 그 레이어의 지하 패턴이 wrap-friendly
    //   - 한 레이어당 1번만 생성하고 캐시 (텍스처 manager에 저장)
    //   - 키: `${layerId}_bg_loop`
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ensureLoopTexture(layerId) {
        if (!layerId) return null;
        const loopKey = `${layerId}_bg_loop`;
        if (this.textures.exists(loopKey)) return loopKey;

        const srcKey = `${layerId}_bg`;
        if (!this.textures.exists(srcKey)) return null;

        const srcImg = this.textures.get(srcKey).getSourceImage();
        if (!srcImg || !srcImg.width || !srcImg.height) return null;

        const w = srcImg.width;
        const h = LOOP_TEXTURE_HEIGHT;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // 원본 row LOOP_START_ROW부터 끝까지를 새 캔버스 row 0부터 그림
        ctx.drawImage(srcImg, 0, LOOP_START_ROW, w, h, 0, 0, w, h);
        this.textures.addCanvas(loopKey, canvas);
        return loopKey;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 지하 마스킹 오버레이 — 사장님 보고: 다 판 후 화면 아래 지상 30% 잔존 + wrap 시 지상 깜빡
    //   B-2 loop 텍스처가 100% 동작 안 하는 케이스 보강
    //   surfaceY가 화면 안일 때만 그 아래 영역을 어두운 흙으로 덮음
    //   surfaceY 화면 위로 갔으면(=충분히 깊음) 화면 전체 underground
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    drawUndergroundOverlay() {
        if (!this.undergroundOverlay) return;
        this.undergroundOverlay.clear();
        if (!this.bgImage) return;

        // 사장님 보고: 6레벨 진입 시 배경 회색 → 처음 진입 단계엔 비활성화
        // LOOP_START_ROW(=1300) 진입 후만 활성화 — 그 전엔 배경 layer_NNN_bg 그대로 노출
        if ((this.virtualScrollY || 0) < LOOP_START_ROW) return;

        const { width, height } = this.cameras.main;
        const tileScale = this.bgImage.tileScaleY || 1;
        const surfaceY = (SURFACE_TEXTURE_Y - (this.virtualScrollY || 0)) * tileScale;

        // 지하 단계 진입 후 — wrap 시 지상 깜빡 차단용. surfaceY 아래만 어두운 흙으로 덮음
        const darkSoil = (this.currentDirtPalette && this.currentDirtPalette[2]) || 0x2a1a0a;
        this.undergroundOverlay.fillStyle(darkSoil, 1);

        if (surfaceY <= 0) {
            this.undergroundOverlay.fillRect(0, 0, width, height);
        } else if (surfaceY < height) {
            this.undergroundOverlay.fillRect(0, surfaceY, width, height - surfaceY);
        }
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
    // 돌(hard soil) 타격 시각 효과
    //   - 🪨 돌 이모지가 발치에서 위로 튀어올랐다 떨어짐 (포물선)
    //   - 💥 스파크 이모지가 좌우로 튀어 흩어짐 (3개)
    //   - 사용자가 "돌 부딪혔다!"를 즉시 인식 가능
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    spawnHardHitEffect(x, y) {
        // 메인 돌 이모지 (중앙에서 위로 솟구침)
        const rock = this.add.text(x, y, '🪨', {
            font: '64px sans-serif'
        }).setOrigin(0.5).setDepth(16);

        const peakY = y - 130;
        // 위로 솟구쳤다 떨어짐 (포물선)
        this.tweens.chain({
            targets: rock,
            tweens: [
                { y: peakY, scale: { from: 0.5, to: 1.3 }, duration: 220, ease: 'Quad.out' },
                { y: y + 10, scale: 0.8, alpha: 0, duration: 320, ease: 'Quad.in' }
            ],
            onComplete: () => rock.destroy()
        });
        // 회전 (하늘에서 빙글)
        this.tweens.add({
            targets: rock, angle: 360, duration: 540, ease: 'Linear'
        });

        // 스파크 3개 (좌/중/우로 튀김)
        const sparkAngles = [-60, 0, 60]; // 좌상/위/우상
        sparkAngles.forEach((deg) => {
            const rad = Phaser.Math.DegToRad(deg - 90);  // -90 = 위쪽 기준
            const dist = 80 + Math.random() * 40;
            const sx = x + Math.cos(rad) * dist;
            const sy = y + Math.sin(rad) * dist;
            const spark = this.add.text(x, y, '💥', {
                font: '36px sans-serif'
            }).setOrigin(0.5).setDepth(16);
            this.tweens.add({
                targets: spark,
                x: sx, y: sy,
                scale: { from: 0.6, to: 1.4 },
                alpha: { from: 1, to: 0 },
                duration: 380,
                ease: 'Quad.out',
                onComplete: () => spark.destroy()
            });
        });
    }

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
    //   + SOUL 게이지 자연 회복 + 번아웃 자동 종료
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    update(time, delta) {
        this.drawHole();
        this.drawMounds();
        this.drawUndergroundOverlay();
        this.drawBuffHUD();

        // 파티클이 흙더미 bbox 안에 들어오면 즉시 사라짐 (alpha 0 처리)
        // 원/사각 두 emitter 모두 검사
        if (this.leftMoundBBox || this.rightMoundBBox) {
            const killIfInMound = (p) => {
                if (this._isInMoundBBox(p.x, p.y)) p.alpha = 0;
            };
            if (this.dirtEmitter)       this.dirtEmitter.forEachAlive(killIfInMound, this);
            if (this.dirtEmitterSquare) this.dirtEmitterSquare.forEachAlive(killIfInMound, this);
        }

        // ━━ SOUL 자연 회복 (탭 안 하는 동안 초당 SOUL_REGEN_PER_SECOND씩) ━━
        // delta는 ms (보통 16~17). 1000ms 모으면 SOUL_REGEN_PER_SECOND 적용
        if (!this.burnoutActive && this.soulGauge < SOUL_MAX) {
            const regenAmount = SOUL_REGEN_PER_SECOND * (delta / 1000);
            this.soulGauge = Math.min(SOUL_MAX, this.soulGauge + regenAmount);
            this.drawSoulGauge();
        }

        // ━━ 번아웃 종료 체크 (5초 후 자동 회복) ━━
        if (this.burnoutActive && time >= this.burnoutEndTime) {
            this.endBurnout();
        }

        // ━━ POWER DIG 박스 만료 → 페이드아웃 (탭으로 명중되면 _consumePowerDig이 먼저 powerDigBox 클리어) ━━
        if (this.powerDigBox && time >= this.powerDigBox.expiresAt) {
            const c = this.powerDigBox.container;
            const glow = this.powerDigBox.glow;
            this.powerDigBox = null;
            if (c) {
                this.tweens.killTweensOf(c);
                if (glow) this.tweens.killTweensOf(glow);
                this.tweens.add({
                    targets: c,
                    alpha: 0,
                    scale: 0.6,
                    duration: 320,
                    ease: 'Quad.in',
                    onComplete: () => c.destroy()
                });
            }
        }

        // ━━ 베이스 캐릭터 텍스처 자동 갱신 ━━
        //   SOUL이 회복/감소하면서 tired ↔ idle/combo 자동 전환
        //   transient 활성 중(dig/panic/surprise/clear/treasurePopup)이면 차단
        //   setCharacterState는 같은 텍스처면 noop이라 매 프레임 호출 안전
        if (!this.digRevertTimer && !this.panicRevertTimer && !this.surpriseRevertTimer
            && !this.clearActive && !this.treasurePopupActive) {
            this.setCharacterState(this.getBaseCharacterState());
        }

        // ━━ 코믹 디테일 모니터링 ━━
        this.updateSweat();
        this.updateSoulGhost();
        this.updateThoughtBubble(time);
        this.updateSleepMode(time);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 땀방울 — SOUL 낮거나 콤보 높을 때 캐릭터 머리 양옆에서 푸른 물방울
    //   콤보 200+ 폭포, 100+ 굵게, 50+/SOUL 50% 이하 보통, 그 외 비활성
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    updateSweat() {
        if (!this.character || !this.sweatEmitterLeft || !this.sweatEmitterRight) return;
        if (this.clearActive || this.treasurePopupActive || this.burnoutActive) {
            this.sweatEmitterLeft.frequency  = -1;
            this.sweatEmitterRight.frequency = -1;
            return;
        }

        // 머리 양옆 위치 갱신 (캐릭터 사이즈 변할 수 있음)
        const headY = this.character.y - this.character.displayHeight + 30;
        this.sweatEmitterLeft.setPosition(this.character.x - 50,  headY);
        this.sweatEmitterRight.setPosition(this.character.x + 50, headY);

        let freq = -1;
        if (this.combo >= 200)                                          freq = SWEAT_FREQ_FLOOD;
        else if (this.combo >= 100)                                     freq = SWEAT_FREQ_HOT;
        else if (this.combo >= SWEAT_COMBO_THRESHOLD ||
                 this.soulGauge <= SWEAT_SOUL_THRESHOLD)                freq = SWEAT_FREQ_NORMAL;

        this.sweatEmitterLeft.frequency  = freq;
        this.sweatEmitterRight.frequency = freq;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 영혼 빠져나감 — SOUL 20% 이하 → 머리 위 둥실, 30% 회복 → 머리로 회수
    //   히스테리시스(20/30%)로 임계점 깜빡임 방지
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    updateSoulGhost() {
        if (!this.character) return;
        const shouldShow = this.soulGauge <= SOUL_GHOST_OUT;
        const shouldHide = this.soulGauge >= SOUL_GHOST_IN;

        if (shouldShow && !this.soulGhost) this.spawnSoulGhost();
        else if (shouldHide && this.soulGhost) this.despawnSoulGhost();

        // 둥실 위치 갱신 (캐릭터 따라옴)
        if (this.soulGhost) {
            const headY = this.character.y - this.character.displayHeight - 80;
            this.soulGhost.x = this.character.x;
            // y는 tween이 ±8 흔들고 있으니 baseY만 갱신
            this.soulGhost._baseY = headY;
        }
    }

    spawnSoulGhost() {
        if (this.soulGhost) return;
        const headY = this.character.y - this.character.displayHeight - 80;
        const ghost = this.add.text(this.character.x, headY, '👻', {
            font: '64px sans-serif'
        }).setOrigin(0.5).setDepth(17).setAlpha(0);
        ghost._baseY = headY;
        this.soulGhost = ghost;

        // 페이드인 + 둥실 yoyo
        this.tweens.add({
            targets: ghost,
            alpha: { from: 0, to: 0.85 },
            duration: 600
        });
        this.soulGhostTween = this.tweens.add({
            targets: ghost,
            y: headY - 16,
            yoyo: true, repeat: -1,
            duration: 1100, ease: 'Sine.inOut'
        });

        // 한 번 자조 라인 (이미 다른 라인 떠있으면 스킵)
        if (!this.characterBubble) this.showCharacterMonologue('영혼 빠져나간다...');
    }

    despawnSoulGhost() {
        if (!this.soulGhost) return;
        const ghost = this.soulGhost;
        this.soulGhost = null;
        if (this.soulGhostTween) { this.soulGhostTween.stop(); this.soulGhostTween = null; }
        // 머리로 회수 (역재생) — y가 머리 위치로 빨려 들어감 + 페이드아웃
        const targetY = this.character.y - this.character.displayHeight + 20;
        this.tweens.add({
            targets: ghost,
            y: targetY, alpha: 0, scale: 0.5,
            duration: 500, ease: 'Quad.in',
            onComplete: () => ghost.destroy()
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 마음의 소리 — 25~45초 무작위 간격, 작고 흐릿한 thought bubble
    //   monologue(직접 외치는 톤)와 다른 internal voice. 말풍선 동시 노출 X
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    updateThoughtBubble(time) {
        if (!this.character) return;
        if (this.clearActive || this.treasurePopupActive || this.burnoutActive) return;
        if (this.characterBubble) return;     // monologue 떠있으면 양보
        if (this.thoughtBubble) return;       // 이미 표시 중

        // 첫 호출에 nextThoughtAt 초기화 (constructor에선 time 모름)
        if (!this.nextThoughtAt) {
            this.nextThoughtAt = time + Phaser.Math.Between(THOUGHT_INTERVAL_MIN, THOUGHT_INTERVAL_MAX);
            return;
        }
        if (time < this.nextThoughtAt) return;

        const line = THOUGHT_LINES[Math.floor(Math.random() * THOUGHT_LINES.length)];
        this.spawnThoughtBubble(line);
        this.nextThoughtAt = time + Phaser.Math.Between(THOUGHT_INTERVAL_MIN, THOUGHT_INTERVAL_MAX);
    }

    spawnThoughtBubble(text) {
        // 캐릭터 우측 상단 (등 뒤 ~) 작고 흐릿한 구름 풍선
        const x = this.character.x + 110;
        const y = this.character.y - this.character.displayHeight + 50;

        const txt = this.add.text(0, 0, text, {
            font: 'italic 18px sans-serif',
            color: '#444444',
            align: 'center'
        }).setOrigin(0.5);

        const padX = 14, padY = 8;
        const w = txt.width + padX * 2;
        const h = txt.height + padY * 2;

        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.78);                       // 반투명 흰
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
        g.lineStyle(1, 0xaaaaaa, 0.7);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
        // 작은 구름 방울 2개 (캐릭터 쪽 아래로 향함)
        g.fillStyle(0xffffff, 0.78);
        g.fillCircle(-w / 2 + 8, h / 2 + 6, 4);
        g.fillCircle(-w / 2 - 2, h / 2 + 14, 3);

        const container = this.add.container(x, y, [g, txt]).setDepth(18).setAlpha(0);
        this.thoughtBubble = container;

        // 페이드인 → 2.5초 유지 → 페이드아웃
        this.tweens.add({ targets: container, alpha: 0.9, duration: 350 });
        this.tweens.add({
            targets: container,
            alpha: 0,
            delay: 350 + 2500,
            duration: 500,
            onComplete: () => {
                if (this.thoughtBubble === container) this.thoughtBubble = null;
                container.destroy();
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 쪽잠 — 30초 무탭이면 머리 위 💤 + tired. 다음 dig() 시 깜짝 깨어남
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    updateSleepMode(time) {
        if (!this.character) return;
        if (this.clearActive || this.treasurePopupActive || this.burnoutActive) return;

        const idleMs = time - (this.lastDigTime || 0);
        if (!this.sleepingActive && this.lastDigTime > 0 && idleMs >= SLEEP_AFTER_MS) {
            this.enterSleepMode();
        }
    }

    enterSleepMode() {
        if (this.sleepingActive) return;
        this.sleepingActive = true;
        const headY = this.character.y - this.character.displayHeight - 60;
        this.sleepIcon = this.add.text(this.character.x + 50, headY, '💤', {
            font: '48px sans-serif'
        }).setOrigin(0.5).setDepth(17).setAlpha(0);
        this.tweens.add({ targets: this.sleepIcon, alpha: 0.95, duration: 400 });
        // 둥실 + 살짝 회전
        this.tweens.add({
            targets: this.sleepIcon,
            y: headY - 10,
            angle: { from: -8, to: 8 },
            yoyo: true, repeat: -1,
            duration: 1200, ease: 'Sine.inOut'
        });
        // 입가에 작은 침 (☆) 풍자 라인
        if (!this.characterBubble) this.showCharacterMonologue('코오오...');
    }

    exitSleepMode() {
        if (!this.sleepingActive) return;
        this.sleepingActive = false;
        if (this.sleepIcon) {
            const icon = this.sleepIcon;
            this.sleepIcon = null;
            this.tweens.killTweensOf(icon);
            this.tweens.add({
                targets: icon,
                alpha: 0, scale: 1.5,
                duration: 220,
                onComplete: () => icon.destroy()
            });
        }
        // 깜짝 깨어남: surprise 텍스처 + 화면 살짝 흔들 + "헉!"
        this.setCharacterState('surprise');
        this.cameras.main.shake(180, 0.006);
        if (!this.characterBubble) this.showCharacterMonologue('헉! 사장님?!');
        // 1.2초 후 surprise 자동 복귀 (기존 surpriseRevertTimer 패턴)
        if (this.surpriseRevertTimer) this.surpriseRevertTimer.remove(false);
        this.surpriseRevertTimer = this.time.delayedCall(1200, () => {
            this.surpriseRevertTimer = null;
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 코피/초집중 — 콤보 100 정확히 도달 시 한 번 발동
    //   캐릭터별 nosebleed PNG (코피 분수 + 만화 글자) + scale 펑 + 화면 flash + 텍스트
    //   PNG 미로드 시 빨간 점 graphics 폴백 (lazy load 중인 캐릭터 안전)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    triggerNosebleed() {
        if (!this.character) return;
        // 화면 빨간 flash
        this.cameras.main.flash(220, 200, 30, 30);

        // 캐릭터 PNG로 nosebleed 텍스처 전환 + scale 펑 tween (1.0 → 1.15 → 1.0)
        const noseKey = `${this.characterId}_nosebleed`;
        if (this.textures.exists(noseKey)) {
            // 진행 중인 transient 취소 후 nosebleed로 전환
            this.cancelDigRevert();
            this.cancelSurpriseRevert();
            this.cancelPanicRevert();
            this.setCharacterState('nosebleed');
            // 임팩트 scale 펑 (캐릭터 자체 1.0 → 1.15 → 1.0)
            const baseScaleX = this.character.scaleX;
            const baseScaleY = this.character.scaleY;
            this.tweens.add({
                targets: this.character,
                scaleX: baseScaleX * 1.15,
                scaleY: baseScaleY * 1.15,
                duration: 180, yoyo: true, ease: 'Quad.out'
            });
            // 1.2초 후 베이스 텍스처 자동 복귀 (panicRevertTimer 패턴 재사용)
            if (this.panicRevertTimer) this.panicRevertTimer.remove(false);
            this.panicRevertTimer = this.time.delayedCall(1200, () => {
                this.panicRevertTimer = null;
            });
        } else {
            // PNG 미로드 폴백 — 빨간 점 graphics
            const noseX = this.character.x;
            const noseY = this.character.y - this.character.displayHeight * 0.65;
            const drop = this.add.circle(noseX, noseY, 6, 0xc8102e, 1).setDepth(17);
            this.tweens.add({
                targets: drop,
                y: noseY + 90, alpha: 0,
                duration: 700, ease: 'Quad.in',
                onComplete: () => drop.destroy()
            });
        }

        // 초집중 텍스트 (캐릭터 옆에 솟구침)
        const noseY = this.character.y - this.character.displayHeight * 0.65;
        this.showFloatingText(this.character.x + 80, noseY, '🩸 초집중!', '#ff3030');
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
    // 캐릭터 상태 머신 (8종)
    //   베이스 우선순위 (높음→낮음):
    //     clear > surprise > tired(SOUL<40) > combo > idle
    //   Transient (덮어씀):
    //     panic (3초)  > dig/dig_hard (0.3초)  > 베이스
    //   panic은 dig보다 우선 → revertCharacterToBase가 panic 활성 중엔 차단
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 현재 게임 상태로부터 표시해야 할 베이스 텍스처 결정
    getBaseCharacterState() {
        if (this.clearActive) return 'clear';
        if (this.treasurePopupActive) return 'surprise';
        if (this.soulGauge < 40) return 'tired';   // SOUL 40% 미만 = 지침/번아웃 단계
        if (this.combo >= 10) return 'combo';
        return 'idle';
    }

    // 현재 캐릭터의 7 상태(dig/combo/surprise/clear/tired/panic/dig_hard) 백그라운드 로드
    //   - char_001은 BootScene에서 다 로드 → missing 0장 → 즉시 return
    //   - char_002~006은 idle만 로드 상태 → 7장 lazy. 완료 시 setCharacterState가 자연스럽게 사용
    //   - 진행 중 setCharacterState 호출 시 미로드 상태면 textures.exists 체크로 noop (idle 유지)
    lazyLoadCharacterStates(charId) {
        if (!charId) return;
        const states = ['dig', 'combo', 'surprise', 'clear', 'tired', 'panic', 'dig_hard', 'nosebleed'];
        const missing = states.filter(s => !this.textures.exists(`${charId}_${s}`));
        if (missing.length === 0) return;
        missing.forEach(s => {
            this.load.image(`${charId}_${s}`, `assets/characters/${charId}_${s}.png`);
        });
        // load 진행 중인지 확인 (이미 진행 중이면 자동으로 큐에 추가됨)
        if (!this.load.isLoading()) {
            this.load.start();
        }
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

        // 캐릭터 라벨은 상단 중앙 고정이라 캐릭터 위치 변화와 무관 (resize에서만 갱신)
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
    //   transient(panic / surprise) 활성 중이면 차단 (보물 발견·NPC 반응 우선)
    revertCharacterToBase() {
        if (this.panicRevertTimer) return;
        if (this.surpriseRevertTimer) return;
        this.setCharacterState(this.getBaseCharacterState());
    }

    // 진행 중인 dig 복귀 타이머 취소
    cancelDigRevert() {
        if (this.digRevertTimer) {
            this.digRevertTimer.remove(false);
            this.digRevertTimer = null;
        }
    }

    // 진행 중인 panic 복귀 타이머 취소
    cancelPanicRevert() {
        if (this.panicRevertTimer) {
            this.panicRevertTimer.remove(false);
            this.panicRevertTimer = null;
        }
    }

    // 진행 중인 surprise 복귀 타이머 취소
    cancelSurpriseRevert() {
        if (this.surpriseRevertTimer) {
            this.surpriseRevertTimer.remove(false);
            this.surpriseRevertTimer = null;
        }
    }

    // surprise transient 트리거 - 보물 발견·장애물 등장·잭팟 등 짧은 놀람 표정용
    //   panic이 활성 중이면 무시 (panic이 더 우선)
    //   기본 700ms (전형적 깜짝 반응 길이)
    triggerSurprise(durationMs = 700) {
        if (this.panicRevertTimer) return;
        // 진행 중인 dig 모션도 정리해서 surprise가 덮어씌움
        this.cancelDigRevert();
        this.cancelSurpriseRevert();
        this.setCharacterState('surprise');
        this.surpriseRevertTimer = this.time.delayedCall(durationMs, () => {
            this.surpriseRevertTimer = null;
            this.revertCharacterToBase();
        });
    }

    // 탭 시 호출 - dig 텍스처로 전환 후 0.3초 뒤 베이스 복귀
    //   사장님 요청: 모션 임팩트 강화 위해 dig_hard 80% / dig 20% 비율로 표출
    //   (이전엔 layer soilType이 hard일 때만 dig_hard, 일반 soil은 dig)
    //   surprise/panic 등 어떤 transient 중이라도 탭하면 즉시 dig 텍스처로 전환
    playDigAnimation() {
        if (this.treasurePopupActive || this.clearActive) return;

        // 진행 중인 transient(surprise/panic)는 모두 취소하고 dig로 전환
        this.cancelSurpriseRevert();
        this.cancelPanicRevert();

        // 80% dig_hard, 20% dig (soilType 무관 RNG)
        // — 캐릭터 강타 모션이 더 자주 보여 게임감 강화
        const useHardTexture = Math.random() < 0.8;
        this.setCharacterState(useHardTexture ? 'dig_hard' : 'dig');

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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SOUL-OUT 게이지 시스템
    //   - drainSoul(amount): 탭마다 소모, 0 도달 시 startBurnout()
    //   - drawSoulGauge(): 게이지 fill/색/캐릭터 상태/입속 👻 갱신
    //   - getSoulStateClass(): 100~70/70~40/40~10/10~0 단계 분류
    //   - startBurnout()/endBurnout(): 5초 정지 → 20% 회복
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 탭마다 호출 - 게이지 감소 + 0 도달 시 번아웃 진입
    drainSoul(amount) {
        if (this.burnoutActive) return;
        this.soulGauge = Math.max(0, this.soulGauge - amount);
        if (this.soulGauge <= 0) {
            this.startBurnout();
        }
        this.drawSoulGauge();
    }

    // 게이지 fill height + 색상 + 텍스트 + 캐릭터 입속 👻 동기화
    drawSoulGauge() {
        if (!this.soulGaugeFill || !this._soulGaugeRect) return;
        const r = this._soulGaugeRect;
        const ratio = Math.max(0, Math.min(1, this.soulGauge / SOUL_MAX));
        const fillH = r.h * ratio;
        // origin (0,1) 기준이므로 y 고정, height만 변경
        this.soulGaugeFill.height = fillH;
        // 색: 70+ 분홍/녹색 / 40~70 노랑 / 10~40 주황 / 10- 빨강
        const stateClass = this.getSoulStateClass();
        const colorMap = {
            energetic: 0xff5577,   // 100~70 분홍 (열정)
            normal:    0xffcc44,   // 70~40 노랑
            tired:     0xff8844,   // 40~10 주황
            burnout:   0xcc3333    // 10~0 빨강
        };
        this.soulGaugeFill.fillColor = colorMap[stateClass];
        // 텍스트
        if (this.soulGaugeText) {
            this.soulGaugeText.setText(`${Math.floor(this.soulGauge)}%`);
        }
        // 입속 👻 이모지 (40 미만부터 1개, 10 미만부터 3개+흔들림)
        this.updateSoulGhostEmojis(stateClass);
    }

    // 100~70=energetic / 70~40=normal / 40~10=tired / 10~0=burnout
    getSoulStateClass() {
        const v = this.soulGauge;
        if (v >= 70) return 'energetic';
        if (v >= 40) return 'normal';
        if (v >= 10) return 'tired';
        return 'burnout';
    }

    // 입에서 👻 1~3개 표시 (40 미만부터)
    updateSoulGhostEmojis(stateClass) {
        if (!this.character) return;
        const targetCount = stateClass === 'tired'   ? 1
                          : stateClass === 'burnout' ? 3
                          : 0;

        // 부족하면 추가, 넘치면 제거
        while (this.soulGhostEmojis.length < targetCount) {
            const idx = this.soulGhostEmojis.length;
            // 캐릭터 머리 위쪽 입 근처에 떠다니는 작은 👻 (오프셋 살짝 다르게)
            const ghost = this.add.text(
                this.character.x - 20 + idx * 18,
                this.character.y - this.character.displayHeight * 0.5,
                '👻',
                { font: '24px sans-serif' }
            ).setOrigin(0.5).setDepth(12);
            // 위아래로 천천히 흔들림 (ambient float)
            this.tweens.add({
                targets: ghost,
                y: ghost.y - 8,
                duration: 700 + idx * 120,
                yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
            this.soulGhostEmojis.push(ghost);
        }
        while (this.soulGhostEmojis.length > targetCount) {
            const ghost = this.soulGhostEmojis.pop();
            this.tweens.killTweensOf(ghost);
            ghost.destroy();
        }

        // 위치 항상 갱신 (캐릭터 이동 따라옴)
        this.soulGhostEmojis.forEach((g, i) => {
            g.x = this.character.x - 20 + i * 18;
        });

        // 번아웃: 캐릭터 좌우로 흔들림 트윈 (한 번만 시작)
        if (stateClass === 'burnout' && !this.soulShakeTween && !this.charMoveTween) {
            this.soulShakeTween = this.tweens.add({
                targets: this.character,
                x: this.charBaseX + 4,
                duration: 80,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.inOut'
            });
        } else if (stateClass !== 'burnout' && this.soulShakeTween) {
            this.soulShakeTween.stop();
            this.soulShakeTween = null;
            if (this.character) this.character.x = this.charBaseX;
        }
    }

    // 게이지 0 도달 시 - 5초 정지 + 번아웃 라인 + 사운드
    startBurnout() {
        this.burnoutActive = true;
        this.burnoutEndTime = this.time.now + SOUL_BURNOUT_PAUSE_MS;
        this.soundManager.playBurnoutSound();
        this.soundManager.triggerHaptic('heavy');
        // "쓰러질 것 같아..." 말풍선
        this.showCharacterMonologue(COLLAPSE_LINE);
    }

    // 5초 후 자동 회복
    endBurnout() {
        this.burnoutActive = false;
        this.soulGauge = SOUL_BURNOUT_RECOVER;
        this.soundManager.playSoulRecoverSound();
        this.drawSoulGauge();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 캐릭터 혼잣말 말풍선 (NPC 말풍선과 별개 - 캐릭터 머리 위 작은 흰 풍선)
    //   - 2초 유지 후 페이드아웃
    //   - 텍스트 효과음 (타닥타닥) 동시 재생
    //   - 동시 1개만 (이미 있으면 즉시 교체)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    showCharacterMonologue(text) {
        if (!this.character) return;

        // 기존 말풍선 즉시 제거
        if (this.characterBubble && this.characterBubble.active) {
            this.tweens.killTweensOf(this.characterBubble);
            this.characterBubble.destroy();
            this.characterBubble = null;
        }

        // 효과음 (텍스트 읽기)
        this.soundManager.playSpeechBubbleSound();

        // 위치: 캐릭터 머리 위
        const bubbleX = this.character.x;
        const bubbleY = this.character.y - this.character.displayHeight - 20;

        const container = this.add.container(bubbleX, bubbleY).setDepth(48);

        // 텍스트 — 사장님 피드백: 글자 너무 작음 → 22 → 34px로 대폭 확대
        const txt = this.add.text(0, 0, text, {
            font: 'bold 34px sans-serif',
            color: '#222',
            align: 'center'
        }).setOrigin(0.5);

        // 자동 사이즈 측정 후 라운드 사각형 배경 (Graphics)
        // 폰트 키운 만큼 패딩도 비례 확대 → 시각적으로 "말풍선" 임팩트 강화
        const padX = 26;
        const padY = 18;
        const w = txt.width + padX * 2;
        const h = txt.height + padY * 2;

        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.97);
        g.lineStyle(4, 0x333333, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
        // 꼬리 (아래쪽 삼각형) — 폰트 확대에 맞춰 같이 키움
        g.fillTriangle(-12, h / 2 - 1, 12, h / 2 - 1, 0, h / 2 + 16);
        g.lineStyle(4, 0x333333, 1);
        g.strokeTriangle(-12, h / 2 - 1, 12, h / 2 - 1, 0, h / 2 + 16);

        container.add([g, txt]);

        // 등장 애니 (작게 시작 → 1.0)
        container.setScale(0.4);
        container.alpha = 0;
        this.tweens.add({
            targets: container,
            scale: 1, alpha: 1,
            duration: 180, ease: 'Back.out'
        });

        this.characterBubble = container;

        // 2초 후 페이드아웃
        this.time.delayedCall(MONOLOGUE_BUBBLE_MS, () => {
            if (!container.active) return;
            this.tweens.add({
                targets: container,
                alpha: 0, scale: 0.85,
                duration: 280,
                onComplete: () => {
                    if (container.active) container.destroy();
                    if (this.characterBubble === container) this.characterBubble = null;
                }
            });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 랜덤 장애물 시스템
    //   spawnObstacle(): 화면 중앙에 장애물 등장 (사운드 + 강진동 + 카메라 흔들)
    //   hitObstacle(): dig 대신 호출됨 - tapsLeft 감소 + 흔들림
    //   breakObstacle(): tapsLeft 0 도달 - 부숨 + 보물 확률 부스트
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    spawnObstacle() {
        if (this.currentObstacle) return;
        if (!this.character) return;

        // 랜덤 타입 선택
        const typeKey = OBSTACLE_KEYS[Math.floor(Math.random() * OBSTACLE_KEYS.length)];
        const def = OBSTACLE_TYPES[typeKey];

        const { width, height } = this.cameras.main;
        const cx = width / 2;
        // 장애물 위치 = 캐릭터 발 바로 아래 (bgCircle 반지름 90 → 원의 윗변이 발 라인에 살짝 닿음)
        // 기존 height*0.5는 캐릭터 허리~발 영역에 겹쳐 보였음 → character.y(발 위치) 기준으로 변경
        const cy = this.character.y + 95;

        const container = this.add.container(cx, cy).setDepth(45);

        // ━━ 사장님 피드백: 보물과 장애물이 둘 다 원이라 구분 안 됨 ━━
        //   → 장애물은 배경 원 제거, 이모지를 더 크게(110→160), 외곽에 def.tint 글로우
        //   → 결과: 보물=원 안 이미지 / 장애물=글로우 도는 큰 이모지 (시각 분리)

        // 장애물 이모지 (110→160, 외곽 글로우 효과)
        const emoji = this.add.text(0, -10, def.emoji, {
            font: '160px sans-serif'
        }).setOrigin(0.5);
        // def.tint 색으로 외곽에 빛나는 글로우 (blur 25, fill에만 그림자)
        const tintHex = '#' + def.tint.toString(16).padStart(6, '0');
        emoji.setShadow(0, 0, tintHex, 25, false, true);

        // 이름 라벨 (이모지 확대분만큼 +20px 내림: y=75→95)
        const nameLabel = this.add.text(0, 95, def.name, {
            font: 'bold 22px sans-serif',
            color: '#ffffff', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        // HP 바 (탭 진행도) — y=110→130
        const hpBarW = 160;
        const hpBarH = 12;
        const hpBarBg = this.add.rectangle(0, 130, hpBarW, hpBarH, 0x333333, 1)
            .setStrokeStyle(2, 0xffffff);
        const hpBar = this.add.rectangle(-hpBarW / 2, 130, hpBarW, hpBarH, 0xffd700, 1)
            .setOrigin(0, 0.5);

        // 안내 텍스트 (탭 X번 더) — y=138→158
        const tapHint = this.add.text(0, 158, `👆 탭 ${def.tapsRequired}회!`, {
            font: 'bold 20px sans-serif',
            color: '#ffd700', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);

        container.add([emoji, nameLabel, hpBarBg, hpBar, tapHint]);

        // 등장 애니 (위에서 떨어짐 + 스케일 펑)
        container.y = -100;
        container.setScale(0.4);
        this.tweens.add({
            targets: container,
            y: cy, scale: 1,
            duration: 320, ease: 'Back.out'
        });

        // 사운드 + 강진동 + 카메라 셰이크 (등장 임팩트도 더 강하게)
        this.soundManager.playObstacleAppearSound();
        this.soundManager.triggerObstacleHitHaptic();   // 4펄스 묵직 진동
        this.cameras.main.shake(260, 0.018);            // 180/0.012 → 260/0.018

        // 캐릭터 깜짝 놀람 표정 0.6초 ("어?!" 반응)
        this.triggerSurprise(600);

        this.currentObstacle = {
            type: typeKey,
            def,
            tapsLeft: def.tapsRequired,
            tapsTotal: def.tapsRequired,
            container, emoji, hpBar, hpBarW, tapHint
        };
    }

    // 장애물 활성 중 dig() 대신 호출됨 - 탭으로 부수기
    hitObstacle(x, y) {
        const ob = this.currentObstacle;
        if (!ob) return;
        ob.tapsLeft = Math.max(0, ob.tapsLeft - 1);

        // 캐릭터 강타 모션 (dig_hard 표정 0.3초) + 좌우 삽질 모션
        // playDigAnimation은 hard soil 분기로 dig_hard 텍스처 자동 선택됨
        // (단 layerData.soilType이 hard가 아니어도 장애물 자체가 단단한 거라 dig_hard 강제하는 게 자연스러움)
        this.cancelDigRevert();
        this.cancelSurpriseRevert();
        if (!this.panicRevertTimer) {
            this.setCharacterState('dig_hard');
            this.digRevertTimer = this.time.delayedCall(300, () => {
                this.digRevertTimer = null;
                this.revertCharacterToBase();
            });
        }
        this.playDigShovelMotion();

        // 이모지 흔들림 (부숨 진행 피드백)
        this.tweens.add({
            targets: ob.emoji,
            angle: { from: -12, to: 12 },
            scale: { from: 1.15, to: 1 },
            duration: 90, yoyo: true, repeat: 0
        });

        // HP 바 갱신
        const ratio = ob.tapsLeft / ob.tapsTotal;
        ob.hpBar.width = ob.hpBarW * ratio;

        // 사운드 + 햅틱 + 카메라 (장애물 타입별 거친 사운드 + 더 강한 진동)
        this.soundManager.playObstacleHitSound(ob.type);
        this.soundManager.triggerObstacleHitHaptic();   // 4펄스 묵직 진동 (hard보다 한 단계 위)
        this.cameras.main.shake(220, 0.024);            // 셰이크 강화: 160/0.018 → 220/0.024
        this.cameras.main.flash(120, 255, 230, 200, false);  // 노란 플래시로 충돌 강조

        // 안내 텍스트 갱신
        if (ob.tapsLeft > 0) {
            ob.tapHint.setText(`👆 탭 ${ob.tapsLeft}회!`);
        } else {
            this.breakObstacle();
        }
    }

    // 장애물 파괴 완료 - 폭발 이펙트 + 보물 확률 부스트
    breakObstacle() {
        const ob = this.currentObstacle;
        if (!ob) return;

        // 사운드 + 강진동 + 강한 카메라 셰이크 (파괴는 가장 강력하게)
        this.soundManager.playObstacleBreakSound();
        this.soundManager.triggerObstacleHitHaptic();
        this.cameras.main.shake(360, 0.026);
        this.cameras.main.flash(180, 255, 230, 120);  // 노란빛 플래시

        // 흙 파티클 폭발 (장애물 위치)
        const cx = ob.container.x;
        const cy = ob.container.y;
        if (this.dirtEmitter)       this.dirtEmitter.explode(60, cx, cy);
        if (this.dirtEmitterSquare) this.dirtEmitterSquare.explode(30, cx, cy);

        // 보물 확률 +20% 일정 시간 부스트
        this.treasureBoostUntil = this.time.now + OBSTACLE_BOOST_MS;

        // 부스트 안내 floatingText (위로 올라가며 사라짐)
        this.showFloatingText(cx, cy - 40, '🏺 보물 확률 +20% (10초)!', '#ffd700');

        // 컨테이너 펑 사라짐
        this.tweens.add({
            targets: ob.container,
            scale: 1.6, alpha: 0,
            duration: 320, ease: 'Quad.out',
            onComplete: () => {
                if (ob.container && ob.container.active) ob.container.destroy();
            }
        });

        this.currentObstacle = null;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 보물 발견 직전 0.3초 황금빛 + 두근두근 → 콜백으로 spawnTreasure 호출
    //   - foreshadowGfx 황금 원 그려서 fade-in/out
    //   - heartbeat 사운드 + light 햅틱
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playTreasureForeshadow(onComplete) {
        if (!this.foreshadowGfx || !this.character) {
            if (onComplete) onComplete();
            return;
        }

        // 직전 foreshadow가 진행 중이면 즉시 spawn (콜백 누락 방지)
        if (this.foreshadowTween && this.foreshadowTween.isPlaying()) {
            if (onComplete) onComplete();
            return;
        }

        // 캐릭터 발 주변에 황금 원 그리기
        const cx = this.character.x;
        const cy = this.character.y;
        this.foreshadowGfx.clear();
        this.foreshadowGfx.fillStyle(0xffd700, 0.55);
        this.foreshadowGfx.fillCircle(cx, cy + 10, 90);
        this.foreshadowGfx.lineStyle(4, 0xffeb3b, 0.9);
        this.foreshadowGfx.strokeCircle(cx, cy + 10, 90);

        // 사운드 + 햅틱
        this.soundManager.playHeartbeatSound();
        this.soundManager.triggerHaptic('light');

        // 페이드 (alpha 0 → 1 → 0)
        this.foreshadowGfx.alpha = 0;
        this.foreshadowTween = this.tweens.add({
            targets: this.foreshadowGfx,
            alpha: 1,
            duration: TREASURE_FORESHADOW_MS / 2,
            yoyo: true,
            onComplete: () => {
                this.foreshadowGfx.alpha = 0;
                this.foreshadowGfx.clear();
                this.foreshadowTween = null;
                if (onComplete) onComplete();
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // legendary "대박!!!" 연출
    //   - 캐릭터 surprise 텍스처 + 0.5초 슬로우모션
    //   - "대박!!!" 말풍선 + 승리 멜로디
    //   - 화면 가장자리 유령 10마리 3초간 떠다님
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playJackpotEffect() {
        // surprise 캐릭터 2초간 (대박 연출은 일반 보물보다 길게 강조)
        // 슬로우모션·멜로디·유령 댄스 동안 표정 유지됨
        this.triggerSurprise(2000);

        // 0.5초 슬로우모션 (Phaser time scale)
        this.time.timeScale = 0.4;
        this.tweens.timeScale = 0.4;
        this.time.delayedCall(500, () => {
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
        }, [], null);
        // ※ delayedCall은 timeScale의 영향을 받으므로 ratio가 0.4면 실제 1250ms ≈ 0.5s slow
        //    (정확히 0.5s real-time 회복 원하면 setTimeout 쓰지만, 게임 흐름상 delayedCall이 자연스러움)

        // "대박!!!" 말풍선
        this.showCharacterMonologue(JACKPOT_LINE);

        // 승리 멜로디
        this.soundManager.playJackpotMelody();

        // 화면 가장자리 유령 10마리 (3초 떠다님)
        this.spawnJackpotGhosts();
    }

    // 화면 가장자리에 유령 이모지 10개 생성 → 가장자리 따라 회전 이동 → 3초 후 페이드 정리
    spawnJackpotGhosts() {
        const { width, height } = this.cameras.main;
        const ghosts = [];

        for (let i = 0; i < JACKPOT_GHOST_COUNT; i++) {
            // 가장자리 4면에 균등 분포 (각 변에 2~3개씩)
            // i를 0~1로 정규화 → 사각형 둘레 위 한 점으로 매핑
            const t = i / JACKPOT_GHOST_COUNT;
            const startPos = this._pointOnPerimeter(t, width, height, 30);

            const ghost = this.add.text(startPos.x, startPos.y, '👻', {
                font: '40px sans-serif'
            }).setOrigin(0.5).setDepth(110);

            ghost.alpha = 0;

            // 등장 (페이드 인)
            this.tweens.add({
                targets: ghost, alpha: 0.95, duration: 250
            });

            // 둘레를 따라 시계방향으로 1.0 ~ 1.3바퀴 이동
            const loops = 1 + Math.random() * 0.3;
            this.tweens.add({
                targets: { p: t },
                p: t + loops,
                duration: JACKPOT_GHOST_DURATION,
                ease: 'Sine.inOut',
                onUpdate: (tw, target) => {
                    if (!ghost.active) return;
                    const pt = this._pointOnPerimeter(target.p % 1, width, height, 30);
                    ghost.x = pt.x;
                    ghost.y = pt.y;
                }
            });

            // 위아래 흔들림 (춤)
            this.tweens.add({
                targets: ghost,
                scale: { from: 0.85, to: 1.15 },
                duration: 280, yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });

            ghosts.push(ghost);
        }

        // 3초 후 페이드아웃 + 정리
        this.time.delayedCall(JACKPOT_GHOST_DURATION, () => {
            ghosts.forEach((g) => {
                this.tweens.add({
                    targets: g, alpha: 0, duration: 300,
                    onComplete: () => { if (g.active) g.destroy(); }
                });
            });
        });
    }

    // 사각형 둘레 위 한 점 (t = 0~1, margin = 가장자리에서 안쪽으로 띄움)
    _pointOnPerimeter(t, w, h, margin) {
        const innerW = w - margin * 2;
        const innerH = h - margin * 2;
        const perim = 2 * (innerW + innerH);
        let d = (t % 1) * perim;
        if (d < innerW)                              return { x: margin + d, y: margin };
        d -= innerW;
        if (d < innerH)                              return { x: w - margin, y: margin + d };
        d -= innerH;
        if (d < innerW)                              return { x: w - margin - d, y: h - margin };
        d -= innerW;
        return { x: margin, y: h - margin - d };
    }
}
