# 삽질왕 (Just Dig It)

캐주얼 아이들 클리커 게임. Phaser.js 3 + Capacitor 기반.

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 (http://localhost:5173)
npm run dev

# 3. 빌드
npm run build

# 4. 안드로이드 빌드 (최초 1회: npx cap add android)
npm run cap:android
```

## 폴더 구조

자세한 구조는 [CLAUDE.md](./CLAUDE.md) 참고.

```
src/
├── index.html        # 메인 HTML
├── main.js           # Phaser 진입점
├── scenes/           # 씬 (BootScene, MenuScene, GameScene 등)
├── managers/         # 매니저 (Sound, Currency, Firebase 등)
├── data/             # 데이터 (characters, layers, i18n)
├── objects/          # 게임 오브젝트
└── assets/           # 이미지/사운드 (생성 예정)
```

## 현재 구현된 것

- Phaser 3 게임 부팅 (BootScene → MenuScene → GameScene)
- 탭 → 삽질 → 코인 획득 핵심 루프
- 콤보 시스템 (1500ms 윈도우)
- 재화 3종 (삽코인 / 다이아삽 / 유물조각) + localStorage 저장
- 햅틱 시스템 (Capacitor Haptics + 웹 폴백)
- 레이어 진행 (레이어가 깊어질수록 필요 삽질수 증가)
- 캐릭터 데이터 30종

## TODO

[CLAUDE.md - 개발 단계별 우선순위](./CLAUDE.md) 참고.
