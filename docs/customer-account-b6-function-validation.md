# B6 테스트 reservation-api 구축·검증

2026-10-18. `feat/customer-account`, 기존 customer-account worktree, Mac Codex 단독. B6 승인 범위의 로컬 패치 및 테스트 Function만 대상으로 한다. 실제 실행은 아래와 같이 완료했으며 Account OFF·공개 Function 진입 차단 상태에서 중단한다.

## B5 — DEFERRED — RELEASE BLOCKER

B5는 취소가 아니라 뒤로 미룬 필수 작업이며 B6가 대신 완료하지 않는다.

- [ ] 기존 운영 4개 프로젝트와 Console의 공통 SMTP 영향 승인
- [ ] 테스트 OTP 수신자 접근·남용 방지 입증
- [ ] Gallery 설정 의미적 지문 검증과 B5 raw 예외 검토
- [ ] System SMTP 전용 Key·발신자 확정
- [ ] 운영 보호 백업, root 인증, API/mail-worker 재생성·복구
- [ ] 실제 Email OTP와 Google↔OTP 동일 UID 검증

해결 전 native Email OTP OFF, Google+OTP 최종 출시 준비 미완료. Google-only 출시도 별도 제품 결정·승인이 필요하다.

## 실행 전 검증

시작 HEAD `9376aab`, clean. Console Settings와 정상 Owner CLI/API에서 endpoint/project ID를 확인했다. Account OFF, 7개 native auth OFF, authLimit 2, Google ON, B4 project SMTP ON 유지. B2 manifest SHA-256은 승인값 `75e18834d1020a0279946169ddc3e9c9d1e58684c76104a6738d92c559f8ef94`와 동일하다. GET-only 28회로 DB2/Collection12/Attribute182/Index38, 전체 available·정확한 ACL·owner schema·M UID를 확인했다. 운영 사용자·주문·메일 본문은 조회하지 않았다.

공식 registry가 node-22 (`openruntimes/node:v5-22`, base `node:22.9.0-alpine3.20`, x86/arm64)와 활성 `s-1vcpu-1gb`를 반환했다. 실제 native 시험은 Linux x86_64/musl 대상이다. 로컬 Mac Node22/24만으로 Linux 통과를 주장하지 않는다.

## 로컬 변경

reservation Function 및 로컬 시험용 sharp 0.35.4→0.35.5, 관련 binary/libvips lock만 갱신. 다른 패키지 업데이트·audit fix 없음. [공식 advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)는 glibc Linux의 조건부 librsvg 위험과 >=0.35.5 수정을 명시한다. 허용 입력은 기존 JPEG/PNG/WebP이며 SVG는 거부한다. 별도 review-api 0.35.4/lock은 변경·배포하지 않았고 high 1건은 미해결이다.

`resolveDeployConfig`의 명시적인 test 옵션은 exact test endpoint/project/DB/Function과 node-22만 허용한다. 기존 production Node16 기본값/Custom opt-in 및 판매 flags는 유지한다. 별도 B6 manager는 dotenv·운영 env 자동 상속·운영 ID·control endpoint·알림 credentials·타 DB table 매핑·중복 Function·무제한 재시도를 거부한다. 실패 후 자동 삭제·덮어쓰기 없음.

## 검증 한계

B6는 Account OFF이며 실제 사용자 JWT·회원 주문 생성·MY ORDERS·A→B 사용자 인수는 B7 별도 승인 대상이다. 공개 browser/product 통합 성공으로 보고하지 않는다. B5 공통 SMTP/서비스 재생성·실제 OTP·production/main 변경은 실행하지 않는다.

## 실제 생성 자원·배포 계약

