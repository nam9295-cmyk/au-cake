# VERYGOOD AU Customer Account — 배포 및 복구 절차

> **Current production checkpoint (2026-10-19):** PR25/26 and customer-OFF Pages deployment completed. Main `08799b739f6d8047154c0ea699aab81837196ce2`, rollback Pages `65a7ccae-422a-4d79-9262-fccea9b51c7f`; production Pages attempts2 preserved. [Current results and remaining approval](customer-account-production-release-results.md), [remaining-release plan](superpowers/plans/2026-10-19-customer-account-production-resume.md), amended manifest SHA `0fd7a7c99681f6c236679a29c84e1d084c861c5d6cd65ca4d61e93653682acc3`, executionApproved=false. Owner schema1+1, Function2 and readiness200/readytrue1513ms completed; no repetition. Current false reader6ad5ce82a6ae17a3830a preserves customerOFF; validated member6ad5cea0eb161f62de24 is retained. Remaining main merges/OFF builds/schema/deployment/readiness0. Amended SHA was approved; the single SMTP apply was restored after executor preflight error propagation failed. Apply2/restore2 container actions are consumed; SMTP remains OFF and UION remains0. Current authorization is stopped, global root apply claim consumed; the user revoked the new Key and official Console confirmed absence. Original keys and quota daily5/100,monthly87/3000 are unchanged. Existing accepted tests are not repeated; historical entries below preserve their original chronology.

> 최종 운영 준비(2026-10-19): [Production preflight](customer-account-production-final-preflight.md). 운영 DB2/Collection22 ACL·GET-only migration을 확인했고 상시 SMTP 유지 확정 adapter와 OFF/ON 산출물을 로컬 준비했다. 운영 변경/배포/main 병합은 미실행이며, 상세 manifest의 새 일괄 승인을 기다린다.

> 2026-10-19 최종 준비: [실제 G JWT 주문 생성·owner 저장·MY ORDERS PASS 및 CLOSED31 복구](customer-account-final-release-preparation.md). 기존 Google/OTP/cart/readiness PASS는 재시험하지 않았다. [상시 SMTP 운영 전환 준비](customer-account-always-on-smtp.md)는 미적용/운영 승인 대기다. B5 단발 PASS와 상시 운영 RELEASE BLOCKER를 구분한다.


> **최신 B5 FINAL 단발 인수 PASS:** [실행 결과](customer-account-b5-final-execution-results.md). 실제 메일1건·6자리 OTP 로그인·기존 G Google↔OTP 동일 UID를 화면과 Owner API로 확인했다. SMTP TLS/AUTH PASS, 노출297.793초 뒤 원본 SMTP·Account/OTP/JWT OFF·세션0·Function OFF/B6·flags false·CLOSED29 및 운영4개/Console 불변을 검증했다. 신규 Key 폐기 완료. Pages2회(누적29), 재생성4회, Function0회. **B5 단발 검증 완료이며 상시 운영 SMTP/출시 승인은 별도**다. D1 timeout·과거 AU/Gallery raw UNVERIFIED는 유지한다. 아래 이전 중단/DEFERRED 기록은 역사적 증거다.

> **최신 B5 실행 결과:** [단발 OTP 시도 및 원복 기록](customer-account-b5-one-shot-otp-results.md). 공통 SMTP를 임시 적용했으나 Python health403/curl200 검사 차이로 Account/OTP ON 전에 중단했다. 자동 복구가 API 검사에서 멈춰 남은 worker는 사용자 root 실행으로 복원했고, 원본 bytes/이미지·큐0/0/failed1·운영4개 지문·OFF403/B6/CLOSED27을 직접 검증했다. 신규 SMTP Key는 폐기, OTP 요청0·UID검증 NOT RUN, Pages27·기존 Function16/120 보존. **B5 — BLOCKED / DEFERRED — RELEASE BLOCKER**, D1 timeout·과거 AU/Gallery raw UNVERIFIED 유지. 아래 이전 기록은 역사적 증거다.

