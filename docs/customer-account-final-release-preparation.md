# Customer Account — 최종 출시 준비

2026-10-19. 시작 커밋 `80e1933`, `feat/customer-account`. 기존 PASS 인수를 재실행하지 않고 실제 G 인증 주문 생성 1건만 추가 검증한다. 운영 main/사이트/프로젝트, 공통 SMTP 및 실제 고객 주문은 변경하지 않는다.

## 기존 근거 유지

| 기능 | 기존 판정 / 근거 |
| --- | --- |
| Google 로그인/세션, G/H/Guest 장바구니·회원정보 분리 | PASS — 기존 사용자 직접 인수 |
| native OTP 실제 수신/로그인, 기존 G Google↔OTP UID | PASS — [B5 결과](customer-account-b5-final-execution-results.md) |
| MY ORDERS G 본인200 / H 타인404 | PASS — [통합 인수 기록](customer-account-integrated-acceptance.md) |
| 5-call readiness 실제 API/DB metadata·ACL | PASS — [기존 HTTP200/ready=true,6.285초 기록](customer-account-readiness-five-call-live.md). health 재호출하지 않음 |
| B5 SMTP/Account/세션/사이트 완전 원복 | PASS — CLOSED29. 단발 Key 폐기 |

## 이번 생성 검증 계약

기존 test project/Function/G만 사용한다. 새 requestId 한 개와 합성 Renewal v2 본문을 실행별 비추적 manifest에 동결한다. 케이크 `pave-cake`,6in/dark,1개,AUD75,쿠폰 없음. 가격·상품·cutover·fingerprint·멱등성·JWT/owner 코드는 원본 그대로다.

새 Function deployment1개에서 기존 guard 변수와 Customer/writes=true·preorders=false를 **배포 전에** 동결한다. Function execute는 G UID만 허용한다. Pages OPEN30/CLOSED31 한 쌍, 실제 생성 POST 최대1회, 새 주문 목록/상세 최대2회, 총 Function 실행 최대3회다. 기존 B7 실행16/120 및 Pages29회를 이어서 기록한다. 물리적 inventory26executions/32Pages와의 차이는 기존 B6 10회/B3 3회이며 초기화하지 않는다.

브라우저에는 Owner 자격증명/HMAC secret을 주지 않는다. 사용자가 G 세션에서 생성한 단기 JWT만 직접 숨김 입력으로 Mac0600 파일에 전달한다. CLI는 Account.get으로 실제 G UID/status를 확인하고 exact document의 부재를 Owner GET으로 확인한 후 `wx` durable dispatch claim을 먼저 생성한다. `create-cake`+`customerAccount:'link'`를 JWT-only Function execution으로 정확히 한 번 보낸다. 응답 timeout에도 재전송하지 않고 Owner GET으로 저장 여부부터 확인한다. JWT 파일은 전송 종료 즉시 삭제한다.

새 test-only guard는 고정 본문·UID·JWT 결합 HMAC·30초 서명/nonce·플랫폼 UID·경로·runtime 환경을 검사한다. 원본 handler가 JWT Account.get을 다시 수행하고 owner UID를 결정한다. 기존 read-only guard는 수정하지 않는다. Product source/lockfile은 archive와 byte equality를 검증한다. per-runtime counter는 전역 횟수 보장의 근거가 아니며, 실제 dispatch1회는 Mac durable claim과 한 개의 고정 documentId로 제한한다.

알림 차단은 UI만이 아니다. 테스트 프로젝트의 Function1개/events[]/schedule없음/webhook0/SMTP·Resend 자격증명 없음, 원본 생성 handler의 직접 메일 호출 없음, test-only transport의 외부 HTTP/다른 프로젝트/다른 DB write 차단을 함께 확인한다. SDK import 전에 transport를 설치하며 기존 SDK의 native fetch 선택을 사용한다. 허용 write는 exact reservations document의 G owner 생성1회뿐이다. DB trigger용 다른 Function도 없다. 주문 생성 외 결제·쿠폰·메일 경로는 실행하지 않는다.

