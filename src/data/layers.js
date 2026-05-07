// 레이어 데이터 - CLAUDE.md 기준
// 런칭 1단계: 한국 레이어 6개 (현실 한국)
// 추후 layer_007~ 세계 나라, 유명지, 판타지, 신화 추가 예정

// 보물 등급별 출현 확률 가중치 (캐릭터 보너스 적용 전 기준)
// CLAUDE.md: 보물 출현 확률 → 기본 5%
// 그 5% 안에서 등급별 분배가 weight로 결정됨
export const TREASURE_RARITY = {
    common:    { weight: 60, color: '#cccccc', label: '일반' },
    rare:      { weight: 25, color: '#7df9ff', label: '희귀' },
    epic:      { weight: 12, color: '#c77dff', label: '에픽' },
    legendary: { weight: 3,  color: '#ffd700', label: '전설' }
};

export const LAYERS = [
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🇰🇷 layer_001 - 동네 공사판 (튜토리얼 레이어)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        id: 'layer_001',
        name: '동네 공사판',
        nameEn: 'Neighborhood Construction Site',
        category: 'korea_real',
        region: '한국',
        order: 1,

        characterY: 0.78,              // 캐릭터 발이 닿는 화면 높이 비율 (배경 땅 라인)
        // 2026-05-07: 50 → 100 되돌림 (사용자 요청 — 첫 레이어가 너무 빨리 끝나 임팩트 부족)
        requiredDigs: 100,
        bgColor: 0x6b4423,        // Phaser hex (진한 흙갈색)
        bgColorHex: '#6b4423',
        groundColor: 0x4a2f1a,    // 땅 부분 진한색
        soilType: 'dirt',         // 사운드 키 (뚝뚝뚝)

        comicEvent: {
            trigger: 'dig_count',
            triggerAt: [50, 100],          // 100탭 기준 절반/완료 시점
            soundType: 'foreman',          // SoundManager.playComicEventSound 키
            npc: '관리소장',
            message: '얌마! 거기 뭐해!',
            emoji: '👷',
            action: 'shake_camera',
            duration: 1500
        },

        treasures: [
            { id: 't_001_01', emoji: '🔨', name: '녹슨 망치',         rarity: 'common',    reward: { coin: 30 },                desc: '"누가 흘렸나?" 공사판의 흔적' },
            { id: 't_001_02', emoji: '🧴', name: '페트병 뚜껑',       rarity: 'common',    reward: { coin: 20 },                desc: '쓰레기인지 보물인지...' },
            { id: 't_001_03', emoji: '🪙', name: '500원 동전',        rarity: 'common',    reward: { coin: 50 },                desc: '오 진짜 돈이다!' },
            { id: 't_001_04', emoji: '👞', name: '작업화 한 짝',      rarity: 'rare',      reward: { coin: 100, relic: 1 },     desc: '한 짝은 어디 갔어?' },
            { id: 't_001_05', emoji: '🍶', name: '막걸리 빈병',       rarity: 'rare',      reward: { coin: 150 },               desc: '아저씨들 야식의 흔적' },
            { id: 't_001_06', emoji: '⛑️', name: '감리사의 안전모',   rarity: 'epic',      reward: { coin: 300, relic: 3 },     desc: '"내 안전모! 어디갔지?"' },
            { id: 't_001_07', emoji: '🔩', name: '황금 못',           rarity: 'legendary', reward: { coin: 1000, diamond: 1 },  desc: '왜 못이 황금이지...?' },
            { id: 't_001_08', emoji: '🪙', name: '금덩어리',         rarity: 'epic',      reward: { coin: 1200, relic: 5 },    desc: '금봤다' },
            { id: 't_001_09', emoji: '☕', name: '캔커피 빈캔',       rarity: 'common',    reward: { coin: 25 },                desc: '노가다의 연료' },
            { id: 't_001_10', emoji: '🧤', name: '한 짝 작업 장갑',   rarity: 'common',    reward: { coin: 30 },                desc: '다른 한 짝은 어디로' },
            { id: 't_001_11', emoji: '🥖', name: '돌처럼 굳은 빵',    rarity: 'common',    reward: { coin: 25 },                desc: '이가 안 들어가' },
            { id: 't_001_12', emoji: '📏', name: '대충 쓴 줄자',      rarity: 'common',    reward: { coin: 35 },                desc: '느낌으로 했지' },
            { id: 't_001_13', emoji: '📋', name: '형식상 안전점검표', rarity: 'rare',      reward: { coin: 140, relic: 1 },     desc: '이거 사장님이 시킨 거' },
            { id: 't_001_14', emoji: '💊', name: '노가다 진통제',     rarity: 'rare',      reward: { coin: 120, relic: 1 },     desc: '허리야 무릎아' },
            { id: 't_001_15', emoji: '📰', name: '보다 만 스포츠 신문', rarity: 'rare',    reward: { coin: 100, relic: 1 },     desc: '어제 경기 결과' },
            { id: 't_001_16', emoji: '🥇', name: '1985 산업역군 메달', rarity: 'epic',     reward: { coin: 350, relic: 4 },     desc: '그 시절 노가다는 영웅' },
            { id: 't_001_17', emoji: '📝', name: '사장의 이중장부',   rarity: 'epic',      reward: { coin: 400, relic: 5 },     desc: '임금이 두 종류네...?' },
            { id: 't_001_18', emoji: '💵', name: '환갑잔치 봉투',     rarity: 'legendary', reward: { coin: 1200, diamond: 2 },  desc: '누가 만원짜리로 줬구나' }
        ],

        clearReward: { coin: 200, relic: 5, diamond: 0 },

        unlockMessage: '첫 삽질 시작! 화면을 탭해서 땅을 파보자.',
        clearMessage: '동네 공사판 정복! 다음은 학교 운동장이다.'
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🇰🇷 layer_002 - 학교 운동장
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        id: 'layer_002',
        name: '학교 운동장',
        nameEn: 'School Playground',
        category: 'korea_real',
        region: '한국',
        order: 2,

        characterY: 0.72,              // 운동장 배경 - 땅 라인 살짝 높음
        requiredDigs: 200,
        bgColor: 0xc19a6b,        // 운동장 모래 베이지
        bgColorHex: '#c19a6b',
        groundColor: 0x8b6f47,
        soilType: 'sand',         // 모래층 - 사르르르

        comicEvent: {
            trigger: 'dig_count',
            triggerAt: [70, 140, 200],
            soundType: 'pe_teacher',
            npc: '체육선생님',
            message: '삑- 삑삑! 거기서 뭐 하쇼!',
            emoji: '🏃‍♂️',
            action: 'whistle_sound',
            duration: 1500
        },

        treasures: [
            { id: 't_002_01', emoji: '🍱', name: '잃어버린 도시락 통', rarity: 'common',    reward: { coin: 40 },               desc: '엄마가 싸주신 그 도시락... 아직도 김치냄새가...' },
            { id: 't_002_02', emoji: '👕', name: '체육복 한 짝',       rarity: 'common',    reward: { coin: 30 },               desc: '체육시간 종 치고 사라진 그것' },
            { id: 't_002_03', emoji: '📝', name: '0점 시험지',         rarity: 'common',    reward: { coin: 60 },               desc: '왜 굳이 묻었어...?' },
            { id: 't_002_04', emoji: '🎀', name: '운동회 청군 머리띠', rarity: 'rare',      reward: { coin: 120, relic: 1 },    desc: '"청군 이겨라!"의 추억' },
            { id: 't_002_05', emoji: '⚽', name: '사라진 축구공',      rarity: 'rare',      reward: { coin: 180, relic: 2 },    desc: '그날 슛이 너무 강했나...' },
            { id: 't_002_06', emoji: '🏅', name: '교장선생님 훈장',    rarity: 'epic',      reward: { coin: 400, relic: 4 },    desc: '도대체 왜 묻혀있는 거지?' },
            { id: 't_002_07', emoji: '⏳', name: '타임캡슐 1995',      rarity: 'legendary', reward: { coin: 1500, diamond: 2 }, desc: '졸업생들의 약속이 잠든 곳' },
            { id: 't_002_08', emoji: '👟', name: '굴찌 운동화',         rarity: 'rare',      reward: { coin: 350, relic: 3 },    desc: '학생이 잃은 듯' },
            { id: 't_002_09', emoji: '✏️', name: '모서리 씹은 연필',    rarity: 'common',    reward: { coin: 30 },               desc: '스트레스 받았구나' },
            { id: 't_002_10', emoji: '🍪', name: '안 먹은 급식 빵',     rarity: 'common',    reward: { coin: 35 },               desc: '그날 도시락 까먹음' },
            { id: 't_002_11', emoji: '📐', name: '안 빠지는 컴파스',    rarity: 'common',    reward: { coin: 40 },               desc: '왜 끼웠지' },
            { id: 't_002_12', emoji: '🏐', name: '바람 빠진 피구공',    rarity: 'common',    reward: { coin: 50 },               desc: '그날 결승전 그것' },
            { id: 't_002_13', emoji: '💌', name: '못 전한 러브레터',    rarity: 'rare',      reward: { coin: 160, relic: 2 },    desc: '10년 전 마음' },
            { id: 't_002_14', emoji: '📓', name: '찢은 시 노트',        rarity: 'rare',      reward: { coin: 130, relic: 1 },    desc: '내가 쓴 흑역사 시' },
            { id: 't_002_15', emoji: '🎴', name: '90년대 야구카드',     rarity: 'rare',      reward: { coin: 180, relic: 2 },    desc: '지금 가치는...?' },
            { id: 't_002_16', emoji: '💍', name: '짝꿍의 종이반지',     rarity: 'epic',      reward: { coin: 380, relic: 4 },    desc: '이게 첫사랑이었나' },
            { id: 't_002_17', emoji: '📋', name: '학생회장 투표지',     rarity: 'epic',      reward: { coin: 420, relic: 5 },    desc: '내 한 표 무용했네' },
            { id: 't_002_18', emoji: '🏆', name: '분실된 1등 트로피',   rarity: 'legendary', reward: { coin: 1700, diamond: 2 }, desc: '친구가 묻었나봐' }
        ],

        clearReward: { coin: 500, relic: 8, diamond: 0 },

        unlockMessage: '아 학교다! 여긴 뭐가 묻혀있을까?',
        clearMessage: '운동장 정복! 다음은 아파트 화단으로!'
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🇰🇷 layer_003 - 아파트 화단
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        id: 'layer_003',
        name: '아파트 화단',
        nameEn: 'Apartment Flower Bed',
        category: 'korea_real',
        region: '한국',
        order: 3,

        characterY: 0.75,              // 화단 - 표준 위치
        requiredDigs: 350,
        bgColor: 0x4a5d23,        // 흙+풀 진한 녹갈색
        bgColorHex: '#4a5d23',
        groundColor: 0x2f3b16,
        soilType: 'dirt',

        comicEvent: {
            trigger: 'dig_count',
            triggerAt: [100, 200, 350],
            soundType: 'security',
            npc: '경비 아저씨',
            message: '이봐! 거기서 뭐 하는 거야!! 관리실로!',
            emoji: '👮',
            action: 'flashlight',
            duration: 2000
        },

        treasures: [
            { id: 't_003_01', emoji: '📦', name: '잃어버린 택배',        rarity: 'common',    reward: { coin: 50 },               desc: '"고객님께서 부재중이라..." 그게 여기 있었네' },
            { id: 't_003_02', emoji: '🐶', name: '강아지 인식표',        rarity: 'common',    reward: { coin: 40 },               desc: '"몽실이"... 잘 있니?' },
            { id: 't_003_03', emoji: '🚗', name: '아이 장난감 자동차',   rarity: 'common',    reward: { coin: 60 },               desc: '꼬마 손에서 떨어진 보물' },
            { id: 't_003_04', emoji: '🧦', name: '베란다에서 떨어진 양말', rarity: 'rare',    reward: { coin: 130, relic: 1 },    desc: '바람의 장난' },
            { id: 't_003_05', emoji: '🪪', name: '경비실 명패',          rarity: 'rare',      reward: { coin: 200, relic: 2 },    desc: '"경비 책임자 김씨"... 누가 묻은 거야?' },
            { id: 't_003_06', emoji: '🧾', name: '관리비 영수증 뭉치',   rarity: 'epic',      reward: { coin: 500, relic: 5 },    desc: '"미납 3개월"... 하지만 보물!' },
            { id: 't_003_07', emoji: '📜', name: '입주민 회장 도장',     rarity: 'legendary', reward: { coin: 2000, diamond: 3 }, desc: '권력의 상징이 묻혀있다니!' },
            { id: 't_003_08', emoji: '🎟️', name: '복권',                rarity: 'rare',      reward: { coin: 800, relic: 3 },    desc: '1등이면 삽질그만' },
            { id: 't_003_09', emoji: '💩', name: '마른 강아지 변',        rarity: 'common',    reward: { coin: 30 },               desc: '그날 산책 누가...?' },
            { id: 't_003_10', emoji: '🥥', name: '말라죽은 화분',         rarity: 'common',    reward: { coin: 40 },               desc: '물 좀 줘요...' },
            { id: 't_003_11', emoji: '🪥', name: '홧김에 던진 칫솔',      rarity: 'common',    reward: { coin: 35 },               desc: '부부싸움의 흔적' },
            { id: 't_003_12', emoji: '🧾', name: '편의점 영수증',         rarity: 'common',    reward: { coin: 25 },               desc: '삼각김밥 + 박카스' },
            { id: 't_003_13', emoji: '🔋', name: '폐건전지',              rarity: 'common',    reward: { coin: 45 },               desc: '여기다 묻으면 안돼요!' },
            { id: 't_003_14', emoji: '📋', name: '엘베 1점 만점 설문',    rarity: 'rare',      reward: { coin: 160, relic: 2 },    desc: '이 아파트 평점 ㅋㅋ' },
            { id: 't_003_15', emoji: '🎈', name: '아이가 놓친 풍선',      rarity: 'rare',      reward: { coin: 140, relic: 2 },    desc: '엄마 미안해...' },
            { id: 't_003_16', emoji: '💌', name: '옆집 부부싸움 메모',    rarity: 'rare',      reward: { coin: 200, relic: 2 },    desc: '각방 쓰자' },
            { id: 't_003_17', emoji: '🪪', name: '본인 안 닮은 신분증',   rarity: 'epic',      reward: { coin: 550, relic: 6 },    desc: '이거 진짜 본인?' },
            { id: 't_003_18', emoji: '📸', name: '1980년대 가족사진',     rarity: 'epic',      reward: { coin: 600, relic: 7 },    desc: '1세대 입주민의 흔적' },
            { id: 't_003_19', emoji: '💍', name: '이혼하며 던진 결혼반지', rarity: 'legendary', reward: { coin: 2200, diamond: 4 }, desc: '원망의 무게' }
        ],

        clearReward: { coin: 1000, relic: 12, diamond: 1 },

        unlockMessage: '경비 아저씨 눈을 피해서... 살살 파자.',
        clearMessage: '경비 아저씨도 결국 포기! 다음은 찜질방!'
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🇰🇷 layer_004 - 찜질방 바닥
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        id: 'layer_004',
        name: '찜질방 바닥',
        nameEn: 'Korean Sauna Floor',
        category: 'korea_real',
        region: '한국',
        order: 4,

        characterY: 0.80,              // 찜질방 바닥 라인이 가장 낮음 (실내 평면 시점)
        requiredDigs: 550,
        bgColor: 0xb8860b,        // 황토 타일 색
        bgColorHex: '#b8860b',
        groundColor: 0x6b4f08,
        soilType: 'tile',         // 타일층 - 삐걱삐걱

        comicEvent: {
            trigger: 'dig_count',
            triggerAt: [150, 300, 450, 550],
            soundType: 'sauna_owner',
            npc: '찜질방 사장님',
            message: '아니 미친!! 바닥을!! 물어내!!',
            emoji: '🧖',
            action: 'steam_burst',
            duration: 2000
        },

        treasures: [
            { id: 't_004_01', emoji: '🧦', name: '누가 흘린 양말',          rarity: 'common',    reward: { coin: 60 },               desc: '땀냄새가... 진하다' },
            { id: 't_004_02', emoji: '🥤', name: '식혜 빈병',               rarity: 'common',    reward: { coin: 50 },               desc: '단군 이래 최고의 음료' },
            { id: 't_004_03', emoji: '🥚', name: '바싹 마른 삶은 계란',     rarity: 'common',    reward: { coin: 80 },               desc: '몇 년이나 묻혀있던 거야...?' },
            { id: 't_004_04', emoji: '👓', name: '잃어버린 안경',           rarity: 'rare',      reward: { coin: 180, relic: 2 },    desc: '"내 안경 어디갔지?" 여기 있었네!' },
            { id: 't_004_05', emoji: '💵', name: '구겨진 만원 지폐',        rarity: 'rare',      reward: { coin: 300, relic: 3 },    desc: '주머니에서 흘렸나봐' },
            { id: 't_004_06', emoji: '🎫', name: '찜질방 단골 회원증',      rarity: 'epic',      reward: { coin: 700, relic: 6 },    desc: '"VIP" 도장이 찍힌 그것' },
            { id: 't_004_07', emoji: '🗝️', name: '사장님의 비밀 금고열쇠',  rarity: 'legendary', reward: { coin: 3000, diamond: 5 }, desc: '왜 바닥에 묻혀있었지...?' },
            { id: 't_004_08', emoji: '👜', name: '루이뷔돌 가방',          rarity: 'epic',      reward: { coin: 2000, relic: 8 },   desc: '왠 루이비돌' },
            { id: 't_004_09', emoji: '💍', name: '삽이아몬드 반지',        rarity: 'legendary', reward: { coin: 5500, diamond: 9 }, desc: '프러포즈 실패한 그분' },
            { id: 't_004_10', emoji: '👜', name: '에르삽 가방',            rarity: 'epic',      reward: { coin: 2200, relic: 9 },   desc: '사장님 부인 거 맞나요?' },
            { id: 't_004_11', emoji: '🥒', name: '마른 오이 마사지팩',     rarity: 'common',    reward: { coin: 50 },               desc: '얼굴에 올렸던 그것' },
            { id: 't_004_12', emoji: '🪮', name: '이 빠진 머리빗',         rarity: 'common',    reward: { coin: 55 },               desc: '너무 많이 썼어' },
            { id: 't_004_13', emoji: '🥤', name: '씹힌 식혜 빨대',         rarity: 'common',    reward: { coin: 45 },               desc: '아이의 흔적' },
            { id: 't_004_14', emoji: '🐑', name: '양머리 수건',            rarity: 'common',    reward: { coin: 60 },               desc: '찜질방 시그니처' },
            { id: 't_004_15', emoji: '🎫', name: '1000회 적립 멤버십',     rarity: 'rare',      reward: { coin: 200, relic: 2 },    desc: '이거 거의 살림' },
            { id: 't_004_16', emoji: '👞', name: '아저씨 슬리퍼 한 짝',    rarity: 'rare',      reward: { coin: 170, relic: 2 },    desc: '그 아저씨...' },
            { id: 't_004_17', emoji: '📱', name: '2010년대 폴더폰',        rarity: 'rare',      reward: { coin: 220, relic: 3 },    desc: '여기 두고 갔구나' },
            { id: 't_004_18', emoji: '📔', name: '사장님의 적자 일기',     rarity: 'epic',      reward: { coin: 680, relic: 7 },    desc: '오늘도 마이너스다...' },
            { id: 't_004_19', emoji: '💍', name: '사우나 인연 결혼반지',   rarity: 'epic',      reward: { coin: 750, relic: 8 },    desc: '그 결혼은 어찌됐을까' },
            { id: 't_004_20', emoji: '💰', name: '사장님 비상금 박스',     rarity: 'legendary', reward: { coin: 3200, diamond: 5 }, desc: '사모님 모르게...' }
        ],

        clearReward: { coin: 2000, relic: 18, diamond: 2 },

        unlockMessage: '뜨거운 찜질방 바닥! 양머리 쓰고 시작!',
        clearMessage: '사장님 절규 BGM과 함께 클리어! 다음은 군부대!'
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🇰🇷 layer_005 - 군부대 훈련장
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        id: 'layer_005',
        name: '군부대 훈련장',
        nameEn: 'Military Training Ground',
        category: 'korea_real',
        region: '한국',
        order: 5,

        characterY: 0.76,              // 훈련장 - 중간 높이
        requiredDigs: 800,
        bgColor: 0x4b5320,        // 군용 카키
        bgColorHex: '#4b5320',
        groundColor: 0x2d3214,
        soilType: 'dirt',

        comicEvent: {
            trigger: 'dig_count',
            triggerAt: [200, 400, 600, 800],
            soundType: 'military',
            npc: '교관',
            message: '이 녀석이!! 또 삽질이야?! 대가리 박어!!',
            emoji: '🎖️',
            action: 'shake_camera_strong',
            duration: 2500
        },

        treasures: [
            { id: 't_005_01', emoji: '💧', name: '군용 수통',              rarity: 'common',    reward: { coin: 80 },                desc: '물이 한 방울 남아있다... 마시지마' },
            { id: 't_005_02', emoji: '🪪', name: '잃어버린 군번줄',        rarity: 'common',    reward: { coin: 70 },                desc: '"이병 김XX 19-XXXXX"' },
            { id: 't_005_03', emoji: '🪓', name: '야전삽 부러진 조각',     rarity: 'common',    reward: { coin: 100 },               desc: '동지여... 너도 삽질했구나' },
            { id: 't_005_04', emoji: '🥾', name: '전투화 한 짝',           rarity: 'rare',      reward: { coin: 250, relic: 3 },     desc: '훈련병의 한이 서려있다' },
            { id: 't_005_05', emoji: '📓', name: '훈련병 일기장',          rarity: 'rare',      reward: { coin: 400, relic: 4 },     desc: '"D-547... 너무 힘들다..."' },
            { id: 't_005_06', emoji: '🎖️', name: '황금 계급장',            rarity: 'epic',      reward: { coin: 900, relic: 8 },     desc: '대장님의 것...?' },
            { id: 't_005_07', emoji: '📜', name: '비밀 작전 명령서',       rarity: 'legendary', reward: { coin: 4000, diamond: 7 },  desc: '"극비 - 절대 누설 금지" ...읽지마' },
            { id: 't_005_08', emoji: '🪙', name: '금괴',                  rarity: 'legendary', reward: { coin: 5000, diamond: 8 },  desc: '신이시여' },
            { id: 't_005_09', emoji: '⌚', name: '롤삽스 시계',            rarity: 'epic',      reward: { coin: 1800, relic: 7 },    desc: '초침이 멈췄네' },
            { id: 't_005_10', emoji: '🥃', name: '삽렌타인 30',            rarity: 'epic',      reward: { coin: 1500, relic: 6 },    desc: '30년산이 흙 속에' },
            { id: 't_005_11', emoji: '🥫', name: '1995 비상식량',          rarity: 'common',    reward: { coin: 70 },                desc: '먹고 죽진 않겠지...?' },
            { id: 't_005_12', emoji: '🪖', name: '꺾인 모자 챙',           rarity: 'common',    reward: { coin: 65 },                desc: '그날의 PT 체조' },
            { id: 't_005_13', emoji: '🎲', name: '행정병의 주사위',         rarity: 'common',    reward: { coin: 80 },                desc: '심심해서 굴렸지' },
            { id: 't_005_14', emoji: '🥜', name: '마른 건빵',              rarity: 'common',    reward: { coin: 60 },                desc: '별사탕은 어디갔어' },
            { id: 't_005_15', emoji: '📞', name: '부모 통화 메모지',        rarity: 'rare',      reward: { coin: 240, relic: 3 },     desc: '월요일 7시 엄마' },
            { id: 't_005_16', emoji: '📓', name: '고참의 이등병 일기',      rarity: 'rare',      reward: { coin: 300, relic: 3 },     desc: '그땐 그랬지...' },
            { id: 't_005_17', emoji: '📋', name: '휴가 D-100 카운트표',    rarity: 'rare',      reward: { coin: 280, relic: 3 },     desc: '전역까지의 영혼' },
            { id: 't_005_18', emoji: '🎤', name: 'PX 노래방 만점 메모',    rarity: 'epic',      reward: { coin: 850, relic: 8 },     desc: '전설의 100점 그곳' },
            { id: 't_005_19', emoji: '🍜', name: '끓이다 만 라면 그릇',    rarity: 'epic',      reward: { coin: 780, relic: 7 },     desc: '1분 30초의 천국' },
            { id: 't_005_20', emoji: '💼', name: '분실 군 기밀 USB',      rarity: 'legendary', reward: { coin: 4200, diamond: 7 },  desc: '이거... 신고해야 하나' }
        ],

        clearReward: { coin: 4000, relic: 25, diamond: 3 },

        unlockMessage: '"전군 삽질 시작! 명령 거부 시 영창!"',
        clearMessage: '훈련 종료! 마지막은 콘서트장이다!'
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🇰🇷 layer_006 - 아이돌 콘서트장 앞 (한국 마지막!)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        id: 'layer_006',
        name: '아이돌 콘서트장 앞',
        nameEn: 'K-pop Concert Hall',
        category: 'korea_real',
        region: '한국',
        order: 6,

        characterY: 0.74,              // 콘서트장 - 살짝 위 (먼 시점)
        requiredDigs: 1100,
        bgColor: 0x6b5b73,        // 콘크리트 + 보랏빛 네온
        bgColorHex: '#6b5b73',
        groundColor: 0x3d3340,
        soilType: 'concrete',     // 콘크리트층

        comicEvent: {
            trigger: 'dig_count',
            triggerAt: [200, 500, 800, 1100],
            soundType: 'fans',
            npc: '팬덤 지박령들',
            message: '오빠 사진. 안돼!! 그만!!',
            emoji: '💜',
            action: 'lightstick_flash',
            duration: 3000
        },

        treasures: [
            { id: 't_006_01', emoji: '🔋', name: '응원봉 배터리',          rarity: 'common',    reward: { coin: 100 },               desc: '"방전돼서 버렸나봐"' },
            { id: 't_006_02', emoji: '🎴', name: '떨어진 포토카드',        rarity: 'common',    reward: { coin: 90 },                desc: '"누구 포카지... 잘생겼다"' },
            { id: 't_006_03', emoji: '🔑', name: '굿즈 키링',              rarity: 'common',    reward: { coin: 120 },               desc: '"한정판이었는데!!"' },
            { id: 't_006_04', emoji: '💌', name: '쓰다 만 팬레터',         rarity: 'rare',      reward: { coin: 280, relic: 3 },     desc: '"오빠 사랑해... (이하생략)"' },
            { id: 't_006_05', emoji: '💿', name: '사인이 절반 들어간 앨범', rarity: 'rare',      reward: { coin: 450, relic: 5 },     desc: '"왜 절반만 사인했지...?"' },
            { id: 't_006_06', emoji: '👕', name: '멤버 입었던 티셔츠',     rarity: 'epic',      reward: { coin: 1100, relic: 10 },   desc: '"진짜야??? 이거 진짜야???"' },
            { id: 't_006_07', emoji: '🎫', name: '레전드 데뷔쇼 티켓',     rarity: 'legendary', reward: { coin: 5000, diamond: 10 }, desc: '"이거 경매가 천만원이야..."' },
            { id: 't_006_08', emoji: '💵', name: '달러뭉치',               rarity: 'epic',      reward: { coin: 1500, relic: 7 },    desc: '혹시 마약왕의 달러' },
            { id: 't_006_09', emoji: '👛', name: '샵넬 가방',              rarity: 'epic',      reward: { coin: 2000, relic: 8 },    desc: '짝퉁이 아니길' },
            { id: 't_006_10', emoji: '💧', name: '짠물 (땀+눈물)',          rarity: 'common',    reward: { coin: 90 },                desc: '감동인지 더위인지' },
            { id: 't_006_11', emoji: '📱', name: '영상 찍다 떨어뜨린 폰',   rarity: 'common',    reward: { coin: 110 },               desc: '오빠가 안 보였어' },
            { id: 't_006_12', emoji: '🍫', name: '녹은 전달용 초콜릿',      rarity: 'common',    reward: { coin: 100 },               desc: '전해주려 했는데...' },
            { id: 't_006_13', emoji: '🪅', name: '다 먹은 응원 도시락',     rarity: 'common',    reward: { coin: 95 },                desc: '오빠 응원에 에너지 필요' },
            { id: 't_006_14', emoji: '📔', name: '응원 가이드북',           rarity: 'rare',      reward: { coin: 300, relic: 3 },     desc: '이 곡엔 이 안무!' },
            { id: 't_006_15', emoji: '🎁', name: '못 던진 무대 선물',       rarity: 'rare',      reward: { coin: 330, relic: 3 },     desc: '경비에 막혔어' },
            { id: 't_006_16', emoji: '🪡', name: '손수 수놓은 응원 손수건', rarity: 'rare',      reward: { coin: 380, relic: 4 },     desc: '한 달 걸린 작품' },
            { id: 't_006_17', emoji: '📜', name: '못 전한 100p 편지',       rarity: 'epic',      reward: { coin: 1200, relic: 11 },   desc: '내 마음 다 적었는데...' },
            { id: 't_006_18', emoji: '🎴', name: '한정판 미개봉 굿즈',      rarity: 'epic',      reward: { coin: 1100, relic: 10 },   desc: '알바해서 산 그것' },
            { id: 't_006_19', emoji: '🪻', name: '멤버 던진 손수건',        rarity: 'legendary', reward: { coin: 5500, diamond: 11 }, desc: '이거 진짜 받은 사람 누구야' }
        ],

        clearReward: { coin: 8000, relic: 35, diamond: 5 },

        unlockMessage: '여긴 팬들의 성지... 조심해서 파자.',
        clearMessage: '🎉 한국 정복 완료! 이제 세계로 나가자!'
    }
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 헬퍼 함수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ID로 레이어 찾기
export function getLayerById(id) {
    return LAYERS.find(l => l.id === id);
}

// order 번호로 찾기 (1부터 시작)
export function getLayerByOrder(order) {
    return LAYERS.find(l => l.order === order);
}

// 카테고리별 필터 (korea_real, world_country, world_famous, fantasy, myth)
export function getLayersByCategory(category) {
    return LAYERS.filter(l => l.category === category);
}

// 다음 레이어 가져오기
export function getNextLayer(currentOrder) {
    return LAYERS.find(l => l.order === currentOrder + 1);
}

// 보물 등급별 가중치 기반 랜덤 선택 (보물이 출현했을 때 어떤 등급인지)
export function rollTreasureRarity() {
    const rarities = Object.entries(TREASURE_RARITY);
    const totalWeight = rarities.reduce((sum, [, v]) => sum + v.weight, 0);
    let r = Math.random() * totalWeight;
    for (const [key, val] of rarities) {
        r -= val.weight;
        if (r <= 0) return key;
    }
    return 'common';
}

// 레이어에서 특정 등급의 보물 중 하나 랜덤 선택
export function rollTreasureFromLayer(layer, rarity) {
    const candidates = layer.treasures.filter(t => t.rarity === rarity);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}