- Function **1개**: `ca-test-reservation-api`, `node-22`, `s-1vcpu-1gb`, timeout 20초.
- Deployment **1개**: `6ad41e576cb7a8f346af`, build ready 후 해당 ID를 active로 지정했다. Function 자체는 계속 **enabled=false / execute=[]**다.
- Function 전용 variable **23개**: test DB 2개/기존 Collection IDs, admin M을 두 기존 allowlist에 지정, customer false, AU, catalog/email 기존 기본 계약, 새 test-only PIN/HMAC. 운영 secret·Resend·SMTP·payment credential 없음. API는 secret value를 빈 문자열로 숨기므로 원문 readback으로 검증했다고 주장하지 않는다. 생성 요청의 exact 매핑·secret 표시/키 목록과 공개 값은 검증했으며 실제 관리자 JWT 인수는 B7이다.
- 새 API Key **0개**. 기존 Owner의 정식 CLI 세션/공식 REST admin 관리 경로를 사용했다. 운영 key/권한 확대 없음.
- DB/Collection/Attribute/Index/fixture/사용자/Google/SMTP/Web platform 추가·변경 **0개**. Function 생성 시 Appwrite 내부에 따라오는 비활성 schedule metadata는 실행 schedule이 아니다. events=[], schedule empty, VCS/webhooks 없음.
- Archive 100,860 bytes / SHA-256 `b0fd0a953a0e8849e926eacd447042f8170963aa5b6f02a4a98bf2d806a6bd03`. package/lock/src/native-smoke만 포함, node_modules/env/credentials 제외. 기존 상품·가격·쿠폰 및 source write policies 그대로다. Renewal/preorders는 기본 OFF이며 활성화하지 않았다.

Appwrite 1.8.1 API에는 Function별 concurrency 입력이 없다. 전역 설정을 바꾸지 않고 공개 진입 차단 + 단일 in-flight runner + synchronous executions로 build/execution 시험 동시성 1을 유지했다. 서버 hard-cap을 새로 설정했다고 주장하지 않는다. registry의 사양 이름은 1gb이며 실제 executor cgroup은 **CPU quota 100000/period 100000 (1 CPU), memory 1,024,000,000 bytes (976.6MiB)**였다. 이를 정확히 1,073,741,824 bytes의 GiB로 오표기하지 않는다.

## 실제 Linux native·권한 결과

실제 build output: **Node 22.23.2 / linux / x64 / sharp 0.35.5 / libvips 8.18.7 / librsvg 2.63.2**. registry의 base 문자열 22.9.0과 실제 image Node patch는 다르므로 실측값을 기준으로 기록했다. locked Linux musl binary를 설치한 같은 archive에서 JPEG/PNG/WebP decode→회전·metadata 제거→WebP, 반복 결과 일치, SVG·truncated PNG 거부를 통과했다. 기존 로컬 codec suite는 크기/픽셀/애니메이션/APNG/JPEG multi-picture까지 통과했다.

| 실제 시험 | 결과 |
| --- | --- |
| 일반 API health | 200, status ready, cake/chocolate order lines·smore 호환 capability |
| customer health OFF | 200, enabled false / ready false |
| 회원 목록·상세·회원 생성 | 각각 503 CUSTOMER_ACCOUNT_DISABLED. execution의 failed 표시는 의도한 차단이며 배포 실패가 아님 |
| guest 잘못된 입력 | 400 INVALID_PHONE |
| guest lookup | 최초 smoke는 phone 필드 대신 customerPhone을 넣어 400 INVALID_LOOKUP. 올바른 phone 계약으로 별도 bounded 확인: 200, result null |
| 관리자 달력 상세의 인증 없는 요청 | 401 CALENDAR_UNAUTHORIZED |
| private Collection 9개 직접 client 조회 | 모두 401, 자료 반환 없음 |
| 공개 Function 실행 | 404 function_not_found, 실행/고객 데이터 생성 없음 |
| test admin/schema ACL | B2 M UID·정확한 ACL·available owner schema 확인. 실제 관리자/고객 JWT 로그인 권한 시험은 B7 미실행 |
| Account | 계속 OFF, client 403 general_service_disabled. Google/SMTP override 보존 |

실제 새 주문·결제·이메일은 0건이다. 정상 guest 생성·requestId/쿠폰·AU Renewal·관리자 세션 회귀는 로컬 전체 suite에서 통과했다. 실제 guest 신규 주문 저장·회원 주문·My Orders·동일 UID·고객 A/B·모바일 공급자 왕복을 이번 B6 성공으로 포함하지 않는다.

Console은 active deployment를 표시하면서 `Some configuration changes are not live yet` 배너도 표시했다. 실제 Function metadata는 live=false다. 고정 1.8.1 수동 activation source는 deploymentId/internalId/createdAt만 갱신하고 live를 true로 설정하지 않는다. 기존 activation 회귀 테스트도 이 차이를 다룬다. 따라서 banner를 숨기기 위해 재배포/metadata 수정을 하지 않았다. active ID 일치·build ready·실제 실행 결과를 별도로 검증했으며, B7 전 운영자가 이 Console 표시 차이를 알고 있어야 한다. [고정 source](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Functions/Deployment/Update.php)

