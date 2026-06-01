// 자동삽질 매니저 (인부 고용 + 무한 레벨업) — 데이터/로직 전용 (UI는 GameScene STEP4)
//
// 컨셉: 박삽돌은 이제 십장(현장 감독). 인부를 고용해 손을 떼도 자동으로 땅을 판다.
//
// ━━ 핵심 경제 규칙 (인플레 방지 — 절대 준수) ━━
//   - 자동삽질 수입은 "초당 코인" 별도 스트림이다.
//   - 탭 수입(콤보×삽 배율)에 절대 곱하지 않는다 (가산 스트림 유지).
//   - 무한 심층 코인배율(STEP2)도 자동수입엔 적용하지 않는다.
//   - 총 자동수입 = 모든 인부의 (초당코인) 합.
//
// ━━ 레벨업 공식 ━━
//   - 비용     = 기본가  × 1.15^(현재레벨)   → 레벨이 오를수록 지수적으로 비싸짐 (소프트캡)
//   - 초당코인 = 기본초당 × 현재레벨           → 선형 증가 (레벨 0 = 수입 0, 레벨 1부터 발생)
//
// localStorage에 인부별 레벨만 저장. CurrencyManager와 연동해 코인 차감(레벨업)/획득(매초 가산).

const STORAGE_KEY = 'sapjilwang_autodig_v1';

const COST_GROWTH = 1.15;       // 레벨업 비용 증가율 (표준 idle 곡선)
const MAX_OFFLINE_HOURS = 8;    // (참고용 — 오프라인 보상 캡은 STEP5 OfflineRewardManager에서 사용)

// 인부 정의 (3종) — id 순서가 화면 표시 순서
export const WORKERS = [
    {
        id: 'rookie',
        name: '막내인부',
        emoji: '🧑‍🌾',
        baseCost: 200,            // 1레벨(첫 고용) 비용 기준가
        basePerSecond: 1,         // 레벨당 초당 +1 코인
        // 번아웃 말풍선 (STEP4 UI에서 랜덤 노출 — 공유 포인트)
        burnoutLines: [
            '사수님 저 그만둘래요...',
            '여기 삽질 너무 많아요 ㅠㅠ',
            '점심시간 언제예요...'
        ]
    },
    {
        id: 'excavator',
        name: '포크레인기사',
        emoji: '🚜',
        baseCost: 2000,
        basePerSecond: 12,
        burnoutLines: [
            '시급 올려주세요...',
            '기계가 과열됐습니다!',
            '이 정도면 특근수당 주셔야죠'
        ]
    },
    {
        id: 'driller',
        name: '굴착기',
        emoji: '⚙️',
        baseCost: 25000,
        basePerSecond: 150,
        burnoutLines: [
            '기름값이 더 나와요...',
            '드릴 날 다 닳았습니다!',
            '엔진 한계입니다 십장님!'
        ]
    }
];

export function getWorkerById(id) {
    return WORKERS.find(w => w.id === id);
}

export default class AutoDigManager {
    /**
     * @param {object} currencyManager - 코인 차감/획득 대상 (spendCoin / addCoin 사용)
     */
    constructor(currencyManager) {
        this.currencyManager = currencyManager;

        // 인부별 레벨 (0 = 미고용). 무한 레벨업.
        this.levels = {};
        WORKERS.forEach(w => { this.levels[w.id] = 0; });

        // 매초 가산용 소수 누적기 (초당수입 × delta가 정수 미만일 때 캐리)
        this._coinAccum = 0;

        this.load();
    }

    // ━━ 조회 ━━

    getLevel(id) {
        return this.levels[id] || 0;
    }

    // 다음 레벨업 비용 = 기본가 × 1.15^(현재레벨)
    getCost(id) {
        const w = getWorkerById(id);
        if (!w) return Infinity;
        return Math.floor(w.baseCost * Math.pow(COST_GROWTH, this.getLevel(id)));
    }

    // 해당 인부의 현재 초당코인 = 기본초당 × 현재레벨
    getIncome(id) {
        const w = getWorkerById(id);
        if (!w) return 0;
        return w.basePerSecond * this.getLevel(id);
    }

    // 총 자동수입 (초당 코인) = 모든 인부 합
    getTotalPerSecond() {
        return WORKERS.reduce((sum, w) => sum + this.getIncome(w.id), 0);
    }

    // 한 명이라도 고용했는지 (오프라인 보상 등에서 사용)
    hasAnyWorker() {
        return WORKERS.some(w => this.getLevel(w.id) > 0);
    }

    // 레벨업 가능 여부 (코인 충분?)
    canLevelUp(id) {
        return this.currencyManager && this.currencyManager.coin >= this.getCost(id);
    }

    // ━━ 동작 ━━

    // 레벨업(=고용/강화). 성공 시 true (코인 차감 + 레벨 +1 + 저장), 실패 시 false (코인 부족)
    levelUp(id) {
        const w = getWorkerById(id);
        if (!w || !this.currencyManager) return false;
        const cost = this.getCost(id);
        if (!this.currencyManager.spendCoin(cost)) return false;   // 코인 부족
        this.levels[id] = this.getLevel(id) + 1;
        this.save();
        return true;
    }

    // 매 프레임 호출 (GameScene.update의 delta ms) → 초당수입을 코인으로 가산.
    //   소수 누적 후 정수 부분만 addCoin. 이번 호출에 실제 가산된 코인 수 반환(UI 연출용).
    accrue(deltaMs) {
        const perSec = this.getTotalPerSecond();
        if (perSec <= 0 || !this.currencyManager) return 0;
        this._coinAccum += perSec * (deltaMs / 1000);
        const whole = Math.floor(this._coinAccum);
        if (whole > 0) {
            this._coinAccum -= whole;
            this.currencyManager.addCoin(whole);
        }
        return whole;
    }

    // ━━ 저장/로드 ━━

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ levels: this.levels }));
        } catch (e) {
            console.warn('자동삽질 저장 실패:', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data && data.levels) {
                WORKERS.forEach(w => {
                    const lv = parseInt(data.levels[w.id], 10);
                    this.levels[w.id] = Number.isFinite(lv) && lv > 0 ? lv : 0;
                });
            }
        } catch (e) {
            console.warn('자동삽질 로드 실패:', e);
        }
    }

    reset() {
        WORKERS.forEach(w => { this.levels[w.id] = 0; });
        this._coinAccum = 0;
        this.save();
    }
}
