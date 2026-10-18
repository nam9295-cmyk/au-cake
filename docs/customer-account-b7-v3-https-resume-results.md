# B7 V3 HTTPS 재개 — runtime PASS, 활성화 전 중단

2026-10-18 KST. **실제 HTTPS 라우팅 문제는 해결됐고 실제 guarded Function 검증도 통과했다. OPEN 배포 직후 활성화 게이트가 실패해 Account·Function 공개 실행은 열지 않았다. Google 회원 주문 인수는 NOT RUN이다.** 독립 watchdog의 자동 복구 결과는 `closed=true / verified=true / failedSteps=[]`이며 이후 직접 GET으로 확인했다.

## 승인과 한도

- V3 원본 SHA: `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`. [manifest](customer-account-b7-execution-manifest-v3.json)의 `executionApproved=false`, V1/V2와 기존 승인 증거를 그대로 보존했다.
- 추가 Pages 승인만 별도 보호 파일에 기록했다. 기존2회 + CLOSED preview/OPEN/최종 CLOSED 각1회로 **누적5/5회**다. 테스트 Pages project `au-cake-account-test` / branch `b3-google-test`만 사용했다. 이 project의 Cloudflare Environment 이름이 Production인 것은 운영 AU Pages project 배포를 뜻하지 않는다.
- 사용자3, 합성 주문6, 쿠폰2, Function 실행120, guarded deployment1, 단일900초·동시 실행1은 변경하지 않았다. 자동 연장·재시도·상한 초기화는 없다.

## 실제 HTTPS 검증 PASS

`57398e7`의 artifact를 재사용한 CLOSED preview를 추가1회 배포했다. 로컬 SPA fallback이나 Mock으로 원격 검증을 대체하지 않았다.

- 실제 cake/chocolate 상세, cart/reserve/account/callback: HTTP200, 앱 렌더링, 승인된 가격 AUD75/AUD12 확인.
- entry JS와 CSS: HTTP200, JavaScript/CSS MIME 정상. 기존 CSP 보존, 외부 폰트 허용·CSP 완화 없음. 실제 브라우저의 CSS/CSP/import 오류0.
- 예상하지 않은 URL과 없는 JS: script 없는 hard404 유지.
- CLOSED window, Account OFF 및 callback→account의 unavailable 안내 확인.
- 원래 상품 UI→Bag→Checkout에서 G 케이크/초콜릿 requestId·body를 각각 캡처했다. UUID는 `e132a45c-996e-4768-a1f7-b5eb92c4ff9a`, `fe42eb6c-b637-4bd0-a45b-def66a369e2b`이며 교체하지 않았다. 실제 HTTPS 초콜릿 주문서를 저장·새로고침한 뒤 UUID/body/날짜/연락처가 동일함을 확인했다. 실제 OAuth 왕복 검증은 아니다.

네이티브 date/select를 DOM 값만 채웠을 때 React state에 반영되지 않는 브라우저 조작 차이는 실제 키 입력으로 확정했다. 제품 코드를 바꾸지 않았다. 실제 wire에 있는 `finish=basic`, `individualPackaging=false`를 V3 fixture validator가 byte 그대로 보존하도록 보완했다. 기본값 외 finish·포장 true·추가 option은 거부하는 RED→GREEN을 추가했다. V2 validator와 원래 가격·쿠폰·JWT·주문 코드는 변경하지 않았다.

## 생성·실행한 테스트 자원

