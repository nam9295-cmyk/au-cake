# B7 V3 — 명세·보안 조치·로컬 검증

승인 범위는 Penpot 연결 토큰 대응, V3 명세 작성, 읽기 전용 설정 검토와 로컬 검증이다. 실제 B7 인증 창은 승인되지 않았다. Mac Codex 단독, 기존 `feat/customer-account` 워크트리에서 수행한다. 이전 V1/V2 문서·승인·manifest는 보존한다.

## 1. Penpot 연결 복구

- 노출 서비스는 Penpot MCP다. 토큰·전체 URL·프로세스 제목·argv를 출력하거나 이전 키를 별도 파일로 복사하지 않는다.
- 사용자가 공식 Integrations에서 MCP 키를 재발급하고 새 값만 숨김 입력으로 0600 보호 파일에 저장한다. 서버 인증 metadata의 읽기 전용 집계로 이전 키 부재/새 키 존재·미만료를 검증한다. SQL 쓰기와 다른 서비스 Key 교체는 금지한다.
- 진단은 실제 executable 경로에서 고정된 label과 숫자 PID만 반환한다. `ps`의 args/command/comm/title은 사용하지 않는다.
- RED→GREEN: exact endpoint와 숨김 입력, 명령행 credential 거부, Penpot 외 설정 보존을 검증한다. native HTTP initialize가 성공하면 Penpot 설정만 native HTTP로 바꿔 credential-bearing stdio argv를 제거한다. 이전 credential을 담은 config 백업은 만들지 않는다.
- 지정된 이전 adapter의 실행 파일·부모 PID를 확인하고 종료한다. Codex가 설정을 다시 읽는 다음 연결과 직접 HTTP protocol 점검을 구분한다.

## 2. V3 변수 계약

신규 manifest: `docs/customer-account-b7-execution-manifest-v3.json`. 원본의 `executionApproved=false`를 유지한다. 실제 실행 승인은 새 SHA에 별도로 결합해야 하며 V2 proof를 재사용하지 않는다.

신규 변수는 기존 guard 5개와 `AU_RENEWAL_WRITES_ENABLED`, `AU_RENEWAL_PREORDERS_ENABLED`로 정확히 7개다. 기존 `CUSTOMER_ACCOUNT_ENABLED`는 신규 추가 수에 포함하지 않는다.

| 상태 | Customer | Renewal writes | Renewal preorders |
| --- | --- | --- | --- |
| 준비 | false | false | false |
| 별도 승인 시험 창 | true | true | false |
| 종료 | false | false | false |

- RED→GREEN: 7개 모두 명시적 존재, 중복 거부, 정확한 secret metadata, phase flag, 15분 제한, 누락 변수와 V2 digest 거부.
- secret readback은 키 유효성 증거가 아니다. 준비 검사만으로 remote write를 허용하지 않는다.
- `scripts/customer-account-b7-v3-contract.mjs`는 transport/writer가 없는 로컬 검사다. 기존 V2 실행 runner/archive/browser builder는 V2에 고정한 채 보존한다. 실제 V3 실행 wiring 및 proof 갱신은 후속 실행 승인 범위에서 검증해야 한다.
- 15분/120회/동시1/6주문/2쿠폰/3사용자/guard/watchdog/복구 조건과 `execute=[any]` 초기 자원 소비 위험을 줄이거나 바꾸지 않는다. 가격·쿠폰·JWT·소유권 제품 로직 변경은 없다.

## 3. 운영 설정 검토

- 공식 기존 Owner CLI 인증으로 GET만 수행한다. 운영 고객·주문 자료는 읽지 않는다.
- Auth/SMTP/OAuth/service 정책을 canonical field별 hash로 비교한다. 비밀값과 전체 응답은 출력·보고하지 않는다.
- B5의 공개 기록으로 비교할 수 있는 인증 방법/Account/SMTP override/Google enabled/session alerts만 과거 동등성 판단에 사용한다.
- 과거 AU raw `projectConfig` 차이는 field별 원본이 없으므로 미확인 상태를 유지한다. 새 지문은 관찰 자료이며 승인된 정상 기준선이 아니다. Gallery의 기존 B5 예외도 별개로 유지한다.
- 작업 전후 공식 GET 지문과 Account OFF/403, disabled Function/execute=[], B6 deployment, CLOSED site를 확인한다. 누락된 Renewal flag를 기본 OFF만으로 V3 준비 완료라고 판정하지 않는다.

## 4. 최종 검증과 중단

- 전체 `npm test`, Node22 집중, lint 및 신규 MJS lint, TypeScript/overlay 타입 검사를 실행한다.
- KR→AU 순차 빌드. 전체 테스트와 빌드는 공유 SEO 파일 때문에 병행하지 않는다.
- Chromium/WebKit compiled artifact에서 닫힌 경로 및 signed Mock/native Checkout draft를 검증한다. 실제 Google/JWT/provider 인수로 표시하지 않는다.
- Git 후보·artifact에서 보호된 실제 secret 일치와 secret-bearing 프로세스 진단의 재도입을 검사한다. 기능별 커밋 후 결과 문서와 Git 상태를 보고하고 중단한다.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] 운영 4개 프로젝트와 Console의 공통 SMTP 영향 승인
- [ ] OTP 수신자 접근·남용 방지
- [ ] Gallery 의미적 지문 예외 검토
- [ ] System SMTP 전용 Key·발신자
- [ ] 운영 백업/root 인증/API·mail-worker 재생성 및 rollback
- [ ] 실제 OTP 및 Google↔OTP 동일 UID

native OTP OFF, Google+OTP 출시 준비 미완료. Account/Function 활성화, Function/Pages 배포, 사용자·쿠폰·주문 생성, SMTP·운영 설정 변경, main 병합·production 배포는 이번에 수행하지 않는다.
