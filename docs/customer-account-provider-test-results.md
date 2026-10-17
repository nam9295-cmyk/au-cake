# Customer Account provider test — B2 로컬 준비 결과

> **최신 상태:** [B2 완료](customer-account-b2-owner-execution.md), [B3 Google SDK 검증](customer-account-b3-google-validation.md)에 이어 별도 승인된 [B4 테스트 Resend SMTP](customer-account-b4-smtp-validation.md)를 완료했다. 테스트 전용 domain/DNS3/도메인 제한 sending Key/프로젝트 SMTP override를 구성하고 승인 수신함의 일반 sample 1건 수신을 확인했다. Account와 신규 인증 진입은 계속 OFF다. 전체 로컬 테스트 1,879 pass/0 fail/기존 skip1, 계정 그룹103 pass. 공통 SMTP/B5, OTP/동일 이메일 UID 통합/제품 주문·계정 통합은 미검증·미실행이다. 아래는 이전 local preflight 당시의 역사적 기록이다.

> **B5 사전 점검 추가:** [읽기 전용 결과](customer-account-b5-preflight.md)와 [별도 승인 후 사용할 실행 계획](superpowers/plans/2026-10-18-customer-account-system-smtp.md)을 작성했다. 기존4의 이메일 인증 ON/SMTP override OFF를 공식 Console에서 확인했다. 공통 SMTP 실제 적용·system Key 발급·재생성·메일 발송은 하지 않았다. 공개 테스트 OTP는 TO 제한 미입증으로 보류한다. 위 테스트 수는 B4 실행 결과이며 B5에서 전체 제품 테스트를 다시 실행한 수치가 아니다.

> B5 최종 raw 지문 비교는 Gallery의 project-config 1개가 불일치했다. 조회 접근 시각 저장/암호화 재생성과 일치하는 source·시각 근거는 확인했지만 이전 semantic 지문이 없어 완전 불변을 확정하지 않았다. 다른8범주·다른 프로젝트·핵심 container/공통 env 불변과 함께 보고서에 기록하고 실제 적용을 보류했다.

2026-10-17 KST. [B1](customer-account-b1-validation.md)은 완료했다. 이번 B2는 **local preflight 완료 / 실제 생성 승인 대기**다. 실제 Google/이메일 OTP/주문 서버 인수는 미완료다.

정확한 자원·권한·키 만료·관리자 UID·합성 자료·실행/중단 절차는 [B2 승인안](customer-account-b2-preflight.md), 전체 schema는 [resource manifest](customer-account-b2-resource-manifest.json)에 있다.

## 로컬 변경

- `scripts/customer-account-test-target.mjs`: exact target/resource allowlist, Console key provenance·scope·expiry 검증, immutable inputs, read-only schema metadata transport, redirect/header 충돌 차단.
- `scripts/customer-account-test-baseline.mjs`: 전체 setup 실행 없이 현 코드의 AU baseline 12 collections 선언. review/email의 공용 declarative schema를 재사용한다.
- `scripts/seed-customer-account-test-project.mjs`: 명시 입력만 받는 offline create 계획, synthetic settings, 별도 owner migration 계획. 원격 apply 없음.
- `tests/customer-account-test-target.test.mjs`, `tests/customer-account-test-seed.test.mjs`: security boundary·실제 Renewal 저장 자료·readiness·CLI 회귀. 기존 테스트 삭제/완화 없음.
- 승인안/JSON manifest/이 문서/B안 진행 상태 문서. 제품 src, Function src, package/lock, 운영 env는 수정하지 않았다.

## 검증 결과