> **최신 수동 장바구니 시험 종료:** [장바구니 분리·로그인 후 가져오기 검증 및 CLOSED19 기록](customer-cart-isolation-validation.md). 사용자 종료 요청으로 Account OFF/API403·test 세션0·Function OFF/B6/flags false·사이트 CLOSED19·감시 종료를 직접 확인했다. 사용자가 G/H 분리를 확인한 PASS는 보존하며, 새 가져오기/회원 장바구니 선택의 실제 결과는 명시 확인되지 않아 NOT RUN/unconfirmed다. 제품 로컬 전체2,136 PASS/0 FAIL/기존 SKIP1, TypeScript/lint/AU build PASS. 누적 Pages19·Function8/120, 추가 창/배포는 미승인. 프로필·실제 회원주문/MY ORDERS·권한 인수와 D1 timeout 후속 검증, **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw **UNVERIFIED**가 남아 있어 운영 활성화 완료로 분류하지 않는다. 아래는 보존된 이전 단계 기록이다.

> **Google-only watchdog 로컬 조사:** [기록 대조와 진단 보완](customer-account-google-only-watchdog-investigation.md). 과거 중단 원인 UNVERIFIED·G 로그인/세션/새로고침 PASS를 보존한다. 종료 사유·API/세션/lease/drift·복구 소요 시간만 로컬에서 계측했으며5초 기준·자동 OFF는 유지한다. 추가 원격 실행/배포0, Pages9/9·Function8/120 불변. 새 시험은 별도 승인 전 금지다. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지.

> **Google-only 실제 인수:** [실행 결과](customer-account-google-only-acceptance-results.md). 사용자 Chrome의 G Google 로그인·Account/session·새로고침 PASS. 프로필 저장 전에 안전 감시가 조기 종료해 G 프로필/명시적 로그아웃·H는 NOT RUN, 전체 인수 미완료다. 최초 중단 predicate는 UNVERIFIED이며 Account OFF403·세션0·Function OFF/B6·사이트 CLOSED 복원과 운영 불변은 PASS다. Pages **9/9 소진**, Function **8/120 불변**. 재시험·추가 배포는 별도 승인 대상이다. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지. 아래는 보존된 이전 준비/실행 기록이다.

> **Google-only 로컬 준비:** [준비 결과와 사용자 클릭 순서](customer-account-google-only-readiness.md). 신규26개 회귀 포함 전체2,072 PASS/0 FAIL/기존 SKIP1, 계정295 PASS. 실제 OFF403/B6/CLOSED·운영4개/Function6개 및 test 보호 설정 검증, idempotent Account OFF1회만 수행했다. 사용자의 새 `시작` 전 ON/Pages 배포/새900초 창0이며 누적8/120·Pages7/9 유지. 실제 Google/profile 인수는 NOT RUN이다. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지.

> **Google 로그인 단독 인수 제안:** [최소 실행 계획](superpowers/plans/2026-10-18-customer-account-google-only-acceptance.md). 기존 G/H·상한2를 유지하고 제품 인증/프로필만 시험한다. Function 실행/배포0, OPEN8/CLOSED9·새 최대900초 Account 창은 **별도 승인 전 미실행**이다. 현재는 계획 작성만 완료, 누적8/120·Pages7/9 불변. D1/backend 최적화·실제 MY ORDERS 인수와 분리하며 **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지.

> **최신 로컬 제품 개선:** [인증/주문 상태 분리와 검증 결과](customer-account-auth-orders-separation.md). Account 인증에서 reservation health 선행 호출을 제거하고 MY ORDERS의 실제 API 결과로 주문 상태를 판단한다. 서버 JWT/owner/ACL/readiness는 그대로이며 17→5회 최적화는 설계 제안만 있다. 로컬 전체 2,046 PASS/0 FAIL/기존 SKIP1, 실제 Google·MY ORDERS 인수 NOT RUN. 이번 원격 작업0·누적8/120·Pages7/9 불변. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지. 아래는 기존 진단/실행 기록이다.

> **D1 timeout 읽기 전용 조사:** [결과](customer-account-b7-d1-timeout-investigation.md), [계측 제안](superpowers/plans/2026-10-18-customer-account-b7-health-timing-diagnostic.md). 실제 Node soft timeout500은 확인, settings/metadata 대기 위치와 transport 원인은 UNVERIFIED. 회원 readiness17회 순차·기존 실측17.46초와 제품10초 제한 충돌을 확인했다. 새 배포/실행0, 누적8/120·Pages7/9·OFF/B6/CLOSED 유지. Google 인수 준비 미완료, 다음 최소 deployment1/health1도 별도 승인 대상이다. B5 DEFERRED — RELEASE BLOCKER·과거 AU raw UNVERIFIED 유지.

