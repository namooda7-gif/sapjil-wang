// 삽 업그레이드 데이터
// CLAUDE.md: 나무삽 → 철삽 → 강철삽 → 미스릴삽 → 마법삽 → 창조의삽
// MVP: 코인으로 살 수 있는 3단계만

export const SHOVELS = [
    {
        id: 'wood',  level: 0,
        name: '나무삽',  icon: '🥄',
        cost: 0,    bonus: 0,
        desc: '기본 (무료)'
    },
    {
        id: 'iron',  level: 1,
        name: '철삽',    icon: '⛏️',
        cost: 1000, bonus: 2,
        desc: '삽질당 코인 +2'
    },
    {
        id: 'steel', level: 2,
        name: '강철삽',  icon: '🔨',
        cost: 5000, bonus: 4,
        desc: '삽질당 코인 +4'
    }
];

// 레벨로 삽 객체 가져오기
export function getShovelByLevel(level) {
    return SHOVELS.find(s => s.level === level) || SHOVELS[0];
}
