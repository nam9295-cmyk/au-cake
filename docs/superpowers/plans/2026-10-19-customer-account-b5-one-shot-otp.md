# B5 단발 native Email OTP — 운영 영향 승인안

2026-10-19. `feat/customer-account`, Mac Codex 단독. **계획만 작성했으며 실행 미승인**.
B5는 **BLOCKED — RELEASE BLOCKER**, 기존 CLOSED25 안전 상태를 유지한다.
기존 Google/세션·G/H 장바구니·MY ORDERS·readiness PASS는 재실행하지 않는다.

- [실행 명세 V2](../../customer-account-b5-one-shot-otp-manifest-v2.json)
- 명세 SHA-256: `1ba95fe97db0dbc939227b832b9377918a0a1126e93ccc5f11de58e255d479a1`
- [기존 SMTP 실행·복구 명령](2026-10-18-customer-account-system-smtp.md)
- [직전 실제 점검](../../customer-account-b5-final-results.md)

## 1. 판단과 기존 운영 영향

**G-only 강제 수신자 제한을 별도 개발하지 않고, 잔여 위험을 명시적으로 수용한
단발 검증은 조건부로 가능하다.** 이를 제품의 영구 수신자 정책으로 만들지 않는다.
권장안은 공통 SMTP를 임시 적용하고 OTP1건과 UID만 확인한 뒤 **성공해도 원복**한다.
영구 SMTP 활성화·공개 고객 OTP 출시 승인은 포함하지 않는다.

| 대상 | 현재 확인한 상태 | 공통 SMTP가 유효해지는 동안의 영향 |
| --- | --- | --- |
| `verygood-main`, `verygood-au`, Gallery, Portfolio | Account·OTP·Magic URL·비밀번호 인증 ON, Custom SMTP OFF | 이미 켜진 native 인증 메일의 SMTP gate가 해제된다. 외부 요청으로 OTP/Magic URL·복구·검증 메일과 Auth token/user가 생길 수 있다. 프로젝트 설정을 저장하지 않아도 실제 동작은 달라진다. |
| 내장 Console | root signup limit1, invites ON, session alerts OFF | 공통 transport를 쓰는 초대·복구·검증 메일 등이 실제 발송 가능해진다. Console 관리자 권한·비밀번호·Google 설정은 변경하지 않는다. |
| 테스트 프로젝트 | Account/OTP/JWT OFF, Google ON, B4 SMTP override ON | 시험 동안 Account와 Email OTP만 ON. 기존 Google 유지, JWT·다른 인증 방식·Function은 OFF. 실제 G OTP는 B4 sender/key를 계속 사용한다. |
| 운영 주문·리뷰 알림 | 기존 Resend HTTP Key/Function 사용 | 코드·Key를 바꾸지 않는다. 다만 SMTP와 같은 Resend 팀 quota/요청량을 공유하므로 간접 영향이 있다. |

공통 system sender는 `appwrite-system@verygood-chocolate.com`, 표시 이름은
`VERYGOOD Chocolate System`이다. 테스트 OTP sender는 기존
`customer-test@auth-test.verygood-chocolate.com` 그대로다. system credential의
TLS/AUTH만 확인하고 일반 system 시험메일은 보내지 않는다.

API 교체는 모든 프로젝트와 Console의 로그인·주문 API·Function 호출·파일 API에
일시 통신 오류를 줄 수 있다. 정적 사이트 자체는 별도다. worker 교체는 메일 처리를
지연시킬 수 있다. 적용/원복 각각 API1회이므로 **API 교체 총2회**다. 이전 계획의
공백 추정은 회당30–120초이며 실측 보장이 아니다. 각 교체 후60초 내 health200/1.8.1
미복원은 실패 처리하고 승인된 복구로 전환한다. 전체 작업시간과 통신 공백은 구분한다.

## 2. 기본 보호 범위와 수용해야 할 잔여 위험

Appwrite1.8.1에 고정된 source와 이전 runtime hash 증거를 사용한다.

