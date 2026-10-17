# B5 공통 SMTP — 읽기 전용 사전 점검

2026-10-18 KST. 시작 HEAD `95def34`, `feat/customer-account`의 기존 customer-account worktree에서 Mac Codex 단독으로 점검했다. **실제 공통 SMTP 적용은 아직 승인 대기다. 공개 테스트 OTP는 수신자 제한이 입증되지 않아 보류한다.** 다음 [실행 계획](superpowers/plans/2026-10-18-customer-account-system-smtp.md)은 향후 별도 승인 후 사용할 절차다.

이번에는 기존 Owner Console, 서버 구성·schema/ACL metadata, 공개 source, Resend 집계만 읽었다. 공통 `.env`/권한/Compose 변경, system Key 발급, 컨테이너 재생성, Account ON, OTP·일반 메일 발송, DB/ACL/Function 변경, 배포·main 병합은 하지 않았다. B4 테스트 SMTP·Google 설정은 보존했다.

**최종 불변성 검사 예외:** Gallery의 raw project-config 지문 1개가 달라졌다. 따라서 이번 점검을 “모든 운영 지문 동일”로 보고하지 않는다. 아래 7절의 관찰·추론·미확인 범위를 실제 적용 전 해소해야 한다. 점검 도구는 설정 저장 요청을 실행하지 않았지만, Appwrite의 정상 조회 경로에 접근 활동 metadata 자동 저장이 있음을 확인했다.

## 1. 기존 4개 프로젝트의 실제 설정

기존 공식 Console Owner 세션에서 각 프로젝트 **Settings의 ID·endpoint**, Auth Settings, Auth Security, Custom SMTP 화면을 읽었다. 사용자 목록·주문·메일 본문은 열지 않았다. SQL의 암호화 envelope로 SMTP 상태를 추측하지 않았다.

| Project ID / 이름 | Account | Email OTP | Magic URL | Email/Password | Custom SMTP | Session alerts |
| --- | --- | --- | --- | --- | --- | --- |
| `verygood-main` / verygood | ON | ON | ON | ON | OFF | OFF |
| `verygood-au` / verygood-au | ON | ON | ON | ON | OFF | OFF |
| `69cb27ef002b63e77c53` / latreeer-gallery | ON | ON | ON | ON | OFF | OFF |
| `69db3ae20026cdc0c7fe` / shinsoowon-portfolio | ON | ON | ON | ON | OFF | OFF |

Phone, Anonymous, Team Invites, JWT도 네 프로젝트 모두 ON이었다. 변경하지 않았다. 비밀번호 복구와 이메일 검증에는 이 UI의 별도 인증 방법 OFF switch가 없다. 1.8.1 source에서 복구·검증 발송 endpoint의 공통 SMTP host 검사를 확인했다. Email/Password switch만으로 복구 메일을 독립 차단한다고 가정하지 않는다.

테스트 프로젝트는 Account OFF, 다른 인증 7개 OFF, Google enabled, B4 Custom SMTP ON 상태다. B4 공식 API에서 읽은 `authLimit=2`와 이후 project-config 지문은 동일하다. **Console Security의 제한 입력폼은 100으로 표시되고 Update가 활성화되는 현상이 있어 저장하지 않았다.** 그 폼 값을 실제 저장된 2의 변경으로 해석하지 않으며, 후속 활성화 전 공식 Owner GET으로 2를 재확인한다.

## 2. 공통 SMTP를 켰을 때의 동작 변화

현재 API와 mail worker의 `_APP_SMTP_HOST`는 empty다. 네 프로젝트 모두 override OFF이므로 기본 transport를 사용한다. 유효한 공통 SMTP를 API에 반영하면 이미 ON인 OTP·Magic URL 및 복구·검증 메일의 host gate가 해제된다. UI의 로그인 버튼이나 고객 기능 flag가 OFF여도 native Account API의 발송 경로는 별개다. 조건을 만족하는 요청이 오면 신규 Auth 사용자·token 등이 생성될 수 있다. 이것은 **운영 인증 동작의 변경**이며 별도 수용 승인이 필요하다.

Console은 저장된 다섯 프로젝트와 별도의 내장 `console` project다. 실제 env와 고정 source를 함께 확인한 결과 Console signup limit은 1, invites ON, session alerts OFF, email/IP signup whitelist는 각각 0개다. 공통 SMTP는 Console의 복구·검증·초대 등 기본 메일에도 사용된다. signup limit/Console whitelist는 테스트 프로젝트 수신자 allowlist가 아니다. 기존 비밀번호·Google 자격증명이나 관리자 allowlist를 바꾸지는 않는다.