| 자원 | 실제 결과 |
| --- | --- |
| Auth H | `ca-test-customer-h-20261018` 1명 사전 생성, 정확히 M/G/H3 확인. Google identity 연결은 미검증 |
| 쿠폰 | `manual_coupons/b7-manual-20261018-01` 5%, `review_coupons/b7-review-20261018-01` 10%. M 전용 read/update/delete ACL 확인, 아직 active·미사용 |
| 신규 변수 | 승인된7개 정확히 생성. 총23→30, HMAC만 secret=true. 준비 false/시험 true·false/종료 false 계약 확인 |
| guarded deployment | `6ad456239aeb781a4f4d` 1개 ready·활성화, Function은 disabled/execute=[] 유지 |
| 실제 native build | Linux x64, Node22.23.2, sharp0.35.5, libvips8.18.7, JPEG/PNG/WebP 및 SVG·truncated 거부 PASS |
| 실제 실행 | Owner 관리 경로의 서명된 health/renewal-health/customer-account-health **3회, 모두 completed/HTTP200**, 예상 밖 execution0 |
| 주문·결제·메일 | **0 / 0 / 0**. 테스트 email queue0. 운영 고객·주문 조회0 |

사용한 coupon HMAC은 B6에서 새로 생성·보호 저장했던 **테스트** secret이다. 과거 SQL `valueDigest`는 encrypted storage hash이므로 plaintext와 비교할 수 없음을 source로 확인했다. 생성 기록·보호 파일·secret metadata·B6 이후 갱신 없음으로 provenance를 확인했고, 실제 쿠폰 적용은 NOT RUN으로 남겼다. 운영 secret 재사용·키 발급은 없다.

## 실제 runtime / watchdog 결과

- 별도 프로세스로 실제 Owner Account OFF·Function OFF·flags OFF 요청을 실행하고 403/B6 보존을 확인했다.
- 독립 watchdog의 실제 heartbeat·관리 GET·활성화 lease를 확인했다. 원격 runtime에서 V3 manifest, HMAC/path, 플랫폼 UID/JWT header 존재 및 customer=true/writes=true/preorders=false가 확인됐다.
- 세 health 응답과 execution metadata를 확인했다. `live=false` 표시가 있어도 실제 guarded entry가 실행됐음을 증명했다. 배너 제거 목적의 재배포는 하지 않았다.
- **Owner health는 고객 JWT 인증 시험이 아니다.** G/H의 Account.get/JWT 검증·주문 owner 저장은 미실행이다.

900초 deadline은 **14:24:59.634→14:39:59.634 KST**로 한 번만 고정했다. 사전 runtime 검증 후 OPEN Pages 배포가 성공했으나 `OPEN_SITE_OR_LEASE_UNVERIFIED`가 발생해 `runner.open()`에 도달하지 않았다. Account ON·Function enabled=true/execute=[any] 요청은 **0회**다. watchdog이 **14:25:57.131 KST**에 조기 종료·복원을 완료했다.

실행기의 결합 조건은 HTTP/window tuple과 최신 watchdog lease를 한 번에 검사했으며, 실패 당시 개별 predicate와 heartbeat age를 기록하지 않았다. **어느 항목이 실패했는지 원인은 UNVERIFIED다.** 배포 전파 지연이나 lease 신선도 문제라고 확정하지 않는다. 이 관찰 설계 부족 때문에 구체 원인을 입증하지 못했다. 실패를 숨기거나 타이머를 다시 시작하지 않았다.

실패 이후 추가 배포·인증 재개는 없다. 다음 검토에서는 동일 deadline 안의 bounded read-only 확인과 개별 status/window/heartbeat-age 기록을 먼저 보완해야 한다. 기존 실행 스크립트·증거는 그대로 보존한다. 새 실행 예산·창은 별도 승인 대상이다.

## 종료 직접 확인 PASS

