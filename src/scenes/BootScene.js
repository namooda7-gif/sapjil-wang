// 부팅 씬 - 에셋 프리로드 및 초기화 담당
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // 로딩 진행률 바 (실제 에셋이 들어오면 자연스럽게 동작)
        const { width, height } = this.cameras.main;

        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const progressBar = this.add.graphics();

        const loadingText = this.add.text(width / 2, height / 2 - 60, '삽질왕 로딩 중...', {
            font: '24px sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffd700, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });

        // ━━━ 캐릭터 이미지 ━━━
        // 박삽돌 (char_001) - 8종 상태 이미지
        //   기본 5종: idle / dig / combo / surprise / clear
        //   추가 3종: tired (SOUL<40 지침) / panic (NPC 등장) / dig_hard (돌·타일 강타)
        this.load.image('char_001_idle',     'assets/characters/char_001_idle.png');
        this.load.image('char_001_dig',      'assets/characters/char_001_dig.png');
        this.load.image('char_001_combo',    'assets/characters/char_001_combo.png');
        this.load.image('char_001_surprise', 'assets/characters/char_001_surprise.png');
        this.load.image('char_001_clear',    'assets/characters/char_001_clear.png');
        this.load.image('char_001_tired',    'assets/characters/char_001_tired.png');
        this.load.image('char_001_panic',    'assets/characters/char_001_panic.png');
        this.load.image('char_001_dig_hard', 'assets/characters/char_001_dig_hard.png');

        // ━━━ 흙더미 이미지 (오른쪽용 1장 → 왼쪽은 flipX로 재활용) ━━━
        this.load.image('mound_right', 'assets/mound_right.png');

        // ━━━ 구덩이 이미지 (U자형 단면 - 캐릭터 발 아래 배치) ━━━
        this.load.image('hole', 'assets/hole.png');

        // ━━━ 레이어 배경 이미지 (한국 레이어 6종, 720×2580 jpg) ━━━
        // 키 규칙: ${layer.id}_bg → 'layer_001_bg' ... 'layer_006_bg'
        this.load.image('layer_001_bg', 'assets/layers/layer_001_bg.jpg');
        this.load.image('layer_002_bg', 'assets/layers/layer_002_bg.jpg');
        this.load.image('layer_003_bg', 'assets/layers/layer_003_bg.jpg');
        this.load.image('layer_004_bg', 'assets/layers/layer_004_bg.jpg');
        this.load.image('layer_005_bg', 'assets/layers/layer_005_bg.jpg');
        this.load.image('layer_006_bg', 'assets/layers/layer_006_bg.jpg');

        // ━━━ 배경음악(BGM) - 메뉴 1개 + 레이어 6개 ━━━
        // 파일이 누락돼도 Phaser는 fileerror 이벤트만 발생, throw 안 함 → 안전
        this.load.audio('bgm_menu',     'assets/sounds/bgm/bgm_menu.mp3');
        this.load.audio('bgm_layer001', 'assets/sounds/bgm/bgm_layer001.mp3');
        this.load.audio('bgm_layer002', 'assets/sounds/bgm/bgm_layer002.mp3');
        this.load.audio('bgm_layer003', 'assets/sounds/bgm/bgm_layer003.mp3');
        this.load.audio('bgm_layer004', 'assets/sounds/bgm/bgm_layer004.mp3');
        this.load.audio('bgm_layer005', 'assets/sounds/bgm/bgm_layer005.mp3');
        this.load.audio('bgm_layer006', 'assets/sounds/bgm/bgm_layer006.mp3');

        // 누락된 에셋이 있어도 무시하고 넘어감 (조용히 fail)
        // - audio: BGM 누락 → 무음
        // - image: 보물/캐릭터 누락 → 호출 측 textures.exists 체크로 emoji fallback
        this.load.on('fileerror', (file) => {
            if (file.type === 'audio') {
                console.warn(`[BGM] 파일 로드 실패: ${file.key} (${file.src}) - 무시하고 진행`);
            } else if (file.type === 'image') {
                console.warn(`[Image] 파일 로드 실패: ${file.key} (${file.src}) - emoji fallback 사용`);
            }
        });

        // TODO: 다른 캐릭터(char_002~030), 효과음 (현재 SFX는 Web Audio API로 합성됨)

        // ━━━ 보물 이미지 (기존 42종 + 추가 6종 = 48종) ━━━
        // 파일 규칙: t_LLL_NN.png
        // 기존 42종 (각 layer 1~7번)
        for (let L = 1; L <= 6; L++) {
            const layerPad = String(L).padStart(3, '0');
            for (let N = 1; N <= 7; N++) {
                const itemPad = String(N).padStart(2, '0');
                const id = `t_${layerPad}_${itemPad}`;
                this.load.image(id, `assets/treasures/${id}.png`);
            }
        }
        // 추가 6종 (2026-05-07 신규: 금덩어리/복권/루이뷔돌/금괴/달러/샵넬)
        ['t_001_08', 't_003_08', 't_004_08', 't_005_08', 't_006_08', 't_006_09']
            .forEach(id => this.load.image(id, `assets/treasures/${id}.png`));
    }

    create() {
        // 부팅 완료 → 메인 메뉴로 전환
        this.scene.start('MenuScene');
    }
}
