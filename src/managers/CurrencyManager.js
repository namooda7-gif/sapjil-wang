// 재화 관리 매니저 (삽코인, 다이아삽, 유물조각, 삽 레벨, 캐릭터)
// localStorage로 로컬 저장 - 추후 FirebaseManager와 연동
import { getShovelByLevel } from '../data/shovels.js';
import { getCharacterById, CHARACTERS } from '../data/characters.js';

const STORAGE_KEY = 'sapjilwang_currency_v1';

// 기본 보유 캐릭터 — 박삽돌은 튜토리얼이라 처음부터 보유
const DEFAULT_CHARACTER_ID    = 'char_001';
const DEFAULT_OWNED_CHARACTERS = ['char_001'];

export default class CurrencyManager {
    constructor() {
        this.coin = 0;          // 🪙 삽코인 (기본 재화)
        this.diamond = 0;       // 💎 다이아삽 (프리미엄)
        this.relic = 0;         // 🏺 유물조각 (희귀 캐릭터)
        this.shovelLevel = 0;   // 0=나무 / 1=철 / 2=강철 (단방향 업그레이드)

        // 박물관용 보물 수집 목록 (id 기준 dedupe + count)
        // 항목 형식: { id, name, rarity, desc, layerId, layerName, count, foundAt }
        this.collectedTreasures = [];

        // 캐릭터 보유/선택 — 초기값은 박삽돌만 보유 + 선택
        this.ownedCharacters    = [...DEFAULT_OWNED_CHARACTERS];
        this.selectedCharacterId = DEFAULT_CHARACTER_ID;

        this.load();

        // 무료 캐릭터(price.type === 'free') 자동 보유 보장 — load() early-return 케이스(신규 유저) 백업
        // load() 안에서도 한 번 처리하지만 localStorage 비어있으면 그 분기 안 탐
        CHARACTERS.forEach(c => {
            if (c.price && c.price.type === 'free' && !this.ownedCharacters.includes(c.id)) {
                this.ownedCharacters.push(c.id);
            }
        });
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 캐릭터 보유/선택
    //   ownedCharacters: ['char_001', ...]
    //   selectedCharacterId: 현재 사용 중인 캐릭터 (게임/메뉴 미리보기 둘 다 이 값 참조)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ownsCharacter(id) {
        return Array.isArray(this.ownedCharacters) && this.ownedCharacters.includes(id);
    }

    // 캐릭터 구매. 가격 type에 따라 coin/relic/diamond/krw 자동 차감
    //   성공 → true (보유 목록에 추가 + 저장). 실패 → false (보유 중/캐릭터 없음/잔액 부족/krw는 별도 결제)
    purchaseCharacter(id) {
        const def = getCharacterById(id);
        if (!def) return false;
        if (this.ownsCharacter(id)) return false;
        const price = def.price || {};

        if (price.type === 'free') {
            // 무료: 그냥 보유 추가
        } else if (price.type === 'coin') {
            if (!this.spendCoin(price.amount || 0)) return false;
        } else if (price.type === 'relic') {
            if (!this.spendRelic(price.amount || 0)) return false;
        } else if (price.type === 'diamond') {
            if (!this.spendDiamond(price.amount || 0)) return false;
        } else if (price.type === 'krw') {
            // 실 결제 — 인앱결제 연동 전이라 차단
            return false;
        } else {
            return false;
        }

        if (!Array.isArray(this.ownedCharacters)) this.ownedCharacters = [];
        this.ownedCharacters.push(id);
        this.save();
        return true;
    }

    // 캐릭터 선택. 보유한 캐릭터만 선택 가능
    selectCharacter(id) {
        if (!this.ownsCharacter(id)) return false;
        this.selectedCharacterId = id;
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
                ownedCharacters: this.ownedCharacters,
                selectedCharacterId: this.selectedCharacterId,
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
            // 캐릭터 — 구버전 저장에는 없으므로 디폴트 fallback
            this.ownedCharacters = Array.isArray(data.ownedCharacters) && data.ownedCharacters.length > 0
                ? data.ownedCharacters
                : [...DEFAULT_OWNED_CHARACTERS];
            // 박삽돌(char_001)은 항상 보유 보장 (튜토리얼 의존)
            if (!this.ownedCharacters.includes(DEFAULT_CHARACTER_ID)) {
                this.ownedCharacters.unshift(DEFAULT_CHARACTER_ID);
            }
            // 무료 캐릭터(price.type === 'free')는 항상 자동 보유 — 정책: 무료는 진입 즉시 사용 가능
            // characters.js에서 무료로 추가/지정만 하면 코드 수정 없이 자동 반영
            CHARACTERS.forEach(c => {
                if (c.price && c.price.type === 'free' && !this.ownedCharacters.includes(c.id)) {
                    this.ownedCharacters.push(c.id);
                }
            });
            // 선택 캐릭터 — 보유 중이 아니면 디폴트로 fallback
            const selected = data.selectedCharacterId || DEFAULT_CHARACTER_ID;
            this.selectedCharacterId = this.ownedCharacters.includes(selected)
                ? selected
                : DEFAULT_CHARACTER_ID;
        } catch (e) {
            console.warn('재화 로드 실패:', e);
        }
    }

    reset() {
        this.coin = 0;
        this.diamond = 0;
        this.relic = 0;
        this.shovelLevel = 0;
        this.ownedCharacters = [...DEFAULT_OWNED_CHARACTERS];
        this.selectedCharacterId = DEFAULT_CHARACTER_ID;
        this.save();
    }
}