> **최신 D1 실제 진단:** [결과](customer-account-b7-d1-runtime-results.md). 배포 전 key/window/flags 동결→새 Node22 deployment에서 guard·header/path 계약 PASS. 첫 health는 timeout/HTTP500으로 FAIL, 나머지2회 NOT RUN으로 즉시 종료했다. Account/공개 Function/Pages OPEN0, 복구·직접 OFF403/B6/CLOSED·운영 현재 지문 불변 PASS. 누적8/120·Pages7/9, Google 인수 미완료. B5 DEFERRED — RELEASE BLOCKER 및 과거 AU raw UNVERIFIED 유지. 아래는 보존된 이전 기록이다.

> **health403 집중 조사:** [결과](customer-account-b7-health-403-investigation.md). 변수 갱신 뒤 기존 deployment/runtime 재사용의 계약 결함을 확인했다. 이전 warm env/TIME 거부가 강하게 지지되지만 실제 최초 predicate는 UNVERIFIED다. [새 deployment 기반 닫힌 검증 제안](superpowers/plans/2026-10-18-customer-account-b7-runtime-env-verification.md)은 실행 미승인. 이번 execution/배포/새 창0, OFF/B6/CLOSED 유지, B5 DEFERRED — RELEASE BLOCKER. Google 재개 전 별도 승인 필요.

> **최신 수동 B7 실행:** [실제 결과](customer-account-b7-manual-run-results.md). 사용자 시작 승인 뒤 첫 Owner health가403 `B7_GUARD_REJECTED`로 실패해 OPEN 전 중단했다. Account/공개 Function/Pages 배포·Google/주문0, watchdog 및 직접 OFF/B6/CLOSED 검증 PASS. 실행 누적7/120, Pages7/9. 실패 predicate UNVERIFIED, 새 창 자동 재시도 금지. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지.

> **최신 B7 수동 전환:** [사용자 Chrome 직접 조작 계획](superpowers/plans/2026-10-18-customer-account-b7-manual-chrome.md), [준비 결과](customer-account-b7-manual-preparation.md). 앞으로 CUA/getApp/자동 브라우저 제어를 사용하지 않는다. 현재 OFF/B6/CLOSED이며 `시작` 전 원격 활성화·Pages 배포 금지. 기존 자원 재사용, 누적 실행6/120(잔여114), Pages7회 사용·OPEN8/CLOSED9만 다음 단일900초 창에 허용한다. 첫 주문은 frozen body를 수동 테스트 패널로 제출하며 일반 Checkout 인수와 구분한다. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지. 아래는 보존된 과거 기록이다.

> **B7 V3 최종 인수 재개:** [실제 결과](customer-account-b7-v3-continuation-results.md). 새 gate/실제 runtime·watchdog·복구 PASS. Chrome 파일 권한과 운영 탭 자동 화면 관찰로 중단했으며 Google/회원 주문 NOT RUN이다. H/쿠폰/7변수/deployment 재사용, 누적 실행6/120·Pages7/7, Account OFF403/Function OFF/B6/CLOSED 복원 확인. 운영 화면 관찰 FAIL을 별도 기록했다. **B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw UNVERIFIED 유지. 새 창 자동 재개 금지.

> **B7 V3 활성화 게이트 조사:** [진단·로컬 검증](customer-account-b7-v3-activation-gate-investigation.md). 과거 실패 predicate는 UNVERIFIED다. 사이트/lease 계측·bounded GET·진단 I/O 실패 시 OFF를 보강했고 실제 활성화·배포는 하지 않았다. 기존 H/쿠폰/7변수/guarded deployment 보존, 다음 실행에는 새 단일 창과 최소 Pages2회(누적7) 승인이 필요하다. 현재 OFF/B6/CLOSED, **B5 — DEFERRED — RELEASE BLOCKER** 및 과거 AU raw 차이 UNVERIFIED 유지.

> **B7 V3 HTTPS 재개 결과:** [최신 보고](customer-account-b7-v3-https-resume-results.md). 실제 HTTPS와 guarded runtime 검증은 PASS, OPEN 후 활성화 gate는 FAIL로 Account/공개 Function을 열지 않았다. watchdog 복원 verified=true, 명시적 flags false/B6/사이트 CLOSED. Pages 누적5/5, 실제 Google·회원 주문은 NOT RUN. B5 DEFERRED — RELEASE BLOCKER 및 과거 AU 차이 UNVERIFIED 유지. 아래 기록은 이전 단계의 증거다.

