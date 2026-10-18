# B7 Google-only 주문 인수 — 준비 결과

2026-10-18. Mac Codex 단독, `feat/customer-account`, 시작 `ec6470c` clean. **이번 결과는 실행 계획이며 활성화/배포/fixture 생성 승인이 아니다.** [실행 계획](superpowers/plans/2026-10-18-customer-account-b7-google-orders.md), [제안 manifest](customer-account-b7-execution-manifest.json)를 함께 검토한다.

## 읽기 전용 재확인

- Endpoint/project 정확한 기존 test pair. Account403/general_service_disabled, 신규 인증 site entry=false.
- test user M+G2명. 예상 G UID `6ad38e4e0ffd5f810e23`·상태/hash 확인, M `ca-test-admin-m-20261017` 불변. 운영 사용자·주문 조회 없음.
- COUNT-only로 test settings1건/나머지11개 Collection0건을 확인했다. 본문을 읽지 않았고 운영 데이터 테이블에는 접근하지 않았다.
- DB2/Collection12/Function1/variables23/key3. B2 schema/ACL과 B3 Google/B4 SMTP 설정 지문을 B6 종료 지문과 대조한다.
- Function `ca-test-reservation-api`, enabled=false/execute=[], node-22/s-1vcpu-1gb. active `6ad41e576cb7a8f346af`, deployment ready, entrypoint src/main.js, live=false. 새로고침한 Console에도 active와 배너가 함께 표시됐다. 재배포/배너 수정/Function execution을 하지 않았다. B6 Linux·실행 증거는 기존 보고서에 보존했다.
- 시작 host RAM available 약8.323GiB/disk82.995GiB/load1 .40. 실행 시 다시 검증한다.

## 선정한 제안

G는 기존 계정, H는 사용자가 별도로 지정한 Google 계정이다. 두 주소는 private actor 파일에 보관하고 공개 manifest에는 SHA-256과 UID만 넣었다. H UID 후보는 `ca-test-customer-h-20261018`이다. **H를 Account OFF에서 먼저 생성하고 M/G/H3명을 확인한 뒤 cap3으로 설정**하여 빈 가입 슬롯 없이 시작한다. Google Testing 목록은 접근 통제가 아니며 필요하면 H1명을 test audience에만 추가한다. provider client/secret/callback은 보존한다.

원래 로그인 UI는 guest readiness를 먼저 실행한다. 따라서 execute를 G/H 두 UID로만 제한하면 실제 login/guest Checkout이 막힌다. 제안은 test-only 서버 entrypoint의 HMAC/시간/UID/fixture guard 아래 Function execute=[any]를 최대15분 허용하는 방식이다. 실제 SDK와 원래 handler의 JWT·owner·쿠폰·멱등성을 그대로 시험한다.

**잔여 위험:** 서명 없는 직접 API 호출도 Appwrite execution metadata와 초기 runtime 자원을 소비할 수 있다. 서버 guard는 business 호출/주문 쓰기를 차단하지만 native API 도달 자체를 차단하는 WAF가 아니다. 요청120/동시1/5초 감시도 provider hard cap이 아니다. 이 위험의 명시적 수용이 없으면 ON하지 않는다. private ingress+relay 대안은 추가 자원·권한 설계를 먼저 승인받는다. 프론트 전용 Access로 대체하지 않는다.

## 최종 승인 요청 범위

| 대상 | 정확한 제안 상한 |
| --- | --- |
| test Auth | H1명; cap2→3→종료2, G/H 실제 Google 세션 및 이번 run session 정리 |
| 인증 창 | 서버 deadline 최대900초, 자동 연장0, native 인증7개(OTP/JWT method 포함) 계속 OFF |
| test Function | 기존 ID만, guard entrypoint 포함 deployment1개; 새 Function0/API Key0; 임시 enabled=true/execute=[any] |
| flags | test backend customer/Renewal writes true, preorders false; test frontend AU/customer true/API all; 끝나면 false |
| guard credential | 새 test-only32byte signing key1개, Function secret 및 지정 탭에만; 공개 bundle/Git/URL/로그0 |
| Function variables | B7 run/start/end/key/fixture hash 최대5개 추가. 기존 DB/Admin M/scopes7/spec/events·schedule 불변 |
| test site | 기존 au-cake-account-test/b3-google-test 및 같은 HTTPS만. 닫힌 준비→open→닫힘 최대3배포, production/staging0 |
| 합성 주문 | reservations 최대6개. Renewal cake/chocolate G2, legacy cake/chocolate H2, owner 없는 guest2 |
| requestId | UI2개는 ON 전 원래 form의 UUID를 관찰·동결, SDK4개는 manifest 고정값. 원래 UUID/wire body를 수정하지 않음 |
| 쿠폰 | 기존 manual/review collection에 합성1개씩(5%/10%). reviews/invites/메일 생성0, 기존 정책 변경0 |
| 자료 | 합성 이름·04번호·example.invalid 연락 이메일. 실제 Google 로그인 이메일과 구분, profile prefs 최대4회 |
| 량/중단 | 전체 Function 실행120, 순차1, 미승인 execution1건/낯선 UID/권한·배포 drift/자원·메일 시도 때 즉시 OFF |