공통 값을 저장한다고 기존 사용자에게 일괄 발송하는 작업을 수행하는 것은 아니다. 다만 새로운 API 요청과 대기·처리 중 메일의 영향은 따로 관리해야 한다. 관측 시 mail queue/processing/failed는 **0 / 0 / 1**이었다. `LLEN`으로 건수만 읽었고 실패 1건의 원인·수신자·내용·소속 프로젝트는 조회하지 않았다. 현재 broker는 정상 queue를 소비하며 failed 재투입은 별도 `queue-retry` 경로다. 이번 계획에서는 재시도·삭제·공유 queue flush를 금지하고 실패 1건을 보존한다. 실제 적용 직전 다시 건수를 확인해야 한다.

B4 override는 자기 test credential·sender를 계속 사용한다. 1.8.1은 override를 사용하기 전에 공통 host를 검사하는 이메일 endpoint가 있으므로 유효한 공통 SMTP는 의미가 있지만, **공통 SMTP 적용과 테스트 Account/OTP 활성화는 별도 단계**다.

## 3. 제안하는 system credential과 환경변수

Resend Console에서 운영 발신 도메인 `verygood-chocolate.com`의 Verified 상태를 재확인했다. domain ID는 `43b81ebb-788c-41ac-8f0b-2160249a1470`다. 신규 DNS나 도메인 변경은 필요하지 않다.

- system sender 후보: `appwrite-system@verygood-chocolate.com`.
- 표시 이름: `VERYGOOD Chocolate System`. 동일 인스턴스의 다른 프로젝트/Console 메일에도 적용될 이름이다.
- 새 Key 후보: `VERYGOOD Appwrite SYSTEM SMTP B5 20261018`, **Sending access / `sending_access` / 위 운영 발신 도메인 ID만**. 아직 발급하지 않았다. 새 Appwrite 관리자 Key는 필요하지 않다.
- 기존 운영 주문 알림 Key 및 B4 테스트 도메인 Key를 재사용·교체·회수하지 않는다. 자동 만료나 수신자 제한이 있는 Key라고 표시하지 않는다.
- root 전용 보호 파일과 0600 `.env`에만 Secret을 주입한다. 명령행 인자·shell history·Git·일반 로그에 넣지 않는다. 발신 주소는 발송 identity 후보이며 수신 mailbox가 준비됐다는 뜻은 아니다.

| 변경 변수 7개 | 현재 두 컨테이너 / resolved Compose | 제안 값 |
| --- | --- | --- |
| `_APP_SMTP_HOST` | empty | `smtp.resend.com` |
| `_APP_SMTP_PORT` | empty | `465` |
| `_APP_SMTP_SECURE` | empty | `ssl` |
| `_APP_SMTP_USERNAME` | empty | `resend` |
| `_APP_SMTP_PASSWORD` | empty | 새 system 전용 Key, 비공개 |
| `_APP_SYSTEM_EMAIL_NAME` | `Appwrite` | `VERYGOOD%20Chocolate%20System` |
| `_APP_SYSTEM_EMAIL_ADDRESS` | `noreply@appwrite.io` | `appwrite-system@verygood-chocolate.com` |

이름은 1.8.1의 `urldecode()` 처리에 맞춘 값이다. 이 버전에서 독립된 `_APP_SYSTEM_EMAIL_REPLY_TO`를 새로 추가하지 않는다. 기본 transport의 Reply-To도 system email address다. 465/SSL은 implicit TLS이며 인증서 검증을 끄지 않는다.

## 4. 테스트 OTP 접근·수신자 제한 판정

**현재 입증된 외부 수신자 allowlist는 없다. 공개 OTP 활성화 불가다.** 확인한 Auth Security에는 사용자 수/세션/비밀번호/알림 제어가 있으나 이메일 수신자 allowlist가 없고, 고정 OTP source도 임의의 유효 email 입력을 받는다. 신규 사용자 상한은 기존 사용자에게 보내는 재전송 수신자를 제한하지 않는다.

Resend domain-restricted sending Key는 FROM 권한을 제한한다. 테스트 웹페이지의 입력 제한, 로그인, Cloudflare Access를 프론트에만 적용하는 방식, CORS/Web platform, request cooldown, Google Testing 사용자 목록으로 공개 Appwrite API에 대한 직접 호출까지 막았다고 볼 수 없다.

현재 `_APP_OPTIONS_ABUSE=enabled`다. 1.8.1의 native 기본 제한은 OTP·복구·이메일 검증 10회/시간, Magic URL 60회/시간이며 route별 email/IP 또는 user ID key를 사용한다. 이는 완전한 수신자 제한이나 팀 일일 quota 예약이 아니다. 서버 Key/privileged 요청의 예외도 있어 그런 경로를 client 테스트의 대체물로 쓰지 않는다.

