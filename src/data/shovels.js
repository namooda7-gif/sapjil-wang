// 삽 업그레이드 데이터
// CLAUDE.md: 나무삽 → 철삽 → 강철삽 → 미스릴삽 → 마법삽 → 창조의삽
// MVP: 코인으로 살 수 있는 3단계만
//
// digMult: 사용자 스펙 — 삽 업그레이드 = 진행 카운트 배율
//   1탭당 layerData.requiredDigs에 더해지는 카운트가 digMult배
//   예) 강철삽(2.0x)이면 1탭 = 2 카운트 → 실질 탭 횟수 절반
//   콤보 보너스(10+:1.5x / 50+:2.0x)와 곱연산되어 누적됨

export const SHOVELS = [
    {
        id: 'wood',  level: 0,
        name: '나무삽',  icon: '🥄',
        cost: 0,    bonus: 0, digMult: 1.0,
        desc: '기본 (무료)'
    },
    {
        id: 'iron',  level: 1,
        name: '철삽',    icon: '⛏️',
        cost: 1000, bonus: 2, digMult: 1.5,
        desc: '삽질당 코인 +2 / 진행 1.5배'
    },
    {
        id: 'steel', level: 2,
        name: '강철삽',  icon: '🔨',
        cost: 5000, bonus: 4, digMult: 2.0,
        desc: '삽질당 코인 +4 / 진행 2배'
    }
];

// 레벨로 삽 객체 가져오기
export function getShovelByLevel(level) {
    return SHOVELS.find(s => s.level === level) || SHOVELS[0];
}