> **2026-10-18 B7 V3 조건부 실행 결과:** [최신 보고](customer-account-b7-v3-execution-results.md). V3 SHA 연결·7변수·guard/watchdog 로컬 검증을 완료했다. 실제 CLOSED Pages preview의 경로404로 필수 사전 조건이 실패해 인증 창은 열지 않았다. 신규 Function·변수·사용자·쿠폰·주문0, Account OFF403/Function disabled/B6/사이트 CLOSED를 확인했다. routing 수정은 로컬만 검증했으며 재개에는 HTTPS 재검증 및 배포 예산 승인이 필요하다. **B5 — DEFERRED — RELEASE BLOCKER** 유지. 아래 이전 승인·준비 기록은 역사적 근거다.

> **B7 V3 준비:** [새 manifest](customer-account-b7-execution-manifest-v3.json), [준비 계획](superpowers/plans/2026-10-18-customer-account-b7-v3-preparation.md), [검증 결과](customer-account-b7-v3-readiness.md)를 추가했다. 신규 변수 한도 7개는 제안 명세이며 `executionApproved=false`, 실제 추가/활성화/배포는 하지 않았다. 기존 V1/V2와 승인 SHA는 보존한다. 과거 운영 AU `projectConfig` 차이는 미확인이고 새 관찰 지문을 정상 기준선으로 승인하지 않았다. 실제 V3 실행 wiring·별도 승인·원격 명시적 flag 준비가 필요하다. **B5 — DEFERRED — RELEASE BLOCKER** 유지.

> **B7 V2:** 신규6건을 Renewal v2로 통일한 별도 manifest/실행 계획 및 [로컬 검증 결과](customer-account-b7-v2-validation.md)를 작성했다. 기존 V1 승인 기록은 보존하며, 새 SHA에 대한 조건부 실행 승인을 받았으나 compiled artifact 오류로 창을 열지 않았다. 후속 로컬 수정·보호장치 검증 결과는 [B7 V2 실행 준비 보고](customer-account-b7-v2-readiness.md)를 확인한다. 현재 신규 변수 필요7/승인5 충돌로 실제 실행은 차단 상태다. B5는 DEFERRED — RELEASE BLOCKER다.

> **2026-10-18 B7 조건부 실행 중단:** 승인 SHA는 일치하지만 Renewal writes ON에서 신규 legacy fixture 3건이 원본 서버의 `409 RENEWAL_CONTRACT_REQUIRED`로 거부된다. guard 구현/시험 창 개방 전 중단했으며 Account·Function은 OFF다. [실패 근거와 재개 조건](customer-account-b7-validation.md). 승인 manifest는 보존했다. 아래 기존 계획은 이 충돌을 해결하기 전 실행하지 않는다.

2026-10-18. 이 문서는 production 적용 전의 승인 절차다. 별도 승인 아래 [B1](customer-account-b1-validation.md), [B2 테스트 schema/조건부 migration](customer-account-b2-owner-execution.md), [B3 테스트 HTTPS·Google SDK 인증](customer-account-b3-google-validation.md), [B4 테스트 전용 Resend SMTP와 일반 sample 1건 수신](customer-account-b4-smtp-validation.md)을 완료했다. 테스트 Account와 신규 인증 진입은 OFF다. production migration/Function·사이트 배포/운영 Google·SMTP 변경/고객 데이터 접근·변경/main 병합은 실행하지 않았다. 공통 SMTP와 B5는 미실행이다. [B6 테스트 Function 구축·검증](customer-account-b6-function-validation.md)은 별도 승인 아래 완료했으며 공개 Function/Account는 차단 상태로 보존한다. 제품 고객 기능 frontend/server flag는 기본 OFF다. [검증 기록](customer-account-validation.md), [개인정보 절차](customer-account-privacy.md), [승인 설계](superpowers/specs/2026-10-17-customer-account-design.md)를 함께 검토한다.

## B5 단발 인수 PASS — 상시 운영 활성화는 RELEASE BLOCKER

[B5 FINAL 결과](customer-account-b5-final-execution-results.md)의 기존 G 단발 검증은 완료했다.
공통 SMTP는 원복했고 native Email OTP/Account는 OFF다. 상시 운영과 최종 출시 승인은 포함하지 않는다.

