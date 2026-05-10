// 삽질왕 (Just Dig It) - Phaser 게임 진입점
import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import ShopScene from './scenes/ShopScene.js';
import MuseumScene from './scenes/MuseumScene.js';
import CharacterScene from './scenes/CharacterScene.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scale 설정 (세로형 모바일 풀스크린)
//
// 핵심 아이디어: 게임 가로(GAME_WIDTH)는 배경 이미지 원본 너비(720)에 고정하고,
//               세로(GAME_HEIGHT)는 실제 디바이스 종횡비에 맞춰 동적 계산.
//               그러면 Phaser.Scale.FIT 모드가 letterbox(검정 바) 없이 화면 100% 충전.
//
// 왜 이렇게? 기존엔 GAME_WIDTH=720 / GAME_HEIGHT=window.innerHeight로 잡았는데,
//   - 폰 CSS 폭이 720보다 좁으면(예: 360) FIT가 가로 기준으로 0.5배 축소
//   - 결과: 캔버스가 화면 위쪽 절반만 차지, 아래 절반 검정 (←사용자가 본 버그)
//
// 동적 계산식:
//   GAME_HEIGHT = 720 × (viewportH / viewportW)
//   → 게임 종횡비 = 디바이스 종횡비 → FIT 스케일이 양축 동일 → 화면 꽉 참
//
// GameScene이 cameras.main.{width,height}와 height*0.72 기반으로 모든 좌표를
// 동적 계산하므로(B방식 수식 포함) GAME_HEIGHT가 변해도 캐릭터/배경 정렬 자동 OK.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const REFERENCE_WIDTH = 720; // 배경 이미지 원본 너비와 일치 → 균일 스케일 1.0 보장

function computeGameSize() {
    // visualViewport가 있으면 우선 사용 (주소창/노치 처리가 더 정확)
    const vv = window.visualViewport;
    const w = (vv && vv.width)  || window.innerWidth  || document.documentElement.clientWidth  || 360;
    const h = (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 800;
    return {
        width: REFERENCE_WIDTH,
        height: Math.round(REFERENCE_WIDTH * (h / w))
    };
}

const initialSize = computeGameSize();

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: 0x000000, // letterbox(여유 영역)도 검정 → 어떤 경우에도 갈색 바 안 보임
    scale: {
        mode: Phaser.Scale.FIT,           // 비율 유지하며 부모 컨테이너에 맞춤
        autoCenter: Phaser.Scale.CENTER_BOTH, // 가로/세로 모두 중앙 정렬 (안전망)
        width: initialSize.width,
        height: initialSize.height
    },
    input: {
        activePointers: 3,
        touch: { capture: true }
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true
    },
    scene: [BootScene, MenuScene, GameScene, ShopScene, MuseumScene, CharacterScene]
};

// 페이지 로드 후 게임 시작
window.addEventListener('load', () => {
    const game = new Phaser.Game(config);

    // 부팅이 시작되면 HTML 로딩 화면 숨김
    game.events.once('ready', () => {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('hidden');
    });

    // 회전/주소창 변화 등으로 종횡비가 바뀌면 게임 사이즈 재계산
    // (FIT 모드는 스케일은 자동으로 다시 맞추지만, 게임 종횡비 자체는 우리가 갱신해줘야 letterbox 0 유지)
    let resizeTimer = null;
    const handleResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const next = computeGameSize();
            game.scale.setGameSize(next.width, next.height);
            game.scale.refresh();
        }, 150); // 디바운스 (주소창 토글 시 잦은 호출 방지)
    };
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
    }

    // 디버깅용 (배포 시 제거)
    if (import.meta.env && import.meta.env.DEV) {
        window.__game = game;
    }
});
