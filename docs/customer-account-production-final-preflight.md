# AU Customer Account — Production Final Preflight

> Historical initial preflight below. Current main08799b7/OFF Pages65a7ccae and consumed budgets are in [current release results](customer-account-production-release-results.md). Execute only the [new remaining-release plan](superpowers/plans/2026-10-19-customer-account-production-resume.md) after approval of its new manifest SHA; old main/Pages/budgets and approval below are not reusable.

2026-10-19. 시작 `c24e6ee`, 기존 feature worktree에서 Mac Codex 단독 진행. **운영 적용은 미승인/미실행**이다. 기존 Google·OTP·동일 UID·장바구니·MY ORDERS·실제 JWT 생성 PASS는 [최종 인수](customer-account-final-release-preparation.md)를 인용하고 반복하지 않았다. B5 단발 PASS와 상시 SMTP 미적용을 구분한다.

## 1. 실제 운영 metadata와 additive migration

공식 Console Owner API의 GET만 사용했다. 고객/주문 document 및 사용자 목록·실행 로그는 조회하지 않았다. DB2/Collection22의 complete inventory, enabled, documentSecurity, permissions, attribute/index metadata를 확인했다.

| 대상 | 현재 결과 |
| --- | --- |
| project/endpoint | `verygood-au` / `https://api.verygood-chocolate.com/v1` |
| cake DB | `verygood_cake_au`:20 collections |
| class DB | `6a47858e0016093ed816`:2 collections |
| private inventory |19: 기존 예약/리뷰/쿠폰6, email2, Custom Cake10, class reservation1 |
| public read-only |3: settings, cake_pickup_openings, class_booked_dates |
| ACL |22개 모두 enabled=true/documentSecurity=false. private는 기존 관리자 user ACL 또는 서버 전용[], public3개는 read(any)+동일 관리자 write만 허용. 일반 customer/any/users write 또는 private public read 없음 |
| owner field/index |둘 다 없음 |
| GET-only migration dry-run |30 GET/0 write, 예상 변경 정확히 Attribute1+Index1. `ready=false`는 미적용 schema 때문에 정상적인 판정 |

승인할 migration은 **`verygood_cake_au/reservations`에만** 다음 두 개다.

- `customerUserId`: string,size36,required=false,array=false,default=null.
- `customerUser_created_idx`: key,attributes `[customerUserId,$createdAt]`,orders `[ASC,DESC]`.

기존 `runCustomerAccountMigration`과 strict inventory/ACL validators를 그대로 사용한다. 실제 적용 시에도 fresh dry-run에서 동일2개만 누락됐을 때 attribute→available→index→available을 순차 생성하고 GET 검증한다. 전체 setup, backfill, guest 자동 연결, 기존 document/ACL 수정, Custom/Kids owner schema는 제외한다. 기존 Owner 인증을 사용하므로 새 운영 Appwrite API Key 발급/권한 확대는 필요하지 않다.

**Migration rollback:** 부분 실패하면 즉시 중단하고 customer/UI OFF를 유지한다. 생성된 optional field/index는 남겨도 기존 guest reader에 영향을 주지 않는다. 출시 rollback에서 삭제하지 않는다. 삭제·기존 데이터 변경·실패 schema 재생성은 별도 승인이다.

## 2. Admin·OAuth·Function 계약