| 기존 기능 | 사용 방법 | 보장하지 않는 것 |
| --- | --- | --- |
| `_APP_OPTIONS_ABUSE=enabled` | 그대로 유지. native Client SDK/공개 API로만 OTP 요청. API Key·Owner·development key로 요청 제한을 우회하지 않는다. | 분산 IP·다수 이메일을 합친 전체 발송량 상한은 없다. privileged/key 요청에는 예외가 있다. |
| Email OTP 요청 | route 기본1시간 창에서 URL+email 및 URL+IP 각각10회 제한, 초과429 | G-only 또는 전체1건 제한이 아니다. alias hostname/별도 route·기존 프로젝트까지 통합한 상한으로 해석하지 않는다. |
| 토큰으로 세션 생성 | IP+userId 기준10회/시간 | 잘못된 코드 검증을 무제한 반복할 수 있다는 뜻이 아니다. 이번 운영자는 코드 제출1회만 수행한다. |
| 다른 프로젝트 Magic URL | 기존60회/시간 제한 유지; 복구·검증도 각 route 자체 제한 | 공통 SMTP 개방으로 해당 발송 경로가 열리는 위험을 제거하지 않는다. |
| test `authLimit=2`, 기존M/G/H3명 | 그대로 유지하여 신규 생성 경로를 제한 | 기존 G/H/M 이메일로의 요청은 제한하지 않는다. 사용자 수 제한을 발송 allowlist로 보고하지 않는다. |
| Resend 팀 quota/요청량 | 최신 공식 Usage 확인, 여유 일50건·월500건 이상일 때만 진행. 직전 관측은 일0/100·월82/3000·10req/s | quota는 운영 알림과 공유된다. 별도 Sending Key가 운영 몫을 예약하거나 recipient/Key별 quota를 강제하지 않는다. |
| 별도 system Sending Key | `sending_access`, 운영 도메인1개만 허용, 이번 작업 전용 생성·회수 | 도메인 제한은 FROM 제한이며 TO 제한이 아니다. 새 Key의 자동 만료가 입증된 것은 아니다. |
| 기존 감시·복구 | 새 semantic baseline, 메일 queue 집계, Resend 발송 집계, 서버 자원/health, root 복구 기한 | 샘플 간 발송, 이미 SMTP로 넘어간 메일, provider 집계 지연을 사전에 차단하는 방화벽이 아니다. |

**시험 운영자가 보내는 요청은 정확히1회다. 인스턴스 전체 발송을1건으로 강제한다고
보장할 수 없다.** 기존 프로젝트의 정상 메일이 겹치거나 제3자 남용이 발생할 수 있다.
알 수 없는 추가 메일·queue 증가·quota 급증/429가 보이면 재시도 없이 차단/원복한다.
공통 SMTP가 잠시 켜져도 운영 영향0을 요구한다면 이 안을 승인하지 않고5절을 선택한다.
기존 프로젝트 Auth 정책·firewall·전역 rate limit을 임의로 수정하지 않는다.

## 3. 실행 전 준비와 복구 조건 — 이번에는 실행하지 않음

1. 사용자 참여·메일함·Google 계정 접근 준비를 먼저 확인한다. 정식 Owner 세션과
   `ssh -tt very`의 사용자 직접 sudo/root 인증을 사용한다. 비밀번호는 채팅·파일에
   저장하지 않는다. 새 전역 관리자 Key/권한 확대/Docker host-file 우회는 없다.
   직전 비대화식 sudo 확인은 실패했으므로 **root 준비 완료로 보고하지 않는다**.
2. 기존 plan의 정확한 원본 `.env`/Compose SHA와 image ID, 여유 RAM≥3GiB,
   disk≥30GiB, queue0/0/failed1, 기존4+test semantic baseline, Console env 지문,
   최신 Resend quota를 재확인한다. 이는 변경 안전 점검이며 기존 제품 PASS의 재시험이 아니다.
   과거 Gallery/AU raw 차이는 UNVERIFIED로 유지하고 새 semantic drift는 중단한다.
3. 신규 Key1개: `VERYGOOD Appwrite SYSTEM SMTP B5 20261018`, `sending_access`,
   `verygood-chocolate.com`/`43b81ebb-788c-41ac-8f0b-2160249a1470` 한정.
   기존 주문·리뷰·B4 Key는 조회/교체/폐기하지 않는다. 정식 Resend 화면에서 생성하고
   Secret은 숨김 입력/보호 파일을 통해 전달한다. root0600 `.env`/credential만 사용하고
   browser bundle, argv, Git, 로그에는 넣지 않는다.
4. `/root/verygood-b5-backups/<UTC>/`0700에 원본 `.env`/Compose, resolved Compose,
   container/image metadata와 동일 image tar를0600으로 백업하고 checksum/용량을 검증한다.
   image는 `sha256:d6c8a343ef61ed16389b19664cfc30f0559aa5bfdb81965fcd2763d354f4964d`;
   pull/upgrade하지 않는다. 원본 `.env` 나머지 비UTF8 bytes·줄바꿈을 그대로 보존한다.
   `.env`는0600으로 제한하며 원복 후에도0600을 유지한다.
