// 사운드 + 햅틱 관리 매니저 (중독성의 핵심)
// SFX: Web Audio API로 모든 효과음을 코드로 합성 (MP3 파일 불필요)
// BGM: Phaser 사운드 매니저 사용 (MP3 파일 사용)
// 햅틱: Capacitor Haptics + 웹 navigator.vibrate 폴백
//
// 모든 효과음은 동시 재생 가능 (각 호출마다 새 노드를 만들고 destination에 연결)
// AudioContext는 모듈 레벨 싱글톤 → 씬 전환되어도 같은 컨텍스트 유지

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SFX 시스템 - 싱글톤 상태
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SFX_STORAGE_KEY     = 'sapjilwang_sfx_muted_v1';
const SFX_DEFAULT_VOLUME  = 0.4;

const sfxState = {
    audioCtx: null,                                  // 싱글톤 AudioContext (lazy 초기화)
    masterVolume: SFX_DEFAULT_VOLUME,                // 마스터 볼륨 (0~1)
    muted: (() => {
        try { return localStorage.getItem(SFX_STORAGE_KEY) === '1'; }
        catch (e) { return false; }
    })()
};

// 첫 사용자 인터랙션 후에만 AudioContext 생성/resume (브라우저 autoplay 정책 대응)
function ensureCtx() {
    if (!sfxState.audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { sfxState.audioCtx = new AC(); }
        catch (e) { return null; }
    }
    if (sfxState.audioCtx.state === 'suspended') {
        sfxState.audioCtx.resume();
    }
    return sfxState.audioCtx;
}

// 마스터 볼륨 게이트 (mute 상태면 0)
function masterVol() {
    return sfxState.muted ? 0 : sfxState.masterVolume;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 합성 헬퍼 - 톤 / 노이즈 / 비브라토
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 일반 음(오실레이터) - 주파수 슬라이드 + 자연스러운 attack/release 엔벨로프
function tone(opts) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const {
        freq = 440,
        freqEnd,                       // null/undefined면 슬라이드 없음
        duration = 0.1,
        type = 'sine',                 // sine/triangle/square/sawtooth
        volume = 1.0,
        startAt = 0,                   // currentTime 기준 지연
        attack = 0.005                 // 클릭 노이즈 방지
    } = opts;

    const t0 = ctx.currentTime + startAt;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    }

    const peak = masterVol() * volume;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
}

// 화이트 노이즈 (페이드아웃 엔벨로프)
function noise(opts = {}) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const {
        duration = 0.04,
        volume = 0.5,
        startAt = 0
    } = opts;

    const t0 = ctx.currentTime + startAt;
    const bufSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // 시작 강하게 → 끝 약하게 페이드 (찰진 임팩트)
    for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const peak = masterVol() * volume;
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    source.connect(gain).connect(ctx.destination);
    source.start(t0);
}

// 비브라토 톤 (LFO로 주파수 변조 = 호루라기/위협음 등)
function vibratoTone(opts) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const {
        baseFreq = 200,
        vibratoFreq = 30,              // 진동 주파수(Hz) - 빠를수록 떨림
        vibratoDepth = 50,             // 진동 폭(Hz)
        duration = 0.3,
        type = 'sawtooth',
        volume = 0.5,
        startAt = 0
    } = opts;

    const t0 = ctx.currentTime + startAt;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = baseFreq;
    lfo.frequency.value = vibratoFreq;
    lfoGain.gain.value = vibratoDepth;
    lfo.connect(lfoGain).connect(osc.frequency);

    const peak = masterVol() * volume;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + duration);
    lfo.stop(t0 + duration);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 효과음 설정 테이블 (사용자 스펙)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 삽질 효과음 - 톤 + 노이즈 임팩트 (사용자 강화 스펙)
//   흙   '퍽'   : 낮고 둔탁
//   모래 '사르르': 노이즈 위주
//   돌   '카캉!': 높고 금속성 + 강한 진동 (HARD = 손저린 연출)
//   타일 '깡!'  : 날카로운 고음 (HARD)
//   콘크리트 '쿵!': 묵직함
//   용암      : 보존
// hard 플래그가 true면 GameScene이 "손저림 연출"(긴 진동/카메라 셰이크 2배/흰색 플래시) 트리거
const SOIL_DIG_CONFIG = {
    // 흙: 낮은 사인파 + 거친 노이즈로 둔탁한 '퍽'
    dirt:     { freq: 90,  freqEnd: 45,  duration: 0.18, oscType: 'sine',     noise: 0.60, noiseDur: 0.06, hard: false },
    // 모래: 노이즈 비중 95% + 톤 약간만 (사르르~)
    sand:     { freq: 220, freqEnd: 180, duration: 0.22, oscType: 'triangle', noise: 0.95, noiseDur: 0.20, hard: false },
    // 돌: 1500→700Hz 빠른 슬라이드 + 금속성 square + 강한 노이즈 임팩트 ('카캉!')
    rock:     { freq: 1500, freqEnd: 700, duration: 0.12, oscType: 'square',  noise: 0.90, noiseDur: 0.05, hard: true,  metalRing: 2400 },
    // 타일: 2200Hz 짧고 날카로운 square ('깡!')
    tile:     { freq: 2200, freqEnd: 1600, duration: 0.10, oscType: 'square', noise: 0.40, noiseDur: 0.03, hard: true,  metalRing: 3200 },
    // 콘크리트: 100→55Hz 묵직한 sawtooth + 두꺼운 노이즈 ('쿵!')
    concrete: { freq: 100, freqEnd: 55,  duration: 0.18, oscType: 'sawtooth', noise: 0.65, noiseDur: 0.06, hard: false },
    // 용암: 보존 (낮은 사인 + 노이즈)
    lava:     { freq: 65,  freqEnd: 40,  duration: 0.20, oscType: 'sine',     noise: 0.70, noiseDur: 0.10, hard: false }
};