- runtime `APPWRITE_ADMIN_USER_IDS`는 **존재하지 않는다**. `REVIEW_ADMIN_USER_IDS`는 secret으로 존재하지만 API 값은 비공개이며 현재 cold runtime도 없어 실제 목록의 동일성을 확인했다고 주장하지 않는다. 권한을 얻기 위한 execution/secret 추출을 하지 않았다.
- 실제22개 ACL에 등장하는 기존 관리자 UID는 정확히1개 `6a3785f5000b3e6adfc6`다. 이 **동일 기존 UID**를 새 `APPWRITE_ADMIN_USER_IDS` audit 변수로 설정하는 안이다. `parseAdminUserIds()`의 실제 환경변수와 일치한다. 기존 REVIEW allowlist/서버 관리자 검사/관리자 로그인/사용자 권한은 보존한다. 승인 시 기존 ACL UID를 새 audit 변수로 사용하는 것을 명시적으로 확인한다.
- 추가 Function 변수는 `APPWRITE_ADMIN_USER_IDS`(secret=true)와 `CUSTOMER_ACCOUNT_ENABLED`(secret=false)2개뿐이다. reader 단계false, writes 단계true를 **각 deployment 생성 전에** 고정한다. 기존37개 변수/secret metadata는 그대로 보존한다. secret GET의 빈 값을 PUT하여 덮어쓰지 않는다.
- 운영 Google enabled, client ID/credential 설정 존재, Account/OTP/JWT 이미ON, authLimit0, Custom SMTP OFF다. 이번 릴리스에서 운영 Auth switch/Google credential/allowlist를 바꾸지 않는다. 테스트 프로젝트 G/H UID/Client/Key를 운영으로 복사하지 않는다.
- 운영 platform에 `au.verygood-chocolate.com`, `au-stage.verygood-chocolate.com`이 등록돼 있고 두 HTTPS root는200/TLS 정상이다. DNS CNAME 응답은 proxy/flattening 때문에 관측되지 않았지만 Cloudflare 공식 Pages domains는 두 hostname의 연결을 확인했다. DNS/TLS 수정은 필요하지 않다.
- Appwrite Google callback: `https://api.verygood-chocolate.com/v1/account/sessions/oauth2/callback/google/verygood-au`. 프론트 success/failure는 같은 origin의 `/account/auth/callback?flowId=<uuid>`다. 공식 Google Cloud의 `verygood-backend-auth` Client 화면에서 Appwrite의 실제 client ID 일치와 exact AU URI 및 기존 main callback 보존을 읽기 전용으로 확인했다. Google 설정 변경은 필요하지 않다.

공식 Function GET과 active source download 결과:

| 항목 | 현재 / 유지할 값 |
| --- | --- |
| Function/active checkpoint | `reservation-api` / `6ad33cd2615e4096f7bf` |
| runtime/spec/timeout | `node-22` / `s-8vcpu-8gb` /60초 |
| execute/events/schedule | `[any]` /[] /`0 * * * *` |
| scopes |기존11개 유지. guest 실행을 위해 기존 any를 임의 축소/확대하지 않음 |
| endpoint |기존 `APPWRITE_INTERNAL_API_ENDPOINT=http://appwrite-internal-proxy/v1` 유지 |
| Renewal writes/preorders |**현재 둘 다true이며 그대로 유지**. 테스트 종료 때처럼 false로 바꾸지 않음 |
| Custom Cake |동일 cake DB의 기존10개 private collections와 모든 활성화/복구/할인 변수 유지. 회원 연동 추가 없음 |
| SDK/dependency |active node-appwrite22.1.3/sharp0.35.4 → prepared22.1.3/0.35.5. root browser SDK와1.8.1 실제 인수는 기존 PASS |

다운로드한 운영 source와 feature를 비교해 기존 source 변경은 `src/main.js` 한 개, 신규 모듈은 customer readiness/orders/identity3개임을 확인했다. 가격·Renewal codec/저장·픽업·fingerprint·쿠폰·endpoint·일반 health 모듈은 byte-identical다. 기존 알림 Function `6ad30f6be203f3dc513c`의 main 및 shared Renewal reader도 현재 소스와 동일하므로 재배포하지 않는다. 리뷰 Function의 별도 sharp0.35.4 위험은 잔존하며 이 배포에 섞지 않는다.