5. 변경은 원래 manifest의 정확한7개만이다: `_APP_SMTP_HOST`, `_APP_SMTP_PORT`,
   `_APP_SMTP_SECURE`, `_APP_SMTP_USERNAME`, `_APP_SMTP_PASSWORD`,
   `_APP_SYSTEM_EMAIL_NAME`, `_APP_SYSTEM_EMAIL_ADDRESS`. 값은
   `smtp.resend.com`/465/ssl/resend/새 Secret/`VERYGOOD%20Chocolate%20System`/
   `appwrite-system@verygood-chocolate.com`. candidate diff를 기계 비교해 다른 bytes,
   Compose service/image/mount/network 변화가 없을 때만 적용한다.
6. 기존 plan의 미작성 byte-preserving helper는 필요한 최소 plan/apply/rollback으로만
   준비하고 합성 env fixture의7개 변경·원복·동시 drift 거부만 집중 검증한다.
   새 시험 프레임워크나 전체 회귀 실행은 하지 않는다. 복구 helper가 없거나 준비 실패면 적용하지 않는다.
   기존 Google-only 검사/정리 조건을 그대로 재사용하지 않는다.1.8.1의 OTP는
   `TOKEN_TYPE_EMAIL` → `SESSION_PROVIDER_TOKEN` → `provider=token`이다. OTP 단계는
   시험 중 생성된 G/token 세션만, 최종 Google 단계는 G/google만 허용하고 M/H/알 수 없는
   새 세션은 중단한다. cleanup도 해당 G/token·google 세션만 허용하도록 바꾼다.
   `provider=token`만으로 OTP 성공을 주장하지 않고 단1회 native email-token 요청과
   코드 교환·UID 증거를 함께 확인한다. G/token 정상·H/token 거부·단계 오류·cleanup만
   기존 focused 테스트에 추가하고 새 프레임워크는 만들지 않는다.
7. **수동 root 복구 채널과 서버 자체의 최대600초 복구 job을 먼저 준비/검증한다.**
   기존 root session/SSH 연결이 끊겨도 원복이 실행돼야 한다. 새 SMTP 서비스가 아니라
   일회 root timer/기존 scheduler를 사용한다. scheduler 존재·권한, verify-only 실행과
   단일 lock/복구 journal을 먼저 확인한다. 정상 종료와 timer가 경합해도 재생성은 각1회다.
   작동 입증이 안 되면 적용하지 않는다. callback/heartbeat가 시험을 자동 성공 처리하지 않는다.
8. 원복은7개 원래 bytes를 복구하고 **API → mail worker**, 동일 이미지로 각1회.
   적용은 **mail worker → API**, 각1회. `up -d --no-deps --no-build --pull never
   --force-recreate --timeout 30 <정확한 서비스>`를 재사용한다. 최대 재생성4회,
   API는 최대2회. 부분 적용 실패 시 바뀐 서비스만 복구한다. 자동 재적용·무제한 재시도는 없다.

root 복구 job은 공통 SMTP bytes와 두 컨테이너만 원복한다. Console Owner cookie나
Cloudflare 토큰을 서버로 복사하지 않는다. test Account/OTP OFF·세션 정리·CLOSED27은
기존 Mac 컨트롤러/자격증명이 담당하므로 사용자는 종료까지 Mac을 켜고 연결을 유지한다.
Mac 단절 시 root SMTP 원복이 되더라도 test Auth/Pages까지 닫혔다고 간주할 수 없다.
이 경우 복구 미확인으로 기록하고 사용자의 수동 차단/재연결을 즉시 요청한다.

공통 SMTP 최대 노출600초는 **처음 새 SMTP로 메일을 보낼 수 있는 worker 재생성 직전**부터
계산한다. 시험 준비/사용자 인증 대기 시간을 무제한으로 더하지 않는다. 이는 B7의
15분 웹 시험을 재시작하는 것이 아니라 이번 운영 변경의 별도 승인 범위다.
Pages가 늦거나 사용자 코드 입력이 늦어도 기한을 연장하지 않는다.

## 4. 승인 후 최소 실제 순서