// 외부에서 hard soil 여부 조회 (GameScene이 카메라/플래시/진동 차등 적용)
export function isHardSoil(soilType) {
    return !!(SOIL_DIG_CONFIG[soilType] && SOIL_DIG_CONFIG[soilType].hard);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BGM 시스템 (모듈 레벨 싱글톤 - SFX와 별도 채널)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BGM_STORAGE_KEY    = 'sapjilwang_bgm_muted_v1';
const BGM_DEFAULT_VOLUME = 0.4;
const BGM_FADE_DURATION  = 500;

const bgmState = {
    currentBgm: null,
    currentKey: null,
    volume:     BGM_DEFAULT_VOLUME,
    muted: (() => {
        try { return localStorage.getItem(BGM_STORAGE_KEY) === '1'; }
        catch (e) { return false; }
    })()
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 햅틱 (Capacitor Haptics 동적 import)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let HapticsImpactStyle = null;
let HapticsApi = null;

async function loadHaptics() {
    try {
        const mod = await import('@capacitor/haptics');
        HapticsApi = mod.Haptics;
        HapticsImpactStyle = mod.ImpactStyle;
    } catch (e) {
        // 웹 개발 환경 - 무시
    }
}
loadHaptics();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SoundManager 클래스
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default class SoundManager {
    constructor(scene) {
        this.scene = scene;
    }

    // 외부 호환용 (기존 코드에서 호출)
    ensureAudioContext() { return ensureCtx() != null; }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SFX 토글 / 볼륨 / 상태
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    get isSFXMuted() { return sfxState.muted; }

    setMasterVolume(vol) {
        sfxState.masterVolume = Math.max(0, Math.min(1, vol));
    }

    toggleSFX() {
        sfxState.muted = !sfxState.muted;
        try { localStorage.setItem(SFX_STORAGE_KEY, sfxState.muted ? '1' : '0'); } catch (e) {}
        return sfxState.muted;
    }

    // 기존 코드 호환용 (SFX 직접 mute 설정)
    setMuted(muted) {
        sfxState.muted = !!muted;
    }
    get muted() { return sfxState.muted; }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1) 삽질 사운드 (레이어 soilType별)
    //   - 흙/모래/콘크리트/용암: 톤 + 베이스 thump + 노이즈 (둔탁/거친 사운드)
    //   - 돌/타일 (hard): 위 사운드 + metalRing(고음 사인 2400~3200Hz)으로 금속성 강조
    //     → 햅틱/카메라 강화는 GameScene에서 isHardSoil() 분기로 처리
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playDigSound(soilType) {
        if (sfxState.muted) return;
        const cfg = SOIL_DIG_CONFIG[soilType] || SOIL_DIG_CONFIG.dirt;
        // 메인 톤 (볼륨 +43%: 0.7 → 1.0, 두께 강화)
        tone({
            freq: cfg.freq,
            freqEnd: cfg.freqEnd,
            duration: cfg.duration * 1.2,   // 살짝 더 길게
            type: cfg.oscType,
            volume: 1.0
        });
        // 베이스 thump 추가 — 한 옥타브 아래 사인파로 묵직한 저음 깔기
        tone({
            freq: cfg.freq * 0.5,
            freqEnd: (cfg.freqEnd ?? cfg.freq) * 0.5,
            duration: cfg.duration * 1.5,
            type: 'sine',
            volume: 0.6
        });
        // 노이즈 임팩트 (찰진 시작) — 볼륨 +50% 두께 강화
        if (cfg.noise > 0) {
            noise({ duration: cfg.noiseDur * 1.3, volume: Math.min(1, cfg.noise * 1.5) });
        }
        // 돌/타일은 금속성 ring 추가 → '카캉!'/'깡!' 느낌
        if (cfg.metalRing) {
            tone({
                freq: cfg.metalRing,
                freqEnd: cfg.metalRing * 0.6,
                duration: 0.18,
                type: 'sine',
                volume: 0.5,
                startAt: 0.005
            });
            // 옥타브 위 살짝 더 (금속이 울리는 잔향)
            tone({
                freq: cfg.metalRing * 1.5,
                duration: 0.10,
                type: 'sine',
                volume: 0.20,
                startAt: 0.01
            });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1-b) 손저림 강진동 (돌/타일 등 hard soil 전용)
    //   - "쿵-쾅-쿵" 트리플 펄스 패턴 → 일반 단발 진동보다 훨씬 임팩트 큼
    //   - Capacitor 폴백은 heavy 단발 (Capacitor는 패턴 미지원)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    triggerHardSoilHaptic() {
        if (sfxState.muted) return;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            // 사용자 요청: 진동 더 강하게 → 펄스 길이 +60~80%, 5단 → 더 묵직 (총 ~1.2s)
            navigator.vibrate([320, 70, 320, 70, 380]);
            return;
        }
        // Capacitor heavy 폴백
        this.triggerHaptic('heavy');
    }

    // 장애물 부수기 전용 강진동 (hard soil보다 한 단계 더 묵직)
    triggerObstacleHitHaptic() {
        if (sfxState.muted) return;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            // 4펄스 무거운 탕탕탕 (~1.4s)
            navigator.vibrate([400, 80, 400, 80, 400, 80, 450]);
            return;
        }
        this.triggerHaptic('heavy');
    }

    // soilType이 hard인지 외부에서도 조회 가능 (GameScene 편의)
    isHardSoil(soilType) {
        return isHardSoil(soilType);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1-c) 돌 충돌 추가 임팩트 (hard soil 전용)
    //   playDigSound 위에 덧입혀 두께를 늘려주는 보조 사운드
    //   - 50Hz 깊은 boom (저역 펀치)
    //   - 0.04s 후 2차 clang (3000Hz 짧고 날카로움)
    //   - 강한 사이드 노이즈 (긁히는 느낌)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playHardSoilImpactSound() {
        if (sfxState.muted) return;
        // 깊은 저역 boom (가슴 울리는 느낌)
        tone({ freq: 80, freqEnd: 40, duration: 0.22, type: 'sine',     volume: 0.85 });
        // 2차 clang (살짝 늦게 들어와 잔향감)
        tone({ freq: 3000, freqEnd: 1800, duration: 0.10, type: 'square', volume: 0.55, startAt: 0.04 });
        // 사이드 노이즈 (긁히는 거친 질감)
        noise({ duration: 0.12, volume: 0.95 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2) 코인 획득 - 매번 살짝 다른 피치 (단조로움 방지)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playCoinSound() {
        if (sfxState.muted) return;
        const startF = 1200 + (Math.random() - 0.5) * 200;   // ±100Hz
        const endF   = 1800 + (Math.random() - 0.5) * 200;
        tone({
            freq: startF,
            freqEnd: endF,
            duration: 0.10,
            type: 'sine',
            volume: 0.35
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3) 보물 발견 - 등급별 멜로디 (등급 올라갈수록 화려)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playTreasureSound(rarity) {
        if (sfxState.muted) return;
        switch (rarity) {
            case 'legendary': this._treasureLegendary(); break;
            case 'epic':      this._treasureEpic(); break;
            case 'rare':      this._treasureRare(); break;
            case 'common':
            default:          this._treasureCommon(); break;
        }
    }

    // 일반: 800 → 1200Hz 2음 "딩동"
    _treasureCommon() {
        tone({ freq: 800,  duration: 0.14, type: 'sine', volume: 0.5 });
        tone({ freq: 1200, duration: 0.20, type: 'sine', volume: 0.6, startAt: 0.10 });
    }

    // 희귀: 600→900→1200Hz 3음 상승 "딩딩딩"
    _treasureRare() {
        const freqs = [600, 900, 1200];
        freqs.forEach((f, i) => {
            tone({
                freq: f,
                duration: i === freqs.length - 1 ? 0.22 : 0.10,
                type: 'sine',
                volume: 0.55 + i * 0.05,
                startAt: i * 0.08
            });
        });
    }

    // 에픽: 400→600→800→1200Hz 4음 + 리버브 (지연 echo로 시뮬레이션)
    _treasureEpic() {
        const freqs = [400, 600, 800, 1200];
        const step = 0.10;
        freqs.forEach((f, i) => {
            // 본음
            tone({ freq: f, duration: 0.20, type: 'sine', volume: 0.55, startAt: i * step });
            // 리버브 echo (살짝 지연 + 작은 볼륨)
            tone({ freq: f, duration: 0.18, type: 'sine', volume: 0.22, startAt: i * step + 0.08 });
            // 옥타브 위 (밝게)
            tone({ freq: f * 2, duration: 0.18, type: 'sine', volume: 0.18, startAt: i * step + 0.02 });
        });
    }

    // 전설: 200→400→600→900→1200Hz 5음 + 화음 (옥타브+5도)
    _treasureLegendary() {
        const freqs = [200, 400, 600, 900, 1200];
        const step = 0.10;
        freqs.forEach((f, i) => {
            tone({ freq: f,        duration: 0.22, type: 'sawtooth', volume: 0.5, startAt: i * step });
            tone({ freq: f * 1.5,  duration: 0.22, type: 'sine',     volume: 0.25, startAt: i * step });  // 5도
            tone({ freq: f * 2,    duration: 0.22, type: 'sine',     volume: 0.18, startAt: i * step });  // 옥타브
        });
        // 마무리 긴 음
        const finale = freqs.length * step;
        tone({ freq: 1200, duration: 0.45, type: 'sine', volume: 0.4, startAt: finale });
        tone({ freq: 1800, duration: 0.45, type: 'sine', volume: 0.2, startAt: finale });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4) 레이어 클리어 - 6음 팡파레 (마지막 음 길고 크게)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playLayerClearSound() {
        if (sfxState.muted) return;
        const freqs = [300, 400, 500, 600, 700, 900];
        const step = 0.10;
        freqs.forEach((f, i) => {
            const isLast = i === freqs.length - 1;
            const dur = isLast ? 0.30 : step;
            tone({
                freq: f,
                duration: dur,
                type: 'sawtooth',
                volume: isLast ? 0.95 : 0.6,
                startAt: i * step
            });
            // 5도 화음으로 풍성하게
            tone({
                freq: f * 1.5,
                duration: dur,
                type: 'sine',
                volume: isLast ? 0.45 : 0.3,
                startAt: i * step
            });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5) 콤보 달성 - 콤보 단계별 점점 화려 (강화: 200 단계까지)
    //   200 → 7음 황금 팡파르 + sub-boom (전설 도달)
    //   150 → 6음 화려한 트릴
    //   100 → 5음 상승 화음 + chime (마일스톤)
    //   75  → 4음 + 살짝 더 화려
    //   50  → 4음 "삐삐삐빅" (기존)
    //   40  → 3음 강조
    //   30  → 3음 "삐삐빅" (기존)
    //   20  → 2음 강조
    //   10  → 2음 "삐빅" (기존)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playComboSound(comboCount) {
        if (sfxState.muted) return;

        if (comboCount >= 200) {
            // 7음 황금 팡파르 + 깊은 sub-boom (전설 200콤보)
            const notes = [523, 659, 784, 1047, 1319, 1568, 2093];   // C5→C7 상승
            notes.forEach((f, i) => {
                tone({ freq: f, duration: 0.10, type: 'square',   volume: 0.85, startAt: i * 0.05 });
                tone({ freq: f * 1.5, duration: 0.10, type: 'sine', volume: 0.4,  startAt: i * 0.05 });   // 5도 화음
            });
            // 마지막 sub-boom (위엄)
            tone({ freq: 80, freqEnd: 30, duration: 0.50, type: 'sine', volume: 0.7, startAt: 0.35 });
            return;
        }
        if (comboCount >= 150) {
            // 6음 화려한 트릴
            const notes = [659, 880, 1100, 1319, 1760, 2200];
            notes.forEach((f, i) => {
                tone({ freq: f, duration: 0.08, type: 'square', volume: 0.75, startAt: i * 0.05 });
            });
            tone({ freq: 100, freqEnd: 50, duration: 0.30, type: 'sine', volume: 0.5, startAt: 0.30 });
            return;
        }
        if (comboCount >= 100) {
            // 5음 상승 화음 + chime (100 마일스톤)
            const notes = [523, 659, 784, 1047, 1319];   // C5→E6 상승
            notes.forEach((f, i) => {
                tone({ freq: f, duration: 0.09, type: 'square', volume: 0.75, startAt: i * 0.05 });
                tone({ freq: f * 2, duration: 0.05, type: 'sine', volume: 0.3, startAt: i * 0.05 + 0.02 });
            });
            return;
        }
        if (comboCount >= 75) {
            // 4음 + 살짝 더 화려 (5도 화음)
            const freqs = [800, 1000, 1300, 1700];
            freqs.forEach((f, i) => {
                tone({ freq: f, duration: 0.08, type: 'square', volume: 0.7, startAt: i * 0.06 });
                tone({ freq: f * 1.5, duration: 0.06, type: 'sine', volume: 0.25, startAt: i * 0.06 });
            });
            return;
        }
        if (comboCount >= 50) {
            // 4음 "삐삐삐빅!" (기존)
            const freqs = [800, 1000, 1200, 1500];
            freqs.forEach((f, i) => {
                tone({ freq: f, duration: 0.07, type: 'square', volume: 0.7, startAt: i * 0.06 });
            });
            return;
        }
        if (comboCount >= 40) {
            // 3음 강조 (50 직전 빌드업)
            const freqs = [700, 950, 1200];
            freqs.forEach((f, i) => {
                tone({ freq: f, duration: 0.07, type: 'square', volume: 0.6, startAt: i * 0.06 });
            });
            return;
        }
        if (comboCount >= 30) {
            // 3음 "삐삐빅" (기존)
            const freqs = [800, 1000, 1300];
            freqs.forEach((f, i) => {
                tone({ freq: f, duration: 0.07, type: 'square', volume: 0.5, startAt: i * 0.06 });
            });
            return;
        }
        if (comboCount >= 20) {
            // 2음 강조 (30 직전 빌드업)
            tone({ freq: 700, duration: 0.07, type: 'square', volume: 0.45 });
            tone({ freq: 950, duration: 0.07, type: 'square', volume: 0.45, startAt: 0.06 });
            return;
        }
        if (comboCount >= 10) {
            // 2음 "삐빅" (기존)
            tone({ freq: 800,  duration: 0.07, type: 'square', volume: 0.4 });
            tone({ freq: 1100, duration: 0.07, type: 'square', volume: 0.4, startAt: 0.06 });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6) 코믹 이벤트 NPC별 사운드
    // npcType: 'foreman' | 'pe_teacher' | 'security' | 'sauna_owner' | 'military' | 'fans'
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playComicEventSound(npcType) {
        if (sfxState.muted) return;

        switch (npcType) {
            case 'foreman':
                // 감리사: 800 → 300Hz 하강 경보음
                tone({
                    freq: 800, freqEnd: 300, duration: 0.5,
                    type: 'sawtooth', volume: 0.5
                });
                break;

            case 'pe_teacher':
                // 체육선생님: 1200Hz 진동 호루라기
                vibratoTone({
                    baseFreq: 1200, vibratoFreq: 28, vibratoDepth: 80,
                    duration: 0.30, type: 'sawtooth', volume: 0.5
                });
                break;

            case 'security':
                // 경비 아저씨: 1000Hz '삐빅' 짧고 날카로움
                tone({ freq: 1000, duration: 0.07, type: 'square', volume: 0.5 });
                tone({ freq: 1300, duration: 0.07, type: 'square', volume: 0.5, startAt: 0.10 });
                break;

            case 'sauna_owner':
                // 찜질방 사장님: 200Hz 진동 위협적
                vibratoTone({
                    baseFreq: 200, vibratoFreq: 12, vibratoDepth: 30,
                    duration: 0.40, type: 'sawtooth', volume: 0.6
                });
                break;

            case 'military':
                // 훈련교관: 300→500→400Hz 군대 나팔
                tone({ freq: 300, duration: 0.18, type: 'sawtooth', volume: 0.5 });
                tone({ freq: 500, duration: 0.18, type: 'sawtooth', volume: 0.6, startAt: 0.18 });
                tone({ freq: 400, duration: 0.24, type: 'sawtooth', volume: 0.55, startAt: 0.36 });
                // 5도 화음 추가 (나팔 느낌)
                tone({ freq: 600, duration: 0.18, type: 'sine', volume: 0.25, startAt: 0.18 });
                break;

            case 'fans':
                // 팬덤: 800+1000+1200Hz 화음 흥분
                tone({ freq: 800,  duration: 0.40, type: 'square',   volume: 0.4 });
                tone({ freq: 1000, duration: 0.40, type: 'square',   volume: 0.4 });
                tone({ freq: 1200, duration: 0.40, type: 'square',   volume: 0.4 });
                tone({ freq: 1600, duration: 0.40, type: 'triangle', volume: 0.2 });  // 옥타브 더
                break;
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 7) 오프라인 보상 팝업 - 잠에서 깨는 하품
    // 200 → 600 → 300Hz 주파수 라운드트립
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playOfflineRewardSound() {
        if (sfxState.muted) return;
        const ctx = ensureCtx();
        if (!ctx) return;
        const t0 = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        // 3단계 주파수 라운드트립 (200 → 600 → 300)
        osc.frequency.setValueAtTime(200, t0);
        osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.40);
        osc.frequency.exponentialRampToValueAtTime(300, t0 + 0.80);

        const peak = masterVol() * 0.6;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(peak, t0 + 0.05);
        gain.gain.linearRampToValueAtTime(peak, t0 + 0.55);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.80);

        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.85);

        // 살짝 화음 (5도 위)
        tone({ freq: 300, freqEnd: 450, duration: 0.6, type: 'triangle', volume: 0.18, startAt: 0.1 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 8) 삽 업그레이드 - "쾅!" + 상승음
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playUpgradeSound() {
        if (sfxState.muted) return;
        // 임팩트 (낮은 노이즈 + 100Hz 둔탁한 톤)
        noise({ duration: 0.10, volume: 0.7 });
        tone({ freq: 100, freqEnd: 60, duration: 0.10, type: 'sawtooth', volume: 0.5 });

        // 상승음 (300 → 900Hz 메인)
        tone({ freq: 300, freqEnd: 900, duration: 0.40, type: 'sawtooth', volume: 0.55, startAt: 0.05 });
        // 옥타브 위 (밝은 광채)
        tone({ freq: 600, freqEnd: 1800, duration: 0.40, type: 'sine', volume: 0.25, startAt: 0.05 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 9) 랜덤 장애물 등장 - "두두둥!" 거친 위협음 (사용자: 더 거칠게)
    //   sawtooth 트리플 디센드 + 두꺼운 노이즈 + 깊은 sub-boom
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playObstacleAppearSound() {
        if (sfxState.muted) return;
        // 거친 sawtooth 트리플 디센드 (500→100Hz, 위협감 증폭)
        tone({ freq: 600, freqEnd: 250, duration: 0.18, type: 'sawtooth', volume: 0.7 });
        tone({ freq: 400, freqEnd: 150, duration: 0.22, type: 'sawtooth', volume: 0.7, startAt: 0.12 });
        tone({ freq: 280, freqEnd: 80,  duration: 0.32, type: 'sawtooth', volume: 0.75, startAt: 0.26 });
        // 깊은 sub-boom (가슴 울림)
        tone({ freq: 70,  freqEnd: 35, duration: 0.55, type: 'sine', volume: 0.6 });
        // 두꺼운 노이즈 (등장 임팩트)
        noise({ duration: 0.30, volume: 0.95 });
        noise({ duration: 0.18, volume: 0.7, startAt: 0.20 });
    }

    // 10) 장애물 부수기 진행 (탭마다) - 타입별 거친 사운드 (사용자: 뿅뿅 X, 다 다르게)
    //   각 obstacle type별로 음색/주파수/노이즈 비율 차등 → 명확히 다른 질감
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playObstacleHitSound(type = 'rock') {
        if (sfxState.muted) return;
        switch (type) {
            case 'rock':    this._hitRock();    break;
            case 'bone':    this._hitBone();    break;
            case 'root':    this._hitRoot();    break;
            case 'ice':     this._hitIce();     break;
            case 'iron':    this._hitIron();    break;
            case 'skull':   this._hitSkull();   break;
            case 'pot':     this._hitPot();     break;
            case 'crystal': this._hitCrystal(); break;
            default:        this._hitRock();    break;
        }
    }

    // 바위: 깊은 sub-boom + 거친 노이즈 + 둔탁한 sawtooth (쾅! 콱!)
    _hitRock() {
        tone({ freq: 220, freqEnd: 70,  duration: 0.18, type: 'sawtooth', volume: 1.0 });
        tone({ freq: 55,  freqEnd: 28,  duration: 0.28, type: 'sine',     volume: 0.85 });
        noise({ duration: 0.16, volume: 1.0 });
        noise({ duration: 0.08, volume: 0.7, startAt: 0.06 });
    }

    // 뼈: 마른 hollow crack + dry clatter (텅! 따악!)
    _hitBone() {
        // hollow square 크랙
        tone({ freq: 380, freqEnd: 180, duration: 0.10, type: 'square',   volume: 0.85 });
        // 두번째 짧은 크랙 (뼈 갈라지는 느낌)
        tone({ freq: 520, freqEnd: 240, duration: 0.07, type: 'square',   volume: 0.7, startAt: 0.05 });
        // 살짝 딜레이로 더 갈라짐
        tone({ freq: 700, freqEnd: 320, duration: 0.06, type: 'triangle', volume: 0.5, startAt: 0.10 });
        // 마른 노이즈 (먼지 + 갈라짐)
        noise({ duration: 0.14, volume: 0.85 });
    }

    // 뿌리: 끊어지는 wood tear + 둔탁한 thump (뚝! 콰직!)
    _hitRoot() {
        // 뿌리 끊김 - 빠른 디센드 sawtooth (찢어짐)
        tone({ freq: 320, freqEnd: 80,  duration: 0.22, type: 'sawtooth', volume: 0.95 });
        // 저역 thump
        tone({ freq: 90,  freqEnd: 50,  duration: 0.18, type: 'sine',     volume: 0.7 });
        // 갈라지는 거친 노이즈 (긴 꼬리)
        noise({ duration: 0.22, volume: 0.95 });
    }

    // 얼음: 날카로운 shatter + glassy crackle (쩌적! 차각!)
    _hitIce() {
        // 고역 square shatter
        tone({ freq: 2800, freqEnd: 1200, duration: 0.10, type: 'square',   volume: 0.7 });
        tone({ freq: 3400, freqEnd: 1800, duration: 0.07, type: 'triangle', volume: 0.45, startAt: 0.04 });
        // 잔향 ring
        tone({ freq: 4200, freqEnd: 2500, duration: 0.12, type: 'sine',     volume: 0.30, startAt: 0.06 });
        // 짧고 날카로운 노이즈 (얼음 부서짐)
        noise({ duration: 0.06, volume: 0.85 });
        noise({ duration: 0.05, volume: 0.55, startAt: 0.05 });
    }

    // 철판: 무거운 metallic clang + 잔향 (창! 캉!)
    _hitIron() {
        // 메인 clang (날카로운 square)
        tone({ freq: 1600, freqEnd: 900, duration: 0.14, type: 'square',   volume: 0.9 });
        // 옥타브 위 sine 잔향 (금속 울림)
        tone({ freq: 3200, freqEnd: 2000, duration: 0.30, type: 'sine',    volume: 0.45, startAt: 0.02 });
        // 깊은 sub (무게감)
        tone({ freq: 100,  freqEnd: 50,  duration: 0.20, type: 'sine',     volume: 0.6 });
        // 짧은 노이즈
        noise({ duration: 0.06, volume: 0.7 });
    }

    // 두개골: 텅 빈 hollow boom + 짧은 크랙 (텅! 둑!)
    _hitSkull() {
        // 두꺼운 hollow sine
        tone({ freq: 180, freqEnd: 70,  duration: 0.22, type: 'sine',     volume: 0.95 });
        // 짧은 크랙 (square)
        tone({ freq: 600, freqEnd: 300, duration: 0.06, type: 'square',   volume: 0.55 });
        // 깊은 sub-boom (텅 빈 공명)
        tone({ freq: 80,  freqEnd: 40,  duration: 0.30, type: 'sine',     volume: 0.7 });
        // 마른 노이즈
        noise({ duration: 0.10, volume: 0.7 });
    }

    // 항아리: 도자기 산산조각 + 짤랑 (쨍그랑!)
    _hitPot() {
        // 도자기 깨짐 - 다중 고음 square (사방으로 튀는 느낌)
        tone({ freq: 1800, freqEnd: 900,  duration: 0.10, type: 'square',   volume: 0.7 });
        tone({ freq: 2400, freqEnd: 1500, duration: 0.08, type: 'triangle', volume: 0.55, startAt: 0.03 });
        tone({ freq: 1300, freqEnd: 700,  duration: 0.12, type: 'square',   volume: 0.5, startAt: 0.06 });
        // 흙 갈라짐 노이즈
        noise({ duration: 0.14, volume: 0.85 });
    }

    // 수정: 맑은 ring + 결정 부서짐 (찰랑! 챙!)
    _hitCrystal() {
        // 맑은 ring (sine + 5도 화음)
        tone({ freq: 2200, freqEnd: 1400, duration: 0.18, type: 'sine',     volume: 0.65 });
        tone({ freq: 3300, freqEnd: 2100, duration: 0.18, type: 'sine',     volume: 0.40 });
        // 결정 부서짐 square 잔향
        tone({ freq: 4400, freqEnd: 2800, duration: 0.10, type: 'triangle', volume: 0.30, startAt: 0.05 });
        // 짧고 거친 노이즈 (결정 갈라짐)
        noise({ duration: 0.05, volume: 0.7 });
    }

    // 11) 장애물 파괴 완료 - "빡! 쫙!! 콰광!" 강력 타격 (사장님 요청: 빡쫙 강력하게)
    //   - "빡" 초기 어택: 짧고 강한 square + 동시 white noise burst (한 방 임팩트)
    //   - "쫙" 균열: 두꺼운 sawtooth 디센드 + 거친 노이즈 (갈라지는 소리)
    //   - sub-boom: 깊은 저음 (땅 흔들림)
    //   - 잔향 노이즈: 잔해 흩어짐
    //   - 보너스 chime: 보물 확률 +20% 알림 (마지막)
    playObstacleBreakSound() {
        if (sfxState.muted) return;

        // ━━ "빡!" 초기 어택 (가장 강한 한 방, 0~60ms) ━━
        tone({ freq: 1200, freqEnd: 300, duration: 0.06, type: 'square',   volume: 1.0 });
        noise({ duration: 0.06, volume: 1.0 });

        // ━━ "쫙!!" 균열 (40~240ms) ━━
        tone({ freq: 500, freqEnd: 80,   duration: 0.22, type: 'sawtooth', volume: 1.0,  startAt: 0.04 });
        noise({ duration: 0.20, volume: 0.95, startAt: 0.05 });

        // ━━ sub-boom (땅 흔들림, 20~520ms) ━━
        tone({ freq: 80,  freqEnd: 25,   duration: 0.50, type: 'sine',     volume: 1.0,  startAt: 0.02 });
        tone({ freq: 50,  freqEnd: 20,   duration: 0.55, type: 'triangle', volume: 0.7,  startAt: 0.04 });

        // ━━ 잔향 노이즈 (잔해 흩어짐, 220~440ms) ━━
        noise({ duration: 0.22, volume: 0.6,  startAt: 0.22 });

        // ━━ 보너스 chime (보물 확률 +20% 알림, 440ms~) ━━
        tone({ freq: 800,  duration: 0.10, type: 'sine', volume: 0.5,  startAt: 0.44 });
        tone({ freq: 1200, duration: 0.18, type: 'sine', volume: 0.55, startAt: 0.54 });
        tone({ freq: 1600, duration: 0.22, type: 'sine', volume: 0.55, startAt: 0.64 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 12) 캐릭터 혼잣말 / 말풍선 효과음
    //   - 텍스트가 "타닥타닥" 읽는 느낌의 짧은 톤 3연타
    //   - 800/900/1000Hz 살짝 다른 피치로 자연스러움
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playSpeechBubbleSound() {
        if (sfxState.muted) return;
        const freqs = [800, 950, 880];
        freqs.forEach((f, i) => {
            tone({
                freq: f,
                duration: 0.05,
                type: 'sine',
                volume: 0.25,
                startAt: i * 0.06
            });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 13) 보물 발견 직전 두근두근 (heartbeat)
    //   - 80Hz × 2회 빠른 펄스 (실제 심장박동 리듬)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playHeartbeatSound() {
        if (sfxState.muted) return;
        // 두근 (강)
        tone({ freq: 90, freqEnd: 60, duration: 0.10, type: 'sine', volume: 0.85, startAt: 0.00 });
        // 두근 (약)
        tone({ freq: 70, freqEnd: 50, duration: 0.09, type: 'sine', volume: 0.55, startAt: 0.13 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 14) "대박!!!" 멜로디 (legendary 보물 전용 짧은 승리 BGM)
    //   - C5 → E5 → G5 → C6 (도-미-솔-도) 상승 화음 + 마지막 길게
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playJackpotMelody() {
        if (sfxState.muted) return;
        const notes = [
            { f: 523, t: 0.00, d: 0.12 },   // C5 도
            { f: 659, t: 0.10, d: 0.12 },   // E5 미
            { f: 784, t: 0.20, d: 0.12 },   // G5 솔
            { f: 1047, t: 0.30, d: 0.45 }   // C6 도 (길게)
        ];
        notes.forEach(n => {
            tone({ freq: n.f, duration: n.d, type: 'square',   volume: 0.55, startAt: n.t });
            tone({ freq: n.f * 1.5, duration: n.d, type: 'sine', volume: 0.25, startAt: n.t });  // 5도 화음
        });
        // 피날레 sparkle (1568Hz = G6)
        tone({ freq: 1568, duration: 0.6, type: 'sine', volume: 0.35, startAt: 0.50 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 15) 번아웃 신음 (SOUL-OUT 0% 도달)
    //   - 200→80Hz 길게 떨어지는 sawtooth (피로감)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playBurnoutSound() {
        if (sfxState.muted) return;
        tone({ freq: 200, freqEnd: 80, duration: 0.80, type: 'sawtooth', volume: 0.5 });
        tone({ freq: 100, freqEnd: 50, duration: 0.80, type: 'sine',     volume: 0.4 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 16-b) 잔상 플래시 (foreshadow) - 미스터리한 약한 종소리
    //   초기 레이어에서 1.5% 확률로 발생. "어? 방금 뭐였지?" 잔상감 유발용.
    //   3음 짧은 사인 화음으로 띵~ (코인보다 어둡고 잔향)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playForeshadowChime() {
        if (sfxState.muted) return;
        // 어두운 base + 5도 위 + 옥타브 위 (살짝 비어있는 느낌)
        tone({ freq: 660, duration: 0.45, type: 'sine', volume: 0.30 });
        tone({ freq: 990, duration: 0.45, type: 'sine', volume: 0.20, startAt: 0.02 });
        tone({ freq: 1320, duration: 0.50, type: 'sine', volume: 0.12, startAt: 0.05 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 16-c) 다음 레이어 프리뷰 - 부드러운 "다음으로~" 상승 화음
    //   레이어 클리어 후 1초 동안 다음 배경을 살짝 비추며 동시에 재생
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playLayerPreviewSound() {
        if (sfxState.muted) return;
        const notes = [523, 659, 784, 988];   // C5 → E5 → G5 → B5 (꿈결 같은 상승)
        notes.forEach((f, i) => {
            tone({ freq: f, duration: 0.40, type: 'sine',     volume: 0.35, startAt: i * 0.10 });
            tone({ freq: f * 2, duration: 0.40, type: 'sine', volume: 0.18, startAt: i * 0.10 });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 17) 에너지 드링크 캐치 - "꿀꺽! 두근!" (등급별 화려)
    //   common: 짧은 꿀꺽 1번
    //   rare: 꿀꺽 + 짧은 chime
    //   epic: 꿀꺽 + 상승 3음
    //   legendary: 꿀꺽 + 상승 4음 + 5도 화음
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playDrinkCatchSound(rarity = 'common') {
        if (sfxState.muted) return;
        // "꿀꺽" - 낮은 sine 빠른 디센드 + 노이즈 살짝
        tone({ freq: 350, freqEnd: 120, duration: 0.18, type: 'sine', volume: 0.6 });
        noise({ duration: 0.06, volume: 0.4, startAt: 0.05 });

        // 등급별 chime 추가
        if (rarity === 'common') {
            tone({ freq: 700, duration: 0.18, type: 'sine', volume: 0.45, startAt: 0.18 });
        } else if (rarity === 'rare') {
            tone({ freq: 700,  duration: 0.10, type: 'sine', volume: 0.45, startAt: 0.18 });
            tone({ freq: 1050, duration: 0.20, type: 'sine', volume: 0.45, startAt: 0.26 });
        } else if (rarity === 'epic') {
            const f = [600, 900, 1200];
            f.forEach((fr, i) => {
                tone({ freq: fr, duration: 0.16, type: 'sine', volume: 0.55, startAt: 0.18 + i * 0.08 });
                tone({ freq: fr * 1.5, duration: 0.16, type: 'sine', volume: 0.25, startAt: 0.18 + i * 0.08 });
            });
        } else { // legendary
            const f = [400, 600, 900, 1200];
            f.forEach((fr, i) => {
                tone({ freq: fr,       duration: 0.18, type: 'sine', volume: 0.55, startAt: 0.18 + i * 0.08 });
                tone({ freq: fr * 1.5, duration: 0.18, type: 'sine', volume: 0.30, startAt: 0.18 + i * 0.08 });
                tone({ freq: fr * 2,   duration: 0.18, type: 'sine', volume: 0.18, startAt: 0.18 + i * 0.08 });
            });
            // 마무리 sparkle
            tone({ freq: 1800, duration: 0.4, type: 'sine', volume: 0.35, startAt: 0.55 });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 18) 기상 악화 (rain/snow/typhoon) - 12초간 분위기 사운드 + 시작 임팩트
    //   playOnce 형식: 시작 임팩트 + 짧은 ambient 흉내
    //   rain: 잔잔한 노이즈
    //   snow: 휘이잉 vibrato
    //   typhoon: 깊은 boom + 강한 wind noise
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playWeatherSound(type) {
        if (sfxState.muted) return;
        if (type === 'rain') {
            // 천둥 임팩트
            tone({ freq: 80, freqEnd: 35, duration: 0.6, type: 'sine', volume: 0.6 });
            noise({ duration: 0.5, volume: 0.7 });
            // 빗소리 흉내 (3번 분산 노이즈)
            noise({ duration: 0.8, volume: 0.4, startAt: 0.6 });
            noise({ duration: 1.0, volume: 0.35, startAt: 1.4 });
            noise({ duration: 1.2, volume: 0.30, startAt: 2.4 });
        } else if (type === 'snow') {
            // 휘이잉 - 낮은 vibrato (찬 바람)
            vibratoTone({
                baseFreq: 220, vibratoFreq: 5, vibratoDepth: 80,
                duration: 1.6, type: 'sine', volume: 0.45
            });
            // 두번째 휘이잉 (잔향)
            vibratoTone({
                baseFreq: 180, vibratoFreq: 4, vibratoDepth: 60,
                duration: 1.2, type: 'sine', volume: 0.30, startAt: 1.4
            });
        } else if (type === 'typhoon') {
            // 깊은 sub-boom (위협)
            tone({ freq: 60, freqEnd: 30, duration: 1.2, type: 'sawtooth', volume: 0.65 });
            // 강한 vibrato (포효)
            vibratoTone({
                baseFreq: 300, vibratoFreq: 12, vibratoDepth: 150,
                duration: 1.4, type: 'sawtooth', volume: 0.5, startAt: 0.2
            });
            // 거친 노이즈 (강풍)
            noise({ duration: 1.0, volume: 0.85 });
            noise({ duration: 0.8, volume: 0.6, startAt: 0.9 });
        }
    }

    // 16) SOUL-OUT 회복 완료 (다시 파기 시작)
    playSoulRecoverSound() {
        if (sfxState.muted) return;
        tone({ freq: 400, freqEnd: 800, duration: 0.20, type: 'sine', volume: 0.45 });
        tone({ freq: 600, freqEnd: 1200, duration: 0.22, type: 'sine', volume: 0.30, startAt: 0.05 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 햅틱 (SFX 음소거 시 함께 무음)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async triggerHaptic(intensity = 'light') {
        if (sfxState.muted) return;

        // Capacitor Haptics 우선
        if (HapticsApi && HapticsImpactStyle) {
            try {
                const styleMap = {
                    light: HapticsImpactStyle.Light,
                    medium: HapticsImpactStyle.Medium,
                    heavy: HapticsImpactStyle.Heavy
                };
                await HapticsApi.impact({ style: styleMap[intensity] || HapticsImpactStyle.Light });
                return;
            } catch (e) {
                // 폴백
            }
        }

        // 웹 폴백 (안드로이드 크롬 등) — 시간 ~70% 증가로 더 묵직한 진동
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            const durMap = { light: 60, medium: 120, heavy: 220 };
            navigator.vibrate(durMap[intensity] || 60);
        }
    }

    triggerComboHaptic(comboCount) {
        if (comboCount >= 100)      this.triggerHaptic('heavy');
        else if (comboCount >= 50)  this.triggerHaptic('medium');
        else                        this.triggerHaptic('light');
    }

    triggerTreasureHaptic() {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100]);
        } else {
            this.triggerHaptic('heavy');
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BGM 관리 (Phaser 사운드 매니저 사용 - SFX와 별도 채널)
    // 효과음(Web Audio API 합성)과 동시 재생 가능
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    get isBGMMuted() { return bgmState.muted; }

    playBGM(key) {
        if (!this.scene || !this.scene.sound) return;
        if (!key) return;

        // 같은 BGM 중복 재생 방지
        if (bgmState.currentKey === key &&
            bgmState.currentBgm &&
            bgmState.currentBgm.isPlaying) {
            return;
        }

        bgmState.currentKey = key;

        if (bgmState.muted) {
            this._stopBGMNow();
            return;
        }

        if (!this.scene.cache.audio.exists(key)) {
            console.warn(`[BGM] 캐시에 ${key} 없음 - 재생 스킵`);
            return;
        }

        // 기존 BGM 페이드아웃
        if (bgmState.currentBgm && bgmState.currentBgm.isPlaying) {
            const oldBgm = bgmState.currentBgm;
            try {
                this.scene.tweens.add({
                    targets: oldBgm,
                    volume: 0,
                    duration: BGM_FADE_DURATION,
                    onComplete: () => {
                        try { oldBgm.stop(); oldBgm.destroy(); } catch (e) {}
                    }
                });
            } catch (e) {
                try { oldBgm.stop(); oldBgm.destroy(); } catch (e2) {}
            }
        }

        // 새 BGM 페이드인
        try {
            const sound = this.scene.sound.add(key, { loop: true, volume: 0 });
            sound.play();
            bgmState.currentBgm = sound;

            this.scene.tweens.add({
                targets: sound,
                volume: bgmState.volume,
                duration: BGM_FADE_DURATION
            });
        } catch (e) {
            console.warn('[BGM] 재생 실패:', e);
        }
    }

    stopBGM() {
        if (!bgmState.currentBgm) return;
        if (!this.scene || !this.scene.sound) return;

        const sound = bgmState.currentBgm;
        bgmState.currentBgm = null;

        try {
            this.scene.tweens.add({
                targets: sound,
                volume: 0,
                duration: BGM_FADE_DURATION,
                onComplete: () => {
                    try { sound.stop(); sound.destroy(); } catch (e) {}
                }
            });
        } catch (e) {
            try { sound.stop(); sound.destroy(); } catch (e2) {}
        }
    }

    _stopBGMNow() {
        if (!bgmState.currentBgm) return;
        try {
            bgmState.currentBgm.stop();
            bgmState.currentBgm.destroy();
        } catch (e) {}
        bgmState.currentBgm = null;
    }

    setBGMVolume(vol) {
        bgmState.volume = Math.max(0, Math.min(1, vol));
        if (bgmState.currentBgm && !bgmState.muted) {
            try { bgmState.currentBgm.setVolume(bgmState.volume); } catch (e) {}
        }
    }

    toggleBGM() {
        bgmState.muted = !bgmState.muted;
        try {
            localStorage.setItem(BGM_STORAGE_KEY, bgmState.muted ? '1' : '0');
        } catch (e) {}

        if (bgmState.muted) {
            this._stopBGMNow();
        } else if (bgmState.currentKey) {
            this.playBGM(bgmState.currentKey);
        }
        return bgmState.muted;
    }
}