- Account OFF / 실제 API403, native 인증7종 OFF, Google와 B4 SMTP 보존.
- Function disabled / execute=[], B6 `6ad41e576cb7a8f346af` 복원. customer·Renewal writes·preorders 모두 **명시적 false**, 신규7변수와 기존 변수 총30 유지.
- 서명 secret 무효화 PUT 성공, B6 복원·공개 실행 차단. Secret readback은 Appwrite에서 마스킹되므로 원문 출력·비교하지 않았다.
- 최종 Pages `cbbbda3c-2d5c-4126-87a8-0d7e388e9c04`, public HTTPS에서 script 없는 CLOSED 확인. 이전 immutable deployment URL을 삭제한 것은 아니며, 모든 alias의 실제 인증·Function 접근은 서버 OFF로 차단된다.
- authLimit 원래2로 복원. M/G/H3명과 두 쿠폰은 보존, G/H session 각각0. 새 인증 세션 생성·삭제0, 자동 데이터 삭제 없음.
- test DB2 / collection12 / attribute182 / index38, available·ACL·owner schema·Admin M 재검증. test Google/SMTP/Auth protected 설정 지문 동일.
- 운영4×42 Auth/SMTP/OAuth/service 필드 작업 전후 지문 동일. 기존 Function6개의 active deployment/runtime/enabled는 B6 기록과 동일. **과거 AU raw 지문 차이는 UNVERIFIED 유지**.
- host 표본 RAM 가용8.82→8.80GiB, disk 가용83.04→82.93GiB, load1 0.24→0.62, OOM0/API 정상. CPU 사용률 % 측정은 아니다. 운영 컨테이너 재시작·재생성0.

## 최종 PASS / FAIL / NOT RUN

| 항목 | 결과 |
| --- | --- |
| 실제 HTTPS route·MIME·CSP·hard404·native UUID/body·새로고침 복원 | PASS |
| 7변수/secret metadata·guarded 배포·Linux native smoke | PASS |
| 실제 Owner 서명 health3·플랫폼 header/path/runtime flags | PASS |
| 실제 독립 OFF 권한·heartbeat·자동 종료 복구·unexpected execution0 | PASS |
| OPEN 후 사이트/window/lease 활성화 게이트 | **FAIL — 정확한 predicate 원인은 UNVERIFIED** |
| G/H Google·고객 JWT·owner·MY ORDERS·타인404 | **NOT RUN** |
| Guest 생성/lookup·실제 쿠폰/멱등성·Legacy409 | **NOT RUN** |
| OAuth 카트·프로필·실기기·동일 이메일 UID | **NOT RUN** |
| 전체 npm test | **1,988 pass / 0 fail / 1 기존 skip, 총1,989** |
| Node22 집중 테스트 | **102 pass / 0 fail / 0 skip** |
| 변경 MJS ESLint·root lint·TypeScript | PASS |
| Chromium/WebKit·KR→AU build | 기존 완료 증거 재사용(제품/TS/의존성 변경0), AU는 이번 전체 suite에서 재빌드 PASS |
| public artifact/Git 비밀정보 검사 | 보호 credential 검출0; 최종 검사 로그 보존 |

코드 커밋 `2d3b088`: Pages 누적5 승인 proof 검증 및 native 기본 option 동결, RED→GREEN. 제품 source·가격·쿠폰·인증 정책·운영 설정 변경은 없다. Mac Codex 단독 구현·자체 리뷰이며 별도 reviewer의 검토를 받았다고 주장하지 않는다. 최종 문서 커밋은 Git log로 식별한다.

증거/승인 proof/관리 인증은 `.superpowers/sdd/2026-10-18-customer-account-b7-v3-execution/resume-20261018/`의 Git 제외 보호 파일에 보존한다. raw key/JWT/cookie/OAuth code는 보고하지 않는다. main/origin/main과 다른 worktree 변경0. **이번에는 여기서 중단한다.**

## B5 — DEFERRED — RELEASE BLOCKER

공통 SMTP·수신자/남용 제한·Gallery 의미적 검증·system credential·운영 백업/재생성/rollback·실제 OTP와 Google↔OTP 동일 UID는 모두 미완료다. native Email OTP OFF, 실제 OTP/교차 UID NOT RUN, Google+OTP 출시 미완료를 유지한다. Google-only 출시도 별도 제품 결정이다. B5/B8·운영 배포·main 병합은 진행하지 않았다.
