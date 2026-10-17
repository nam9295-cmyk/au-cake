# Customer Account 실제 인증 테스트 환경 사전 점검

2026-10-17 KST. 조사 기준은 `feat/customer-account`의 `bd8a03dbc2993bcf5ae7b62f54e38c4b983d170d`다. 이 문서와 [후속 실행 계획](superpowers/plans/2026-10-17-customer-account-provider-test-environment.md)은 **조사 결과와 승인 후 수행할 계획**이다. 프로젝트·컨테이너 생성, dependency 패치, Function 실행/배포, migration dry-run/apply, 인증·메일 발송은 수행하지 않았다. main 및 다른 worktree를 수정하지 않았다.

## 결론과 선택 비교

**A의 별도 Linux x86_64 테스트 호스트를 권장한다.** Appwrite 1.8.1, 전용 MariaDB/Redis/메일 수신기/executor를 운영 서버와 분리한다. Mac은 개발·브라우저 실행에 사용한다. 현재 Mac에 전체 스택을 추가하는 방안과 베리서버의 프로젝트만 분리하는 방안은 우선 선택으로 권하지 않는다.

가장 큰 이유는 SMTP다. 프로젝트별 SMTP 설정이 있어도 **1.8.1 Email OTP는 공통 `_APP_SMTP_HOST`가 비어 있으면 요청을 거부**한다. 실제 베리서버 API와 mail worker 모두 이 값이 비어 있다. B로 OTP까지 시험하려면 운영 인스턴스 공통 설정 변경이 추가로 필요하므로, 프로젝트 생성 승인만으로 진행할 수 없다.