실제 UI/SDK 시험의 expected pass/fail/NOT RUN은 실행 계획 Task4에 고정했다. A/B 상세·cursor/replay는 wrapper가 먼저 막지 않고 원래 backend의404/409를 확인한다. guest는 실제 session 없는 SDK를 쓰며 Owner 호출로 대신하지 않는다. 정상 가격·SKU/쿠폰/날짜 정책을 바꾸지 않는다. fixture 날짜는2026-10-23 10:00이므로 실행 지연으로 유효하지 않으면 자동 교체하지 말고 승인 명세를 갱신한다.

## 선행조건과 복구

**guard/overlay/runner/watchdog 코드는 아직 작성하지 않았다.** 최종 승인 후에도 RED→GREEN, 전체 로컬 회귀, artifact 비밀값 검사, 정확한6 UUID 동결, closed native/readiness 검증, OFF watchdog 검증을 모두 통과하기 전에는 ON하지 않는다. 예상 밖의 리소스/권한/재배포가 필요하면 중단한다.

독립 Mac watchdog과 Function 서버 deadline을 함께 사용한다. 끝나면 Account OFF, Function false/execute[], customer/Renewal/preorders false, signing key 무효화, B6 원래 deployment 복원, test site closed, G/H logout/해당 run session 정리, 운영4 불변을 확인한다. H/합성 자료/배포는 보존하고 자동 삭제하지 않는다. Mac 네트워크/인증 실패 때 deadline은 business 요청을 거부하지만 Account OFF를 대신하지 못하므로 별도 수동 Console 차단과 읽기 확인이 필요할 수 있다. 실제 종료 확인 전 완료로 표시하지 않는다.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] 기존 운영4/Console 공통 SMTP 영향 승인
- [ ] OTP 수신자 접근·남용 방지
- [ ] Gallery 의미적 지문 예외 검토
- [ ] System SMTP 전용 Key·sender
- [ ] 운영 보호 백업/root 인증/API·mail-worker 재생성·복구
- [ ] 실제 OTP·Google↔OTP 동일 UID

공통 SMTP/서비스 재시작/OTP 발송은0건이며 계속 보류한다. Google+OTP 최종 출시 승인 불가, Google-only 제품 출시도 별도 결정·승인이 필요하다.

## 이번 검증의 범위

문서 링크/manifest 구조·대상·개수/중단 조건/제안 SHA/기존 운영 metadata 불변을 검증한다. 제품 코드·의존성·Function·Pages·Google/SMTP·Auth/flags·DB 문서는 변경하지 않았으므로 전체 제품 테스트/빌드를 다시 실행하지 않는다. B6의1886 pass/account109/Node22 focused34와 이번 문서 검증은 구분한다. 실제 B7 로그인/JWT/주문/보안 guard 효과/브라우저 인수는 전부 NOT RUN이다. 최종 승인 대기 상태에서 중단한다.

제안 manifest SHA-256: `f71da5a2f768e9789086548d9af5c12c06b25e2f4480d5762daf1c781af27a43`. 실행 시 이 digest와 승인 proof를 검증하고, UI의 native UUID2개를 포함한 파생 private fixture manifest를 ON 전에 별도로 동결한다.

문서 self-review: requestId 관찰/동결, guard가 원래 ownership 거부를 가리지 않는 조건, 실제 guest SDK, live/vars readback, watchdog의 네트워크 실패 한계를 대조했다. 문서·manifest 구조/개수/링크/복구·B5 체크박스 검증 PASS. 준비 전후 기존5 project 구성 지문 전체·core5가 동일하며 B6 종료 baseline과도 동일했다. 최종 자원 관측은 available RAM8.510GiB/disk83.003GiB/load1 1.06이며 순간값이다.
