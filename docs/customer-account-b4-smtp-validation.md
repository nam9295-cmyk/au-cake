# B4 — 테스트 프로젝트 전용 Resend SMTP 검증

2026-10-18 KST. B4 승인 범위에서 완료했다. 대상은 `https://api.verygood-chocolate.com/v1` / `verygood-au-account-test`뿐이다. 테스트 Account는 계속 OFF였으며 일반 SMTP sample 1건만 발송했다. 수신자가 받은편지함의 **1건 수신**을 직접 확인했다. Email OTP, 공통 SMTP 변경, 컨테이너 재생성, Function 배포, B5는 실행하지 않았다.

## 승인과 관리 경로

- 기존 Resend `nam9295` 계정의 공식 Console Owner 접근을 사용했다. 로그인은 사용자가 직접 완료했다.
- 테스트 DNS TXT 1개/CNAME 2개에 대해 실행 직전 별도 승인을 받았다. Cloudflare의 해당 zone Console에서 **Add record만 3회** 사용했다. 기존 레코드 수정·삭제와 자동 DNS 구성은 하지 않았다.
- 새 Key의 이름·Sending access·테스트 도메인 제한을 준비한 뒤 실행 직전 승인을 받았다. 생성된 Key의 상세 화면에서 실제 권한·도메인·ID를 검증했다. 운영 Key 원문은 조회하지 않았고 운영 Key를 교체·회수하지 않았다.
- Appwrite는 기존 Owner의 공식 `appwrite-cli@15.0.0` 로그인 세션과 1.8.1의 정식 Projects API를 사용했다. 기존 Owner/team 소속, Console Settings의 Project ID/endpoint를 다시 확인했다. 브라우저 Cookie 추출·SQL 쓰기·운영 API Key 사용·새 Appwrite Key 발급은 하지 않았다.
- 작업 종료 시 이번 CLI 세션만 서버에서 로그아웃하고 이전 CLI Cookie의 401을 확인했다. 브라우저 Owner 세션은 보존했다.

## Resend와 DNS

기존 `verygood-chocolate.com`은 Verified였다. 기존 Sending access Key `verygood-cake-reservation`은 보존했다. 이 Key의 마지막 사용 시각이나 과거 `/domains` 401만으로 운영 배송 성공·실패를 판단하지 않았다. 기존 주문 알림은 Resend HTTP API 설정을 사용하며, 이번 SMTP Key와 분리했다. 운영 Function과 환경변수 지문은 그대로다.

시작 시 Console은 Transactional Free, 월 76/3,000건, 일 11/100건, 도메인 1/3개, 팀 공통 10 requests/sec를 표시했다. SMTP를 사용할 수 있었다. 테스트 도메인을 추가해 도메인은 2개가 됐다. 한도·평판·서버 자원은 동일 계정/인스턴스에서 공유되며 프로젝트 격리로 없어지지 않는다.

| 항목 | 검증 결과 |
| --- | --- |
| 새 발신 도메인 | `auth-test.verygood-chocolate.com` |
| Resend domain ID | `ebeb59b5-2944-4d93-97a1-ac485f812b2f` |
| 리전 | Tokyo / `ap-northeast-1` |
| 상태 | Verified, Sending ON, Receiving OFF |
| 새 Key 이름 | `VERYGOOD AU Account TEST SMTP B4 20261018` |
| Key ID | `51ff6c2b-2fb3-4edb-8bcd-f2c6b03cd6df` |
| 권한 | Sending access, 위 테스트 도메인만 허용 |
| 비밀값 | Git 제외 0700 디렉터리의 0600 파일 및 테스트 Appwrite SMTP에만 보관. 채팅·로그·Git에 출력하지 않음 |

새 DNS는 아래 3개뿐이다. TTL Auto, 모두 DNS Only다. 공개 DNS 응답과 Resend Verified 상태를 확인했다. 공개 DKIM 값의 전문은 [manifest](customer-account-b4-smtp-manifest.json)에 있다.

| Type | Name | Content |
| --- | --- | --- |
| TXT | `resend._domainkey.auth-test.verygood-chocolate.com` | manifest의 Resend 공개 DKIM key |
| CNAME | `rsend.auth-test.verygood-chocolate.com` | `rsend-apne1.forge.rmta.net` |
| CNAME | `send.auth-test.verygood-chocolate.com` | `send.forge.rmta.net` |

현재 Resend Console이 제시한 TXT 1개/CNAME 2개 형식을 사용했다. 과거 MX/SPF 예제로 대체하지 않았다. DNS 수는 25→28개다. optional root `_dmarc`는 생성하지 않았고 기존 루트 MX/SPF/DKIM/DMARC·사이트 DNS는 수정하지 않았다.

