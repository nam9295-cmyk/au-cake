# B7 조건부 실행 — 선행 계약 충돌로 중단

2026-10-18, Mac Codex 단독. 시작 HEAD `c81cda4a11fb779a479a1215f82512ac68404101`, branch `feat/customer-account`, 지정 customer-account worktree만 사용했다.

## 결론: BLOCKED / 시험 창 미개방

승인 manifest SHA-256 `f71da5a2f768e9789086548d9af5c12c06b25e2f4480d5762daf1c781af27a43`는 일치한다. 그러나 해당 명세의 임시 `AU_RENEWAL_WRITES_ENABLED=true`와 신규 legacy 주문 3건 생성은 원래 서버 계약과 충돌한다. 이전 B7 계획이 기존 cutover 정책을 반영하지 못한 설계 오류다. 제품 결함으로 간주해 서버의 보호 조건을 제거해서는 안 된다.

`appwrite-functions/reservation-api/src/main.js`의 `createCake()`는 기존 requestId replay를 먼저 처리한 뒤, Renewal writes가 켜진 상태의 신규 legacy 요청을 `409 RENEWAL_CONTRACT_REQUIRED`로 거부한다. 기존 `tests/au-renewal-api.test.mjs`의 `cutover closes obsolete legacy new writes while keeping replay path first`가 이 정책을 검증한다.

## 이번 검증 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 승인 manifest SHA | PASS | 승인값과 byte digest 동일 |
| H legacy cake 신규 생성 계획 | FAIL | 원본 createCake → 409 RENEWAL_CONTRACT_REQUIRED |
| H legacy chocolate 신규 생성 계획 | FAIL | 원본 createCake → 409 RENEWAL_CONTRACT_REQUIRED |
| guest legacy chocolate 신규 생성 계획 | FAIL | 원본 createCake → 409 RENEWAL_CONTRACT_REQUIRED |
| 기존 Renewal API 회귀 | PASS | 4 pass / 0 fail / 0 skipped |
| Account 차단 | PASS | 실제 GET /v1/account: 403 general_service_disabled, 1.8.1 |
| 신규 사이트 진입 차단 | PASS | test-window.json: enabled=false, endsAt=null |
| Function/B6 배포 유지 | PASS | enabled=0, 이전 functions 지문 동일(기존 execute=[] 포함), active 6ad41e576cb7a8f346af |
| 테스트 flags/SMTP/Google/schema/ACL | PASS | 이전 B7 preflight 대비 projectConfig/schemaAcl/variables 등 9개 지문 그룹 동일 |
| 운영 4개 프로젝트 / core 5개 컨테이너 | PASS | 각 9개 지문 그룹 및 core metadata 동일 |
| guard/overlay/runner/watchdog 구현·RED→GREEN | NOT RUN | manifest 계약 충돌로 구현 전 중단 |
| 실제 서명 header 전달, 플랫폼 JWT, 회원/guest 주문, 쿠폰, MY ORDERS | NOT RUN | Function 실행·시험 창 개방 없음 |
| Chrome/Safari 실제 인증·OAuth 복원 | NOT RUN | 시험 창 개방 없음 |
| 전체 npm test / lint / TypeScript / AU·KR build | NOT RUN | 제품·도구 코드 변경 없음, 선행 실패 후 확대 검증 중단 |

위 FAIL 3건은 로컬 계획 호환성 probe 결과이며 기존 테스트 suite의 실패 건수와 구분한다. 원래 createCake를 그대로 호출하고 DB I/O만 absent-document stub으로 대체했다. 각 요청은 승인된 test DB/collection/requestId의 read 1회 후 거부했고 write 0회였다. 네트워크 호출 0회. 쿠폰은 이 선행 gate보다 뒤에서 검사되므로 probe에서는 빈 코드로 두었으며 쿠폰 인수 성공을 주장하지 않는다.

SDK23 로컬 소스의 createExecution은 headers를 JSON payload.headers로 전달하고 xpath를 path로 매핑한다. 기존에 보관한 Appwrite 1.8.1 공식 source에는 headers 검증 및 플랫폼 사용자 헤더 덮어쓰기가 있다. 이는 소스 확인에 한하며 이번 실제 실행 계약 검증 PASS로 세지 않는다.

## 실제 변경 및 닫힌 상태

외부 쓰기 0회. H/쿠폰/주문/서명 키/Function 변수/배포/사이트 배포/세션 모두 생성하지 않았다. Account와 Function을 열지 않았으므로 rollback 실행이나 세션 삭제도 하지 않았다. B6 active deployment를 그대로 유지했다. main 및 production 변경 없음.

2026-10-18 11:01:39 KST 읽기 전용 snapshot: available RAM 9,214,025,728 bytes(약8.58 GiB), disk 89,170,763,776 bytes(약83.05 GiB), load1 0.79. 운영 고객/주문 데이터는 읽지 않았다. 비교 기준은 이전 B7 preflight after.json이며 이번 snapshot까지 metadata 동일을 확인했다. Gallery의 B5 이전 의미적 지문 예외는 별도 미해결 상태다.

보호된 Git 제외 증거 디렉터리: `.superpowers/sdd/2026-10-18-customer-account-b7-google-orders/`.
- `preflight.mjs`: 로컬 재현 명령 `node .superpowers/sdd/2026-10-18-customer-account-b7-google-orders/preflight.mjs` (계약 불일치 시 exit 1)
- `compatibility.safe.json`: 3개 FAIL / 로컬 writes 0 / networkCalls 0
- `closed-state.json`: SELECT READ ONLY metadata/자원 snapshot

## 재개에 필요한 결정

권장 수정안은 **6개 신규 합성 주문을 모두 현재 Renewal v2 계약으로 통일**하는 것이다. H cake/chocolate 및 guest chocolate 3건의 format만 Renewal로 조정하고 원래 가격·쿠폰·소유권·멱등성 코드를 유지한다. legacy 신규 요청은 409 거부를 확인하는 부정 시험으로 남기고 기존 legacy 조회/replay 회귀와 구분한다. 쿠폰의 Renewal v2 호환성도 로컬 선행 검증을 통과해야 한다. 이 제안은 아직 적용·검증하지 않았다.

현재 승인 manifest를 수정하지 않았다. 위 변경은 fixture 계약과 승인 digest를 바꾸므로 **수정 manifest를 제시하고 승인받은 뒤** guard 구현부터 재개한다. 요청마다 Renewal flag를 다르게 주입하거나 원본 handler의 legacy gate를 우회하지 않는다. 이 미실행 단계에서 15분 창은 시작되지 않았으며 연장도 없었다.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] 기존 운영 4개 프로젝트와 Console 공통 SMTP 영향 승인
- [ ] 테스트 OTP 수신자 접근 및 남용 방지
- [ ] Gallery 설정 의미적 지문 예외 검토
- [ ] System SMTP 전용 Key·발신자 확정
- [ ] 운영 보호 백업, root 인증, API/mail-worker 재생성 및 복구
- [ ] 실제 Email OTP 및 Google↔OTP 동일 UID 검증

Native OTP OFF. Google+OTP 출시 준비 미완료. B5/B8, production 배포 및 main 병합으로 진행하지 않는다.