공개 manifest의 `emailSendAllowed=false`는 B5 실행 도구가 직접 메일을 보내지 않는다는 제약이다. Appwrite/Resend의 전체 발송 방화벽이나 수신자 정책을 설정한 값이 아니다. 공통 SMTP가 켜진 뒤 기존 프로젝트의 native 인증 요청이 메일을 생성할 수 있다는 영향은 그대로다.

후속 실제 OTP를 열려면 테스트 SMTP 경로에서 **정확한 TO allowlist를 서버에서 집행하는 승인된 중계층** 또는 **직접 native API 우회까지 막는 project 전용 비공개 ingress**를 별도 설계·승인·검증해야 한다. 현재 어느 쪽도 구성하거나 효과를 입증하지 않았다. 외부 주소, 변형된 project 식별자·legacy/GraphQL 경로, 직접 API 호출에서 발송 0회임을 검증하기 전에는 Account/OTP OFF를 유지한다. 프론트 전용 보호나 15분 창만으로 수신자 제한을 대체하지 않는다.

## 5. 기존 Resend 알림에 미칠 영향

현재 공식 Console의 Transactional Free는 **일 12/100, 월 77/3,000, 도메인 2/3, 팀 공통 10 req/s**다. B4 sample 1건이 포함된다. 따라서 관찰 시 남은 quota는 일 88건/월 2,923건이지만 실제 적용 시 다시 확인한다. SMTP·HTTP API가 이를 공유하며 새 Key만으로 용량·발신 평판이 격리되지는 않는다.

운영 도메인만 선택한 최근 15일(10/04–10/18) 집계는 33건, Deliverability 93.94%, bounce 6.06% / Transient 2 / Permanent 0 / Complaint 0이었다. 집계는 15분 갱신이다. 이는 특정 주문 알림의 원인 분석이나 현재 장애 확정이 아니다. 기존 메일 본문·수신자·개별 delivery log를 열지 않았다. 기존 운영 Key의 Secret도 조회하지 않았다.

공통 Auth 메일 증가, 임의 수신자 남용, 429/일일 한도 초과, 반송·complaint·평판 악화로 기존 HTTP 주문/리뷰 알림도 영향을 받을 수 있다. 현재 발신량은 여유가 있지만 위 Transient 집계는 사전 수용/모니터링 항목이다. 운영 Key나 Function을 자동 수정하지 않는다. 후속 제한 테스트 예산은 **별도 승인된 최대 10건/일, 동시에 1건, 운영 여유 일 50건 이상**을 제안하며, 아직 provider의 강제 key별 quota로 구현된 제한은 아니다. 실제 B5 자체는 발송 없이 TLS/SMTP AUTH 연결 확인만 계획한다.

## 6. 서버·백업·권한

실제 Compose context는 project `appwrite`, `/home/john/srv/appwrite/appwrite/docker-compose.yml`, 같은 경로 `.env`, Compose 5.2.0이다. SMTP/system email을 소비하는 서비스는 **`appwrite`, `appwrite-worker-mails` 두 개뿐**이다. `.env` bind mount는 없으므로 단순 restart로 env를 반영할 수 없다.

두 서비스는 `appwrite/appwrite:1.8.1`, 동일 이미지 `sha256:d6c8a343ef61ed16389b19664cfc30f0559aa5bfdb81965fcd2763d354f4964d`를 사용한다. 이미지 크기는 약 526.6 MB다. CPU 관찰값은 API 0.00%, worker 0.03%, RAM은 약 623.9 MiB/25.55 MiB였다. host CPU 4개, available RAM 약 8.92 GiB, available disk 약 83.19 GiB다. 시점별 수치이며 재생성 실측값은 아니다. 기존 이미지를 export하는 보호 백업에 약 0.6–1 GiB를 예상하고 2 GiB 여유를 확보한다.

실제 원본 파일은 root:root / 0644다. `.env`에 비 UTF-8 바이트가 있어 일반 텍스트 변환·전체 재인코딩은 금지한다. 대상 7개 key는 각각 정확히 1회 존재한다. 다음 승인에는 `.env`를 root:root / **0600**으로 제한하고 원본의 나머지 바이트·줄바꿈을 보존하는 변경을 포함해야 한다. SSH `very` 세션의 비대화식 sudo 검사는 실패했다. 권한이 아예 없다고 단정하지 않지만 정식 root/sudo 인증 경로는 실제 적용 전에 사람이 확인해야 한다. Docker로 host 파일 권한을 우회하지 않는다.

