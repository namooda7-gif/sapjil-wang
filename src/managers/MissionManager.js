// 일일 미션 매니저 — localStorage, 로컬 자정 리셋
//   매일 풀에서 랜덤 3개 출제. 게임 중 GameScene가 report(type, amount)로 진행도 보고.
//   목표 도달 시 자동으로 보상 지급(currencyManager) + 완료 미션 목록 반환(토스트 연출용).
//
// 진행 모드:
//   - 'count': 누적 합 (보물 발견, 장애물 격파, 콤보30 횟수, 자동수입 코인)
//   - 'max'  : 도달 최댓값 (지하 N m 도달 — 세션 깊이의 최고치)
//
// 통화 표기: 🪙 코인 / 🏺 유물 / 💎 다이아 (달러 표기 금지)

const STORAGE_KEY = 'sapjilwang_missions_v1';

// 미션 풀 — 매일 이 중 3개 랜덤 출제
export const MISSION_POOL = [
    { id: 'combo30x3',  type: 'combo30',   mode: 'count', target: 3,    label: '콤보 30 달성 3회',          reward: { coin: 500 } },
    { id: 'treasure10', type: 'treasure',  mode: 'count', target: 10,   label: '보물 10개 발견',            reward: { relic: 3 } },
    { id: 'obstacle5',  type: 'obstacle',  mode: 'count', target: 5,    label: '장애물 5개 격파',           reward: { coin: 800 } },
    { id: 'depth50',    type: 'depth',     mode: 'max',   target: 50,   label: '지하 50m 도달',             reward: { coin: 600 } },
    { id: 'auto5000',   type: 'auto_coin', mode: 'count', target: 5000, label: '자동수입으로 5000코인 획득', reward: { diamond: 2 } }
];

// 보상 표시 문자열 (🪙/🏺/💎)
export function formatReward(reward) {
    const parts = [];
    if (reward.coin)    parts.push(`🪙 +${reward.coin}`);
    if (reward.relic)   parts.push(`🏺 +${reward.relic}`);
    if (reward.diamond) parts.push(`💎 +${reward.diamond}`);
    return parts.join('  ');
}

// 로컬 날짜 YYYY-MM-DD (자정 리셋 기준)
function ymdLocal(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default class MissionManager {
    constructor(currencyManager) {
        this.currencyManager = currencyManager;
        this.date = null;            // 'YYYY-MM-DD' — 출제 날짜
        this.missions = [];          // [{ id, type, mode, target, label, reward, progress, claimed }]
        this.load();
        this.ensureToday();
    }

    // 오늘 미션 보장 — 날짜 바뀌었으면 새로 3개 출제
    ensureToday() {
        const today = ymdLocal();
        if (this.date === today && Array.isArray(this.missions) && this.missions.length > 0) return;
        this.date = today;
        this.missions = this._pickThree();
        this.save();
    }

    // 풀에서 랜덤 3개 (중복 없이)
    _pickThree() {
        const pool = [...MISSION_POOL];
        // Fisher-Yates 부분 셔플
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, 3).map(def => ({
            id: def.id, type: def.type, mode: def.mode, target: def.target,
            label: def.label, reward: def.reward,
            progress: 0, claimed: false
        }));
    }

    getMissions() {
        this.ensureToday();
        return this.missions;
    }

    // 오늘 완료(수령)한 미션 수 / 전체
    getCompletedCount() {
        this.ensureToday();
        return this.missions.filter(m => m.claimed).length;
    }

    // 게임 중 진행 보고. 목표 도달 시 자동 보상 + 완료된 미션 배열 반환(토스트용)
    //   type: 'combo30' | 'treasure' | 'obstacle' | 'depth' | 'auto_coin'
    report(type, amount = 1) {
        this.ensureToday();
        const completed = [];
        let changed = false;

        for (const m of this.missions) {
            if (m.claimed || m.type !== type) continue;
            const before = m.progress;
            if (m.mode === 'max') {
                m.progress = Math.max(m.progress, amount);
            } else {
                m.progress += amount;
            }
            if (m.progress !== before) changed = true;

            if (m.progress >= m.target) {
                m.progress = m.target;
                m.claimed = true;
                this._grant(m.reward);
                completed.push(m);
                changed = true;
            }
        }

        if (changed) this.save();
        return completed;
    }

    _grant(reward) {
        if (!this.currencyManager || !reward) return;
        if (reward.coin)    this.currencyManager.addCoin(reward.coin);
        if (reward.relic)   this.currencyManager.addRelic(reward.relic);
        if (reward.diamond) this.currencyManager.addDiamond(reward.diamond);
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: this.date, missions: this.missions }));
        } catch (e) {
            console.warn('미션 저장 실패:', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.date = data.date || null;
            this.missions = Array.isArray(data.missions) ? data.missions : [];
        } catch (e) {
            console.warn('미션 로드 실패:', e);
        }
    }

    reset() {
        this.date = null;
        this.missions = [];
        this.ensureToday();
    }
}