| 검증 | pass | fail | skip | 비고 |
| --- | ---: | ---: | ---: | --- |
| target guard | 5 | 0 | 0 | wrong target/mixed resources/unknown credentials → operation/network 0 |
| offline seed | 7 | 0 | 0 | 2 DB/12 classified collections, private ACL, 실제 cake/chocolate 자료, reservations-only owner schema |
| `npm run test:customer-account` | 71 | 0 | 0 | 기존 59 + 신규 12 |
| 전체 `npm test` | 1,847 | 0 | 1 | 69 test summary 합산; 기존 1,835 + 신규 12. 총 1,848 |
| 신규 helper tests, Node22.23.3 | 12 | 0 | 0 | macOS arm64, 실제 Linux Function/native smoke가 아님 |
| ESLint / TypeScript | 통과 | 0 | — | `npm run lint`, `npx tsc -b`, 새 JS 5파일 `no-unused-vars` 검사 |
| JS syntax / 문서·manifest | 통과 | 0 | — | Node --check, diff --check, JSON 재생성 동일성·local link 검증 |

위 Node24 실행은 24.12.0/npm11.6.2다. 전체 npm test의 기존 skip은 `KR production dist does not publish AU Chocolate pages`이며 AU dist를 검사하는 실행의 market 조건에 따른 기존 skip다. 새 테스트 skip은 없다. AU/KR 독립 build와 고객 브라우저 UI는 이번 helper 변경에서 별도로 재실행하지 않았다. Console UI 조회는 수행했으나 실제 고객 Auth 브라우저 검증으로 계산하지 않는다.

RED 증거: 초기 target 5개·seed 7개가 신규 기능 부재로 실패한 뒤 각각 GREEN으로 전환했다. 추가 self-review에서 caller header를 강제 덮어쓰는 것보다 잘못된 입력을 거부해야 함을 확인했다. header 혼합 테스트를 `Missing expected rejection`으로 재현하고 network 이전 거부로 수정한 후 전체 suite를 통과했다. `.superpowers/sdd/2026-10-17-customer-account-very-server-test/`에 RED/GREEN/전체 테스트 로그·Console 대상 screenshot을 Git 제외로 보존했다.

## 실제 Appwrite 상태와 미검증

기존 Console Owner 세션의 Settings에서 project ID `verygood-au-account-test`와 endpoint, **Account OFF**를 확인했다. 사용자 생성 폼은 조건만 확인 후 Cancel했다. 새 Auth user/Key/DB/Collection/Function을 생성하지 않았고 test resource POST·migration apply도 실행하지 않았다. 운영 프로젝트 설정/권한/데이터는 접근·변경하지 않았다. main 및 다른 worktree를 수정하지 않았다.

다음 항목은 후속 승인이 있어야 검증할 수 있다.

- 실제 Key 발급 소속·scope/expiry와 private 보관, M UID 실제 존재, 테스트 schema/ACL available 및 GET migration dry-run/apply.
- Google/6자리 OTP·동일 이메일 동일 UID·session/권한/소유권·OAuth 장바구니 복원·실제 공급자 오류/발송. B3 이후 별도 승인 사항이다.
- 공통 SMTP empty gate, 운영 이메일 영향, sharp 0.35.4 및 Node16 기본 deploy/Node22 운영 차이. 별도 해결 대상으로 유지하며 이번에 변경하지 않았다.
- 생성 전 기존 프로젝트 구성 metadata/서버 자원 재확인. 이번 조회만으로 B1 이후 모든 자원이 계속 불변이라고 보증하지 않는다.

## 커밋과 중단 지점

- `bf1ea98`: target/credential guard 및 RED→GREEN 테스트.
- `8e5db7a`: 혼합 project/key header를 network 이전에 거부하는 회귀 보강.
- `f5b6473`: offline seed helper, test-only baseline, 정확한 resource manifest, RED→GREEN 테스트.
- 최종 문서 커밋은 Git log의 이 결과 문서·B2 승인안 갱신 커밋으로 식별한다(자기 SHA를 문서 안에 넣어 후속 변경을 만들지 않음).

최종 검증 시 branch `feat/customer-account`, tracked working tree clean을 확인하고 보고한다. push/main merge/배포/리소스 생성은 없다. 사용자가 요구한 **최종 생성 승인 지점에서 중단**하며, baseline+GET dry-run 또는 owner migration apply 포함 여부를 명시적으로 승인받은 뒤 해당 범위만 이어간다.