1. CLOSED25 상태에서 위 준비를 끝내고 OTP 전용 테스트 화면을 로컬 준비한다.
   기존 `CustomerAccountProvider`/`createCustomerAuth`/CartProvider·기본 Appwrite SDK와
   기존 AU isolated builder/CSP·CLOSED 산출물을 재사용한다. 예약·MY ORDERS·profile
   저장은 연결하지 않는다. read-only 주문 서비스는 unavailable로 고정하고 Function 호출0.
   테스트 코드에만 이메일을G로 고정하고 send/verify1회 버튼 잠금·durable claim으로
   실수 재전송을 막는다. 이를 서버 recipient 보호로 설명하지 않는다.
   비밀값 검사와 OTP 허용 Account endpoint·CLOSED 복원만 집중 확인한다.
2. Pages **OPEN26 1회**, 최종 **CLOSED27 1회**만 계획한다. 비밀키/Owner 세션/HMAC은
   browser에 주지 않는다. Account OFF를 유지한 채 HTTPS/CSP/asset만 확인한다.
   배포 실패 시 새 OPEN을 반복하지 않고 CLOSED27/기존 CLOSED 상태를 확인한다.
3. operator와 root 복구 담당이 준비되면 root 복구 기한을 설정하고7개 env 적용,
   worker 확인(TLS/AUTH, DATA 없음) → API 교체 → health/version60초 내 복원을 진행한다.
   다른 컨테이너, DB/ACL/Function/운영 project Auth는 변경하지 않는다.
4. 정상일 때 test Account/Email OTP만 ON. authLimit2, Google provider/B4 SMTP와
   다른 Auth OFF를 유지한다. JWT OFF, Function disabled/execute=[], B6, 모든 server
   customer/Renewal flags false다. 일반 client 요청에 Owner cookie/API key를 붙이지 않는다.
5. 사용자가 자기 Chrome에서 G 실제 이메일 `nam9295@gmail.com`로 **발송1회**를 누른다.
   Appwrite token 응답의 userId가 기존G `6ad38e4e0ffd5f810e23`인지 확인한다.
   틀린UID·신규 user·발송 실패/timeout이면 중단한다. 자동 재발송/계정 병합/사용자 삭제는 없다.
   rate headers가 제공되면 limit/remaining/reset만 남기고 실제 OTP/secret/본문은 남기지 않는다.
6. 사용자가 받은6자리 코드를 화면에 직접1회 입력한다. 코드·Cookie·JWT·OAuth code를
   Codex/Terminal에 보내지 않는다. Account.get/getSession 성공, 실제 UID=기존G를 확인한다.
   잘못된 코드/만료/네트워크 불명 상태는 재시도하지 않는다.
7. 기존 prefs의 비민감 digest/필드 일치와 동일UID에 따른 회원 장바구니 복원을 read-only로
   확인한다. 품목/수량·회원정보를 수정하지 않는다. 기존 주문 owner metadata 보존과
   이미 PASS인 동일 UID owner 조회 증거를 재사용하며 MY ORDERS/health를 다시 실행하지 않는다.
   이 보존 확인을 새 주문 생성/JWT 소유권 연결 인수로 확대 해석하지 않는다.
8. OTP 세션에서 로그아웃한 뒤 G의 Google 로그인1회만 사용자가 직접 수행한다.
   이번 검증 목적은 **OTP 이후 UID가 그대로인지**이며 Google 인수 전체를 반복하지 않는다.
   다른 UID/계정 충돌이면 즉시 중단하고 자동 병합하지 않는다.
9. 정상/실패 모두 test Email OTP·Account OFF/403, JWT OFF, 시험 세션만 정리,
   Function OFF/B6/flags false를 확인하고 CLOSED27로 닫는다. 성공해도 공통 SMTP7개
   원복/API→worker 복원을 실행한다. deadline이 먼저 오면 같은 복구 lock을 사용한다.
10. 원래 SMTP empty, system name/address 원복, image/non-SMTP bytes/다른 서비스 ID 불변,
    API/version, 기존4+Console semantic, queue0/0/failed1, B4 SMTP/Google 보존,
    Resend usage/delivery1건의 metadata만 확인한다. OTP 본문은 열지 않는다.
    queue 임시 대기/실패가 있으면 숨기지 않고 미완료로 보고하며 삭제/재투입하지 않는다.
    복구 verified 후 **새 system Key만 회수**, 백업 증거는 보호 보관한다. 기존 Key는 유지한다.

provider Usage는 집계 지연이 있을 수 있다. 가능한 공식 새Key/시험sender delivery 상태를
함께 보되 운영 개별 메일/수신자/본문은 조회하지 않는다. 기존 정상 발송과 겹쳐 총량이
늘었어도 임의로 남용으로 확정하지 않고, 귀속을 입증할 수 없으면 보수적으로 중단한다.
이미 전달된 메일·발급 token/링크는 원복으로 취소되지 않는다. queue flush/failed 재시도 금지.

