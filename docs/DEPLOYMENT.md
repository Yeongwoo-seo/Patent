# DEPLOYMENT.md

## 현재 상태: 로컬 전용 PWA (서버 연동 설정 대기)

이번 세션은 단계 D(서버 동기화·실제 알림)를 구현하지 않았다. 이 문서는
(1) 지금 당장 가능한 정적 배포 방법과 (2) 다음 세션에서 서버를 붙일 때 따라야
할 절차를 구분해서 적는다.

## 1. 지금 가능한 것: 정적 HTTPS 배포

앱은 순수 정적 파일(`npm run build`의 `dist/`)이다. Netlify, Vercel, Cloudflare
Pages, GitHub Pages 등 정적 호스팅 어디에나 올릴 수 있다.

```bash
npm ci
npm run build
# dist/ 를 정적 호스팅에 업로드
```

체크리스트(17.6):
- [ ] HTTPS로 서빙되는지 확인 (Web Push, 서비스 워커 필수 조건)
- [ ] `manifest.webmanifest`의 `start_url`/`scope`가 실제 배포 경로와 일치하는지
- [ ] 직접 URL 접근/새로고침이 index.html로 정상 폴백되는지 확인 — 단, `/api`나
      실제 콘텐츠 파일 404까지 감추지 않도록 호스팅의 SPA 폴백 범위를 좁혀야 한다
      (이번 세션에는 `/api` 경로 자체가 없으므로 해당 없음)
- [ ] `public/icons/icon-192.png`, `icon-512.png`는 **플레이스홀더**(단색 정사각형)다.
      실제 브랜드 아이콘으로 교체할 것(`scripts/generate-placeholder-icons.mjs` 참고)

이 경로만으로는 서버 동기화·푸시 알림이 동작하지 않는다 — 로컬 IndexedDB만
사용하는 완전 오프라인 앱으로 동작한다(19.6 로컬 모드).

## 2. 다음 세션: 서버 연동 (설정 대기)

브리핑 14.3절의 기본안을 따른다. 아래는 **아직 구현하지 않은** 항목이며, 착수
시 필요한 자격 증명과 절차만 미리 적어둔다.

### 2.1 필요한 자격 증명 (`.env.example` 참고)

| 변수 | 용도 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | 클라이언트용 익명 키 (RLS로 권한 분리) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용. **클라이언트에 절대 노출 금지** |
| `VAPID_PUBLIC_KEY` | Web Push 공개 키 |
| `VAPID_PRIVATE_KEY` | Web Push 개인 키. **서버 비밀로만 관리** |
| `VAPID_SUBJECT` | Web Push mailto: 또는 URL |

이 값들이 없으므로 이번 세션에는 서버 코드/설정을 작성하지 않았다. 값이
준비되면:

1. Supabase 프로젝트 생성, `18.2`의 엔터티에 대응하는 테이블 생성.
2. 사용자별 RLS 정책 작성·테스트(22.2, `learnerId`가 아니라 인증 주체 기준).
3. `18.4`의 API 계약(`/api/sync/events` 등)을 Supabase Edge Function 또는
   별도 서버로 구현.
4. Supabase Cron으로 알림 스케줄러(`/internal/notifications/run`) 등록,
   서버 인증 필수로 보호.
5. 프런트엔드에 Push 구독 등록 UX(14.4)를 붙이고, iOS 16.4+ 홈 화면 설치 +
   사용자 동작 기반 권한 요청 규칙을 지킨다.

### 2.2 완료 판정 기준

14.8절대로, **실제 iPhone 홈 화면 설치 → 권한 허용 → 앱 종료 → 서버 예약
실행 → 알림 수신 → 탭 → 퀘스트 진입**까지 실기기로 검증해야 "완료"다. 서버
함수 호출 성공이나 브라우저 에뮬레이션만으로는 완료로 보고하지 않는다.

## 3. 개인 자료 제외 절차

- 공개 저장소/배포 산출물에는 `src/data/fixtures/demoContent.ts`의 테스트용
  가상 자료만 포함된다. 실제 기출 PDF, 기본서 원문, 판례 전문 등은 이번
  세션에 다루지 않았고, 만약 향후 로컬 수입 기능이 생기면 그 자료는 사용자
  기기/비공개 저장소에만 두고 빌드 산출물에 포함하지 않아야 한다(22.1).
- `.env`, 실제 VAPID/Supabase 키는 `.gitignore`에 포함되어 있다(`.env`, `*.local`).