백업은 향후 승인 후 `/root/verygood-b5-backups/<UTC stamp>/` 0700에 원본 `.env`/Compose, resolved Compose, container/image inspect, 이미지 tar, 파일 mode/uid/gid·hash 및 metadata 비교 자료를 0600으로 보관한다. 이번에는 원본 전체 백업·image export·권한 변경을 실행하지 않았고 비민감 metadata 지문만 로컬 보호 evidence에 기록했다. 복구는 SMTP 관련 7개만 원래 바이트로 되돌리며 동시 변경된 다른 설정을 덮지 않는다. 보안상 0600 유지까지 승인 범위를 명시한다.

## 7. 재생성·중단·검증·rollback

이번 사전 점검의 최종 비교에서 `verygood-main`, `verygood-au`, `shinsoowon-portfolio`와 test project는 기존 9범주 지문이 동일했다. `latreeer-gallery`는 DB/schema·ACL/Function/deployment/bucket/variables/Key/platform **8범주가 동일**, raw `projectConfig`만 `ec7dec4c…` → `3551280c…`로 달라졌다. 핵심 컨테이너와 `.env`/Compose 원본 hash·권한은 동일했다. 이 불일치는 실패/예외 항목으로 보존하며 자동으로 baseline을 덮지 않는다.

Gallery의 `updatedAt`과 `accessedAt`은 모두 **2026-10-18 01:08:10.315 KST**, 해당 프로젝트 Console 조회 시각과 일치했다. 실제 배포와 일치하는 1.8.1 API middleware에는 오래된 project의 `accessedAt`을 갱신하며 document를 저장하는 경로가 있다. encryption filter는 저장 시 무작위 IV를 사용한다. 따라서 조회에 수반된 활동 저장·암호화 envelope 재생성이 raw 지문을 바꿨다는 설명과 일치한다. **이는 source와 시각에 근거한 추론**이며, 점검 전 필드별 원문/semantic 지문을 저장하지 않았으므로 모든 필드가 동일했다고 소급 증명할 수는 없다. 별도의 운영 고객·메일·감사 본문을 조회하거나 설정을 원복하지 않았다. 별도 수집한 Compose 컨테이너 26개의 ID/image/start/env 지문은 모두 동일했고 binding 목록도 순서를 정규화하면 동일했다.

향후 실제 적용 전에는 공식 Owner CLI 세션의 `X-Appwrite-Project: console` Projects GET만 사용하는 읽기 도구로 config의 canonical semantic 지문을 먼저 확보한다. credential 필드는 메모리 내 digest만 남기고 원문은 출력하지 않는다. raw 지문도 함께 보존하며, 암호화 nonce·활동 시각 변화와 실제 Auth/SMTP/OAuth/ACL 정책 변경을 구분한다. semantic baseline이 없는 과거 차이를 무조건 정상으로 처리하거나 보안 필드를 비교에서 제외하지 않는다. 현재 Gallery 예외의 수용/새 baseline 검토도 실제 적용 승인 항목이다.

[실행 계획](superpowers/plans/2026-10-18-customer-account-system-smtp.md)에 정확한 backup/apply/rollback 명령과 gate를 적었다. 적용은 **worker 먼저 → 확인 → API**, rollback은 **API 먼저 → 확인 → worker**다. `up -d --no-deps --no-build --pull never --force-recreate --timeout 30`에 정확한 서비스 하나만 지정한다. 같은 이미지를 확인하고 새 설치·upgrade·전체 down/up·volume/queue 복원은 하지 않는다.