PASS는 실제 수신·OTP 세션·G UID 일치·OTP 후 Google UID 일치·보존·완전 복구가 모두
증거로 확인됐을 때만이다. 그때도 상시 공통 SMTP/공개 고객 OTP 운영은 별도 미승인이다.
실제 회원 주문 생성 owner 연결, D1 원래 health timeout, 과거 AU/Gallery raw 불확실성은 별도 유지한다.

## 5. 공유 운영 위험을 수용하지 않을 경우

**기존 very-server 공통 SMTP는 그대로 두고, 별도 임시 Appwrite1.8.1 인스턴스에서
Auth만 시험**한다. 기존 A안 자료를 재사용해 Mac Docker 또는 승인된 별도 Linux의
가용 자원을 먼저 판단한다. 현재 운영 인스턴스의 DB/volume/queue/고객정보/Secret을
복사하지 않는다. 테스트 전용 project·Google Client/callback·SMTP credential만 사용하고
예약 DB/Function/주문·쿠폰은 만들지 않는다. 이메일1회·Google↔OTP UID 비교만 수행한다.

이 안은 기존4/Console 재생성·공통 Auth gate 개방을 피한다. 단, 새 인스턴스 UID 비교는
그곳에서의 인증방식 연결 검증이다. **현재 very-server의 기존G UID/prefs/order 보존을
실서버 검증했다고 주장할 수 없다.** 이 차이를 수용해야 하며 별도 환경 구성 승인과
일정이 필요하다. 현재 Appwrite Cloud는1.8.1 고정을 보장하지 않아 같은 버전 검증의
동등 대안으로 제시하지 않는다. 이번 요청으로 어느 대안도 생성하지 않는다.

## 6. 한 번에 요청하는 운영 승인

이 V2 명세 SHA에 대해 아래를 함께 승인받는다.

- 공통 SMTP 임시 개방으로 기존4+Console 인증메일 경로가 실제 동작하며 추가 외부 메일을
  완전히 막을 수 없고 Resend 운영 quota/평판을 공유한다는 **잔여 위험 수용**.
- 정식 root 인증·0700/0600 백업·동일 image export·`.env`0600, exact7개 변경/원복,
  신규 domain-scoped system Key1개 생성·안전 보관·복구 후 해당 Key만 회수.
- 두 서비스 적용/정상 또는 실패 복구, 최대 재생성4회/API2회, 통신 중단 가능성,
  최대600초 SMTP exposure와 root 일회 복구 job. 다른 운영 서비스/정책 변경 없음.
- test Account/OTP 임시 ON/OFF, G native email 요청1회·OTP session 제출1회·그 뒤
  Google UID 비교1회, 필요한 Auth token/session/기존G emailVerification metadata 변화 수용.
- OTP Pages OPEN26/CLOSED27 최대2회, Function 배포/실행0, 주문/쿠폰/프로필 변경0.
- 성공해도 공통 SMTP 원복. 자동 재시도/연장/추가배포/상시SMTP/운영출시/main 병합 불포함.

지금은 이 승인안을 요청할 뿐 적용·Key 발급·root 인증·timer·컨테이너/SMTP/Pages 변경은 없다.
실행 승인 뒤에도 root/backup/health/quota/source/semantic 조건이 달라지면 쓰기 전에 중단한다.

## 근거

- [Appwrite1.8.1 Account routes](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php): OTP10, Magic URL60, session-token10의 route labels 및 기존 user 경로.
- 로컬 pinned `b5-preflight/auth-controller.php`: `abuse-time` 기본3600, email/IP key와 privileged/app/development key 예외. 최근 deployed source hash 대조 증거를 재사용한다.
- [Appwrite rate-limit 공식 문서](https://appwrite.io/docs/advanced/security/rate-limits): Client SDK 제한/Server API key 예외, rate headers. 실제1.8.1 수치는 pinned source를 우선한다.
- [Appwrite1.8.1 session provider constants](https://github.com/appwrite/appwrite/blob/1.8.1/app/init/constants.php):OTP의 token provider 해석.
- [Resend Usage Limits](https://resend.com/docs/api-reference/rate-limit): 팀/Key 공통 요청량·일/월 quota와429.
- [Resend SMTP](https://resend.com/docs/send-with-smtp):465 implicit TLS, SMTP도 API와 rate limit 공유.
- [Resend Key 설정](https://resend.com/docs/dashboard/api-keys/introduction):권한/도메인 제한과 관리.