Owner GET은 저장 UID/가격/서버 fingerprint 형식/저장 계약만 확인하며 생성에 사용하지 않는다. Owner metadata는 secret 원문을 반환하지 않으므로 runtime HMAC secret을 추출하거나 로컬 재계산을 주장하지 않는다. 원본 fingerprint 생성 코드의 byte equality와 원본 handler의 실제 생성 실행을 근거로 정책 불변을 판정한다. MY ORDERS에 새 ID가 포함됐음을 실제 원본 JWT/owner 응답으로 확인한다. 성공 후 신규 합성 문서의 status만 취소로 바꾸고 보존한다. 기존 주문은 변경하지 않는다. 모든 결과는 후속 실행 결과 절에 기록한다.

## 출시 경로 및 남은 승인

- 실제 AU Renewal `createRenewalOrder()`는 `renewalCapabilities()`의 가벼운 `renewal-health`(flag/정책 상수 반환)를 호출하고 create-cake를 실행한다. 이 경로와 고객 인증·MY ORDERS는 D1의 원래 `health`를 호출하지 않는다. 이번 직접 API 인수는 이미 통과한 브라우저 Checkout 전체 인수를 다시 수행한 것이 아니다.
- D1 `health`의 settings1+metadata7 timeout 원인은 여전히 UNVERIFIED다. `repository.ts`의 legacy capability 검사에는 원래 `health`가 남는다. 운영에서 그 Checkout이 노출되면 영향 검토/해결 전 해당 경로의 출시 준비 완료를 주장하지 않는다. 이번에 timeout/ACL/readiness를 완화하거나 통신 경로를 바꾸지 않는다.
- 기존 비회원 경로와 가격/쿠폰/멱등성은 product diff가 없으며, 실제 product handler를 통과하는 로컬 focused 검증으로 회귀를 확인한다. 기존 전체 테스트 PASS는 인용하고 새 전체 suite를 반복하지 않는다.
- 과거 AU/Gallery raw 지문 차이는 UNVERIFIED 유지다. 이번 운영4개 의미적 baseline과 전후 비교는 신규 drift 여부만 입증한다. 역사적 자료 공백이 해소됐다고 주장하지 않는다. 현재 semantic drift가 없다는 근거를 검토해 운영자가 baseline을 수용해야 한다.
- [상시 SMTP 운영 전환 계획](customer-account-always-on-smtp.md)은 준비 문서이며 미적용이다. 새 system Key·운영 root 변경·worker/API 재생성·유지 확정은 별도 운영 승인이 필요하다. 공통 fallback 실제 배달은 아직 검증하지 않았다.
- 생산 리소스의 additive owner migration dry-run/ACL/정확한 APPWRITE_ADMIN_USER_IDS 확인, 운영 Google/플랫폼 설정, production Function/사이트 배포·flag 단계 활성화 및 main 병합은 별도 승인 후 진행한다. 고객 기능 flag 기본 OFF와 비회원 경로 rollback을 유지한다.
- 기존 Google 계정→OTP→Google round trip은 PASS다. 신규 OTP-first 계정→Google의 실제 공급자 인수는 미실행이며 동일 coverage로 포장하지 않는다. 새 사용자 검증이 필요하면 별도 최소 범위를 승인받는다.
- 운영 review-api의 별도 sharp 취약점 추적은 유지한다. 이번 테스트 reservation-api 의존성을 운영 review-api에 배포하지 않는다.

## 실행 결과

### 실제 G 인증 주문 생성: PASS

