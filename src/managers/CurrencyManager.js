// 재화 관리 매니저 (삽코인, 다이아삽, 유물조각, 삽 레벨)
// localStorage로 로컬 저장 - 추후 FirebaseManager와 연동
import { getShovelByLevel } from '../data/shovels.js';

const STORAGE_KEY = 'sapjilwang_currency_v1';

export default class CurrencyManager {
    constructor() {
        this.coin = 0;          // 🪙 삽코인 (기본 재화)
        this.diamond = 0;       // 💎 다이아삽 (프리미엄)
        this.relic = 0;         // 🏺 유물조각 (희귀 캐릭터)
        this.shovelLevel = 0;   // 0=나무 / 1=철 / 2=강철 (단방향 업그레이드)

        // 박물관용 보물 수집 목록 (id 기준 dedupe + count)
        // 항목 형식: { id, name, rarity, desc, layerId, layerName, count, foundAt }
        this.collectedTreasures = [];

        this.load();
    }

    // 박물관: 보물 발견 시 호출. 같은 id면 count 증가, 새 id면 추가
    addCollectedTreasure(item) {
        if (!item || !item.id) return;
        if (!Array.isArray(this.collectedTreasures)) this.collectedTreasures = [];
        const existing = this.collectedTreasures.find(t => t.id === item.id);
        if (existing) {
            existing.count = (existing.count || 1) + 1;
            existing.foundAt = item.foundAt || Date.now();
        } else {
            this.collectedTreasures.push({
                ...item,
                count: 1,
                foundAt: item.foundAt || Date.now()
            });
        }
        this.save();
    }

    // 박물관: 고유 보물 종류 개수
    getUniqueTreasureCount() {
        return Array.isArray(this.collectedTreasures) ? this.collectedTreasures.length : 0;
    }

    // 박물관: 뻘짓 점수 (역발상 - 흔할수록 높은 점수)
    // common=100 / rare=50 / epic=30 / legendary=10
    getSillyScore() {
        if (!Array.isArray(this.collectedTreasures)) return 0;
        const scoreMap = { common: 100, rare: 50, epic: 30, legendary: 10 };
        return this.collectedTreasures.reduce((sum, t) => sum + (scoreMap[t.rarity] || 0), 0);
    }

    // 현재 삽의 코인 보너스 (dig마다 추가로 더해짐)
    getShovelBonus() {
        return getShovelByLevel(this.shovelLevel).bonus;
    }

    // 삽 업그레이드 시도. 성공 시 true, 실패(이미 보유 / 코인 부족) 시 false
    upgradeShovel(targetLevel) {
        const target = getShovelByLevel(targetLevel);
        if (!target) return false;
        if (targetLevel <= this.shovelLevel) return false; // 이미 보유 / 다운그레이드 금지
        if (this.coin < target.cost) return false;          // 코인 부족
        this.coin -= target.cost;
        this.shovelLevel = targetLevel;
        this.save();
        return true;
    }

    addCoin(amount) {
        this.coin = Math.max(0, this.coin + amount);
        this.save();
    }

    addDiamond(amount) {
        this.diamond = Math.max(0, this.diamond + amount);
        this.save();
    }

    addRelic(amount) {
        this.relic = Math.max(0, this.relic + amount);
        this.save();
    }

    // 차감 (실패 시 false)
    spendCoin(amount) {
        if (this.coin < amount) return false;
        this.coin -= amount;
        this.save();
        return true;
    }

    spendDiamond(amount) {
        if (this.diamond < amount) return false;
        this.diamond -= amount;
        this.save();
        return true;
    }

    spendRelic(amount) {
        if (this.relic < amount) return false;
        this.relic -= amount;
        this.save();
        return true;
    }

    // 로컬 저장 (오프라인 대비)
    save() {
        try {
            const data = {
                coin: this.coin,
                diamond: this.diamond,
                relic: this.relic,
                shovelLevel: this.shovelLevel,
                collectedTreasures: this.collectedTreasures,
                updated_at: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('재화 저장 실패:', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.coin = data.coin || 0;
            this.diamond = data.diamond || 0;
            this.relic = data.relic || 0;
            this.shovelLevel = data.shovelLevel || 0;
            this.collectedTreasures = Array.isArray(data.collectedTreasures) ? data.collectedTreasures : [];
        } catch (e) {
            console.warn('재화 로드 실패:', e);
        }
    }

    reset() {
        this.coin = 0;
        this.diamond = 0;
        this.relic = 0;
        this.shovelLevel = 0;
        this.save();
    }
}
