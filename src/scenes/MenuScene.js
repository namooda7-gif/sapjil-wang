// 메인 메뉴 씬 (대규모 업데이트 — 첫 진입 임팩트 강화)
//   #1 발 밑 보물 티징    : 화면 하단에 살짝 빛나는 보물 1개로 호기심 유발
//   #2 카피 수정          : "삽질하러 가기 →" 메인 라벨 (직관 강화)
//   #3 캐릭터 터치 반응   : 박삽돌 찌르면 라인 순환 + 깜짝 흔들림
//   #5 타이틀 숨쉬기/후광  : scale + alpha 펄스
//   #5 흙먼지 파티클       : 화면 전체 미세 입자 6~8개
//   #6 시작 버튼 펄스+👆  : 시작 버튼 1.05x 펄스 + 옆에 흔드는 손 이모지
//   #7 재화 카운터        : 상단 중앙 (재진입 유저만)
//   #8 신규/재진입 분기   : 첫 진입 시 [삽질하러 가기]만, 재진입은 풀 메뉴
import Phaser from 'phaser';
import CurrencyManager from '../managers/CurrencyManager.js';
import OfflineRewardManager from '../managers/OfflineRewardManager.js';
import AttendanceManager from '../managers/AttendanceManager.js';
import AutoDigManager from '../managers/AutoDigManager.js';
import SoundManager from '../managers/SoundManager.js';