- 새 requestId/documentId: `0165f170-105a-4ce8-ba94-52aaa96b068f` (합성). 신규 Function deployment `6ad58cec2c34998fd937`, 원본 main SHA-256 `1f217507c0a6b64022d80e293269c4d38626f3a511ffd6ac4b1bd987770da235`.
- G가 자신의 Chrome에서 직접 Google 인증했고 실제 G 세션의 단기 JWT를 보호 입력으로 Mac에 전달했다. CLI가 JWT Account.get의 UID/status를 확인한 뒤 exact UUID 부재를 Owner GET으로 확인했다.
- durable dispatch claim 이후 `create-cake`+`customerAccount:'link'` **1회**. execution `6ad58dc8dc3c9e9239b7`: HTTP200, Function5.576424초, client round trip6.383초, 원본 handler4.830초. 원본 서버의 JWT 검증 및 UID 저장 경로를 통과했다. Owner API로 owner를 입력해 생성하지 않았다.
- Owner GET: 저장 `customerUserId`가 실제 G UID와 일치, 원본 디코더로 envelope `version=2`/`policyVersion=au-renewal.2026-10.v2`,AUD75/7500c, 유효한 fingerprint를 확인했다. client body에 owner UID는 없다. 원본 price/fingerprint/idempotency/owner 소스는 변경하지 않았다.
- 초기 GET 검증기가 numeric envelope version을 contract string과 비교하는 오류로 중단됐다. 이후 Owner API가 secret 원문을 반환하지 않는 상태에서 로컬 fingerprint 재계산을 시도한 검사도 중단됐다. 두 오류는 **검증 코드 오류**로 기록·수정했고 실제 생성 POST는 반복하지 않았다. 원본 디코더/저장 형식·source equality로 확인했으며 런타임 secret을 추출하거나 로컬 HMAC 재계산 PASS를 주장하지 않는다.
- G MY ORDERS 실제 목록 HTTP200: 첫3.327333초(원본 handler3.314초), 둘째3.181414초(3.164초). 각 서버 응답에 `orderCount=2` 및 `newOrderListed=true` 기록. 사용자가 새 예약신청 주문 표시를 직접 확인했다. 상세는 이번에 다시 실행하지 않았으며 기존 본인200/타인404 PASS를 유지한다.
- 이번 Function 실행은 생성1+목록2=**3회**. 두 번째 목록도 남은 읽기 예산 안이며 기존 counter를 초기화하지 않았다. 누적 B7 **19/120**, 물리 inventory29(B6 10 포함). 배포1회, Pages OPEN30/CLOSED31=2회, 누적31(물리34/B3 setup3 포함).
- 검증 후 새 합성 주문 한 건의 status만 `취소`로 변경하고 Owner GET으로 G owner 유지/취소를 확인했다. 기존 합성 주문·G/H Preferences·장바구니·DB schema/ACL/상품/쿠폰은 변경하지 않았다. 결제·메일·알림·새 사용자·쿠폰 생성0건.

### 안전 복구: PASS

2026-10-19 03:28:51.531UTC: `closed=true/verified=true`,15개 복구 단계 모두 PASS. Account OFF 실제API403, JWT/native OTP OFF, Function disabled/execute[]/B6 `6ad41e576cb7a8f346af`, customer/Renewal flagsfalse, signing Key 무효화, G/H 세션0, HTTPS CLOSED31. 테스트 정책의 허용 외 필드와 운영4개 semantic fingerprint가 baseline과 동일하다. Google/B4 SMTP override를 보존했다. 공통 SMTP·root·컨테이너·운영 프로젝트·main을 변경하지 않았다.

보호 evidence는 `.superpowers/sdd/2026-10-19-customer-account-member-create/`에0600/0700으로 보관한다. 실제 JWT 파일은 dispatch 종료 직후 삭제했다. 기존 승인 manifest·실행 journal·사용량을 보존했다. 새 run scope SHA-256 `0ec3db41b77b2c98bcfde2171500abb836ff355cc5f7f4e8c19b660f83d8f483`; body SHA-256 `d722d05a1908608b44ddff4eb66ce551d32a3467f11dfccb4c374ba8146584ab`.

로컬 검증: 새 guard/transport/원본 handler 연결·부정 테스트6PASS, 기존 relay 회귀 포함 focused17PASS/0FAIL/0SKIP. TypeScript와 변경 entry ESLint PASS, 실제 테스트 Vite artifact 빌드 PASS, 공개 asset917개 signing-key/Key 패턴 검사 PASS. product source diff0. 이후 저장 envelope 회귀 assertion 추가 후 focused6PASS를 확인했다. 사용자 지시대로 전체 suite/AU·KR 제품 빌드와 기존 실제 PASS 인수는 반복하지 않았다.

### 최종 출시 판정

실제 G JWT 회원 주문 생성과 신규 owner 저장/MY ORDERS 연결은 완료됐다. 상시 SMTP는 **준비 문서 완료/미적용**이며 운영 승인, 담당자·quota 정책 수락, one-shot timer의 유지 확정 전환 구현이 필요하다. production 리소스 migration/ACL·Node22 배포 계약·OAuth 설정 확인과 단계적 활성화/main 병합도 승인 전이다. D1 legacy health, 역사적 AU/Gallery raw UNVERIFIED, 신규 OTP-first 공급자 조합 및 review-api 취약점은 위 범위대로 별도 추적한다. 고객 기능 전체의 production 출시 완료를 주장하지 않는다.