## 로컬 검증·미해결 취약점

- 전체 `npm test`: **1,886 pass / 0 fail / 1 skip**, 총 1,887. 기존 market skip 유지.
- account group: **109 pass / 0 fail / 0 skip**.
- Node22.23.3 집중 검증: **34 pass / 0 fail / 0 skip**. Mac Node24.12.0 전체 suite와 구분한다.
- runtime 선택 RED 1→GREEN18, B6 guard RED4→GREEN4, native gate는 0.35.4에서 PATCHED_SHARP_REQUIRED 실패 확인→0.35.5 통과. 새 검증은 기존 테스트를 삭제·완화하지 않았다.
- ESLint, TypeScript `tsc -b`, 신규 mjs 개별 ESLint, AU/KR build 모두 exit0. 기존 bundle 크기 경고는 남아 있다.
- 첫 전체 run은 KR build와 병행한 생성 파일 때문에 SEO `llms text exposes current public menu, confirmed prices and archived classes` 1건 실패(1,884 pass / 1 fail / 1 skip). 원인은 공용 public/llms.txt의 KR 출력이다. AU build로 원상 복원한 뒤 build와 분리한 전체 run을 위 최종 결과로 통과했다. 제품/테스트 수정으로 숨기지 않았다.
- reservation Function audit **0**, root production audit **0**. root dev tool audit **4**: baseline-browser-mapping moderate1, brace-expansion/browserslist/source-map-js high3. 별도 review-api sharp **high1 미해결**, package/lock 및 운영 배포는 그대로다. 해당 운영 image가 패치됐다고 보고하지 않는다.

## 서버·운영 불변

B6 전후 기존 4개 프로젝트의 9범주 raw metadata·schema/ACL·Function/active deployment·key/platform 지문은 모두 동일했다. 정상 Owner console-project GET으로 만든 각 필드의 canonical 의미적 지문도 기존4와 테스트 project에서 동일했다. Gallery는 이번 전후 비교를 통과했으나, B5 이전 semantic baseline 부재와 당시 raw 예외를 소급 해소한 것은 아니므로 B5 검토 항목은 유지한다. core5의 container ID/image/start/env도 동일하다. 운영 고객·주문·메일 payload는 열지 않았다.

host available RAM **8.994→최종8.780GiB** (중간 관측8.752GiB), disk **83.09→82.994GiB**, load1 **0.12→최종0.28**. 실제 create/build/smoke 중 5개 표본의 최소 available RAM **8.765GiB**, disk **82.995GiB**, max load1 **0.335**, OOM0, 모든 version probe healthy. 샘플 사이의 순간 peak를 측정했다고 주장하지 않는다. 이후 단일 관측 CPU API0.01%/mail-worker0.00%/executor0.00%/test runtime0.01%, test runtime RSS 약27.69MiB. 자원 중단 기준에 도달하지 않았다. API/mail worker/DB/executor 재시작·재생성은 실행하지 않았다. 테스트 runtime container만 정상 Function 수명주기에 따라 추가됐다.

## 중단 상태·B7 전 준비

Account OFF, native OTP OFF, static 신규 인증 진입 OFF, customer flag OFF, 테스트 Function public disabled/execute=[] 상태로 보존한다. B4 SMTP와 B3 Google도 보존한다. B5/B7/B8을 자동 진행하지 않는다.

B7 전에는 별도 승인으로 제한된 Account/Google 인증 창·허용 사용자/기간·watchdog·제품 테스트 배포/flags·실제 JWT/회원 주문/ACL·guest 저장 및 멱등성·브라우저 복원을 준비한다. 공개 Function 실행 허용도 별도 통제 범위를 먼저 정해야 한다. B5 수신자 통제와 공통 SMTP 적용·복구 승인이 없으면 OTP와 교차 UID 검증은 열지 않는다. 이번 B6 완료는 Google+OTP 출시 준비 완료가 아니다.

로컬 코드 커밋 `ec167dd`. Mac Codex 단독 self-review로 exact target/create-only/불변 조건·secret 비출력·패키징·권한과 실행 결과를 검토했다. production/site/main 적용 없음. 보호 evidence·비추적 credential 파일은 보존한다.

최종 보호 검사: 기존4 raw9범주/core5 불변을 다시 확인했다. B6에서만 사용한 현재 CLI 세션을 공식 API로 revoke한 뒤 old cookie401 및 공식 CLI local cookie 제거를 확인했다. 기존 browser Owner는 보존했다.
