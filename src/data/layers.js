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
        requiredDigs: 100,
        bgColor: 0x6b4423,        // Phaser hex (진한 흙갈색)
        bgColorHex: '#6b4423',
        groundColor: 0x4a2f1a,    // 땅 부분 진한색
        soilType: 'dirt',         // 사운드 키 (뚝뚝뚝)

        comicEvent: {
            trigger: 'dig_count',
            triggerAt: [50, 100],          // 절반/완료 시점에 등장
            soundType: 'foreman',          // SoundManager.playComicEventSound 키
            npc: '감리사 아저씨',
            message: '야! 거기 뭐해!',
            emoji: '👷',
            action: 'shake_camera',
            duration: 1500
        },

        treasures: [
            { id: 't_001_01', name: '녹슨 망치',         rarity: 'common',    reward: { coin: 30 },                desc: '"누가 흘렸나?" 공사판의 흔적' },
            { id: 't_001_02', name: '페트병 뚜껑',       rarity: 'common',    reward: { coin: 20 },                desc: '쓰레기인지 보물인지...' },
            { id: 't_001_03', name: '500원 동전',        rarity: 'common',    reward: { coin: 50 },                desc: '오 진짜 돈이다!' },
            { id: 't_001_04', name: '작업화 한 짝',      rarity: 'rare',      reward: { coin: 100, relic: 1 },     desc: '한 짝은 어디 갔어?' },
            { id: 't_001_05', name: '막걸리 빈병',       rarity: 'rare',      reward: { coin: 150 },               desc: '아저씨들 야식의 흔적' },
            { id: 't_001_06', name: '감리사의 안전모',   rarity: 'epic',      reward: { coin: 300, relic: 3 },     desc: '"내 안전모! 어디갔지?"' },
            { id: 't_001_07', name: '황금 못',           rarity: 'legendary', reward: { coin: 1000, diamond: 1 },  desc: '왜 못이 황금이지...?' }
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
            message: '삑- 삑삑! 거기서 뭐 해!',
            emoji: '🏃‍♂️',
            action: 'whistle_sound',
            duration: 1500
        },

        treasures: [
            { id: 't_002_01', name: '잃어버린 도시락 통', rarity: 'common',    reward: { coin: 40 },               desc: '엄마가 싸주신 그 도시락... 아직도 김치냄새가...' },
            { id: 't_002_02', name: '체육복 한 짝',       rarity: 'common',    reward: { coin: 30 },               desc: '체육시간 종 치고 사라진 그것' },
            { id: 't_002_03', name: '0점 시험지',         rarity: 'common',    reward: { coin: 60 },               desc: '왜 굳이 묻었어...?' },
            { id: 't_002_04', name: '운동회 청군 머리띠', rarity: 'rare',      reward: { coin: 120, relic: 1 },    desc: '"청군 이겨라!"의 추억' },
            { id: 't_002_05', name: '사라진 축구공',      rarity: 'rare',      reward: { coin: 180, relic: 2 },    desc: '그날 슛이 너무 강했나...' },
            { id: 't_002_06', name: '교장선생님 훈장',    rarity: 'epic',      reward: { coin: 400, relic: 4 },    desc: '도대체 왜 묻혀있는 거지?' },
            { id: 't_002_07', name: '타임캡슐 1995',      rarity: 'legendary', reward: { coin: 1500, diamond: 2 }, desc: '졸업생들의 약속이 잠든 곳' }
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
            message: '학생! 거기서 뭐 하는 거야!! 관리실로!',
            emoji: '👮',
            action: 'flashlight',
            duration: 2000
        },

        treasures: [
            { id: 't_003_01', name: '잃어버린 택배',        rarity: 'common',    reward: { coin: 50 },               desc: '"고객님께서 부재중이라..." 그게 여기 있었네' },
            { id: 't_003_02', name: '강아지 인식표',        rarity: 'common',    reward: { coin: 40 },               desc: '"몽실이"... 잘 있니?' },
            { id: 't_003_03', name: '아이 장난감 자동차',   rarity: 'common',    reward: { coin: 60 },               desc: '꼬마 손에서 떨어진 보물' },
            { id: 't_003_04', name: '베란다에서 떨어진 양말', rarity: 'rare',    reward: { coin: 130, relic: 1 },    desc: '바람의 장난' },
            { id: 't_003_05', name: '경비실 명패',          rarity: 'rare',      reward: { coin: 200, relic: 2 },    desc: '"경비 책임자 김씨"... 누가 묻은 거야?' },
            { id: 't_003_06', name: '관리비 영수증 뭉치',   rarity: 'epic',      reward: { coin: 500, relic: 5 },    desc: '"미납 3개월"... 하지만 보물!' },
            { id: 't_003_07', name: '입주민 회장 도장',     rarity: 'legendary', reward: { coin: 2000, diamond: 3 }, desc: '권력의 상징이 묻혀있다니!' }
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
            message: '아니 손님!! 바닥을!! 어떻게 책임질 거야!!',
            emoji: '🧖',
            action: 'steam_burst',
            duration: 2000
        },

        treasures: [
            { id: 't_004_01', name: '누가 흘린 양말',          rarity: 'common',    reward: { coin: 60 },               desc: '땀냄새가... 진하다' },
            { id: 't_004_02', name: '식혜 빈병',               rarity: 'common',    reward: { coin: 50 },               desc: '단군 이래 최고의 음료' },
            { id: 't_004_03', name: '바싹 마른 삶은 계란',     rarity: 'common',    reward: { coin: 80 },               desc: '몇 년이나 묻혀있던 거야...?' },
            { id: 't_004_04', name: '잃어버린 안경',           rarity: 'rare',      reward: { coin: 180, relic: 2 },    desc: '"내 안경 어디갔지?" 여기 있었네!' },
            { id: 't_004_05', name: '구겨진 만원 지폐',        rarity: 'rare',      reward: { coin: 300, relic: 3 },    desc: '주머니에서 흘렸나봐' },
            { id: 't_004_06', name: '찜질방 단골 회원증',      rarity: 'epic',      reward: { coin: 700, relic: 6 },    desc: '"VIP" 도장이 찍힌 그것' },
            { id: 't_004_07', name: '사장님의 비밀 금고열쇠',  rarity: 'legendary', reward: { coin: 3000, diamond: 5 }, desc: '왜 바닥에 묻혀있었지...?' }
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
            npc: '훈련 교관',
            message: '이 녀석이!! 또 삽질이야?! 원위치!!',
            emoji: '🎖️',
            action: 'shake_camera_strong',
            duration: 2500
        },

        treasures: [
            { id: 't_005_01', name: '군용 수통',              rarity: 'common',    reward: { coin: 80 },                desc: '물이 한 방울 남아있다... 마시지마' },
            { id: 't_005_02', name: '잃어버린 군번줄',        rarity: 'common',    reward: { coin: 70 },                desc: '"이병 김XX 19-XXXXX"' },
            { id: 't_005_03', name: '야전삽 부러진 조각',     rarity: 'common',    reward: { coin: 100 },               desc: '동지여... 너도 삽질했구나' },
            { id: 't_005_04', name: '전투화 한 짝',           rarity: 'rare',      reward: { coin: 250, relic: 3 },     desc: '훈련병의 한이 서려있다' },
            { id: 't_005_05', name: '훈련병 일기장',          rarity: 'rare',      reward: { coin: 400, relic: 4 },     desc: '"D-547... 너무 힘들다..."' },
            { id: 't_005_06', name: '황금 계급장',            rarity: 'epic',      reward: { coin: 900, relic: 8 },     desc: '대장님의 것...?' },
            { id: 't_005_07', name: '비밀 작전 명령서',       rarity: 'legendary', reward: { coin: 4000, diamond: 7 },  desc: '"극비 - 절대 누설 금지" ...읽지마' }
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
            message: '"오빠 사진 묻혔으면 어떡해!!" "당장 그만!!"',
            emoji: '💜',
            action: 'lightstick_flash',
            duration: 3000
        },

        treasures: [
            { id: 't_006_01', name: '응원봉 배터리',          rarity: 'common',    reward: { coin: 100 },               desc: '"방전돼서 버렸나봐"' },
            { id: 't_006_02', name: '떨어진 포토카드',        rarity: 'common',    reward: { coin: 90 },                desc: '"누구 포카지... 잘생겼다"' },
            { id: 't_006_03', name: '굿즈 키링',              rarity: 'common',    reward: { coin: 120 },               desc: '"한정판이었는데!!"' },
            { id: 't_006_04', name: '쓰다 만 팬레터',         rarity: 'rare',      reward: { coin: 280, relic: 3 },     desc: '"오빠 사랑해... (이하생략)"' },
            { id: 't_006_05', name: '사인이 절반 들어간 앨범', rarity: 'rare',      reward: { coin: 450, relic: 5 },     desc: '"왜 절반만 사인했지...?"' },
            { id: 't_006_06', name: '멤버 입었던 티셔츠',     rarity: 'epic',      reward: { coin: 1100, relic: 10 },   desc: '"진짜야??? 이거 진짜야???"' },
            { id: 't_006_07', name: '레전드 데뷔쇼 티켓',     rarity: 'legendary', reward: { coin: 5000, diamond: 10 }, desc: '"이거 경매가 천만원이야..."' }
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