- 유지보수 창 15분, 실제 변경·검증 약 5–10분을 제안한다. API 재생성의 통신 중단 예산은 **약 30–120초**다. 재생성을 시험하지 않아 보장된 복구시간은 아니다. health가 60초 안에 복원되지 않으면 rollback을 시작한다.
- API 교체 동안 네 프로젝트와 Console의 로그인·주문/Function 호출·storage 등 HTTP API가 일시 실패할 수 있다. 정적 프론트는 별도이지만 주문 API의 이미 완료된 처리와 응답 유실은 구분해야 한다. 실제 주문을 재제출하거나 운영 주문으로 smoke하지 않는다. mail worker 교체 동안 발송은 지연될 수 있다.
- health/version 200/1.8.1, test Account guest GET 403 `general_service_disabled`, 두 컨테이너의 TLS/SMTP AUTH(no DATA), image/non-SMTP env/volume/network 불변, 기존 project 9범주 지문·배포/ACL, 제외한 서비스 ID/start 불변을 확인한다. Running만으로 완료 판정하지 않는다.
- queue/processing은 0, failed는 승인된 baseline 1을 보존한다. failed 증가·뜻밖의 발송, SMTP 인증/인증서 오류, quota 급증/429, image/config/권한 drift, 기존 관리자/guest 장애, OOM/CrashLoop, RAM<3 GiB 또는 disk<30 GiB, load1≥4가 5분 지속되면 중단/rollback한다.
- rollback은 `.env`의 승인된 7개만 원복하고 두 서비스를 원래 이미지로 재생성한다. 이미 전달된 메일과 새 Auth token/user/session 등 요청 부작용을 자동 취소하지 않는다. 이미 발급된 인증 링크·코드가 즉시 무효화된다고 보장하지 않는다. 공유 queue purge/failed 재시도/고객 데이터 삭제·복원은 금지한다. B4 override를 OFF하는 방식으로 발송을 차단하지 않는다.

## 8. 적용 가능 여부와 다음 승인 항목

**기술적 경로와 실행/복구 순서는 확정했지만, 현재 실제 적용은 보류한다.** 다음 승인에는 아래 항목을 구체적으로 포함해야 한다.

1. 기존 4개 프로젝트와 Console의 이메일 인증 경로가 동작하게 되는 영향 수용. 원하지 않는 방법을 차단하려면 프로젝트별 별도 정책 승인부터 필요하며 이번에 임의로 OFF하지 않는다.
2. 제안 system sender/name, 새 domain-scoped Sending Key 발급·보관·회수 정책, 공통 변수 7개와 `.env` 0600 변경.
3. 정식 sudo/root 인증, 보호 백업·이미지 export·검증 도구 설치, 두 서비스만의 재생성 및 rollback 권한, 저부하 15분 창.
4. 기존 failed mail 1건을 보존·미재시도하는 정책과 Resend 집계/남은 quota의 수용·중단 기준.
5. Gallery raw 지문 예외의 검토와 공식 Owner GET 기반의 새로운 semantic baseline 확인. 실제 설정 drift가 확인되면 원인을 먼저 보고하고 적용하지 않는다.

공개 테스트 OTP는 위 B5 승인이 있더라도 수신자 제한이 따로 입증되기 전에는 열지 않는다. 이번 작업은 여기서 중단한다. 제품 코드·sharp·Node runtime·Function·판매 정책은 변경하지 않았다.

문서 검증은 JSON/manifest SHA, 상대 링크, shell 7개 블록의 `bash -n`, 배포 컨테이너 PHP의 **`php -l` 문법 검사만** 수행했다. 이 검사는 PHP 본문이나 SMTP AUTH를 실행하지 않는다. public health는 200/1.8.1, test Account는 403 `general_service_disabled`, 신규 인증 창은 OFF였다. 제품 코드 변경이 없어 B5에서 전체 npm test/AU·KR build를 반복하지 않았으며, B4의 1,879 pass 수치를 새 실행 결과로 표시하지 않는다. raw config 비교의 Gallery 예외는 별도 미통과 항목이다.

## 근거와 증거 범위

기존 4개 설정은 공식 Console의 직접 관찰, 구성은 read-only SSH metadata로 확인했다. Appwrite Account/Mails/variables/resources/registers/console/auth middleware의 배포 파일 SHA-256은 공식 1.8.1 source와 일치했다. source·metadata·화면 증거는 Git 제외 `b5-preflight` 보호 경로에 있다.

- [Appwrite 1.8.1 Account](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php), [Auth methods](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/shared/api/auth.php), [공통 SMTP 초기화](https://github.com/appwrite/appwrite/blob/1.8.1/app/init/registers.php), [Console config](https://github.com/appwrite/appwrite/blob/1.8.1/app/config/console.php), [mail worker](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Workers/Mails.php).
- [조회 시 접근 활동 저장](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/shared/api.php#L403), [암호화 filter의 무작위 IV](https://github.com/appwrite/appwrite/blob/1.8.1/app/init/database/filters.php#L265). 이 source만으로 과거 지문 전체의 의미적 동일성이 증명되지는 않는다.
- [Resend SMTP](https://resend.com/docs/send-with-smtp), [Key/domain 제한](https://resend.com/docs/dashboard/api-keys/introduction), [계정 한도](https://resend.com/docs/knowledge-base/account-quotas-and-limits).
- [Docker compose up](https://docs.docker.com/reference/cli/docker/compose/up/), [restart의 env 반영 제한](https://docs.docker.com/reference/cli/docker/compose/restart/).