## 테스트 Appwrite SMTP와 일반 메일 1건

| 설정 | 값 |
| --- | --- |
| Project | `verygood-au-account-test` |
| Custom SMTP | ON |
| Sender name | `VERYGOOD AU Account TEST` |
| Sender / Reply-To | `customer-test@auth-test.verygood-chocolate.com` |
| Host / Port | `smtp.resend.com` / `465` |
| Username / Secure | `resend` / `ssl` (implicit TLS) |
| Password | 새 테스트 sending Key, 원문 비공개 |
| Account / 다른 인증 7개 | 계속 OFF |
| Google provider / authLimit | 기존 B3 상태 유지 / 2 |

공식 Owner API의 `PATCH /projects/verygood-au-account-test/smtp`로 저장한 뒤 GET 응답의 공개 필드와 비밀값을 내부 비교했다. Console을 새로고침해 저장된 override도 확인했다. Auth/service/OAuth/team/ID 지문은 전후 동일하다. 저장 시 연결 확인만으로 SMTP 인증·배송 성공을 주장하지 않았다.

수신자가 직접 지정한 주소는 보호 승인 파일에서만 공급했다. 발신자·수신자·제목·내용을 사전에 알린 뒤 `POST /projects/verygood-au-account-test/smtp/tests`를 **1회** 실행했다. 제목은 Appwrite 기본 `Custom SMTP email sample`, 본문은 발신·회신 주소 및 스팸/DNS 안내다. OTP·주문·고객 데이터는 없다.

- Appwrite: HTTP 204, recipient 1. 이는 접수 결과이며 단독 배송 증거로 취급하지 않았다.
- Resend: 새 Key로 필터한 로그만 조회, 사용 1회 / `/emails` POST 200. 운영 메일 목록·본문은 조회하지 않았다.
- 수신자: 받은편지함에 1건 도착을 직접 확인했다. 재발송하지 않았다.
- 발송 전에 `wx` 방식의 영속 claim 파일을 생성했다. 실패·타임아웃이어도 재실행하지 않는 보호장치를 유지한다. 이 장치는 운영자의 sample API 제출 횟수를 제한하며, Appwrite worker 내부 재시도 정책을 변경한 것은 아니다.

**수신자 제한의 한계:** 도메인 제한 Key는 FROM 범위를 제한한다. 임의 외부 TO 주소에 대한 Resend 수신자 allowlist를 보장하지 않는다. 이번에는 Account OFF, 비공개 credential, 정확한 승인 주소 하나만 허용하는 helper로 발송 경로를 제한했다. 향후 공개 OTP 진입은 별도 수신자 통제·시간/사용자 상한·남용 방지 승인 없이는 열지 않는다. Key의 자동 만료를 설정했다고 주장하지 않으며 후속 보존/회수는 별도 승인 범위다.

## 불변성·서버·안전 정지

기존 네 프로젝트(`verygood-main`, `69cb27ef002b63e77c53`, `69db3ae20026cdc0c7fe`, `verygood-au`)의 project config, DB, schema/ACL, Function, active deployment, bucket, variables, Key metadata, platform **9범주 지문이 모두 동일**했다. 고객·주문 document는 조회하지 않았다.

테스트 프로젝트는 SMTP 설정만 바뀌었다. DB2 / Collection12 / Appwrite Key3 / Web platform1 / Function0 / Bucket0 / global variable0이 유지됐다. schema/ACL 및 OAuth/auth/service 지문도 동일하다. Account OFF의 실제 client 요청은 **403 `general_service_disabled`**로 차단됐다. 테스트 사이트의 신규 인증 창도 B3 종료 상태를 유지했다.

| 관찰값 | B4 전 | B4 후 |
| --- | --- | --- |
| Available RAM | 9,574,301,696 bytes | 9,558,802,432 bytes |
| Available disk | 89,320,218,624 bytes | 89,319,604,224 bytes |
| Load 1/5/15분 | 0.34 / 0.36 / 0.30 | 0.34 / 0.34 / 0.29 |

위 차이는 공유 서버의 시점별 관찰값이며 B4 전용 사용량으로 단정하지 않는다. 핵심 컨테이너 5개의 ID/image/start/env 지문이 동일했다. API와 mail worker의 `_APP_SMTP_HOST`가 여전히 비어 있음을 값 노출 없이 확인했다. API health/version은 HTTP 200 / 1.8.1이었다. 컨테이너 재시작·재생성, 공통 설정 변경은 없었다.

## 로컬 보호장치와 검증