아래 자원 예산은 소수 사용자의 순차 인증·주문·이미지 검증을 위한 **계획 추정치**다. 측정치 또는 Appwrite 1.8.1의 보장된 최소 사양이 아니다. 현재 공식 설치 문서는 2 CPU·RAM 4GB·swap 2GB를 요구하지만 현재 릴리스용 문서이므로 1.8.1 용량 보증으로 사용하지 않는다. [현재 설치 요구사항](https://appwrite.io/docs/advanced/self-hosting/installation)

| 기준 | A1: 현재 Mac | A2: 별도 Linux 호스트 — 권장 | B: 베리서버 별도 프로젝트 |
| --- | --- | --- | --- |
| CPU·RAM 계획 | Docker VM에 2–4 CPU·4–6GiB 필요 예상. 호스트 전체 8GiB라 개발 도구와 경쟁 | 4 vCPU·8GiB RAM·swap 2GiB 이상 예산. 단일 build/execution부터 측정 | 전체 스택 추가는 없음. 추가 사용량 1–2GiB, build/native 처리 시 2–4GiB 순간 여유를 계획. 동시성 1부터 검증 |
| 스토리지 예산 | 이미지·VM disk·build/log를 위해 추가 여유 30–50GiB 권장. 현재 여유 부족 | 시작 시 50GiB 이상 사용 가능한 SSD, log·archive 보존 상한 지정 | 테스트 archive·로그·합성 데이터용 추가 5–10GiB 예산. 기존 Docker 전체 사용량과 합산 |
| 구축 | Docker 설치/VM 자원 배분·ARM 이미지/실행기 검증·TLS 필요 | 새 호스트/Docker Compose v2·DNS/TLS·메일 설정으로 초기 작업 가장 큼 | 프로젝트·키·리소스 생성은 비교적 작음. OTP 공통 SMTP 전제 때문에 현재 상태에서는 단순하지 않음 |
| 검증 범위 | Google/OTP 가능하나 ARM과 Docker VM의 차이, 실기기 접속 제약 | 인증·쿠키·실제 JWT·ACL·주문·Linux x64 native 설치까지 가능 | 현재 운영 인스턴스의 registry/patch/DB와 가장 가까움. 부하·메일 장애 시험은 운영과 공유하므로 제한 |
| 운영 영향 | 베리서버 영향 없음. Mac 메모리/디스크·절전이 테스트에 영향 | 베리서버 영향 없음. 운영 API key/DB/메일 계정 미사용 | DB·Redis·메일 워커·executor·디스크·네트워크·IP reputation 공유. 프로젝트는 장애/성능 격리가 아님 |
| 복구 | 테스트 VM/스택만 중지. 명시적 테스트 volume만 이후 승인으로 정리 | 테스트 DNS/진입 차단 → 테스트 스택 중지, 증거·volume 보존. 운영 복구 불필요 | 테스트 진입/Function/메일만 중지. 공통 SMTP를 바꿨다면 별도 승인된 기존 설정 복원과 서비스 영향 점검 필요. 전체 서버/DB 복원 금지 |

별도 VM을 베리서버 **동일 물리 호스트**에 두면 CPU·디스크 장애 영역은 여전히 공유된다. 권장 A2는 별도 자원/호스트를 뜻한다. 호스트가 준비되지 않으면 로컬 Mock 검증 상태를 유지한다. B로 자동 전환하지 않는다.

## 읽기 전용으로 확인한 실제 자원

약 20:21–20:36 KST의 일회성 snapshot이다. 장기 여유량/성능 보장은 아니며 swap 누적 사용량만으로 현재 thrashing을 판정하지 않는다.

| 대상 | 관측 결과 |
| --- | --- |
| Mac | Apple M1, 물리/논리 8코어, RAM 8GiB. APFS 가용 약 14GiB. swap 사용 약 4.36GiB/6GiB, `memory_pressure -Q` free 43%. load average 약 3.28/2.72/3.40 |
| Mac Docker | PATH에 CLI 없음. `/Applications/Docker.app`, OrbStack 및 확인한 표준 CLI 위치에도 없음. 설치/다운로드하지 않음 |
| 베리서버 | Linux x86_64, 4 CPU, RAM 15.57GiB. `free` available 약 8GiB, swap 1.7GiB/4GiB 사용. 디스크 84GiB available, 62% 사용. load 약 0.34/0.34/0.30 |
| 공유 서비스 | Appwrite, Penpot, Chatwoot 등 공존. Appwrite API 약 588MiB, MariaDB 242MiB, Redis 20MiB, mail worker 17MiB. 관측된 Node 실행 컨테이너 약 32MiB. idle snapshot이며 build peak 아님 |
| Appwrite | API/worker 이미지 `appwrite/appwrite:1.8.1`, console 7.5.7, executor 0.7.22, MariaDB 10.11, Redis 7.2.4-alpine. 해당 프로젝트 version metadata도 1.8.1 |
| registry allowlist | 현재 `node-16.0`, `node-20.0`, exact `node-22` 포함. 프로젝트 SMTP enabled metadata는 null(명시적 활성화 아님). API·mail worker의 공통 SMTP host 모두 empty/unset |

SSH의 `free/df/uptime`, Docker의 선택한 상태·이미지·자원 정보 및 아래 두 Function의 배포 메타데이터/코드 아카이브만 읽었다. 기존 API key로 Function GET은 403이어서 키/권한을 변경하지 않았다. 대신 이미 허용된 서버 접근으로 DB의 **프로젝트 설정 중 version/SMTP enabled 및 대상 Function/deployment 메타데이터만** READ ONLY transaction에서 SELECT하고 종료했다. 고객 users/sessions, 예약/주문 document, 업로드, mail body/queue, execution/build log는 조회하지 않았다. 비밀값은 출력·문서화하지 않았다. DB ACL 인수 검증은 이번 조사에 포함되지 않았다.

## SMTP의 두 계층과 운영 영향

1. 인스턴스 `_APP_SMTP_*`와 `_APP_SYSTEM_EMAIL_*`는 기본 transport/sender다. 공통 값을 바꾸면 기본 SMTP를 사용하는 다른 프로젝트와 Console 계정 메일까지 영향을 받을 수 있다. API/관련 worker에 설정을 반영하는 작업도 운영 변경이다. [1.8.1 환경변수 정의](https://github.com/appwrite/appwrite/blob/1.8.1/app/config/variables.php)
2. 1.8.1에는 `/projects/:projectId/smtp`가 있고 `enabled`, host/port/secure/credentials/sender를 프로젝트에 저장한다. OTP의 mail payload가 override를 전달하고 mail worker는 override 또는 인스턴스 기본 mailer를 선택한다. 따라서 SMTP가 공통 설정만 있는 구조는 아니다. [프로젝트 SMTP 구현](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/projects.php), [메일 워커 구현](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Workers/Mails.php)
3. 그러나 `POST /account/tokens/email`은 override를 읽기 **전에** 공통 host가 비었는지 검사한다. 이 gate를 공식 1.8.1 source와 실제 배포 PHP 양쪽에서 확인했다. 프로젝트 SMTP만 활성화하거나 SMTP test endpoint만 성공하는 것으로 OTP 준비 완료를 판정하지 않는다. [OTP 구현](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php)

B에서 공통 host를 가짜 문자열로 채우거나 운영 SMTP를 Mailpit으로 바꾸는 우회는 제안하지 않는다. 다른 프로젝트 기본 메일을 오발송/실패시킬 수 있다. 기존 Penpot mailcatcher도 전용 테스트 수신기로 재사용하지 않는다. 별도 프로젝트 override가 운영 프로젝트 설정을 직접 덮어쓰지는 않지만 mail queue/worker 자원 및 공급자 quota는 공유할 수 있다.

기존 주문 확인/리뷰/예약 알림은 저장소의 Resend transport와 별도 Function 경로를 사용한다. Resend 설정은 Appwrite Auth SMTP를 대신하지 않는다. 반대로 Auth SMTP 변경이 그 Resend credential을 직접 바꾸는 것은 아니지만 공유 인프라 부하까지 무영향이라고 보장할 수 없다.

권장 A2에서는 전용 내부 Mailpit을 기본 SMTP로 두어 외부 발송 없이 실제 Appwrite OTP 생성·메일 수신·코드 검증을 먼저 시험한다. SMTP 1025는 테스트 Docker network 내부, UI 8025는 loopback/SSH tunnel 또는 인증된 내부 접속에만 둔다. relay/forward는 끈다. [Mailpit Docker 설정](https://mailpit.axllent.org/docs/install/docker/)

이후 별도 승인된 **테스트 전용** 외부 SMTP 계정·발신 subdomain·수신자 allowlist로 실제 Gmail 수신, TLS, SPF/DKIM/DMARC·spam/delivery를 시험한다. Mailpit 성공은 외부 수신 성공을 증명하지 않는다. 운영 SMTP key, 운영 발신 domain의 설정 변경, 실제 고객 주소는 사용하지 않는다. 테스트 프로젝트의 SMTP 설정을 껐을 때 인스턴스 Mailpit으로 되돌아가는지도 합성 메일로 확인한다.

## 테스트 자원·사용자·메일 분리

- 인스턴스 secret, 관리자 계정, project ID, server key, DB/collection/bucket ID, Function, OAuth client, SMTP credential을 모두 nonproduction 전용으로 발급한다. 운영 백업/프로젝트 export/customer rows를 복제하지 않는다. suffix와 ID만 바꾼 운영 credential 재사용도 금지한다.
- 테스트 origin과 API는 같은 전용 테스트 site의 HTTPS sibling host를 권장한다. 예: `shop.<test-domain>` / `api.<test-domain>`; 아직 미선정·미생성이다. 생산 origin/platform, wildcard redirect는 등록하지 않는다. localhost는 초기 smoke용이며 Safari/실기기 cookie 인수는 유효한 HTTPS로 수행한다. [Appwrite custom domains](https://appwrite.io/docs/products/network/custom-domains)
- 별도 브라우저 프로필과 모바일 test session을 사용한다. 운영 사이트를 열지 않는다. test endpoint/project **정확한 pair allowlist**와 운영 pair denylist를 요청 전에 검사한다. B를 선택하면 host 전체 차단으로 테스트 host도 차단하지 않도록 project pair까지 판정한다. 전용 키가 승인된 test project 외에 쓸 수 없어야 한다.
- 기본 Account는 Google-backed 테스트 mailbox 2개(G1: Google 먼저, E1: OTP 먼저), 공격/교차 소유권용 B, allowlist 관리자 M으로 구분한다. Google과 OTP 교차 시험은 **같은 실제 primary 이메일**을 사용한다. Gmail dot/plus alias가 같은 UID라고 가정하지 않는다. 테스트 주소 원문은 private 실행 manifest에만 둔다.
- 일반 케이크·초콜릿 신규 주문만 회원 연결한다. kids 및 review/mail baseline 자원은 기존 inventory/readiness 계약에 필요한 **빈 테스트 자원**으로 준비할 수 있다. Custom Cake 회원 연동/owner schema/폼 복원은 만들지 않는다. 미구성 Custom namespace를 위해 운영 DB를 복제하지 않는다. 기존 판매 OFF/미정 가격 상품도 활성화하지 않는다.
- schema 관리자 allowlist는 기존 `APPWRITE_ADMIN_USER_IDS`, 관리자 API 판정은 `REVIEW_ADMIN_USER_IDS`다. 테스트 관리자 M의 실제 UID를 각 계약에 맞게 대조한다. 환경변수를 새 이름으로 대체하거나 일반 고객을 관리자에 넣지 않는다.
- 테스트 주문·쿠폰·메일에는 run ID를 사용한다. 합성 고객 이름/전화·연락 이메일만 사용한다. Appwrite OTP 메일과 주문 알림 모두 외부 고객 발송이 불가능하도록 분리한다. 알림 Function/schedule/webhook은 기본 비활성; 필요한 합성 알림만 전용 transport로 시험한다. 실제 결제/결제수단/유료 주문은 사용하지 않는다.
- public frontend에는 test endpoint/project 등 공개 설정만 둔다. server/API/SMTP/Google secret은 비추적 설정에 보관한다. trace/HAR/screenshot에 OTP, cookie, JWT, OAuth code/state, mailbox 본문을 남기지 않는다. 증거는 case ID·UID 일치 여부·HTTP code·비민감 resource hash 중심으로 보존한다.

## Google OAuth 준비와 실제 인증 검증표

Google Cloud의 **별도 테스트 프로젝트/웹 OAuth client**, 테스트 consent screen/audience 및 허용 test users를 준비한다. 운영 관리자 Google client를 수정/재사용하지 않는다. 기본 로그인에 필요한 최소 profile/email scope만 사용한다. Google redirect URI에는 Appwrite Console이 제공하는 **Appwrite callback**을 정확히 등록한다. 앱의 `/account/auth/callback`은 Appwrite의 success/failure return URL이며 두 callback을 혼동하지 않는다. scheme/host/path/port/trailing slash까지 대조한다. [Appwrite OAuth 설정](https://appwrite.io/docs/products/auth/oauth2), [Google redirect 규칙](https://developers.google.com/identity/protocols/oauth2/web-server), [테스트·운영 client 분리](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)

1.8.1 source는 로그인하지 않은 OAuth에서 identity 또는 같은 `users.email`을 찾고 OTP에서도 기존 email의 UID를 재사용한다. 이는 설계 근거이며 실제 공급자 검증 결과는 아니다. client에서 계정 병합/과거 주문 귀속으로 차이를 보정하지 않는다. [고정 버전 Account 구현](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php), [Email OTP 가이드](https://appwrite.io/docs/products/auth/email-otp)

아래 **모든 실제 시험은 미실행**이다. 기존 Mock 59 pass를 공급자 시험으로 합산하지 않는다.

| ID | 실행 절차 | 합격 기준 |
| --- | --- | --- |
| A01 | G1 신규 Google → Account.get → 일반 상품 주문 → 명시적 logout → 같은 이메일 OTP | Google 신규 세션, OTP 6자리, `$id` 동일, 앞 주문 계속 본인 소유, 테스트 Account 중복 없음 |
| A02 | E1 신규 OTP → 주문 → logout → 같은 이메일 Google → 재로그인 | 반대 순서도 UID/owner 유지. 로그인 이메일과 수정한 주문 연락 이메일을 혼동하지 않음 |
| A03 | 잘못된 코드·만료 코드·재사용·재전송·중복 클릭, SMTP 실패 | 인증 거부/실제 오류 표시, app cooldown과 실제 429 처리, 중복 세션/제출 방지. rate limit 전역 비활성화 금지. SMTP 실패 후 guest 진행 가능 |
| A04 | 새로고침/브라우저 재방문/focus, logout·session revoke/만료, A→B 전환 | 같은 UID 미저장 profile/detail 보존, 만료·타 UID/명시적 변경 시 이전 개인정보 폐기. 다른 탭도 세션 변경 반영 |
| A05 | 실제 AU Renewal Bag에 판매 중 상품·주말 13:00·옵션·쿠폰 입력 → Google 성공/취소/실패/뒤로가기 | cart/form/date/options/coupon/requestId 보존, 자동입력이 작성값을 덮지 않음, 다른 탭 최신 cart 보호, submit 자동 실행 없음. 30분 지난 draft와 storage 실패도 안전한 안내 |
| A06 | member A 주문 list/detail/pagination → B에서 A ID/cursor 요청, guest 주문·기존 guest 합성 row | 본인만 조회, foreign/missing/guest 동일 404, 직접 DB read/write 거부. email/phone 일치 guest row 자동 연결 0 |
| A07 | guest/member create, 같은 requestId 동시 재시도·ambiguous 응답 재시도, 쿠폰·알림 | 주문/claim 1회, member owner 서버 JWT-only Account.get UID와 일치, body/header 위조로 owner 변경 불가. 인증 오류는 조용히 guest 소유권으로 재제출하지 않음 |
| A08 | guest 예약번호+전체 전화 조회, auth 장애 및 고객 flags OFF 후 guest create/lookup | 기존 계약 유지. Auth만 장애일 때 guest 가능; Appwrite DB 전체 장애까지 해결한다고 보고하지 않음 |
| A09 | M의 기존 Google/비밀번호 관리자 로그인, 일반 A의 관리자 route/API 요청, 고객 상태에서 admin 검사 | M 권한 유지, A 관리자 API 403, 단순 관리자 검사로 A session 삭제 0. 권한은 서버에서도 강제 |
| A10 | 실제 Function 세션 실행과 위조/누락/만료 JWT·ID, 직접 DB 권한 확인 | 플랫폼 ID/JWT 검증, 타인/guest write 차단, private ACL 불변. unsafe/unclassified metadata면 flag OFF 유지·원인 보고 |
| A11 | Chrome/WebKit와 실제 iPhone Safari/Android Chrome에서 EN/KO·cookie 제한·OAuth 왕복 | 핵심 A01–A10 반복, 실제 cookie restore 확인. UI Mock/Playwright WebKit을 실제 모바일 Safari 합격으로 표시하지 않음 |

G1/E1 교차 순서마다 새로 준비된 테스트 Account 상태를 사용하고, 동일 프로젝트 안의 UID와 주문 연결을 비교한다. 프로젝트 간 UID는 비교 기준이 아니다. 다른 로그인 계정/관리자 세션이 남은 상태에서는 기존 session guard가 명시적 전환을 요구하는지도 확인한다. Google의 실제 허용/거절 화면은 사람이 조작하고 비밀번호·2FA 자동화를 만들지 않는다.

## Function 실제 배포와 로컬 배포 계약의 차이

아래는 이번 읽기 전용 조회 결과다. 운영 metadata를 변경하지 않았고 Function 요청도 실행하지 않았다. source archive와 build archive의 package manifest만 검사했다.

| 항목 | review-api | reservation-api |
| --- | --- | --- |
| active deployment | `6a90036a14939fa970f1` | `6ad33cd2615e4096f7bf` |
| 생성 시각 metadata | `2026-08-27 09:29:14.086` | `2026-10-17 09:16:02.406` |
| 실제 Function metadata | `node-22`, version `v5`, status `ready` | **`node-22`**, version `v5`, status `ready` |
| entrypoint / install | `src/main.js` / `npm ci --omit=dev` | 동일 |
| specification | `s-8vcpu-8gb` | `s-8vcpu-8gb` |
| 배포 source 및 build | sharp 0.35.4, node-appwrite 22.1.3, libheif-js 1.19.8 | sharp 0.35.4, node-appwrite 22.1.3 |
| source package engine | `>=22 <23` | 선언 없음 |
| 현재 로컬 deploy script | exact `node-22`만 허용 | 기본 `node-16.0`; `CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED=true`에서만 explicit `node-22` |

metadata 생성 시각은 DB 표현 그대로이며 KST로 재해석하지 않았다. `s-8vcpu-8gb`는 물리 서버 4 CPU보다 크다. 예약된 전용 CPU 8개가 있다는 뜻이 아니며 두 Function/다른 서비스의 동시 메모리 소비를 제한하는 근거로 사용할 수 없다. 테스트에서는 작은 명시적 specification과 순차 실행으로 자원을 측정해야 한다.

현재 로컬 script를 기본값으로 실행하면 운영 22와 다른 경로로 간다. sharp 0.35.4와 0.35.5 모두 Node >=20.9.0이므로 Node16은 native loader 조건을 충족하지 않는다. **reservation 배포 계약 정정과 Linux transaction 회귀 확인이 배포 전 blocker**다. Custom Cake 배포/판매 플래그를 고객 기능이나 sharp 업데이트의 우회 스위치로 켜지 않는다. exact Node22를 독립적으로 선택하고 Node16+sharp archive를 사전 거부하는 변경은 후속 코드 승인 항목이다. [현재 runtime gate](../scripts/reservation-api-deploy-config.mjs), [sharp 0.35.5 manifest](https://github.com/lovell/sharp/blob/v0.35.5/package.json)

### OS·Node·native 라이브러리

- 현재 설치 이미지 `openruntimes/node:v5-22`는 Linux amd64, `NODE_VERSION=22.23.2`, image ID `sha256:0cc350916c963d457cb371f02834de23cb8496ad6b54f3c8abc612a8c79fc9c3`다. 이미 실행 중인 같은 이미지의 generic Node 프로세스에서 Node 22.23.2, Alpine 3.23.6, **musl 1.2.5**, Node ELF type 3(ET_DYN, PIE와 일치)를 확인했다. 업무 모듈/Function handler는 실행하지 않았다.
- 설치돼 있는 legacy 이미지는 `v5-16.0`의 Node16.20.2 및 `v5-20.0`의 Node20.20.2다. 설치 존재는 이 두 Function이 그 이미지를 사용한다는 증거가 아니다. Function metadata는 모두 22다.
- 양 build archive에는 Linux glibc 및 musl용 sharp optional package가 함께 있다. 두 계열 `versions.json` 모두 libvips **8.18.6**, librsvg **2.62.91**, libheif **1.23.2**, WebP **1.6.0**이다. musl runtime에는 musl 바이너리가 필요하다. archive 내 파일 존재만으로 각 active handler의 실제 loader 선택/이미지 처리 성공까지 검증했다고 하지 않는다.
- 로컬 기본 Node24.12.0, 기존 검증 Node22.23.3은 **macOS arm64**다. 서버 22.23.2와 patch level·OS·libc·arch가 다르다. 새 격리 환경에서는 production과 비교 가능한 exact image digest/Node/libc를 기록하고 Linux 설치·load·처리를 확인한다. 태그는 바뀔 수 있으므로 tag 이름만 기록하지 않는다.
- sharp는 플랫폼별 optional dependencies를 설치해야 한다. Mac node_modules를 Linux archive에 넣거나 `--omit=optional`을 사용하지 않는다. 전역 libvips가 있으면 선택된 라이브러리가 bundled 버전과 다를 수 있으므로 `sharp.versions`를 실제 격리 runtime에서 확인한다. [공식 설치·cross-platform 조건](https://sharp.pixelplumbing.com/install/)

### sharp 보안 평가와 권장 패치 순서

공식 advisory는 `<0.35.5`를 affected, `>=0.35.5`를 patched로 분류하고 prebuilt 수정본의 librsvg를 **2.63.2**로 안내한다. glibc Linux의 특정 runtime 조건에서 가능한 RCE를 설명한다. 현재 관측한 Alpine/musl 및 PIE 조건에 그 RCE를 그대로 적용해 “운영 RCE 확인”이라고 보고할 근거는 없다. 반대로 취약 버전/구형 librsvg가 설치된 사실과 다른 경로의 위험은 남는다. exploit은 실행하지 않았다. [공식 sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)

| 경로 | 노출·회귀 고려사항 | 우선순위 |
| --- | --- | --- |
| review-api production | `src/photo.js`는 metadata 호출 후 실제 format을 거부하는 경로가 있다. invite 유효성/MIME 제한만으로 native SVG decoding 진입을 배제할 수 없다. 배포 source에도 SVG loader block 없음 | 서버 패치 1순위 |
| reservation-api production | custom photo codec은 sharp 전에 JPEG/PNG/WebP 실제 container를 검사해 raw SVG를 거부한다. 일반 주문 auth와 이미지 처리는 별도 경로지만 dependency는 production archive에 포함됨 | runtime gate 정정과 함께 서버 패치 |
| root dev dependency | 사이트 브라우저 runtime이 아닌 이미지 최적화 스크립트. 내부 SVG 생성/합성이 정상 경로에 있음 | 같은 패치 작업에서 별도 검증. Function만 수정하거나 root만 수정하지 않음 |

권장 순서는 다음과 같다. **전부 이번에는 미적용**이다.

1. 이번 metadata/manifest 증거로 대상 runtime을 고정하고 reservation의 Node16/22 배포 계약 불일치를 먼저 검토한다. 별도 승인 후 정확한 Node22 선택을 Custom 기능 플래그와 분리하고, unsupported Node16+sharp를 network 이전에 거부하는 RED/GREEN 검증을 추가한다.
2. root와 두 Function의 **6개 package.json/package-lock.json**에서 sharp를 exact 0.35.5로 개별 갱신한다. `npm audit fix`나 전체 dependency update를 사용하지 않는다. 각 디렉터리에서 lock 재현성과 `npm ci`를 확인한다. 공식 0.35.5는 Node >=20.9.0, libvips >=8.18.7, `@img/sharp-libvips-*` 1.3.4를 사용한다. 수정 bundle은 librsvg 2.63.2를 포함한다. [0.35.5 변경](https://github.com/lovell/sharp/releases/tag/v0.35.5), [native bundle 1.3.4](https://github.com/lovell/sharp-libvips/releases/tag/v1.3.4)
3. review archive(기존 shared 복사 포함) 및 reservation **checkpoint/full 양쪽**을 로컬 생성·검사한다. source에는 정확한 manifest/lock/src만, `.env`·secret·node_modules 제외. runtime build가 Linux에서 설치한다. 현재 builder가 full에서 chocolate write policy를 바꾸므로 test archive 생성 결과를 운영 판매 승인으로 해석하지 않는다. 검증된 기존 sales policy와 일치하는 artifact만 후속 배포 대상으로 승인받는다.
4. 깨끗한 Linux x64 **musl/production Node22 이미지**에서 `npm ci --omit=dev`, import 및 `sharp.versions`를 확인한다. 다른 Linux glibc 환경에서 실행할 예정이면 glibc도 별도 검증한다. Node16이 허용되지 않는지와 Mac arm64 Node22/24 회귀도 확인한다. installed runtime에서 patched librsvg가 실제 선택되는 것이 합격 기준이다.
5. 기존 review/Custom photo, deploy/archive 테스트를 유지한다. WebP·실제 HEIC/HEIF fallback·AVIF, 회전/투명도/색·크기/EXIF 제거·pixel/byte bounds·애니메이션·손상 입력·preview/cleanup/오류 code와 root crop/합성 결과를 비교한다. Custom codec은 JPEG/PNG/WebP/SVG 거부도 확인한다. review에서 원래 거부하던 format을 새로 허용하지 않는다. bytes 차이가 있으면 품질/개인정보 결과와 저장 계약을 검토한다.
6. 전체 테스트·account/renewal·lint/TypeScript·AU/KR build 후 **별도 승인된 격리 환경에만** patch artifact를 설치해 같은 codec/주문/transaction smoke를 반복한다. 운영 rollout은 별도 승인과 기존 artifact/변수 보존 후 수행한다. 이전 취약 artifact로의 긴급 복귀가 필요하면 노출 제한을 포함해 별도 판단한다.

업데이트가 지연될 때 maintainer의 `sharp.block({operation:['VipsForeignLoadSvg']})`는 서버별 보완 후보다. 코드 변경 및 정상 format 회귀 승인이 필요하며 root 전체에 적용하면 내부 SVG 최적화가 깨질 수 있다. account feature OFF만으로 기존 review 처리 위험이 해결되지는 않는다.

양 deployed source manifest hash는 현재 로컬 Function manifest hash와 일치했다. runtime source 전체가 같다는 뜻은 아니다.

| 파일 | SHA-256 |
| --- | --- |
| review-api/package.json | `2ada14cb49ce691cced873d9d07f642faf2560c1476548c70f02b40501833b5c` |
| review-api/package-lock.json | `835b7da6d365298ff7eb5587df7dac8515b1e29b420e243790ee0e5848841440` |
| reservation-api/package.json | `90c647325611bb1a5cc46f6ed482010b71a12ab981df92694d2f71a0ca35000b` |
| reservation-api/package-lock.json | `584f672ec0499302a0d651e178a33153aaf144965790f506e8f2b95dc2e51079` |

## 승인 항목·진행 기준·복구

실행 계획의 P1–P6은 A2 기준이다. **다음 승인이 있어야 시작한다.**

1. 테스트 호스트 위치/비용·4vCPU/8GiB/50GiB 예산, Docker 설치와 전용 volume/network, DNS/TLS 및 제한된 접근 범위.
2. 전용 Appwrite 1.8.1 instance/project/admin/API key, 합성 baseline schema/fixtures와 additive owner migration, 테스트 Function 배포 및 nonproduction flags 활성화.
3. Google Cloud 테스트 client/consent/test users와 정확한 callbacks, Appwrite provider 설정. 운영 관리자 client는 그대로 보존.
4. 내부 Mailpit, 이후 외부 SMTP sandbox와 발신 subdomain·수신자 allowlist, 테스트용 Google-backed mailbox 사용. 운영 메일 설정 변경은 포함하지 않음.
5. 별도 로컬 sharp 패치·reservation runtime 배포 계약 정정 및 Linux image 테스트 범위. 이후 테스트 Function 배포 승인과 운영 패치 승인은 서로 별개.
6. 실제 합성 주문/쿠폰·격리 알림·cookie/JWT/직접 ACL 검증 및 증거/테스트 데이터 보존·삭제 범위.

B를 선택한다면 위와 별도로 **운영 인스턴스 공통 SMTP 설정/관련 container 재구성, 다른 프로젝트 기본 메일 영향 분석, 자원 상한과 중단 기준**을 승인받아야 한다. 현재는 그 변경을 하지 않으므로 B의 OTP 실행 준비가 완료된 상태가 아니다.

실행 순서는 target guard → 전용 호스트/SMTP sink → 전용 project/합성 schema·runtime gate/patch → Google·외부 SMTP → A01–A11 → OFF·재인증·guest 복구 검증 및 보고다. 각 단계의 gate가 실패하면 이후 활성화를 멈춘다. ACL이 넓거나 서버 transaction/JWT 계약이 맞지 않으면 권한 완화·이메일 owner 재연결·Custom 기능 활성화로 통과시키지 않는다.

테스트 종료/실패 시 전용 frontend 진입 및 customer flags OFF, 필요 시 테스트 provider/Function 중지, OAuth callback과 30분 draft 복원·guest 경로를 확인한다. key revoke/메일 중지는 테스트 자원에만 적용한다. 증거·합성 데이터·volume은 기본 보존하고 이후 승인된 ID 목록만 정리한다. 전체 Appwrite/DB 복원·운영 resource 삭제·Git reset/GC는 복구 절차에 포함하지 않는다. 운영 migration/배포/rollback은 기존 [운영 절차](customer-account-rollout.md)에 따라 다시 승인받는다.

## 이번 조사 검증과 남은 사항

- 시작 worktree/branch/HEAD/clean 상태, 실제 host/Function metadata, source/build manifest·native versions, 공식 고정 버전 source와 patch release를 확인했다.
- 새 파일은 이 조사 문서와 실행 계획뿐이다. dependency·제품·Function·배포 script·환경설정을 변경하지 않았다. 전체 테스트/빌드는 문서 작업에서 재실행하지 않았다. 기존 **1835 pass / 0 fail / 1 skip**, 신규 **59 pass**, AU/KR·lint/TypeScript 통과는 [이전 안정화 증거](customer-account-stabilization.md)이며 이번 실행 결과가 아니다.
- 실제 Google/OTP/SMTP delivery·세션 cookie·새 코드의 Linux native load·Appwrite JWT 실행·direct DB ACL·transaction·실기기 A01–A11은 미검증이다. 운영 활성화 준비 완료라고 판정하지 않는다.
- 새 테스트 호스트/domain, Google test users/mailbox 소유자, SMTP sandbox와 비용/보존기간은 사용자가 실행 전에 선택·승인해야 한다. 실행 계획 검토 후 여기서 중단한다.
