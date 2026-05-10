// 캐릭터 데이터 (총 30종) - CLAUDE.md 기준
// 기본 무료 6종 + 유료 24종

export const CHARACTERS = [
    // ━━━━━━━ 기본 캐릭터 (무료 6종) ━━━━━━━
    // 무료 6종 — 모두 free (사장님 정책: 무료 6종은 진입 즉시 모두 사용 가능, 보너스만 차별)
    { id: 'char_001', name: '박삽돌',         rarity: 1, price: { type: 'free' }, bonus: {},                      desc: '기본 (튜토리얼)' },
    { id: 'char_002', name: '굴착용',         rarity: 1, price: { type: 'free' }, bonus: { dig_speed: 0.05 },     desc: '알바생 - 삽질속도 +5%' },
    { id: 'char_003', name: '김파순',         rarity: 1, price: { type: 'free' }, bonus: { stamina: 0.10 },       desc: '베테랑 아줌마 - 체력소모 -10%' },
    { id: 'char_004', name: '이땅녀',         rarity: 2, price: { type: 'free' }, bonus: { treasure_rate: 0.05 }, desc: '씩씩한 여대생 - 보물확률 +5%' },
    { id: 'char_005', name: '굴팔이',         rarity: 2, price: { type: 'free' }, bonus: { dig_speed: 0.08 },     desc: '평생 땅만 판 노가다 영감 - 속도 +8%' },
    { id: 'char_006', name: '금속탐지 김씨',   rarity: 2, price: { type: 'free' }, bonus: { detect: 0.10 },        desc: '동네 보물사냥꾼 아저씨 - 탐지 +10%' },

    // ━━━━━━━ 직업 시리즈 (5종) ━━━━━━━
    { id: 'char_007', name: '정굴착',     rarity: 2, price: { type: 'krw', amount: 1900 }, bonus: { dig_speed: 0.10 },                       desc: '굴착기 기사' },
    { id: 'char_008', name: '최삽질',     rarity: 2, price: { type: 'krw', amount: 1900 }, bonus: { coin_gain: 0.10 },                       desc: '건설현장 베테랑' },
    { id: 'char_009', name: '하드워커',   rarity: 3, price: { type: 'krw', amount: 3900 }, bonus: { dig_speed: 0.15 },                       desc: '하드워커 - 속도 +15%' },
    { id: 'char_010', name: '나파워',     rarity: 3, price: { type: 'krw', amount: 3900 }, bonus: { combo_bonus: 0.20 },                     desc: '파워 노가다 - 콤보 +20%' },
    { id: 'char_011', name: '파라박사',   rarity: 3, price: { type: 'krw', amount: 4900 }, bonus: { treasure_rate: 0.10 },                   desc: '고고학 박사 - 보물확률 +10%' },

    // ━━━━━━━ 판타지 시리즈 (5종) ━━━━━━━
    { id: 'char_012', name: '굴착대왕',     rarity: 3, price: { type: 'krw', amount: 4900 }, bonus: { dig_speed: 0.20 },         desc: '굴착의 왕' },
    { id: 'char_013', name: '파라다이스',   rarity: 3, price: { type: 'krw', amount: 3900 }, bonus: { coin_gain: 0.15 },         desc: '낙원의 발굴자' },
    { id: 'char_014', name: '마법삽사리',   rarity: 3, price: { type: 'krw', amount: 4900 }, bonus: { combo_bonus: 0.25 },       desc: '마법의 삽 사용자' },
    { id: 'char_015', name: '갑옷순이',     rarity: 3, price: { type: 'krw', amount: 3900 }, bonus: { stamina: 0.20 },           desc: '갑옷 입은 여전사' },
    { id: 'char_016', name: '드래곤파',     rarity: 4, price: { type: 'krw', amount: 5900 }, bonus: { dig_speed: 0.25, coin_gain: 0.10 }, desc: '드래곤 굴착자 (이벤트 한정)' },

    // ━━━━━━━ SF 시리즈 (4종) ━━━━━━━
    { id: 'char_017', name: '우주굴착맨',   rarity: 3, price: { type: 'krw', amount: 4900 }, bonus: { dig_speed: 0.20 },         desc: '우주 굴착 전문가' },
    { id: 'char_018', name: 'D-1호',        rarity: 3, price: { type: 'krw', amount: 3900 }, bonus: { combo_bonus: 0.20 },       desc: '굴착 로봇 1호기' },
    { id: 'char_019', name: '사이보굴',     rarity: 4, price: { type: 'krw', amount: 5900 }, bonus: { dig_speed: 0.30 },         desc: '사이보그 굴착자' },
    { id: 'char_020', name: '외계삽순이',   rarity: 4, price: { type: 'krw', amount: 5900 }, bonus: { treasure_rate: 0.15 },     desc: '외계인 발굴가' },

    // ━━━━━━━ 동물 시리즈 (4종) ━━━━━━━
    { id: 'char_021', name: '두더킹',       rarity: 3, price: { type: 'krw', amount: 4900 }, bonus: { dig_speed: 0.20 },         desc: '두더지의 왕' },
    { id: 'char_022', name: '판다굴',       rarity: 2, price: { type: 'krw', amount: 2900 }, bonus: { stamina: 0.15 },           desc: '굴착하는 판다' },
    { id: 'char_023', name: '냥삽이',       rarity: 2, price: { type: 'krw', amount: 2900 }, bonus: { combo_bonus: 0.15 },       desc: '고양이 굴착가' },
    { id: 'char_024', name: '곰파저',       rarity: 3, price: { type: 'krw', amount: 3900 }, bonus: { coin_gain: 0.20 },         desc: '거대한 곰 발굴자' },

    // ━━━━━━━ 이벤트 시리즈 (4종) ━━━━━━━
    { id: 'char_025', name: '산타삽',       rarity: 4, price: { type: 'krw', amount: 5900 }, bonus: { coin_gain: 0.30 },         desc: '산타 (크리스마스 한정)' },
    { id: 'char_026', name: '좀비굴',       rarity: 3, price: { type: 'krw', amount: 4900 }, bonus: { stamina: 0.25 },           desc: '좀비 굴착자 (할로윈 한정)' },
    { id: 'char_027', name: '설빔이',       rarity: 3, price: { type: 'krw', amount: 3900 }, bonus: { treasure_rate: 0.10 },     desc: '한복 입은 설날 캐릭터' },
    { id: 'char_028', name: '해적삽',       rarity: 3, price: { type: 'krw', amount: 4900 }, bonus: { treasure_rate: 0.15 },     desc: '해적 발굴자' },

    // ━━━━━━━ 프리미엄 (2종) ━━━━━━━
    { id: 'char_029', name: '삽질황제',     rarity: 5, price: { type: 'krw', amount: 9900 },  bonus: { dig_speed: 0.40, coin_gain: 0.30 },                          desc: '삽질의 황제 (신화)' },
    { id: 'char_030', name: '대지신',       rarity: 5, price: { type: 'krw', amount: 14900 }, bonus: { dig_speed: 0.50, coin_gain: 0.40, treasure_rate: 0.20 },     desc: '대지의 신 (최강)' }
];

// ID로 캐릭터 찾기
export function getCharacterById(id) {
    return CHARACTERS.find(c => c.id === id);
}

// 등급별 필터
export function getCharactersByRarity(rarity) {
    return CHARACTERS.filter(c => c.rarity === rarity);
}

// 무료 캐릭터만
export function getFreeCharacters() {
    return CHARACTERS.filter(c => c.price.type === 'free' || c.price.type === 'coin' || c.price.type === 'relic');
}
