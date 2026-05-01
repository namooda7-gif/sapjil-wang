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

// 삽질 효과음 - 톤 + 노이즈 임팩트 (CLAUDE.md: 흙=뚝 / 모래=사르르 / 돌=깡 / 등)
const SOIL_DIG_CONFIG = {
    dirt:     { freq: 80,  freqEnd: 50,  duration: 0.15, oscType: 'sine',     noise: 0.5,  noiseDur: 0.05 },
    sand:     { freq: 200, freqEnd: 180, duration: 0.20, oscType: 'triangle', noise: 0.85, noiseDur: 0.14 },
    tile:     { freq: 800, freqEnd: 600, duration: 0.08, oscType: 'square',   noise: 0.18, noiseDur: 0.02 },
    rock:     { freq: 50,  freqEnd: 30,  duration: 0.12, oscType: 'sine',     noise: 0.70, noiseDur: 0.04 },
    concrete: { freq: 180, freqEnd: 120, duration: 0.10, oscType: 'triangle', noise: 0.45, noiseDur: 0.04 },
    lava:     { freq: 65,  freqEnd: 40,  duration: 0.20, oscType: 'sine',     noise: 0.70, noiseDur: 0.10 }
};

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
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playDigSound(soilType) {
        if (sfxState.muted) return;
        const cfg = SOIL_DIG_CONFIG[soilType] || SOIL_DIG_CONFIG.dirt;
        // 톤 (낮은 임팩트)
        tone({
            freq: cfg.freq,
            freqEnd: cfg.freqEnd,
            duration: cfg.duration,
            type: cfg.oscType,
            volume: 0.7
        });
        // 노이즈 임팩트 (찰진 시작)
        if (cfg.noise > 0) {
            noise({ duration: cfg.noiseDur, volume: cfg.noise });
        }
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
    // 5) 콤보 달성 - 콤보 단계별 점점 화려
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    playComboSound(comboCount) {
        if (sfxState.muted) return;
        if (comboCount >= 50) {
            // 4음 "삐삐삐빅!" 볼륨 크게
            const freqs = [800, 1000, 1200, 1500];
            freqs.forEach((f, i) => {
                tone({
                    freq: f, duration: 0.07, type: 'square',
                    volume: 0.7, startAt: i * 0.06
                });
            });
        } else if (comboCount >= 30) {
            // 3음 "삐삐빅"
            const freqs = [800, 1000, 1300];
            freqs.forEach((f, i) => {
                tone({
                    freq: f, duration: 0.07, type: 'square',
                    volume: 0.5, startAt: i * 0.06
                });
            });
        } else if (comboCount >= 10) {
            // 2음 "삐빅"
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

        // 웹 폴백 (안드로이드 크롬 등)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            const durMap = { light: 30, medium: 60, heavy: 120 };
            navigator.vibrate(durMap[intensity] || 30);
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