[SMTP helper](../scripts/customer-account-smtp-test.mjs)는 exact endpoint/project pair와 기존 target guard를 사용하며 정해진 test-project GET/PATCH/POST 경로만 허용한다. 이미 켜진 SMTP를 덮어쓰지 않는다. 잘못된 프로젝트·권한·미검증 도메인·인증 상태 변경·redirect를 거부한다. DNS guard는 manifest의 3개 신규 이름/값과 완전한 조회 결과만 허용하고 기존 이름, root, proxy, 추가 필드를 차단한다. Key scope/domain은 공식 Console 관찰에 근거한 확인이며 sending Key의 암호학적 introspection을 뜻하지 않는다.

- RED: 모듈 부재 시 5개 실패. imported manifest 변조 회귀 테스트가 수정 전 추가로 실패한 뒤 내부 복사로 차단했다. 이미 통과한 입력 검사에 대해 허위 RED 기록을 만들지 않았다.
- GREEN: 신규 B4 7 pass / 0 fail / 0 skip, Node24와 Node22.23.3에서 통과.
- 전체 `npm test`: **1,879 pass / 0 fail / 기존 skip 1**. 고객 계정 그룹은 **103 pass / 0 fail / 0 skip**.
- ESLint / TypeScript build check / 새 mjs 파일의 no-undef·no-unused-vars 검사 통과. 전체 테스트에 포함된 AU build 통과. 제품 코드가 바뀌지 않아 B4에서 KR build·제품 브라우저 회귀 전체를 다시 실행하지 않았다. B3의 기존 AU/KR 검증 기록은 별도로 유지한다.
- 제품 src, Function, package/lockfile, 판매 정책은 변경하지 않았다. sharp/Node16 기본 배포·운영 Node22 차이는 기존 미해결 항목으로 남겼다.
- 코드·테스트·public manifest 커밋: `88cb4e7` (`test(account): guard isolated SMTP configuration and one sample send`). 결과 문서는 별도 커밋한다.

비밀값·실제 수신 주소·스크린샷·인증 증거는 Git 제외 B4 evidence 경로에 보호 저장했다. B2 manifest와 main/다른 worktree는 변경하지 않았다.

## B5 전제조건 — 미실행

이번 성공은 프로젝트 SMTP override를 payload로 전달한 일반 sample의 검증이다. Appwrite 1.8.1 Email OTP의 **공통 SMTP host 선검사 통과나 OTP 성공을 뜻하지 않는다**. OTP 발송·Google↔OTP 동일 UID·제품 주문 통합 검증은 여전히 미완료다.

B5 전에는 아래를 한 번에 검토하고 별도 승인받아야 한다.

1. 유효한 공통 SMTP/system sender와 별도 credential의 정확한 범위. 테스트 도메인 전용 Key를 다른 프로젝트 공통 발신에 임의 사용하지 않는다.
2. 기존 네 프로젝트 및 Console의 이메일 경로/저장된 OTP·Magic URL 설정에 미칠 영향, 테스트 수신자 제한과 허용 범위.
3. 기존 env/Compose/image/metadata의 보호 백업, SMTP 관련 키만 복구하는 절차, 저부하 작업 시간과 API/mail-worker 두 서비스의 재생성 승인. DB/Redis/executor 재생성·queue flush는 제외한다.
4. 제한된 합성 smoke, 중단 기준, 장애 시 승인된 기존 공통 값 복원 및 두 서비스만 원복하는 절차.

후속 OTP 단계에서는 현재 M+G 두 명으로 이미 채워진 authLimit 2도 고려해야 한다. 신규 OTP 사용자 생성에 필요한 정확한 test-user 상한 변경/합성 사용자 정리와 Account 재활성화는 후속 별도 승인 대상이며 이번에는 변경하지 않았다.

현재는 Account OFF/신규 인증 창 OFF로 안전 정지했다. SMTP override를 OFF하는 것은 공통 transport fallback일 수 있으므로 발송 차단 수단으로 사용하지 않는다. 긴급 상황에서 test Key를 회수하려면 대상 Key를 특정해 별도 승인받는다. 기존 운영 Key·공유 queue·DB를 손대거나 테스트 프로젝트를 자동 삭제하지 않는다.

## 근거

- [Resend 공식 SMTP](https://resend.com/docs/send-with-smtp): host·인증·implicit TLS 포트.
- [Resend 공식 Key 권한](https://resend.com/docs/dashboard/api-keys/introduction), [공통 한도](https://resend.com/docs/knowledge-base/account-quotas-and-limits).
- Appwrite 1.8.1 [Projects SMTP 저장/sample API](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/projects.php), [mail worker](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Workers/Mails.php), [Account controller](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php), [sample template](https://github.com/appwrite/appwrite/blob/1.8.1/app/config/locale/templates/email-smtp-test.tpl).
- 실제 DNS3/Verified/Key scope·domain/전용 Key의 1회 응답은 현재 공식 Console 관찰과 보호 evidence를 근거로 한다.