**범용 `deploy-reservation-api.mjs`는 이번 배포에서 사용하지 않는다.** Node16 default/custom gate,20초·1vCPU 등 재설정, scope 재설정, Chocolate checkpoint의 판매 flag rewrite가 현재 운영 계약과 다르다. 준비 archive를 기존 Function에 createDeployment(activate=false)하고 현재 Function 옵션은 PUT하지 않는다. build command만 기존 B6의 `npm ci --omit=dev --include=optional && node scripts/native-smoke.mjs --linux-node22`를 deployment에 지정한다. Node22 Linux native 검증은 기존 PASS를 인용하며 실제 운영 build에서도 동일 smoke가 성공해야 activate한다. 런타임 변경·조건 우회·자동 재배포는 없다.

Google Cloud 게시 상태는 Testing이고 UI는 브랜드 구성을 완료해야 publish할 수 있다고 표시한다. 그러나 [Google 공식 basic-scope 예외](https://support.google.com/cloud/answer/15549945?hl=en)에 따르면 이름/이메일/프로필 또는 OpenID만 요청하면 테스트 사용자 등록·경고·7일 만료 제한의 예외다. [Appwrite1.8.1 Google provider](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Auth/OAuth2/Google.php)의 기본 scope3개와 제품의 추가 scope 미요청을 대조했다. 따라서 현 Google-only 로그인에는 Testing 자체를 기술적 출시 차단으로 판정하지 않는다. branding/publish 변경은 별도 제품·운영 결정이며 이번 승인 범위에 넣지 않는다.

제품 `Functions`는 `Account`와 같은 browser SDK client/session을 사용하며 `setJWT()`로 별도 JWT-only transport를 만들지 않는다. [1.8.1 execution source](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Executions/Create.php)는 현재 session proof를 찾아 platform UID/JWT를 생성한다. 따라서 테스트 중계의 signed forwarding adapter를 production에 배포하지 않는다. 이 source 계약 확인은 새 provider 실행 인수가 아니며, bare JWT-only 도구를 native cookie 세션과 동일시하지 않는다.

## 3. D1 timeout 출시 판정

**현재 AU Renewal 주문 경로를 직접 차단하지 않는다.** `App.tsx`에서 AU `/cart`, `/reserve`, 일반 cake/chocolate 경로는 `AuRenewalShop`으로 일찍 반환한다. 실제 제출은 `createRenewalOrder`→상수/flag만 반환하는 `renewal-health`→`create-cake`다. Guest/member 모두 D1 일반 `health`를 제출 선행조건으로 호출하지 않는다. native Google/OTP와 MY ORDERS의5-call readiness도 분리돼 있다.

옛 Reserve/repository의 line capability에는 일반 health가 남아 있다. 또한 App의 legacy cart useEffect는 early-return 전에 등록되므로, legacy cart 조건에 따라 **백그라운드 health 호출이 가능**하다. 그 결과는 Renewal UI에 전달하지 않아 주문 버튼의 준비 조건이 되지 않지만 부하·지연 위험은 남는다. KR/기존 legacy 화면의 readiness 성공까지 이번 출시로 보증하지 않는다.

D1은 test 공개 endpoint/20초였고 운영은 internal proxy/60초다. 이 차이가 원인 해결이나 운영 health 성능 PASS를 증명하지는 않는다. 이번에는 health 실행·timeout 증대·통신 경로 변경을 하지 않았다. 기존 일반 health root cause UNVERIFIED는 후속 이슈로 유지한다. 운영 배포 검증에 옛 health를 필수 gate로 넣어 실패를 반복하지 않는다.

## 4. 상시 SMTP 유지 확정 — 로컬 구현 완료

[기존 운영 준비](customer-account-always-on-smtp.md)와 보존된 byte helper/operator를 재사용하는 `scripts/customer-account-system-smtp-production.py`를 추가했다. 이전 단발 operator SHA `0d68678a4f5e3169b84e7d24ea90651de699da694fd3ebeb3d3d3982b3717a09`는 변경하지 않았다.

동작은 다음과 같다.

1. 새 manifest/새 운영 승인/새 domain-limited Sending Key/정식 root/새0600 백업을 요구한다. 이전 approval·apply claim·Key를 재사용하지 않는다. root 전역 O_EXCL claim으로 다른 backup 경로에서 serve를 다시 실행해도 같은 승인으로 SMTP를 두 번 적용하지 못한다. 동일1.8.1 image와 원본 non-SMTP byte, Compose/큐0/0/failed1을 gate로 사용한다.
2. worker→API 재생성 전에 **480초 독립 systemd timer**를 실행한다. Mac 연결/heartbeat가 사라져도 root backup의 검증된 코드로 복구한다. mutable staging code에 의존하지 않는다. 이전600초 hard limit을 유지한다.
3. 실제 적용은 일곱 변수만 교체하고 두 컨테이너의 TLS/AUTH, public curl200(60초 한도)/내부 health, 원본 env에서 SMTP7개를 제외한 모든 값, 무관 컨테이너, 큐, 최신 운영4개 semantic/Console, quota/담당자 승인을 확인한다.
4. 30초 이내의 새 confirmation proof와 root 재검증을 **동일 operation lock** 안에서 확인한다. 검증 끝에도480초 미만이어야 한다. durable receipt→committed state를 먼저 저장한 후 timer를 해제한다. 이미 실행 중인 timer도 같은 lock과 receipt를 검증해 경합을 구분한다.
5. 미확정/불완전 proof/만료/worker·API·큐·정책 불일치이면 timer 또는 serve가 원복한다. timer가 rollback을 선점했으면 이후 confirm이 이길 수 없다. 유지 확정 뒤 Mac을 닫아도 자동 만료하지 않으며, 승인된 수동 rollback 경로는 보존한다.

서버에 새 wrapper/manifest를 올리거나 root serve/timer를 실행하지 않았다. **로컬17개 집중 테스트 PASS/0FAIL/0SKIP**이며 실제 production timer/재생성 인수는 아직 미실행이다. 실제 root 진입 후 기존 harmless timer probe도 PASS해야 SMTP 적용을 시작한다. 복구 검증 실패는 성공으로 처리하지 않고 수동 root 조치를 요청한다.

## 5. 운영 quota·남용·담당자 승인

공식 Resend Usage 화면의 최신 관측은 일5/100·월87/3000이다. animated-number 접근성 값은0/0 placeholder였으므로 실제 스크린샷의 표시값을 확인했다. Domains 화면에서 운영 root 및 B4 test 도메인 모두 Verified도 확인했다. 메일/Key를 건드리지 않았다. 적용 직전 다시 새 집계를 확보한다. Free quota100/UTC일·3000/월 및 rate10req/s는 팀 공유이며 Key/도메인 분리로 주문·리뷰 메일 예산을 강제 예약할 수 없다. [공식 quota](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [Key scope](https://resend.com/docs/dashboard/api-keys/introduction).

초기 승인 정책: 적용 시작/유지 확정 시 일 잔량≥50·월 잔량≥1000. baseline 대비5분10건 초과 증가, 일 사용50건 도달, 월80%,429/Auth/TLS 오류, queue/failed 증가 또는 예상 밖 발송은 신규 OTP 진입 차단·담당자 호출 기준이다. Appwrite 기존 abuse/email-IP/user 제한은 유지하지만 분산된 요청의 총량을 막지 못한다. UI OFF만으로 직접 native API 발송을 차단하지 못한다. 지속 남용이면 새 system Key 회수+공통 SMTP rollback이 필요하며 운영4개/Console 인증메일도 영향을 받는다.

책임자 제안은 `nam9295`(서비스 소유자), 실행은 승인 시간 동안 Mac Codex다. **이름만 적힌 것은 인수 수락이 아니다.** 첫 운영 관찰/이후 일별 quota 확인, 부재 시 대체 담당자·연락 방법, 공유 quota/배달 미검증 위험 수용을 최종 승인에 포함한다. 새 서버 감시/SMTP relay를 만들거나 상시 자동 남용 차단을 구현했다고 주장하지 않는다.

새 system Key는 검증된 root domain에 한정한 Sending access1개다. 기존 주문·리뷰/B4 Key는 유지한다. 유출/교체 시 새 system Key TLS/AUTH→worker/API 반영→기존 system Key만 회수한다. 원문은 root0600만 사용한다. B5 실제 OTP는 B4 override로 배달됐으므로 **운영 공통 fallback 배달은 미검증**이다. OTP를 다시 보내지 않는 이번 계획에서는 그 한계를 명시적으로 수용해야 하며, 수용할 수 없으면 별도 배달 검증 승인 또는 출시 보류다.

## 6. 한 번의 명시적 운영 승인으로 실행할 순서

이 절은 **승인 요청 범위 제안**이며 현재 권한이 아니다. 정확한 manifest는 `docs/customer-account-production-release-manifest.json`, executionApproved=false다.

| 순서 | 변경 / gate / 상한 |
| --- | --- |
| 0 | 최신 metadata/semantic/ACL/Resend·root 인증·백업/복구/timer probe·Google Cloud exact redirect/current client 변경 없음 재확인. 기존 baseline과 다르면 쓰기0으로 중단. 승인된 담당자 및 fallback/공유 quota 위험 수락 |
| 1 AU frontend OFF | 명시적으로 승인된 feature push/정상 main 통합1회. 현재 main=`34ba1072f475ba8458b25a8ffd7a9e5467293dbe`가 feature ancestor이며 자동 Git Pages 배포로 customer flag OFF frontend1회. main이 이동했거나 required checks 실패면 강제 병합/우회하지 않음 |
| 2 Schema | Owner 공식 인증으로 fresh dry-run 뒤 owner attribute1/index1만 적용·available 확인. ACL/기존 document 변경0 |
| 3 Compatible readers | 새 admin audit 변수+customer=false를 동결. 준비한 동일 source archive로 Function deployment1회, Linux native build PASS 뒤 activate. runtime/timeout/spec/11scopes/schedule/Custom/Renewal true/true 보존 |
| 4 Member writes | customer=true만 바꾸고 새 deployment1회. **변수만 바꾸고 옛 runtime을 재사용하지 않음**. production `customer-account-health` 읽기 실행 최대1회로 실제22개 inventory/owner schema·현재 runtime readiness 확인. ready=true이고8초 미만이어야 UI gate 통과. 일반 health/주문/고객 조회/실제 생성 실행0 |
| 5 SMTP | 새 Key1개 및 승인된7개 env 임시 적용, worker/API 각1회 재생성.480초 독립 복구 gate 안에서 운영/큐/TLS/health/quota를 확인하고 keep 확정. 조건 불충족이면 원복하고 UI OFF 유지. OTP 실제 발송0 |
| 6 Auth UI ON | `au-cake-next` production env의 `VITE_CUSTOMER_ACCOUNT_ENABLED=true`1개만 추가하고 준비된 ON artifact로 Pages1회. `/account`, callback, JS/CSS/MIME/noindex/hard404를 HTTP로 확인. 이미 PASS인 인증·주문 인수를 반복하거나 실제 고객 테스트 계정을 만들지 않음 |

정상 한도는 **승인된 feature push/PR 및 main 정상 통합1회, production Pages2회(OFF 자동+ON 직접), Function deployment2회, 읽기 readiness1회, owner schema2개, runtime 변수2개, frontend env1개, system Key1개, 컨테이너2회**다. 실패 대비 Pages 복구1회와 컨테이너 복구2회(총최대4)를 예약한다. 이전 테스트 Pages31/Function19/120은 독립 기록 그대로 둔다. 새 합성 주문/사용자/쿠폰/결제/메일/알림0. 실제 트래픽의 자연 발송을 agent 발송0과 혼동하지 않는다.

Cloudflare 실제 project는 **`au-cake-next`**, production branch main, 현재 checkpoint `0af308ee-ad99-4345-838e-649c5a60111a`다. `au-stage`도 같은 deployment를 공유하므로 두 hostname 동시 영향이 승인 범위다. 예전 `au-cake`는 자동 production builds=false/preview none이고 `au-cake-next`만 main 자동 배포가 ON이다. 이 설정은 변경하지 않는다. main 통합을 승인하지 않으면 자동 OFF 단계도 시작하지 않으며 임의로 다른 branch를 production에 올리지 않는다. main/production 배포는 이번 조사 중0이다.

## 7. 즉시 rollback

- 신규 진입: 첫 단계의 **새 코드/customer OFF** Pages checkpoint로 복구한다. `VITE_CUSTOMER_ACCOUNT_ENABLED`를 원래 absent/false로 되돌려 향후 Git build도 OFF가 되게 한다. 예약한 Pages 복구≤1회만 사용한다.
- backend: Customer flagfalse를 관리 metadata에 저장하고 **false가 동결된 compatible-reader deployment**로 재활성화한다. 새 배포를 반복하지 않는다. 원래 active Function도 비상 checkpoint로 보존한다. 기존 guest 판매 및 Renewal writes/preorders true/true, Custom Cake, schedule/options/scopes는 보존한다.
- **운영 Account/OTP/JWT를 테스트처럼 전부 OFF하지 않는다.** 이미 ON인 관리자/기존 서비스 인증과 다른 프로젝트를 파괴한다. 운영 세션 전체 삭제도 금지다. 새 기능 UI/server gate만 닫는다.
- SMTP 미확정이면 독립 root timer가 원복한다. 유지 확정 후 심각한 장애면 승인한 root restore로7개 필드/API·worker만 복구하고 새 system Key만 회수한다. public/internal health, 원본 full env/image/Compose, 큐0/0/failed1 및 무관 컨테이너·현재 semantic을 확인한다. failed 메일 재시도/삭제0. 안전 확인 불가면 성공 보고 대신 수동 root 조치 요청.
- optional field/index 및 생성 후 정상 고객 주문은 지우지 않는다. 이번에는 주문을 생성하지 않는다. Git 통합은 history rewrite로 취소하지 않고 feature OFF 상태를 유지하며 필요 시 정상 후속 revert/수정 커밋을 별도 승인받는다.

## 8. 증거·미확인·최종 판단

준비 산출물은 Git 제외 `.superpowers/sdd/2026-10-19-customer-account-production-preflight/`에 보관한다. OFF/ON frontend 각각1062파일, 공개2124파일의 test project/Function/UID 및 알려진 credential 포함 검사 PASS. Function archive56파일은 현재 원본 source/lock과 byte-identical이며 판매 flag rewrite0이다. `.env` 자동 상속을 끄고 실제 Cloudflare 공개 production 매핑만 사용했다. 이 빌드는 배포용 산출물 생성이며 전체 제품 인수 반복이 아니다.

현재4개 project의 Auth/SMTP/OAuth/service semantic은 직전 accepted evidence와 동일하다. 서버 공통 SMTP empty, mail queue0/processing0/failed1, image1.8.1. 마지막 샘플 RAM 약9.21GiB·disk약81.97GiB·load1約0.28. 과거 AU/Gallery raw 차이는 **UNVERIFIED 유지**이며 최신 semantic 동일성을 과거의 증명으로 바꾸지 않는다. 테스트 Account OFF/Function OFF/B6/CLOSED31과 기존 사용량도 보존한다.

**실행 전 남은 승인/조건:** 기존 ACL UID의 audit 변수 사용 승인, 새 root 세션/timer 실제 사전 probe, 최신 quota와 담당자 수락, 공통 fallback 미검증/공유 남용 위험 수용, 위 main+운영 변경의 명시적 일괄 승인. Google 설정 불일치·현재 drift·quota 부족이면 추가 자원을 만들지 않고 중단한다. review-api sharp 위험과 D1 원인/역사적 raw 공백은 별도 미해결로 남는다.
