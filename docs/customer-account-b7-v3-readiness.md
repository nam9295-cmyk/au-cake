# B7 V3 준비 결과

상태: **로컬 명세·검증 준비, 실제 실행 승인 대기**. `executionApproved=false`. B7 인증 창·Function/Pages 배포·합성 데이터 생성은 실행하지 않았다.

## 연결 토큰 보안 조치

노출 대상은 Penpot MCP 연결의 `userToken`이었다. Appwrite/Resend/Cloudflare Key가 아니며 다른 서비스 자격증명은 교체하지 않았다. 토큰 원문이나 전체 연결 URL은 본 문서에 기록하지 않는다.

사용자가 Penpot 공식 Integrations에서 재발급하고 새 키만 숨김 입력으로 보호 파일에 저장했다. 이전과 동일한 입력은 저장하지 않고 차단했다. 최종 읽기 전용 인증 metadata 집계에서 **이전 키 0개 / 새 키 1개 / 새 키 미만료 1개**를 확인했다. 인증 테이블 쓰기, SQL을 통한 재발급, 서비스 재시작은 없었다. [Penpot 2.17.2 공식 재발급 구현](https://github.com/penpot/penpot/blob/2.17.2/backend/src/app/rpc/commands/access_token.clj)은 같은 사용자의 다른 MCP 키를 제거한다.

재연결 전 새 키로 native HTTP initialize **200**을 확인했다. 키는 curl config stdin으로만 전달하고 argv·응답 본문·로그에 출력하지 않았다. 로컬 Codex 설정의 Penpot 항목만 native HTTP `url` 방식으로 바꿔 `mcp-remote`의 credential-bearing 명령행을 없앴다. 다른 설정은 구조와 bytes 보존을 검증했고, 기존 키가 포함된 config 백업은 만들지 않았다. 설정·새 값 보호 파일은 0600이다.

이전 adapter 두 프로세스는 실제 실행 파일과 부모 PID 관계를 검증한 후 종료했고 부재를 확인했다. 향후 진단은 숫자 PID와 실제 executable의 고정 label만 출력한다. npm이 프로세스 제목을 URL로 바꿀 수 있으므로 `ps args/command/comm/title`, 전체 config 출력은 사용하지 않는다.

**Codex connector 자체의 새 세션 재연결은 NOT RUN**이다. 이 세션을 끊지 않고 작업을 마쳤으며, 다음 설정 reload/새 연결에서 확인해야 한다. 직접 native HTTP handshake 성공과 Codex 세션 연결 완료는 구분한다. 정적 MCP 도구 응답도 이전 키 폐기의 근거로 사용하지 않았다. 도구 출력 사고 자체를 되돌리거나 없었다고 주장하지 않는다.

## V3 명세

[V3 manifest](customer-account-b7-execution-manifest-v3.json)

```text
SHA-256 1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90
```

이전 승인 기록은 bytes를 보존했다.

| 버전 | SHA-256 |
| --- | --- |
| V1 | f71da5a2f768e9789086548d9af5c12c06b25e2f4480d5762daf1c781af27a43 |
| V2 | 2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41 |

신규 변수 한도는 정확히 **7**이다. `CUSTOMER_ACCOUNT_ENABLED`는 기존 변수다.

| 신규 변수 | Secret | 준비/종료 | 별도 승인 시험 창 |
| --- | --- | --- | --- |
| B7_TEST_RUN_ID | false | manifest run ID | 동일 ID |
| B7_TEST_STARTS_AT | false | 준비 시 0 | 확정 시각 |
| B7_TEST_ENDS_AT | false | 준비 시 0 | 시작+최대900초 |
| B7_TEST_HMAC_SECRET | true | 비공개, 종료 시 무효화 | 해당 창 전용 |
| B7_TEST_FIXTURE_MANIFEST_SHA256 | false | 동결 fixture digest | 동일 digest |
| AU_RENEWAL_WRITES_ENABLED | false | false | true |
| AU_RENEWAL_PREORDERS_ENABLED | false | false | false |

실제 테스트 Function은 여전히 변수 23개이며 Customer flag만 명시적 false, 두 Renewal flag는 없다. **기본 OFF는 현재 안전 차단 상태의 설명일 뿐 V3 준비 완료 조건이 아니다.** 원격 변수 추가는 이번에 하지 않았다.

로컬 validator는 7개 변수의 명시적 존재/중복/secret metadata/phase 값/창 길이와 새 manifest digest를 검사하며 remote write를 허용하지 않는다. secret metadata가 맞더라도 key 내용·유효성은 별도 실제 검증 대상이다. V1/V2 guard·runner·archive·browser builder는 기존 V2 digest에 고정된 상태로 보존했다. **V3 실행 wiring은 별도 실행 승인 뒤 갱신·검증해야 한다.** 이 준비 코드를 실행 가능한 V3 orchestration으로 표시하지 않는다.

15분 단일 창, 120회, 순차1, 고유 Renewal 주문6, 쿠폰2, M/G/H3, HMAC·플랫폼 JWT·원래 소유권·가격·쿠폰·멱등성·watchdog·B6 복원 조건은 그대로다. `execute=[any]` 초기 runtime 소비 위험과 Appwrite hard cap이 아니라는 설명도 유지했다.

## 운영 AU 설정 차이 검토

기존 Owner CLI 정식 인증을 확인하고 공식 GET만 사용했다. 각 운영 프로젝트의 Auth/SMTP/OAuth/service 정책 **42개 필드**를 canonical field별 hash로 기록했다. 실제 credential 값·프로젝트 전체 응답은 보고하지 않았다. 고객/주문 데이터 조회는 0회다.

B5에 남은 인증 방법 7종, Account 상태, SMTP override, Google enabled, session alerts는 운영 4개 모두 일치했다. 이것은 Google Client ID/Secret, 전체 SMTP 세부값 또는 모든 서비스 정책의 과거 불변을 증명하지 않는다.

**과거 운영 AU raw `projectConfig` 차이의 원인은 UNVERIFIED**다. 당시 field별 원본이 없어 어느 필드가 달랐는지 입증할 수 없다. 재암호화/자동 갱신이라고 추정하거나 새 관찰 지문을 승인된 정상 기준선으로 재분류하지 않았다. Gallery B5 예외도 별도로 미완료다. 후속 활성화 전 해당 차이 검토 또는 명시적인 기준선 승인 절차가 필요하다.

## 검증 결과

| 검증 | 판정 | 근거/범위 |
| --- | --- | --- |
| 전체 `npm test` | PASS | **1,947 pass / 0 fail / 1 skip**, 총1,948. 기존 KR production-dist 조건부 skip 유지 |
| `test:customer-account` | PASS | 전체 suite에 포함된 **170 pass / 0 fail / 0 skip** |
| Node22 집중 | PASS | **65 pass / 0 fail / 0 skip**, Darwin Node22.23.3. 기존 guard/watchdog/복구·codec 포함 |
| 신규 보안·V3·설정 계약 | PASS | 7개. RED→GREEN, 변수 누락/값 미확인/중복/미승인 guard/잘못된 digest/초과 시간 거부 |
| ESLint / TypeScript | PASS | 전체 lint·`tsc -b`, 신규 MJS/browser driver lint, overlay 단독 타입 검사 |
| KR→AU build | PASS | 순차 실행, 기존 큰 chunk 경고 유지. 공개 배포 없음 |
| Chromium/WebKit compiled artifact | PASS (Mock) | 각각 닫힌 Function 호출0, signed Mock8회, 잘못된 대상0, page error0. native wire/requestId·draft 복원·CSS status/MIME 유지 |
| 비밀값 검사 | PASS (files) | Git 후보 전체와 새 닫힌 artifact 2,878개 파일, 지정 보호값 일치0·실제 Penpot URL credential 패턴0. 과거 도구 출력 사고와 구분 |
| 공식 Owner GET 전후 | PASS (현재 작업 구간) | 운영4개×42개 필드 hash 동일. 각 GET 점검10회, write0, 운영 고객·주문 조회0 |
| 과거 운영 AU 전체 정책 동등성 | **UNVERIFIED** | B5 공개 항목은 일치하지만 과거 raw hash 차이를 설명할 field별 원본 없음. 기준선 승인 안 함 |
| 현재 V3 원격 변수 준비 | **NOT READY** | Renewal 두 flag 미존재, 명시적 준비 기준 불충족. 원격 추가0 |
| 실제 V3 인증/JWT/주문/배포/복구 | **NOT RUN** | 승인 경계에 따라 창을 열지 않음 |
| Codex native connector 재연결 | **NOT RUN** | 새 키 native HTTP initialize200 및 설정 전환 확인, 다음 설정 reload/연결에서 connector 자체 확인 필요 |

Chromium 최초 artifact 검사는 profile 입력 표시 직후 `calls>=2` 검사에서 실패했다. 원래 AccountPanel은 profile을 먼저 렌더하고 주문을 비동기로 조회한다. Mock window 응답에 지연을 넣자 profile 시점1회→주문 로딩 뒤2회를 재현했다. 기존 호출 수 assertion을 유지하고 실제 주문 로딩 완료 UI를 기다리도록 browser driver만 수정한 뒤 두 엔진을 통과했다. 제품 코드·CSP·guard·비즈니스 assertion은 완화하지 않았다. 초기 실패와 진단 로그를 보존했다.

추가 500ms Mock 지연을 넣은 전체 Chromium 시나리오도 PASS였다(native wire/draft 복원 true, page error0, 잘못된 대상0). 정상 두 엔진의 호출8회와 달리 이 지연 시나리오는 cache/비동기 순서에 따라6회였으며, 기존 최소 호출 및 원래 본문 검증을 모두 유지했다.

overlay 단독 타입 검사의 최초 명령에는 root의 JSX/JS import/TS extension 옵션이 빠져 실패했다. 옵션을 일치시킨 최종 명령은 통과했으며 제품 파일 변경은 없다. 초기 RED 로그와 보호된 증거는 Git 제외 작업 폴더에 보존한다.

종료 확인: Account OFF/실제403, native auth7 OFF, Function disabled/execute=[], B6 `6ad41e576cb7a8f346af`, customer=false, 테스트 사이트 CLOSED. Google provider·B4 SMTP override 유지. host 표본 RAM 가용8.80GiB / disk83.02GiB / load1 0.14, OOM0, core5의 ID/image/start 시각은 V2 readiness 기록과 동일하다. env·프로세스 argv는 읽거나 출력하지 않았다.

## 변경 범위와 후속 승인

- 보안 helper3개와 보안 회귀2개: 새 값 숨김 capture, native reconnect, 안전 PID 진단.
- V3 manifest·로컬 validator·계약 tests, 공식 설정 hash helper·test, artifact driver의 비동기 완료 대기.
- 본 보고·V3 준비 계획·rollout/기존 B안 계획에 현재 승인 경계와 B5 blocker를 기록했다.
- 기존 `src/`, 운영 Function source/dependencies/lockfile, V1/V2 manifest와 제품 주문 로직은 바꾸지 않았다. 다른 worktree/main도 변경하지 않았다.

| 구분 | 파일 |
| --- | --- |
| 보안 | `scripts/security/capture-penpot-mcp-url.py`, `reconnect-penpot-mcp.py`, `safe-process-inventory.mjs`; `tests/customer-account-security-diagnostics.test.mjs`, `customer-account-security-reconnect.test.mjs` |
| V3 계약 | `docs/customer-account-b7-execution-manifest-v3.json`, `scripts/customer-account-b7-v3-contract.mjs`, `tests/customer-account-b7-v3.test.mjs` |
| 설정 증거/브라우저 | `scripts/customer-account-settings-fingerprint.mjs`, `tests/customer-account-settings-fingerprint.test.mjs`, `tests/customer-account-b7-artifact.browser.mjs` |
| 문서 | 본 보고, `docs/superpowers/plans/2026-10-18-customer-account-b7-v3-preparation.md`, `docs/customer-account-rollout.md`, `docs/superpowers/plans/2026-10-17-customer-account-very-server-test.md` |

코드 커밋: `bf6f89c`(Penpot 안전 reconnect/진단), `848d189`(V3 계약·설정 증거·browser 대기). 이 보고와 계획·rollout 상태는 별도 문서 커밋으로 마무리한다.

다음 실제 실행은 **이 V3 SHA에 대한 별도 승인**이 필요하다. V2 proof를 재사용하지 않는다. 승인 후에도 V3 runner/archive/proof wiring, 원격 변수7개 명시적 계약, AU 과거 설정 차이 검토, 닫힌 HTTPS native UUID/body 동결, live watchdog 권한·deadline 및 플랫폼 JWT/path 보존 검증이 선행돼야 한다. 로컬 준비를 실제 provider 인수나 production 출시 준비 완료로 표시하지 않는다.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] 운영 4개 프로젝트와 Console의 공통 SMTP 영향 승인
- [ ] OTP 수신자 접근·남용 방지
- [ ] Gallery 의미적 지문 예외 검토
- [ ] System SMTP 전용 Key·발신자 확정
- [ ] 운영 백업/root 인증/API·mail-worker 재생성 및 rollback
- [ ] 실제 이메일 OTP 및 Google↔OTP 동일 UID

native Email OTP OFF. Google+OTP 출시 준비 미완료. main 병합·production 배포·B5/B8 진행 승인은 포함하지 않는다.
