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
        this.load.image('char_001_nosebleed','assets/characters/char_001_nosebleed.png');

        // ━━━ 무료 캐릭터 char_002~006 idle만 부팅 시 로드 (lazy load 최적화) ━━━
        // 사장님 보고: 로딩 길어 첫 탭 안 눌림 → 부팅 자산 96MB(48장) → 28MB(14장)로 70% 감소
        // 나머지 7 상태(dig/combo/surprise/clear/tired/panic/dig_hard)는 GameScene 진입 시 lazy load
        // CharacterScene 카드 미리보기는 idle만 쓰니 부팅 시 idle만 있으면 충분
        for (let i = 2; i <= 6; i++) {
            const charId = `char_00${i}`;
            this.load.image(`${charId}_idle`, `assets/characters/${charId}_idle.png`);
        }

        // ━━━ 에너지 드링크 PNG 4종 (이모지 → PNG 교체, 인지도 강화) ━━━
        // 사장님 Gemini 워크플로 도착 (2026-05-10): 박카스/핫식스/레드불 패러디 + 황금 슈퍼
        // 미로드 시 launchDrinkFall에서 def.emoji 폴백
        ['drink_sapcas', 'drink_hotsaps', 'drink_redsap', 'drink_energasap']
            .forEach(id => this.load.image(id, `assets/drinks/${id}.png`));

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

        // TODO: 유료 캐릭터 char_007~030, 효과음 (현재 SFX는 Web Audio API로 합성됨)

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

        // 추가 5종 (2026-05-07 명품 패러디: 굴찌/반지/에르삽/시계/술)
        ['t_002_08', 't_004_09', 't_004_10', 't_005_09', 't_005_10']
            .forEach(id => this.load.image(id, `assets/treasures/${id}.png`));

        // 추가 10종 (2026-05-08 layer_001 신규: 캔커피~환갑봉투, 제미나이 생성)
        ['t_001_09', 't_001_10', 't_001_11', 't_001_12', 't_001_13',
         't_001_14', 't_001_15', 't_001_16', 't_001_17', 't_001_18']
            .forEach(id => this.load.image(id, `assets/treasures/${id}.png`));

        // 추가 52종 (2026-05-08 layer_002~006 신규, 제미나이 생성)
        // - 2026-05-10: 재생성 배치(new/) 받아 덮어씀 → 깨졌던 t_002_12 / t_004_19 / t_005_14도 활성화
        [
            // layer_002 (10종 전부)
            't_002_09','t_002_10','t_002_11','t_002_12','t_002_13','t_002_14','t_002_15','t_002_16','t_002_17','t_002_18',
            // layer_003 (11종 전부)
            't_003_09','t_003_10','t_003_11','t_003_12','t_003_13','t_003_14','t_003_15','t_003_16','t_003_17','t_003_18','t_003_19',
            // layer_004 (10종 전부)
            't_004_11','t_004_12','t_004_13','t_004_14','t_004_15','t_004_16','t_004_17','t_004_18','t_004_19','t_004_20',
            // layer_005 (9종, t_005_15 부모 통화 메모지 검수 탈락 삭제)
            't_005_11','t_005_12','t_005_13','t_005_14','t_005_16','t_005_17','t_005_18','t_005_19','t_005_20',
            // layer_006 (11종 전부)
            't_006_07','t_006_10','t_006_11','t_006_12','t_006_13','t_006_14','t_006_15','t_006_16','t_006_17','t_006_18','t_006_19'
        ].forEach(id => this.load.image(id, `assets/treasures/${id}.png`));
    }

    create() {
        // 부팅 완료 → 메인 메뉴로 전환
        this.scene.start('MenuScene');
    }
}