- [x] 기존 운영4개/Console의 단발 SMTP 영향·공유 quota·수신자 제한 부재를 명시적으로 승인
- [x] 이번 실행의 새 의미적 지문 전후 일치; 과거 Gallery/AU raw UNVERIFIED 보존
- [x] 전용 Sending Key/발신자·정식 root·보호 백업·동일 이미지 재생성4회 및 원복 검증
- [x] 실제6자리 OTP 수신·로그인·기존 G Google↔OTP 동일 UID 검증
- [ ] 상시 SMTP credential·발송 감시·공유 quota/남용 위험 운영 정책과 적용 승인
- [x] PR25/26 정상 main 통합 및 customer-OFF production 배포 (누적 시도2)
- [ ] 새 SHA의 잔여 owner schema/Function/상시 SMTP/UION·복구 범위 최종 승인 및 적용

G-only 수신자 제한이 입증된 것은 아니며 제품의 최종 수신자 정책으로 요구하지 않는다.
이번에는 새 OTP-first 회원을 만들지 않았으므로 그 신규 가입/Google 연결 경로도 별도 미검증이다.

## 후속 안정화 배포 gate

main의 주말 13:00 정책 통합, profile focus 보존과 Node 22/24 로컬 검증은 [안정화 기록](customer-account-stabilization.md)에 추가했다. 운영 배포 전에는 해당 문서의 **sharp Function 위험 대응**, 실제 target runtime(Review node-22 및 기존 reservation 배포 gate 구분), Linux native codec·공급자/ACL/실기기 검증을 확인한다. root production audit 0이나 Mac Node 22 통과만으로 gate를 해제하지 않는다. 실제 프로젝트/리소스·설정·권한 변경은 별도 승인 대상이다.

[B5 사전 점검](customer-account-b5-preflight.md)과 [공통 SMTP 실행·복구 계획](superpowers/plans/2026-10-18-customer-account-system-smtp.md)은 작성했으나 실제 적용하지 않았다. 기존 네 프로젝트의 Email OTP/Magic URL/Email-Password·Account가 ON이고 SMTP override는 OFF여서, 공통 host 적용은 그 네 프로젝트와 Console의 이메일 인증 경로에도 영향을 준다. 운영 영향 수용, system credential, `.env` 0600/원본 bytes 보존과 정식 root 인증, 실패 mail 1건 보존, 두 서비스 재생성·rollback을 별도 승인받는다. TO 제한 미입증이므로 공개 test OTP는 계속 보류한다.

Gallery raw project-config 지문 예외는 B5 보고서에 원인 추론과 한계를 기록했다. 자동 활동 저장/재암호화로 설명 가능한 패턴이지만 점검 전 semantic 자료가 없어 전체 불변은 확정하지 않았다. 공식 Owner GET의 전후 의미적 설정 비교를 추가하고 예외 검토 전 실제 적용을 보류한다.

## 적용 리소스와 설정

| 위치 | 필요한 변경 / 유지할 조건 |
| --- | --- |
| AU frontend | `VITE_MARKET=AU`, 기존 endpoint/project/resource 매핑, `VITE_RESERVATION_API_MODE=all`, 기존 `VITE_RESERVATION_API_FUNCTION_ID`; `VITE_CUSTOMER_ACCOUNT_ENABLED=false`가 기본값이다. 활성화는 별도 승인 후 `true` 빌드로 한다. KR에는 계정 경로가 없다. |
| 기존 reservation-api | 신규 모듈을 포함한 호환 archive. `CUSTOMER_ACCOUNT_ENABLED=false` 기본값. 기존 Function ID/runtime/execute roles/API key scopes, 쿠폰·메일·판매 플래그를 유지한다. 새 Function이나 고객 테이블은 만들지 않는다. |
| ACL 검증 | 기존 `APPWRITE_ADMIN_USER_IDS`를 schema 관리자 ID allowlist로 사용한다. `REVIEW_ADMIN_USER_IDS`는 기존 관리자 API 권한용으로 유지한다. 둘을 임의 대체하거나 권한을 확대하지 않는다. 두 설정의 실제 관리자 구성을 운영자가 대조한다. |
| reservations만 | optional string `customerUserId`, size 36, required false, 기본값 없음. `customerUser_created_idx`: key, `[customerUserId,$createdAt]`, `[ASC,DESC]`. 기존 데이터 backfill·ACL 변경 없음. |
| 기존 private 자원 | cake/class 예약, review/coupon/mail ledgers, 구성된 private Custom Cake 자원은 metadata 권한만 확인한다. 회원 연동·새 owner schema를 만들지 않는다. 미분류 DB/collection, 불완전 inventory, broad private ACL은 활성화를 차단한다. |
| 공개 설정·달력 | settings, cake pickup openings, class booked dates의 공개 read는 허용하되 일반 사용자 write 또는 documentSecurity 활성 상태는 거부한다. 실제 ACL이 맞지 않으면 OFF로 두고 원인을 보고한다. 자동 수정하지 않는다. |
| Account | Appwrite Account 및 Preferences의 `verygoodAuCustomer` namespace. 이름, 주문 연락 이메일, AU 휴대전화, 언어. 로그인 이메일은 별도이며 수정하지 않는다. 다른 prefs 보존. |
| 공급자 | Appwrite 1.8.1의 Google OAuth2 및 Email OTP 활성화, 승인된 Google test/production 클라이언트와 정확한 redirect URI, SMTP와 발신 도메인, Appwrite Web platform 등록 및 세션 cookie 정책 확인. B3은 별도 test Google/Web platform/SDK smoke만 완료했다. production provider/SMTP는 변경하지 않았다. |