// 캐릭터 터치 시 순환 라인 (인덱스 0은 초기 말풍선과 동일)
const CHARACTER_TAP_LINES = [
    '...번아웃...',
    '앗! 사장님?!',
    '뼈 빠지게 파는 중...',
    '월급은 언제...',
    '이게 내 인생인가...',
    '사람 살려...'
];

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // 입력 우선순위: 가장 위 인터랙티브 요소만 받음 (depth 충돌 시 시작 버튼 우선)
        // Phaser 기본값이지만 첫 탭 무반응 보고 받고 명시 — 일부 빌드에서 false로 바뀐 흔적 방지
        this.input.setTopOnly(true);

        // ━━━━ 배경 + 어두운 오버레이 ━━━━
        if (this.textures.exists('layer_001_bg')) {
            const bg = this.add.image(width / 2, height / 2, 'layer_001_bg').setOrigin(0.5);
            const sw = bg.width, sh = bg.height;
            if (sw && sh) bg.setScale(Math.max(width / sw, height / sh));
        } else {
            this.add.rectangle(width / 2, height / 2, width, height, 0x5a2d0c);
        }
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45);

        // ━━━━ 무거운 파티클 시스템은 250ms 지연 → 시작 버튼 input 즉시 받음 ━━━━
        // 사장님 보고: 로딩 직후 시작 버튼 무반응, 시간 지나면 부분 작동 = 메인 스레드 블록
        // 파티클 emitter 2개(treasureTease 글로우, dust)는 무거워 input 처리 지연 유발
        // 250ms 후 백그라운드 추가 (시각 효과 살짝 늦지만 input 우선 보장)
        this.time.delayedCall(250, () => {
            if (!this.scene || !this.scene.isActive('MenuScene')) return;
            this.createTreasureTease(width, height);
            this.createDustParticles(width, height);
        });

        // ━━━━ 사용자 상태 (신규 vs 재진입) ━━━━
        this.currencyManager = new CurrencyManager();
        // STEP5: 오프라인 보상이 인부 자동수입 기반이 되도록 AutoDigManager 주입
        this.autoDigManager = new AutoDigManager(this.currencyManager);
        this.offlineRewardManager = new OfflineRewardManager(this.currencyManager, this.autoDigManager);
        const cm = this.currencyManager;
        const isFirstTime =
            this.offlineRewardManager.lastSeenTime === null &&
            cm.coin === 0 && cm.diamond === 0 && cm.relic === 0;
        this.isFirstTime = isFirstTime;

        // ━━━━ #7 상단 재화 카운터 (재진입 유저만) ━━━━
        if (!isFirstTime) this.createCurrencyHUD(width);

        // ━━━━ #5 타이틀 (숨쉬기 + 후광 펄스) ━━━━
        this.createBreathingTitle(width / 2, height * 0.25);

        // ━━━━ #3 박삽돌 - 터치 인터랙션 ━━━━
        this.createInteractiveCharacter(width, height);

        // ━━━━ #2/#6/#8 좌측 버튼 (신규는 시작만, 재진입은 4개) ━━━━
        this.createMenuButtons(width, height, isFirstTime);

        // ━━━━ #4 메뉴 임팩트 (번쩍번쩍 첫 인상) ━━━━
        //   dbe1bfe 커밋 8개 패키지 중 누락됐던 #4 자리 (2026-05-07 보강)
        //   - 황금 fadeFrom: 메뉴가 황금색에서 떠오르는 영화 같은 진입
        //   - createTitleSparkles: 타이틀 주변 황금 별 파티클 지속 발사
        //   "번쩍번쩍"이지 "정신없음"은 아님 — 효과 2개 이내로 절제
        this.cameras.main.fadeFrom(600, 255, 215, 0, true);
        // sparkle 파티클도 지연 (무거운 작업 → input 우선 보장)
        this.time.delayedCall(250, () => {
            if (!this.scene || !this.scene.isActive('MenuScene')) return;
            this.createTitleSparkles(width / 2, height * 0.25);
        });

        // ━━━━ BGM 시스템 + 오프라인 보상 ━━━━
        this.soundManager = new SoundManager(this);
        this.soundManager.playBGM('bgm_menu');
        this.createBGMToggleButton(width - 60, 60);

        // ━━━━ 출석 보상 매니저 (자동 팝업 비활성화 — 사장님 피드백: 시작 버튼 가려서 어색) ━━━━
        // 메뉴 진입 시 자동으로 안 뜨고, 우상단 🎁 버튼 누를 때만 노출
        // 오프라인 보상도 같은 패턴 (자동 X, 버튼 누름 시 X)
        this.attendanceManager = new AttendanceManager(this.currencyManager);

        // 우상단 🎁 보상 버튼 — 출석 가능/오프라인 보상 있으면 빨간 점 알림
        this.createRewardButton(width - 60, 130);

        // 오프라인 보상은 markSeen만 처리 (자동 받기 X)
        // — 사장님이 🎁 버튼 누르면 그제야 보상 팝업 노출
        if (!this._beforeunloadHooked) {
            window.addEventListener('beforeunload', () => this.offlineRewardManager.markSeen());
            this._beforeunloadHooked = true;
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 우상단 🎁 보상 버튼 — 출석/오프라인 보상 모아 노출
    //   알림 점: 출석 가능 OR 오프라인 보상 있으면 빨간 점
    //   누름 시: 오프라인 보상 있으면 그것부터, 닫고 출석 가능하면 출석 팝업
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createRewardButton(x, y) {
        const hasOffline = this.offlineRewardManager.getPendingReward() > 0;
        const canAttend  = this.attendanceManager.canClaimToday();
        const hasAlert   = hasOffline || canAttend;

        // 원형 배경
        this.add.circle(x, y, 38, 0x000000, 0.75)
            .setStrokeStyle(3, 0xffd700).setDepth(50);

        // 🎁 아이콘
        const btn = this.add.text(x, y, '🎁', { font: '40px sans-serif' })
            .setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });

        // 빨간 점 (보상 있을 때)
        if (hasAlert) {
            const dot = this.add.circle(x + 22, y - 22, 9, 0xff3b30, 1)
                .setStrokeStyle(2, 0xffffff).setDepth(52);
            // 미세 펄스 (시선 끌기)
            this.tweens.add({
                targets: dot,
                scale: { from: 1.0, to: 1.25 },
                duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
        }

        // 클릭 — 오프라인 우선, 없으면 출석
        this.bindMobileClick(btn, () => {
            const offlineReward = this.offlineRewardManager.getPendingReward();
            if (offlineReward > 0) {
                this.soundManager.playOfflineRewardSound();
                this.showOfflineRewardPopup(
                    offlineReward, this.offlineRewardManager.formatElapsed(),
                    () => {
                        this.offlineRewardManager.claim();
                        this.time.delayedCall(350, () => {
                            if (this.attendanceManager.canClaimToday()) {
                                this.showAttendancePopup();
                            } else {
                                this.scene.restart();   // 알림 점 갱신
                            }
                        });
                    }
                );
            } else if (this.attendanceManager.canClaimToday()) {
                this.showAttendancePopup();
                // 받은 후 알림 점 갱신을 위해 잠깐 후 재시작 — showAttendancePopup의 closePopup에 묶이면 더 깔끔하지만 단순 처리
            } else {
                this.showComingSoonToast('받을 보상이 없어요');
            }
        }, {
            onPress:   () => btn.setAlpha(0.6),
            onRelease: () => btn.setAlpha(1)
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #1 발 밑 보물 티징
    //   화면 하단(y 92%)에 보물 이모지 1개 + 황금 후광이 천천히 깜빡
    //   "저 밑에 뭐가 있다" 호기심만 유발하고 클릭 X (메뉴 버튼과 분리)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createTreasureTease(width, height) {
        const x = width * 0.18;            // 화면 좌측 하단 - 캐릭터(우측)와 안 겹치게
        const y = height * 0.92;

        // 황금 후광 (반투명 원, 펄스)
        const glow = this.add.circle(x, y, 38, 0xffd700, 0.32).setDepth(1);
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.32, to: 0.65 },
            scale: { from: 1.0, to: 1.18 },
            duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });

        // 보물 이모지 (반쯤 흙에 묻힌 듯 살짝 회전)
        const treasure = this.add.text(x, y, '🏺', {
            font: '46px sans-serif'
        }).setOrigin(0.5).setDepth(2).setAngle(-12);
        // 매우 미세한 둥실 (흙에서 살짝 솟구치는 느낌)
        this.tweens.add({
            targets: treasure,
            y: y - 4,
            duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #5 흙먼지 미세 파티클 (저사양 친화 - 8개, alpha 0.3 미만)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createDustParticles(width, height) {
        // 점 텍스처 즉석 생성 (없으면)
        if (!this.textures.exists('__menuDust')) {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffe0a0, 1);
            g.fillCircle(2, 2, 2);
            g.generateTexture('__menuDust', 4, 4);
            g.destroy();
        }
        // 화면 전체에 천천히 떠다님 (frequency 700ms = 입자 빈도 매우 낮음)
        this.add.particles(0, 0, '__menuDust', {
            x: { min: 0, max: width },
            y: height + 10,                                         // 아래에서 위로
            speedY: { min: -22, max: -10 },
            speedX: { min: -8, max: 8 },
            lifespan: 8000,
            scale:  { start: 0.8, end: 0.5 },
            alpha:  { start: 0.28, end: 0 },
            frequency: 700,                                         // 0.7초마다 1개
            quantity: 1
        }).setDepth(2);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #7 상단 재화 카운터 (재진입 유저만 노출, 신규는 0/0/0이라 부담)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createCurrencyHUD(width) {
        const cm = this.currencyManager;
        const txt = `🪙 ${cm.coin.toLocaleString()}    💎 ${cm.diamond}    🏺 ${cm.relic}`;
        const hud = this.add.text(width / 2, 60, txt, {
            font: 'bold 22px sans-serif',
            color: '#ffd700',
            stroke: '#000', strokeThickness: 4,
            backgroundColor: '#00000099',
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setDepth(15);
        // 살짝 페이드인
        hud.setAlpha(0);
        this.tweens.add({ targets: hud, alpha: 1, duration: 400, delay: 200 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #5 타이틀 (숨쉬기 scale + 후광 alpha 펄스)
    //   기존 둥실둥실(y) 유지 + scale + 별도 glow 레이어
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createBreathingTitle(cx, cy) {
        const titleContainer = this.add.container(cx, cy).setDepth(10);

        // 후광 (큰 황금 원, alpha 펄스 → "삽질왕" 글자가 빛나는 느낌)
        const glow = this.add.circle(0, -10, 220, 0xffd700, 0.0);
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.0, to: 0.22 },
            duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });

        // 그림자 (입체감)
        const titleShadow = this.add.text(4, 4, '삽질왕', {
            font: 'bold 120px sans-serif', color: '#000000'
        }).setOrigin(0.5);

        // 본 타이틀
        const titleMain = this.add.text(0, 0, '삽질왕', {
            font: 'bold 120px sans-serif',
            color: '#FFD700',
            stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5);

        // 서브타이틀
        const subtitle = this.add.text(0, 80, 'Just Dig It', {
            font: 'bold 36px sans-serif',
            color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        titleContainer.add([glow, titleShadow, titleMain, subtitle]);

        // 전체 컨테이너 둥실둥실 (y) + scale 숨쉬기
        this.tweens.add({
            targets: titleContainer,
            y: cy - 8,
            duration: 1000, ease: 'Sine.inOut', yoyo: true, repeat: -1
        });
        this.tweens.add({
            targets: titleContainer,
            scale: { from: 1.0, to: 1.04 },
            duration: 1600, ease: 'Sine.inOut', yoyo: true, repeat: -1
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #4 메뉴 임팩트 — 타이틀 주변 황금 sparkle 지속 발사
    //   sin 곡선 alpha/scale → 작은 별이 깜빡거리며 떠올랐다 사라짐
    //   GameScene 보물 팝업 sparkle과 동일 시스템, 메뉴 톤 맞춤
    //   영역: 타이틀(가로 480 / 세로 160) 주변, 110ms마다 1개 (지속)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createTitleSparkles(cx, cy) {
        if (!this.textures.exists('__menuSparkle')) {
            const stg = this.make.graphics({ x: 0, y: 0, add: false });
            stg.fillStyle(0xffffff, 1);
            stg.fillCircle(8, 8, 8);
            stg.generateTexture('__menuSparkle', 16, 16);
            stg.destroy();
        }
        this.add.particles(0, 0, '__menuSparkle', {
            x: { min: cx - 240, max: cx + 240 },
            y: { min: cy - 90,  max: cy + 70 },
            speed: { min: 0, max: 25 },
            angle: { min: 0, max: 360 },
            scale: {
                onEmit: () => 0,
                onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 1.3
            },
            alpha: {
                onEmit: () => 0,
                onUpdate: (p, k, t) => Math.sin(t * Math.PI)
            },
            lifespan: { min: 900, max: 1700 },
            frequency: 110,
            quantity: 1,
            tint: [0xffd700, 0xffffff, 0xffeb3b, 0xffe066]
        }).setDepth(11);   // 타이틀 컨테이너(10)보다 한 단계 위
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #3 박삽돌 - 터치 시 라인 순환 + 깜짝 흔들림
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createInteractiveCharacter(width, height) {
        // 현재 선택된 캐릭터의 idle 텍스처 (없으면 박삽돌 폴백)
        const selectedId = (this.currencyManager && this.currencyManager.selectedCharacterId) || 'char_001';
        let idleKey = `${selectedId}_idle`;
        if (!this.textures.exists(idleKey)) idleKey = 'char_001_idle';
        if (!this.textures.exists(idleKey)) return;

        const charX = width * 0.78;
        const charY = height * 0.74;
        const char = this.add.image(charX, charY, idleKey)
            .setOrigin(0.5).setDepth(5);

        const targetH = height * 0.40;
        const ratio = char.width / char.height;
        char.setDisplaySize(targetH * ratio, targetH);
        char.setAngle(5);

        // 말풍선 (캐릭터 머리 위) — 신규/재진입 무관 항상 보임
        const bubbleY = charY - char.displayHeight * 0.55;
        const bubble = this.createSpeechBubble(charX - 20, bubbleY, CHARACTER_TAP_LINES[0]);
        this.menuBubble = bubble;
        this.menuBubbleLineIdx = 0;

        // ━━ 신규 유저: 캐릭터 클릭 비활성화 ━━
        //   캐릭터(charX=width*0.78, displayHeight=height*0.40)가 큰 시작 버튼(중앙, height*0.62) 영역과
        //   겹쳐 hit을 가로챌 위험 차단. 신규 유저 첫 진입의 핵심은 시작 버튼이지 캐릭터 라인 순환 X.
        //   재진입 유저(메인 화면 익숙)만 캐릭터 라인 순환 인터랙션 활성화.
        if (this.isFirstTime) return;

        // 사장님 보고: 시작 버튼 첫 탭 안 눌림 매번 발생
        // 추가 보강: 재진입에서도 캐릭터 setInteractive를 1.5초 지연 — 시작 버튼 첫 탭 우선 보장
        // 1.5초 후 캐릭터 라인 순환 활성화. 그동안엔 캐릭터 클릭 무시
        this.time.delayedCall(1500, () => {
            if (!char || !char.scene) return;
            char.setInteractive({ useHandCursor: true });
        });

        // 터치 핸들러
        char.on('pointerdown', () => {
            // 라인 순환 (0번은 초기 라인이라 1번부터 다시 돌림)
            this.menuBubbleLineIdx = (this.menuBubbleLineIdx + 1) % CHARACTER_TAP_LINES.length;
            const newLine = CHARACTER_TAP_LINES[this.menuBubbleLineIdx];
            // 말풍선 텍스트 갱신
            if (bubble && bubble.list) {
                const txt = bubble.list.find(c => c.type === 'Text');
                if (txt) txt.setText(newLine);
            }
            // 캐릭터 깜짝 흔들림 (좌우 빠른 8px)
            this.tweens.killTweensOf(char);
            this.tweens.add({
                targets: char,
                x: { from: charX - 6, to: charX + 6 },
                duration: 60, yoyo: true, repeat: 2,
                onComplete: () => { char.x = charX; }
            });
            // 살짝 scale 펑
            this.tweens.add({
                targets: char,
                scaleX: char.scaleX * 1.06,
                scaleY: char.scaleY * 1.06,
                duration: 120, yoyo: true, ease: 'Quad.out'
            });
            // 효과음
            if (this.soundManager) this.soundManager.playSpeechBubbleSound();
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 모바일 안정 클릭 바인더 (drag-tolerant click)
    //   문제: 모바일에서 손가락이 미세하게 움직이면 pointerout이 즉시 발생.
    //         pointerup이 hit area 밖에서 일어나면 pointerupoutside만 호출되고
    //         기존 코드는 거기서 onClick을 안 불러서 첫 탭이 무시됨.
    //         시작 버튼 펄스(1.05x) + 모바일 터치 흔들림 = 매번 outside 처리 → 사용자 체감 "한 번에 안 됨"
    //   해결: pointerdown 위치 기록 → pointerup/pointerupoutside 둘 다에서
    //         이동 거리가 dragThreshold 안이면 onClick 호출 (진짜 드래그만 무시)
    //   사용: 호출자가 onPress/onRelease 콜백으로 시각 피드백(setScale/setAlpha) 제공
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    bindMobileClick(target, onClick, options = {}) {
        const dragThreshold = options.dragThreshold ?? 30;
        const onPress       = options.onPress   || null;
        const onRelease     = options.onRelease || null;
        let pressed = false;
        let downX = 0, downY = 0;

        target.on('pointerdown', (p) => {
            pressed = true;
            downX = p.x;
            downY = p.y;
            if (onPress) onPress();
        });
        // pointer가 영역 밖으로 나가면 시각만 복원 (pressed는 유지 → 다시 들어오거나 outside up도 처리)
        target.on('pointerout', () => {
            if (onRelease) onRelease();
        });

        const handleUp = (p) => {
            if (onRelease) onRelease();
            if (!pressed) return;
            pressed = false;
            const dx = p.x - downX;
            const dy = p.y - downY;
            if (dx * dx + dy * dy <= dragThreshold * dragThreshold) {
                if (onClick) onClick();
            }
        };
        target.on('pointerup',         handleUp);
        target.on('pointerupoutside',  handleUp);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #6/#8/#2 메뉴 버튼 묶음
    //   - 신규(isFirstTime): 큰 [삽질하러 가기 →] 하나만 + 흔드는 👆
    //   - 재진입: 시작 + 캐릭터 + 상점 + 박물관 4개 (시작은 펄스 강조)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createMenuButtons(width, height, isFirstTime) {
        const btnW = Math.floor(width * 0.55);
        const btnH = 80;
        const btnX = btnW / 2 + 22;

        if (isFirstTime) {
            // 큰 시작 버튼 1개 (1.4x), 화면 세로 중앙 살짝 아래
            const startY = height * 0.62;
            const bigStart = this.createStartButton(width / 2, startY, Math.floor(btnW * 1.35), 110);
            // 흔드는 👆 (시작 버튼 우측)
            this.createWaggleHand(width / 2 + Math.floor(btnW * 1.35) / 2 + 30, startY);
            return;
        }

        // 재진입 - 시작 버튼은 강조 (펄스 + 화살표), 나머지 3개는 평범
        const btnYs = [560, 660, 760, 860];
        this.createStartButton(btnX, btnYs[0], btnW, btnH);
        this.createWaggleHand(btnX + btnW / 2 + 30, btnYs[0]);
        // 2026-05-11: 박물관 등 메뉴 버튼도 bindMobileClick 첫 탭 실패 가능 → DOM 우회 적용
        this.createIconButton(btnX, btnYs[1], btnW, btnH, 'character', '👷', '캐릭터', () => {
            this.scene.start('CharacterScene');
        });
        this.createIconButton(btnX, btnYs[2], btnW, btnH, 'shop', '🛒', '상점', () => {
            this.scene.start('ShopScene');
        });
        this.createIconButton(btnX, btnYs[3], btnW, btnH, 'museum', '🏛️', '삽질박물관', () => {
            this.scene.start('MuseumScene');
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #6 시작 버튼 (펄스 + "삽질하러 가기 →" 메인 라벨)
    //   다른 버튼보다 큰 사이즈 + 1.05x 펄스 + 황금 외곽 강조
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createStartButton(x, y, w, h) {
        // depth 50: 캐릭터(5)/일반 메뉴 버튼(20) 위, BGM 토글(50/51)과 동급
        // 출석/오프라인 팝업은 메뉴 진입 시 자동으로 안 뜨고 우상단 🎁 버튼 누를 때만 뜨므로
        // 시작 버튼이 팝업 input과 충돌할 일 없음 (기존 depth 200 시각 어색 부작용 해소)
        const container = this.add.container(x, y).setDepth(50);
        const radius = 18;
        const SHADOW_OFFSET = 8;
        const HIT_PAD = 60;   // 히트영역 ±60px 확장 — 사장님 보고 "여전히 안 눌림" 추가 보강

        // 그림자판 (어두운 황토)
        const shadow = this.add.graphics();
        shadow.fillStyle(0xa07000, 1);
        shadow.fillRoundedRect(-w / 2, -h / 2 + SHADOW_OFFSET, w, h, radius);

        // 메인판 (밝은 황금 + 굵은 검정 외곽)
        const top = this.add.graphics();
        top.fillStyle(0xffd700, 1);
        top.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        top.lineStyle(4, 0x000000, 1);
        top.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

        // 황금 광택 (상단 1/3 영역에 밝은 노랑 라인)
        const shine = this.add.graphics();
        shine.fillStyle(0xffffaa, 0.45);
        shine.fillRoundedRect(-w / 2 + 8, -h / 2 + 6, w - 16, Math.max(8, h * 0.18), 6);

        // 메인 라벨 "삽질하러 가기 →" (부제 제거 → 메인을 중앙 정렬로 이동)
        const main = this.add.text(0, 0, '삽질하러 가기 →', {
            font: 'bold 42px sans-serif', color: '#000000'
        }).setOrigin(0.5);

        container.add([shadow, top, shine, main]);

        // 히트 영역 (HIT_PAD 30px 확장)
        container.setSize(w + HIT_PAD * 2, h + SHADOW_OFFSET + HIT_PAD * 2);
        container.setInteractive(
            new Phaser.Geom.Rectangle(
                -w / 2 - HIT_PAD, -h / 2 - HIT_PAD,
                w + HIT_PAD * 2, h + SHADOW_OFFSET + HIT_PAD * 2
            ),
            Phaser.Geom.Rectangle.Contains
        );

        // 펄스 (1.05x 숨쉬기)
        const pulseTween = this.tweens.add({
            targets: container,
            scale: { from: 1.0, to: 1.05 },
            duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // pointerdown 즉시 발동 — bindMobileClick(drag-tolerant) 우회
        //   왜: 사용자가 "여전히 안 눌려" 보고. 추적된 원인:
        //     1) bindMobileClick의 dragThreshold 30px이 모바일 손가락 미세 흔들림에 자주 초과
        //     2) pointerout/pointerupoutside 시퀀스 일부 디바이스에서 누락
        //     3) 캐릭터(우측, depth 5) hit 영역과 시작 버튼 hit 영역 일부 겹침 → 캐릭터가 가로챌 위험
        //        (해결: createInteractiveCharacter에서 신규 유저 setInteractive 비활성화)
        //   시작 버튼은 단순 진입(드래그 의미 X) → pointerdown 즉시 처리가 가장 안정.
        //
        // 2026-05-11 추가: 6번 시도 모두 부분 효과만. DOM HTML <button> 우회를 동시 사용
        //   - this._starting 플래그는 Phaser 경로와 DOM 경로 공유 → 더블 진입 차단
        //   - 둘 다 작동: 안정성 이중화 (어느 한 경로가 막혀도 다른 경로로 진입)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this._starting = false;
        const startGame = () => {
            if (this._starting) return;     // 더블 탭/연타/DOM·Phaser 중복 차단
            this._starting = true;
            // AudioContext 명시 resume — 모바일 첫 사용자 제스처에서만 unlock 가능.
            // Phaser가 자동 처리하지만 일부 WebView에서 첫 탭이 unlock에만 소비되는 케이스 보강.
            try {
                const ctx = this.sound && this.sound.context;
                if (ctx && ctx.state === 'suspended') ctx.resume();
            } catch (e) {}
            pulseTween.pause();
            container.setScale(0.88);
            this.spawnButtonRipple(x, y);
            this.tryRequestFullscreen();
            this.scene.start('GameScene');
        };
        container.on('pointerdown', startGame);
        // 시각 복원 (pointerdown 즉시 scene.start 하지만, 만약 어떤 이유로 scene 전환이 늦으면 복원)
        const restore = () => {
            if (this._starting) return;
            container.setScale(1);
        };
        container.on('pointerup', restore);
        container.on('pointerout', restore);
        container.on('pointerupoutside', restore);

        // ━━ DOM HTML <button> 우회 ━━
        // Phaser input 시스템 완전 우회 — 브라우저 네이티브 input이 가로챔
        // 2026-05-11 사장님 보고: 캐릭터 머리 부분에서 시작 버튼이 작동
        //   → HIT_PAD 60 확장이 캐릭터 영역과 겹침. DOM은 시각 영역만으로 축소 (Phaser는 60 유지 폴백)
        this.attachDOMTouchOverlay('start', x, y, w, h + SHADOW_OFFSET, '삽질하러 가기', startGame);

        return container;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DOM HTML <button> 우회 — Phaser input 외 직접 브라우저 native input
    //   배경: 메모리 project_unresolved_attempts_2026_05_10.md — Phaser input 6번 시도 모두 실패
    //   원리: 캔버스 위에 z-index 9999 투명 <button>을 버튼 위치에 겹침
    //         → 터치는 브라우저 → button → click 핸들러로 직진 (Phaser input 우회)
    //   좌표: scale.canvasBounds + scale.displayScale 로 게임 좌표 → CSS 픽셀 변환
    //   리사이즈: 주소창 토글/회전 시 canvasBounds 변하므로 reposition 재호출
    //   클린업: scene shutdown/destroy 시 DOM 제거 (다음 진입 시 중복 방지)
    //
    //   2026-05-11 일반화: buttonKey로 id 분리 → 시작/캐릭터/상점/박물관 모두 적용
    //   사장님 보고 "박물관 작동 안해" — bindMobileClick의 dragThreshold 30px 모바일 첫 탭 실패
    //   원리는 시작 버튼과 동일하므로 메뉴 버튼 모두 DOM 우회 적용
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    attachDOMTouchOverlay(buttonKey, gameX, gameY, gameW, gameH, ariaLabel, onPress) {
        const elementId = `__dom-overlay-${buttonKey}`;
        // 이전 인스턴스(scene 재시작 등) 정리
        const existing = document.getElementById(elementId);
        if (existing && existing.parentNode) existing.remove();

        const btn = document.createElement('button');
        btn.id = elementId;
        btn.setAttribute('aria-label', ariaLabel || buttonKey);
        btn.style.cssText = [
            'position: fixed',
            'z-index: 9999',
            'background: transparent',
            'border: none',
            'outline: none',
            'padding: 0',
            'margin: 0',
            'cursor: pointer',
            'touch-action: manipulation',
            '-webkit-tap-highlight-color: transparent',
            '-webkit-user-select: none',
            'user-select: none'
        ].join(';');
        document.body.appendChild(btn);

        const reposition = () => {
            const bounds = this.scale && this.scale.canvasBounds;
            const ds     = this.scale && this.scale.displayScale;
            if (!bounds || !ds || !ds.x || !ds.y) return;
            const cssW = gameW / ds.x;
            const cssH = gameH / ds.y;
            const cssX = bounds.left + gameX / ds.x - cssW / 2;
            const cssY = bounds.top  + gameY / ds.y - cssH / 2;
            btn.style.left   = `${cssX}px`;
            btn.style.top    = `${cssY}px`;
            btn.style.width  = `${cssW}px`;
            btn.style.height = `${cssH}px`;
        };
        reposition();

        const onPointer = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof onPress === 'function') onPress();
        };
        // pointerdown 즉시 처리 (Phaser 경로와 동일 전략)
        btn.addEventListener('pointerdown', onPointer, { passive: false });
        // 폴백: pointer event 미지원 환경 (구버전 안드로이드 WebView 등)
        btn.addEventListener('touchstart', onPointer, { passive: false });
        btn.addEventListener('click',      onPointer);

        // 리사이즈 시 위치 재계산
        this.scale.on('resize', reposition);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', reposition);
        }

        // 씬 종료/파괴 시 청소
        const cleanup = () => {
            btn.removeEventListener('pointerdown', onPointer);
            btn.removeEventListener('touchstart',  onPointer);
            btn.removeEventListener('click',       onPointer);
            this.scale.off('resize', reposition);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', reposition);
            }
            if (btn.parentNode) btn.remove();
        };
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
        this.events.once(Phaser.Scenes.Events.DESTROY,  cleanup);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 시작 버튼 누름 ripple — 황금 동심원이 확산하며 페이드아웃
    //   "내가 눌렀구나" 시각 확정. 0.4초 안에 사라져 산만하지 않음.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    spawnButtonRipple(cx, cy) {
        const ring = this.add.graphics().setDepth(19);
        ring.lineStyle(5, 0xffd700, 1);
        ring.strokeCircle(0, 0, 30);
        ring.setPosition(cx, cy);
        this.tweens.add({
            targets: ring,
            scale: { from: 0.5, to: 2.6 },
            alpha: { from: 0.9, to: 0 },
            duration: 420, ease: 'Quad.out',
            onComplete: () => ring.destroy()
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // #6 흔드는 👆 손 (시작 버튼 옆)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createWaggleHand(x, y) {
        const hand = this.add.text(x, y, '👆', {
            font: '46px sans-serif'
        }).setOrigin(0.5).setDepth(20);
        // 좌우 흔들기 (각도 ±15°)
        this.tweens.add({
            targets: hand,
            angle: { from: -15, to: 15 },
            duration: 350, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
        // 살짝 위아래 (찌르는 느낌)
        this.tweens.add({
            targets: hand,
            y: y - 6,
            duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 풀스크린 요청 (브라우저별 prefix 처리)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    tryRequestFullscreen() {
        const el = document.documentElement;
        try {
            if (el.requestFullscreen) {
                const p = el.requestFullscreen();
                if (p && p.catch) p.catch(() => {});
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (el.msRequestFullscreen) {
                el.msRequestFullscreen();
            }
        } catch (e) {}
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 일반 라운드 버튼 (캐릭터/상점/박물관용)
    //   2026-05-11: DOM 우회 추가 (사장님 보고 "박물관 작동 안해")
    //   buttonKey 인자로 DOM overlay 식별 (start 와 분리)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createIconButton(x, y, w, h, buttonKey, icon, label, onClick) {
        const container = this.add.container(x, y).setDepth(20);
        const radius = 16;
        const colorTop    = 0xFFD700;
        const colorBottom = 0xc49a00;
        const SHADOW_OFFSET = 6;

        const shadow = this.add.graphics();
        shadow.fillStyle(colorBottom, 1);
        shadow.fillRoundedRect(-w / 2, -h / 2 + SHADOW_OFFSET, w, h, radius);

        const top = this.add.graphics();
        top.fillStyle(colorTop, 1);
        top.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        top.lineStyle(3, 0x000000, 1);
        top.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

        const iconText = this.add.text(-w / 2 + 50, 0, icon, {
            font: '38px sans-serif'
        }).setOrigin(0.5);
        const labelText = this.add.text(-w / 2 + 100, 0, label, {
            font: 'bold 34px sans-serif', color: '#000000'
        }).setOrigin(0, 0.5);

        container.add([shadow, top, iconText, labelText]);

        container.setSize(w, h + SHADOW_OFFSET);
        container.setInteractive(
            new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h + SHADOW_OFFSET),
            Phaser.Geom.Rectangle.Contains
        );

        // drag-tolerant click — 모바일 첫 탭 안정성 (Phaser 경로, 폴백)
        this.bindMobileClick(container, () => {
            if (onClick) onClick();
        }, {
            onPress:   () => container.setScale(0.96),
            onRelease: () => container.setScale(1)
        });

        // DOM HTML <button> 우회 — Phaser bindMobileClick 첫 탭 실패 대응
        this.attachDOMTouchOverlay(buttonKey, x, y, w, h + SHADOW_OFFSET, label, () => {
            if (onClick) onClick();
        });

        return container;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 말풍선 (둥근 흰색 + 아래 꼬리)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createSpeechBubble(x, y, text) {
        const container = this.add.container(x, y).setDepth(20);
        const bw = 240, bh = 60;
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.95);
        g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
        g.lineStyle(3, 0x000000, 1);
        g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);

        g.fillStyle(0xffffff, 0.95);
        g.fillTriangle(-12, bh / 2 - 1, 12, bh / 2 - 1, 0, bh / 2 + 18);
        g.lineStyle(3, 0x000000, 1);
        g.lineBetween(-12, bh / 2 - 1, 0, bh / 2 + 18);
        g.lineBetween(12, bh / 2 - 1, 0, bh / 2 + 18);

        const txt = this.add.text(0, 0, text, {
            font: 'bold 22px sans-serif', color: '#5a2d0c'
        }).setOrigin(0.5);

        container.add([g, txt]);

        // 둥실둥실
        this.tweens.add({
            targets: container, y: y - 5,
            duration: 1400, ease: 'Sine.inOut', yoyo: true, repeat: -1
        });
        return container;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 미구현 메뉴 클릭 시 짧은 토스트 (console.log 대신 사용자에게 보이는 피드백)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    showComingSoonToast(msg) {
        const { width, height } = this.cameras.main;
        const txt = this.add.text(width / 2, height * 0.85, msg, {
            font: 'bold 22px sans-serif',
            color: '#ffffff',
            backgroundColor: '#000000cc',
            padding: { x: 18, y: 12 },
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(60);
        this.tweens.add({
            targets: txt,
            alpha: 0, y: txt.y - 30,
            delay: 1500, duration: 400,
            onComplete: () => txt.destroy()
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BGM ON/OFF 토글 (기존)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    createBGMToggleButton(x, y) {
        const updateIcon = () => {
            this.bgmToggleBtn.setText(this.soundManager.isBGMMuted ? '🔇' : '🔊');
        };
        this.add.circle(x, y, 38, 0x000000, 0.75)
            .setStrokeStyle(3, 0xffd700).setDepth(50);
        this.bgmToggleBtn = this.add.text(x, y, '🔊', { font: '40px sans-serif' })
            .setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
        updateIcon();
        // drag-tolerant click — 시각 피드백은 alpha 변화
        this.bindMobileClick(this.bgmToggleBtn, () => {
            this.soundManager.toggleBGM();
            updateIcon();
        }, {
            onPress:   () => this.bgmToggleBtn.setAlpha(0.6),
            onRelease: () => this.bgmToggleBtn.setAlpha(1)
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 오프라인 보상 팝업 (기존 그대로)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    showOfflineRewardPopup(rewardCoin, elapsedStr, onClaim) {
        const { width, height } = this.cameras.main;

        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setInteractive({ useHandCursor: true }).setDepth(100);

        const card = this.add.container(width / 2, height / 2).setDepth(101);
        const cardW = width * 0.84;
        const cardH = 480;

        const cardBg = this.add.rectangle(0, 0, cardW, cardH, 0x2a1a0a, 1)
            .setStrokeStyle(6, 0xffd700);

        // STEP5: 자동수입 = 인부들이 벌어놓은 코인 (테마 통일)
        const sleepIcon = this.add.text(0, -160, '👷', { font: '96px sans-serif' }).setOrigin(0.5);
        const line1 = this.add.text(0, -50, '자리 비운 사이', { font: 'bold 32px sans-serif', color: '#ffffff' }).setOrigin(0.5);
        const line2 = this.add.text(0, -10, '인부들이 벌어놨어요!', { font: 'bold 32px sans-serif', color: '#ffffff' }).setOrigin(0.5);
        const elapsed = this.add.text(0, 40, `(${elapsedStr} 동안)`, { font: '22px sans-serif', color: '#cccccc' }).setOrigin(0.5);
        const reward = this.add.text(0, 110, `🪙 +${rewardCoin.toLocaleString()} 삽코인 획득!`, {
            font: 'bold 36px sans-serif', color: '#ffd700',
            stroke: '#5a2d0c', strokeThickness: 5
        }).setOrigin(0.5);
        const tapHint = this.add.text(0, 195, '👆 탭해서 받기', { font: 'italic 22px sans-serif', color: '#aaaaaa' }).setOrigin(0.5);

        card.add([cardBg, sleepIcon, line1, line2, elapsed, reward, tapHint]);
        card.setScale(0.6);
        card.alpha = 0;
        this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 350, ease: 'Back.out' });

        overlay.once('pointerdown', () => {
            overlay.disableInteractive();
            if (typeof onClaim === 'function') onClaim();
            this.tweens.add({
                targets: [card, overlay],
                alpha: 0, scale: 0.85, duration: 200,
                onComplete: () => { card.destroy(); overlay.destroy(); }
            });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 출석 보상 팝업 (30일 캘린더 그리드)
    //   카드 안: 타이틀 + 30셀 그리드(5×6) + 받기/닫기 버튼
    //   오늘 셀: 황금 외곽 + 펄스
    //   받은 셀: 녹색 외곽 + ✓ 오버레이
    //   미래 셀: 회색 + alpha 0.7
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    showAttendancePopup() {
        if (!this.attendanceManager) return;
        const { width, height } = this.cameras.main;
        const cal = this.attendanceManager.getCalendarData();

        // 카드 사이즈 (모바일 세로형 기준 — 폭 92%, 높이 88% 또는 880px)
        const cardW = width * 0.92;
        const cardH = Math.min(height * 0.88, 880);

        // 딤 오버레이 — 외곽 어디 누르면 자동 받기 + 닫기 (사용자 친화: 버튼 빗나가도 진행 가능)
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
            .setInteractive().setDepth(120);

        const card = this.add.container(width / 2, height / 2).setDepth(121);
        const cardBg = this.add.rectangle(0, 0, cardW, cardH, 0x2a1a0a, 1)
            .setStrokeStyle(6, 0xffd700);

        const title = this.add.text(0, -cardH / 2 + 50, '📅 출석 체크', {
            font: 'bold 38px sans-serif', color: '#ffd700',
            stroke: '#5a2d0c', strokeThickness: 5
        }).setOrigin(0.5);

        const subText = cal.isClaimedToday
            ? `오늘은 받았어요 (Day ${cal.todayDay}) — 내일 또 봬요!`
            : `오늘은 Day ${cal.todayDay}!`;
        const subtitle = this.add.text(0, -cardH / 2 + 95, subText, {
            font: '20px sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        card.add([cardBg, title, subtitle]);

        // ━━ 그리드 (5열 × 6행 = 30셀) ━━
        const cols = 5, rows = 6;
        const gridTop = -cardH / 2 + 135;
        const gridSidePad = 20;
        const cellW = (cardW - gridSidePad * 2) / cols;
        const cellH = 95;
        const cellInnerW = cellW - 8;
        const cellInnerH = cellH - 8;
        const gridLeft = -cellW * cols / 2 + cellW / 2;

        cal.cells.forEach((cell, idx) => {
            const c = idx % cols;
            const r = Math.floor(idx / cols);
            const cx = gridLeft + c * cellW;
            const cy = gridTop + r * cellH + cellH / 2;
            const cellGroup = this.createAttendanceCell(cell, cellInnerW, cellInnerH);
            cellGroup.setPosition(cx, cy);
            card.add(cellGroup);
        });

        // ━━ 하단 버튼 (받기 or 닫기) ━━
        // closing 가드: overlay click과 button click이 거의 동시에 들어와도 tween 중복 방지
        let closing = false;
        const closePopup = () => {
            if (closing) return;
            closing = true;
            this.tweens.add({
                targets: [card, overlay], alpha: 0, scale: 0.9,
                duration: 280,
                onComplete: () => { card.destroy(); overlay.destroy(); }
            });
        };

        // 받기 처리 (button + overlay click 공통)
        const claimAndClose = () => {
            if (closing) return;
            const result = this.attendanceManager.claim();
            if (result) {
                if (this.soundManager) this.soundManager.playUpgradeSound();
                this.cameras.main.flash(220, 255, 215, 0);
                this.spawnAttendanceFloatingReward(width / 2, height / 2, result.reward);
            }
            closePopup();
        };

        if (cal.isClaimedToday) {
            // 이미 받음 → 닫기 버튼만 (큰 사이즈)
            const closeBtn = this.createAttendanceButton(
                0, cardH / 2 - 65, 280, 70, '닫기',
                0x666666, 0x444444, '#ffffff', closePopup
            );
            card.add(closeBtn);
        } else {
            // 받기 버튼 (큰 사이즈 + 보상 표시)
            const todayCell = cal.cells.find(c => c.status === 'today');
            const reward = todayCell.reward;
            const claimBtn = this.createAttendanceButton(
                0, cardH / 2 - 65, 360, 80,
                `🎁 받기  ${reward.label}`,
                0xffd700, 0xa07000, '#000000', claimAndClose
            );
            card.add(claimBtn);
        }

        // ━━ overlay 외곽 click도 받기/닫기로 처리 ━━
        //   - 버튼 hit area 빗나가도 외곽 어디 누르면 진행됨 (모바일 친화)
        //   - card 내부 버튼 영역 click은 button이 우선 (Phaser hit test depth 순)
        //   - 외곽이 받기로 바뀌어도 코인+ 보상이라 손해 없음
        overlay.on('pointerdown', () => {
            if (cal.isClaimedToday) closePopup();
            else                    claimAndClose();
        });

        // 등장 애니
        card.setScale(0.7);
        card.alpha = 0;
        this.tweens.add({
            targets: card, scale: 1, alpha: 1, duration: 350, ease: 'Back.out'
        });
    }

    // 출석 셀 1칸 (Day N + 보상 이모지/수량 + 상태별 색)
    createAttendanceCell(cell, w, h) {
        const container = this.add.container(0, 0);
        const radius = 10;

        const styleMap = {
            claimed: { bg: 0x1f3320, border: 0x4caf50, alpha: 1.0,  dayColor: '#88dd88', amountColor: '#dddddd' },
            today:   { bg: 0x4a3520, border: 0xffd700, alpha: 1.0,  dayColor: '#ffd700', amountColor: '#ffffff' },
            future:  { bg: 0x1f1f1f, border: 0x555555, alpha: 0.75, dayColor: '#888888', amountColor: '#777777' }
        };
        const s = styleMap[cell.status] || styleMap.future;

        const bg = this.add.graphics();
        bg.fillStyle(s.bg, s.alpha);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        bg.lineStyle(cell.status === 'today' ? 3 : 2, s.border, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

        const dayLabel = this.add.text(0, -h / 2 + 12, `Day ${cell.day}`, {
            font: 'bold 14px sans-serif', color: s.dayColor
        }).setOrigin(0.5, 0);

        const iconChar = cell.reward.type === 'coin'    ? '🪙'
                       : cell.reward.type === 'relic'   ? '🏺'
                       : '💎';
        const icon = this.add.text(0, 2, iconChar, { font: '28px sans-serif' }).setOrigin(0.5);

        const amount = this.add.text(0, h / 2 - 12, `+${cell.reward.amount}`, {
            font: 'bold 14px sans-serif', color: s.amountColor
        }).setOrigin(0.5, 1);

        container.add([bg, dayLabel, icon, amount]);

        if (cell.status === 'claimed') {
            const check = this.add.text(0, 2, '✓', {
                font: 'bold 44px sans-serif', color: '#4caf50',
                stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setAlpha(0.85);
            container.add(check);
        }

        if (cell.status === 'today') {
            // 펄스 (시선 끌기)
            this.tweens.add({
                targets: container,
                scale: { from: 1.0, to: 1.06 },
                duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
        }

        return container;
    }

    // 출석 팝업 전용 라운드 버튼 (받기/닫기)
    createAttendanceButton(x, y, w, h, label, colorTop, colorBottom, textColor, onClick) {
        const container = this.add.container(x, y);
        const radius = 16;
        const SHADOW_OFFSET = 6;

        const shadow = this.add.graphics();
        shadow.fillStyle(colorBottom, 1);
        shadow.fillRoundedRect(-w / 2, -h / 2 + SHADOW_OFFSET, w, h, radius);

        const top = this.add.graphics();
        top.fillStyle(colorTop, 1);
        top.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        top.lineStyle(3, 0x000000, 1);
        top.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

        const labelTxt = this.add.text(0, 0, label, {
            font: 'bold 24px sans-serif', color: textColor
        }).setOrigin(0.5);

        container.add([shadow, top, labelTxt]);

        // hit area를 시각 사이즈보다 ±20px 확장 — 모바일에서 손가락이 가장자리 빗나가도 click 인정
        const HIT_PAD = 20;
        container.setSize(w + HIT_PAD * 2, h + SHADOW_OFFSET + HIT_PAD * 2);
        container.setInteractive(
            new Phaser.Geom.Rectangle(-w / 2 - HIT_PAD, -h / 2 - HIT_PAD, w + HIT_PAD * 2, h + SHADOW_OFFSET + HIT_PAD * 2),
            Phaser.Geom.Rectangle.Contains
        );
        // drag-tolerant click — 모바일 첫 탭 안정성
        this.bindMobileClick(container, () => {
            if (onClick) onClick();
        }, {
            onPress:   () => container.setScale(0.96),
            onRelease: () => container.setScale(1)
        });
        return container;
    }

    // 출석 받은 후 화면 중앙에 "+보상" 짧게 떠오름 (받았다는 시각 피드백)
    spawnAttendanceFloatingReward(x, y, reward) {
        const txt = this.add.text(x, y, reward.label, {
            font: 'bold 56px sans-serif',
            color: '#ffd700',
            stroke: '#5a2d0c', strokeThickness: 6
        }).setOrigin(0.5).setDepth(140);
        this.tweens.add({
            targets: txt,
            y: y - 140, alpha: 0,
            duration: 1400, ease: 'Quad.out',
            onComplete: () => txt.destroy()
        });
    }
}
