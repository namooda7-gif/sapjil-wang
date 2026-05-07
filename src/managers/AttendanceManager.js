// 일일 출석 보상 매니저 - localStorage 기반, 로컬 날짜 (YYYY-MM-DD) 기준
// CLAUDE.md 스펙:
//   1일=코인 100 / 3일=유물 5 / 7일=다이아 10 / 30일=레어 캐릭터 선택권
//   → 30일 보상은 캐릭터 시스템 미구현이라 다이아 50으로 대체 (정신 유지)
// 그 외 일차는 day*100 코인 (소소한 매일 보상)
//
// 연속 규칙:
//   어제 출석 → 오늘 받으면 streak+1
//   2일 이상 빠짐 → 1일차로 리셋
//   30일 도달 → 다음날 사이클 1일차 (재시작)

const STORAGE_KEY = 'sapjilwang_attendance_v1';

// 특수 일차 보상 (그 외는 day*100 코인)
const STREAK_REWARDS = {
    1:  { type: 'coin',    amount: 100,  label: '🪙 +100' },
    3:  { type: 'relic',   amount: 5,    label: '🏺 +5'   },
    7:  { type: 'diamond', amount: 10,   label: '💎 +10'  },
    14: { type: 'diamond', amount: 5,    label: '💎 +5'   },
    21: { type: 'diamond', amount: 8,    label: '💎 +8'   },
    30: { type: 'diamond', amount: 50,   label: '💎 +50'  }
};

export function getRewardForDay(day) {
    if (STREAK_REWARDS[day]) return STREAK_REWARDS[day];
    const amount = day * 100;
    return { type: 'coin', amount, label: `🪙 +${amount}` };
}

// 로컬 시간(타임존) 기준 YYYY-MM-DD 문자열 — 시차 변경 시에도 유저 체감 일관
function ymdLocal(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 두 YYYY-MM-DD 사이의 일 수 (UTC로 변환해 일자 차이만 정확히)
function dayDiff(ymd1, ymd2) {
    const [y1, m1, d1] = ymd1.split('-').map(Number);
    const [y2, m2, d2] = ymd2.split('-').map(Number);
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((t2 - t1) / (24 * 3600 * 1000));
}

export default class AttendanceManager {
    constructor(currencyManager) {
        this.currencyManager = currencyManager;
        this.lastClaimedYmd = null;     // YYYY-MM-DD or null (한 번도 안 받음)
        this.streakDay = 0;              // 1~30, 0 = 첫 출석 전
        this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.lastClaimedYmd = data.lastClaimedYmd || null;
            this.streakDay = data.streakDay || 0;
        } catch (e) {
            console.warn('출석 데이터 로드 실패:', e);
        }
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                lastClaimedYmd: this.lastClaimedYmd,
                streakDay: this.streakDay
            }));
        } catch (e) {
            console.warn('출석 데이터 저장 실패:', e);
        }
    }

    canClaimToday() {
        return ymdLocal() !== this.lastClaimedYmd;
    }

    // 오늘 받으면 몇 일차가 될지 (UI 미리보기 + claim 둘 다 사용)
    getNextStreakDay() {
        if (!this.lastClaimedYmd) return 1;             // 첫 출석
        const diff = dayDiff(this.lastClaimedYmd, ymdLocal());
        if (diff === 0) return this.streakDay;          // 이미 오늘 받음
        if (diff === 1) {                                // 어제 → 오늘 (연속)
            const next = this.streakDay + 1;
            return next > 30 ? 1 : next;                // 30일 후 다시 1일차
        }
        return 1;                                        // 2일 이상 빠짐 → 리셋
    }

    // 성공 시 { day, reward }, 이미 받았으면 null
    claim() {
        if (!this.canClaimToday()) return null;
        const day = this.getNextStreakDay();
        const reward = getRewardForDay(day);

        if (this.currencyManager) {
            if (reward.type === 'coin')    this.currencyManager.addCoin(reward.amount);
            if (reward.type === 'relic')   this.currencyManager.addRelic(reward.amount);
            if (reward.type === 'diamond') this.currencyManager.addDiamond(reward.amount);
        }

        this.lastClaimedYmd = ymdLocal();
        this.streakDay = day;
        this.save();
        return { day, reward };
    }

    // 30일 그리드 데이터 (UI용)
    //   status: 'claimed'(받은) / 'today'(오늘 받을 차례) / 'future'(미래)
    getCalendarData() {
        const isClaimedToday = this.lastClaimedYmd === ymdLocal();
        const nextDay = this.getNextStreakDay();
        const cells = [];
        for (let d = 1; d <= 30; d++) {
            let status;
            if (d < nextDay)            status = 'claimed';
            else if (d === nextDay)     status = isClaimedToday ? 'claimed' : 'today';
            else                         status = 'future';
            cells.push({ day: d, status, reward: getRewardForDay(d) });
        }
        return { cells, todayDay: nextDay, isClaimedToday };
    }

    reset() {
        this.lastClaimedYmd = null;
        this.streakDay = 0;
        this.save();
    }
}