서버 매핑은 `.env.example`과 `resolveCustomerAccountResources()`를 따른다. `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, server-only `APPWRITE_API_KEY`, cake/kids database·collection IDs, 기존 review/mail/custom 매핑을 승인된 대상으로 정확히 준비한다. 사용자 ID/키/실제 고객정보를 보고서·명령행 기록·브라우저 변수에 넣지 않는다. 신규 secret이나 API key scope 확대는 이 절차의 전제가 아니다. 현재 권한으로 metadata를 볼 수 없으면 활성화를 보류한다.

## 격리 환경의 필수 gate

[B7 Google-only 준비 계획](customer-account-b7-preflight.md)을 작성했으나 guard 구현·실제 활성화/주문 인수는 아직 미실행이다. 15분 제한·잔여 공개 invocation 위험과 정확한 자원 범위를 최종 승인받은 뒤 선행 검증을 통과해야 시작한다. B5의 미완료 체크박스는 그대로 유지한다.

사용자가 선택한 환경은 **B안: very-server의 기존 Appwrite 1.8.1 인스턴스 안에 별도 nonproduction project 생성**이다. 새 호스트·Compose·Appwrite 설치는 하지 않는다. [현재 사전 점검과 단계별 승인 계획](superpowers/plans/2026-10-17-customer-account-very-server-test.md)을 먼저 따른다. `verygood-au-account-test`의 B1/B2 자원과 B3 Google SDK, B4 테스트 SMTP 일반 메일 검증은 별도 승인 아래 완료했다. B6의 테스트 Function 1개는 차단 상태로 배포·검증했으나 공통 SMTP·실제 OTP·제품 회원 주문 통합은 미실행이다. Account OFF·다른 인증 7개 OFF·test authLimit 2를 유지한다.

SMTP/OAuth의 직접 SQL JSON은 암호화 envelope여서 enabled null을 미설정으로 해석하지 않는다. 기존 프로젝트의 실제 override/provider 상태는 별도 승인된 Console/API metadata 확인 대상이다. test project의 Custom SMTP는 B4에서 `auth-test.verygood-chocolate.com` 전용 Resend Key로 ON 설정했다. 도메인 제한은 수신자 제한이 아니며 1건 승인 주소 제한은 로컬 helper의 통제다. Google provider는 B3에서 등록했지만 Account OFF가 신규 client 인증을 차단한다. 기본 Google 로그인은 Testing 사용자 목록만으로 접근을 제한하지 못하므로 후속 재활성화의 시간·사용자 상한/추가 접근 제한을 다시 승인받는다.

같은 API host를 사용하므로 차단 기준은 **endpoint/project의 정확한 pair**다. 운영 project denylist와 테스트 resource ID allowlist를 확인하고, 운영 키·DB·사용자·Function을 복제/재사용하지 않는다. 새 프로젝트 생성에는 재시작이 필요 없다. 그러나 현재 공통 SMTP가 비어 있어 실제 OTP에는 별도 승인된 공통 설정 변경과 API/mail-worker 재생성이 필요하다. 기존 네 프로젝트의 저장된 OTP·Magic URL 설정이 켜져 있어 그 영향도 함께 승인받아야 한다. 프로젝트별 SMTP override만으로 이 영향을 없앨 수 없다.

SMTP 복구는 테스트 중지와 분리한다. 테스트 중지 시 새 인증·Function 실행을 차단하고 테스트 키만 revoke한다. **프로젝트 SMTP override를 끄면 공통 transport로 fallback할 수 있으므로 이를 발송 중지 수단으로 사용하지 않는다.** 공통 설정을 되돌려야 하면 별도 승인된 기존 값으로 해당 keys만 복원하고 두 서비스만 재생성한다. 공유 DB/Redis/queue/volume 전체 복구·삭제는 하지 않는다.

전용 SMTP credential·수신함·Google test users를 준비하고 실제 대상·버전·인증정보 주입 경로를 사람이 확인한다. 아래 실제 인증·권한 gate는 여전히 미실행이다.

1. Google → logout → 같은 이메일 OTP, OTP → logout → 같은 이메일 Google에서 `$id`와 신규 주문 소유권이 동일한지 확인한다. 기존 계정·다른 이메일·동시 최초 로그인·남아 있는 관리자/고객 세션도 확인한다. 공급자 동작이 다르면 활성화를 중단한다. 이메일을 이용한 주문 재귀속으로 보완하지 않는다.
2. 실제 OTP 신규/재로그인, 6자리 검증, 만료·재전송·429·SMTP 오류, Google 성공/취소/실패, blocked/deleted account, 세션 만료/로그아웃/재방문을 검증한다. cookie 제한과 Safari의 실제 동작을 포함한다.
3. 실제 Functions 실행의 platform ID/JWT를 JWT-only Account.get으로 검증하고, 위조 header/body/만료 JWT·A→B detail/cursor 요청을 거부하는지 확인한다. 게스트·일반 고객이 DB에 직접 예약/관리자 데이터를 읽거나 쓰지 못하는지도 확인한다.
4. 동시 requestId 재시도, 쿠폰 transaction/claim/reconciliation 경로, tied timestamp pagination, frozen 저장 주문의 가격·연락처, 관리자 Google/비밀번호 권한, 기존 guest lookup과 알림을 격리 데이터로 확인한다.
5. 실제 iPhone Safari/Android Chrome에서 360/390/768/1440px의 대응 화면과 Google 왕복 후 폼·카트·날짜·옵션·쿠폰·requestId·다른 탭 변경을 검증한다. 로컬 Chrome/WebKit Mock 결과는 실제 공급자/실기기 검증을 대체하지 않는다.

## 전용 additive migration

아래는 **미래 production 승인 후** 실행할 명령이다. 테스트 프로젝트만 B2에서 승인된 dry-run/조건부 apply를 완료했다. production 대상의 dry-run/apply는 실행하지 않았다. `npm run setup:appwrite` 전체를 운영 migration으로 사용하지 않는다.

사전에 shell 환경을 승인된 target으로 준비한다. 스크립트는 dotenv를 자동 로드하지 않는다. `CUSTOMER_ACCOUNT_MIGRATION_MARKET=AU`, HTTPS `/v1` endpoint, project ID, server key, 정확한 자원 매핑과 `APPWRITE_ADMIN_USER_IDS`가 필요하다. localhost/self-signed 우회나 redirect를 허용하지 않는다. 설정/권한 문제는 운영자 검토 후 별도 승인으로 해결한다.

```sh
node scripts/migrate-customer-account-schema.mjs --dry-run
```

GET-only로 버전 1.8.1, DB/collection inventory·ACL 및 기존 owner/index 정의를 검사한다. 출력 `changes`는 reservations의 누락 attribute/index만 나타낸다. `ready`는 두 정의가 모두 `available`일 때만 true다. `changes: []`라도 `processing`이면 준비 완료가 아니다. 값·타입·정렬·암호화·권한 불일치는 실패한다. `ready: true`는 공급자·전체 배포 준비 완료를 의미하지 않는다.

dry-run의 대상·결과와 기존 ACL/checkpoint를 검토한 후 **apply 승인을 별도로 받은 경우에만**:

```sh
node scripts/migrate-customer-account-schema.mjs --apply
node scripts/migrate-customer-account-schema.mjs --dry-run
```

누락 항목만 생성하며 각 status를 최대 30회, 1초 간격으로 기다린다. 실패/timeout 시 OFF를 유지한다. 이미 생성된 optional attribute는 삭제하지 않는다. 원인을 확인한 뒤 동일 전용 migration을 재실행한다. 주문·owner·기존 스키마·권한을 변경하거나 되돌리는 작업은 없다.

## Production 적용 순서 — 실행 전 별도 승인

1. 최종 커밋·diff·로컬/격리/실기기 결과, 실제 대상·관리자 IDs·ACL, migration dry-run, 보존 정책을 제출한다. 운영 배포·설정·거래성 smoke의 범위를 각각 승인받는다. 기존 frontend/backend deployment 및 변수·schema/ACL checkpoint를 안전하게 보관한다.
2. 승인된 전용 migration을 적용하고 `available`, ACL 불변, guest 원장 불변을 확인한다. 예기치 않은 자원이 있으면 활성화하지 않는다.
3. 호환 reservation-api를 customer flag OFF로 배포한다. guest create/lookup, 관리자 권한, 기존 reader·쿠폰·결제·메일을 승인된 데이터와 범위로 검증한다. frozen Custom/Class reader 및 판매 정책 플래그를 유지한다.
4. callback 복원 코드를 포함한 AU frontend를 customer flag OFF로 배포한다. `/account`와 `/account/auth/callback` direct load·noindex, 기존 hard 404와 카트 복원을 확인한다. 민감 페이지는 analytics/공개 sitemap에서 제외한다.
5. 격리 gate와 운영 검토가 모두 완료된 뒤 서버 flag를 ON, health ready를 확인하고 frontend flag ON 빌드를 순차 적용한다. Appwrite 변수 변경이 deployment 재생성을 요구하는 경우에도 별도 배포 승인과 checkpoint를 남긴다. 관리자/고객 전환·guest fallback과 오류율을 확인한다.

## 즉시 rollback

1. AU frontend를 `VITE_CUSTOMER_ACCOUNT_ENABLED=false`로 전환한 호환 빌드를 적용해 새로운 고객 인증 진입을 중단한다. 이어서 reservation-api의 `CUSTOMER_ACCOUNT_ENABLED=false`를 적용한다. 각 실제 배포·변수 변경에는 승인이 필요하다.
2. OAuth 진행 중인 탭을 위해 callback 및 checkout 복원을 포함한 버전을 유지한다. draft 유효기간은 30분이다. 플래그 OFF에서도 같은 탭의 저장 form/cart/coupon/requestId로 guest 제출이 가능하다. callback 없는 옛 frontend로 즉시 복귀하지 않는다.
3. 필요하면 저장 형식·coupon claim·알림·frozen reader·callback과 호환되는 검증된 deployment checkpoint만 사용한다. frontend/backend를 무조건 과거 SHA로 되돌리지 않는다.
4. optional owner attribute/index, 계정/preferences, 주문·원장·기존 ownership을 보존한다. rollback은 데이터 삭제·owner 수정·guest backfill·schema 삭제·권한 공개를 포함하지 않는다.
5. guest 생성과 예약번호+전화번호 조회, 관리자 권한, 카트·폼 보존을 확인한다. 쿠폰/결제/메일 등 실제 거래·알림을 일으키는 smoke는 승인된 범위에서만 수행한다. 인증만 장애인 경우 guest 경로는 account readiness와 독립적이다. Appwrite/DB 전체 장애를 우회하는 새 저장소는 없으며 기존 오류 안내와 카트/requestId를 유지한다.

계정 삭제는 rollback과 별개이며 [개인정보 처리 절차](customer-account-privacy.md)를 따른다. 로그인 고객에게 기존 비회원 주문을 자동 연결하거나, 이메일 일치로 이전 소유권을 복구하지 않는다.

### 2026-10-19 B5 final controlled attempt

[Result](customer-account-b5-final-results.md): integration CLOSED25 restore PASS;
Account/OTP/JWT OFF, Function OFF/B6, approved sessions cleared. B5 remains
**DEFERRED — RELEASE BLOCKER** because G-only native OTP recipient restriction is
not proven and root/backup/rollback prerequisites are not yet verified. No common
SMTP changes, key issuance, recreation or email sends. Fresh operating semantic
fingerprints matched before/after; historical Gallery/AU raw uncertainty remains.

### Pending B5 one-shot operational approval

[2026-10-19 V2 plan](superpowers/plans/2026-10-19-customer-account-b5-one-shot-otp.md)
proposes a temporary common SMTP change, one native G OTP/UID check and restoration
even on success. G-only is not a permanent product policy or a proven native
allowlist. Shared-quota/public-auth residual risk requires explicit approval.
B5 remains **BLOCKED — RELEASE BLOCKER**, CLOSED25 preserved; no execution performed.
