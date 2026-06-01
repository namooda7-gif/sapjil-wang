// 오프라인 보상 매니저 - 게임 종료 시각 저장 + 재접속 시 보상 계산
// 2026-06-01 STEP5: 고정 0.5코인/초 → "인부들이 벌어놓은 자동수입" 으로 전환
//   오프라인 수입 = AutoDigManager 총 초당코인 × 떠나있던 초 (최대 8시간)
//   → 인부 없으면 수입 0 / 인부 레벨업이 곧 오프라인 수입 증가 = 돌아올 이유
// CurrencyManager는 건드리지 않고 별도 storage key로 저장

const STORAGE_KEY = 'sapjilwang_offline_v1';

const MAX_HOURS             = 8;
const MAX_SECONDS           = MAX_HOURS * 3600;        // 28800초
const MIN_THRESHOLD_SECONDS = 30;                      // 30초 미만은 팝업 안 띄움 (메뉴 왔다갔다 노이즈 방지)

export default class OfflineRewardManager {
    /**
     * @param {object} currencyManager - 보상 적용 대상 (addCoin 호출됨)
     * @param {object} [autoDigManager] - 자동수입 초당코인 출처 (없으면 오프라인 수입 0)
     */
    constructor(currencyManager, autoDigManager = null) {
        this.currencyManager = currencyManager;
        this.autoDigManager = autoDigManager;
        this.lastSeenTime = null;     // null = 최초 실행 (보상 없음)
        this.load();
    }

    // 인부 총 초당코인 (인부 없으면 0)
    getRatePerSecond() {
        return this.autoDigManager ? this.autoDigManager.getTotalPerSecond() : 0;
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.lastSeenTime = typeof data.lastSeenTime === 'number' ? data.lastSeenTime : null;
        } catch (e) {
            console.warn('오프라인 시각 로드 실패:', e);
        }
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastSeenTime: this.lastSeenTime }));
        } catch (e) {
            console.warn('오프라인 시각 저장 실패:', e);
        }
    }

    // 현재 시각을 "마지막 본 시각"으로 기록 (세션 시작/종료 시 호출)
    markSeen() {
        this.lastSeenTime = Date.now();
        this.save();
    }

    // 경과 시간 (초) - 보상 계산 없이 정보용
    getElapsedSeconds() {
        if (!this.lastSeenTime) return 0;
        return Math.max(0, Math.floor((Date.now() - this.lastSeenTime) / 1000));
    }

    // 아직 받지 않은 보상 (코인) 계산 (claim 호출 전까지 누적)
    //   = 인부 총 초당코인 × 떠나있던 초 (8시간 캡). 인부 없으면 0.
    getPendingReward() {
        if (!this.lastSeenTime) return 0;
        const rate = this.getRatePerSecond();
        if (rate <= 0) return 0;                          // 인부 없으면 오프라인 수입 없음
        const elapsed = this.getElapsedSeconds();
        if (elapsed < MIN_THRESHOLD_SECONDS) return 0;
        const capped = Math.min(elapsed, MAX_SECONDS);
        return Math.floor(capped * rate);
    }

    // 보상 적용 + 시각 리셋. 받은 액수 반환
    claim() {
        const reward = this.getPendingReward();
        if (reward > 0 && this.currencyManager) {
            this.currencyManager.addCoin(reward);
        }
        this.markSeen();
        return reward;
    }

    // 시간/포맷 헬퍼 (팝업 안내문 용)
    formatElapsed() {
        const total = Math.min(this.getElapsedSeconds(), MAX_SECONDS);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        if (h > 0) return `${h}시간 ${m}분`;
        return `${m}분`;
    }
}
