# B7 V3 최종 인수 재개 — 활성화 PASS, 브라우저 준비 실패로 조기 종료

2026-10-18 KST. **새 활성화 게이트와 실제 watchdog·runtime 검증은 통과했다. Chrome 파일 가져오기 권한 문제와 운영 탭의 자동 화면 관찰로 시험을 중지했다. Google 로그인·회원 주문 인수는 NOT RUN이며 B7 완료가 아니다.** 자동 OFF 복구와 이후 직접 GET 검증은 PASS다.

## 승인·기존 기록 보존

- V3 SHA `1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90`, 원본 `executionApproved=false`, V1/V2와 기존 승인·실행 evidence를 변경하지 않았다.
- 별도 보호 approval proof/continuation journal에 이전 journal SHA·기존 자원 ID·B7 실행3·Pages5 사용량을 인계했다. 이전 journal을 초기화하지 않았다. 새 키는 이전 키와 다르게 생성했고 기존 secret 변수에만 설정했다.
- H·쿠폰2·신규7 변수 ID·guarded deployment `6ad456239aeb781a4f4d`를 재사용했다. Auth user/쿠폰/변수/Function deployment/API Key/DB/schema 신규 생성0이다.
- 기존 guarded archive·fixture·Function source/lock bytes의 검증을 재사용했고 새 Linux build/Function deployment는 하지 않았다. 제품 source·가격·쿠폰 정책·JWT·ownership 코드는 변경하지 않았다.

## 실제 진행과 개별 gate 기록

| 시각 KST | 실제 결과 |
| --- | --- |
| 준비 | 공식 Console Settings에서 정확한 test endpoint/project 확인. Account OFF403, Function disabled/execute=[], B6 active, CLOSED, 기존 자원·schema/ACL·Google/B4 SMTP 확인 |
| 닫힌 probe5주기 | 실제 관리 GET11개/주기와 aggregate metrics, heartbeat 간격 최대3,509ms. 모두5초 이내·건강/metadata 정상 |
| 15:12:39.673 | 승인된 새900초 창을 한 번 확정. deadline 15:27:39.673, 연장 없음 |
| 활성화 전 | 같은7 변수 ID 및 기존 Customer flag 갱신, 독립 watchdog·수동 OFF 경로 준비, 기존 deployment에서 Owner 서명 health3회 HTTP200 |
| Pages6 OPEN | `6cb480da-4a97-4eb5-b098-85506a8ccade`, 테스트 Pages project/branch만 배포 |
| gate 1차 | HTTP200/redirect 없음/JSON 정상, **enabled=false·startsAt/endsAt 불일치**. 전후 lease PASS, age3,345ms/199ms. 이전 CLOSED 응답에 해당해 승인된 bounded GET 재확인 |
| gate 2차 | HTTP/window/lease/deadline/clock 조건 전부 PASS. age1,203ms/2,099ms. 전체 gate 소요2,229ms, deadline 잔여859,355ms |
| 15:13:21.061 | Account ON, Function enabled/execute=[any]를 실제 확인 |
| 15:14:20.400 | 브라우저 차단/화면 관찰 문제로 stop 요청. 로그인/주문 시도 없이 조기 종료 |
| 15:14:36.344 | watchdog `closed=true / verified=true / failedSteps=[]`, CLOSED7 복원 완료 |
| 15:16:05.676 | 직접 GET으로 Account403/Function OFF/B6/flags false/CLOSED/세션0/주문0 재확인 |

실제 독립 worker의 non-closed heartbeat32개, 최대 간격3,672ms였다. 마지막 closed observation의 약12.44초는 OFF·Pages 복구 전체를 포함하는 종료 시간이며 정상 probe 신선도 표본으로 계산하지 않았다. 5초/+1초 future 기준을 완화하지 않았다. 새 계측으로 이번 Pages 이전 CLOSED 응답과 정상 lease를 구분했다. **이 사실이 과거 V3 실패 predicate의 원인을 증명하지는 않으며 과거 원인은 UNVERIFIED**다.

원래 Function inventory에는 B6의 보존된 실행10건도 있다. 처음 read-only preflight가 전체를 B7의3건으로 잘못 기대해 중단했다. B6 기준선10 + 기존 B7 서명 health3 = 기존13건이 정확히 일치하고 알 수 없는 실행0임을 확인한 뒤 수정한 별도 preflight로 이어갔다. 실패한 스크립트와 로그도 보존했다. B7 사용량3을 전체 inventory13으로 바꾸거나0으로 초기화하지 않았다.

## FAIL — 브라우저 준비와 운영 화면 관찰

테스트 `/account`는 실제 HTTPS에서 렌더링됐다. 이후 보호 run file을 로컬 test-only input으로 가져오려 했지만 Chrome 확장의 **Allow access to file URLs** 권한 부족으로 `fileChooser.setFiles`가 실패했다. 파일 가져오기·키 적용·Google 버튼 실행에 도달하지 않았다. 전용 키 원문은 출력하지 않았다.

이 문제를 확인하면서 **에이전트가 `cua.getApp('Google Chrome')`를 창 지정 없이 호출했다.** 도구가 사용자의 기존 운영 예약 탭을 선택해 운영 고객·주문 화면 정보를 도구 출력에 포함했다. 이는 허용된 테스트 범위를 벗어난 관찰이며 에이전트의 실수다. 해당 탭에 추가 탐색·입력·변경·export를 수행하지 않았고 내용을 로컬 파일이나 Git 문서로 복사하지 않았다. **운영 고객 데이터 관찰0이라고 보고하지 않는다.** 이 보고서에도 고객 정보는 재수록하지 않는다. 설정·배포·데이터 변경과 화면 관찰은 별개로 기록한다.

stop 요청 후 복구를 확인했고 창·Pages 예산을 재시작/추가하지 않았다. 이번 시험을 계속하기 위해 확장 권한을 임의로 변경하거나 다른 경로로 키를 전달하지 않았다.

후속 실행 전에 필요한 준비:

1. 원격 창을 열기 전에 CUA/Chrome의 실제 파일 가져오기를 로컬 compiled artifact와 **비밀이 없는 dummy 파일**로 검증한다. 로컬 Playwright Mock PASS가 사용자의 Chrome 확장 권한을 보증하지 않는다.
2. 브라우저 조작은 정확한 tab ID와 test origin에 고정한다. 파일 문제의 대체 경로로 앱 이름만 지정한 native 앱 접근을 사용하지 않는다. 지정 대상이 없으면 사용자에게 요청하고 멈춘다.
3. Chrome 권한 변경은 사용자가 직접 검토·수행하도록 한다. 이번에 변경하지 않았다. 공식 도구 안내:

> To enable file upload, open chrome://extensions, click Details under the ChatGPT browser extension, and enable "Allow access to file URLs." See [here](https://developers.openai.com/codex/app/chrome-extension#upload-files) for details.

지금 새 인증 창은 승인 대기이며 자동 재개하지 않는다.

## 사용량·종료 확인

- Pages **7/7**: OPEN6, CLOSED7 `164639d3-7e11-49b0-8890-dc0c88d60dd9`. Cloudflare의 Environment=Production은 테스트 Pages project `au-cake-account-test`의 branch `b3-google-test`를 뜻한다. 운영 AU Pages 배포가 아니다. 이전 immutable URL은 삭제하지 않았고 서버 Auth/Function OFF로 접근을 차단했다.
- B7 Function 실행 **누적6/120** = 이전3 + 새 Owner health3. 추가117 중3회 사용, 예상 밖 execution0. 전체 inventory16은 B6 과거10을 포함한다. 실제 고객 JWT 검증으로 계산하지 않는다.
- 주문0/6, 기존 쿠폰2건 보존·추가0, Google 로그인0, G/H 세션 각0, mail queue0, 실제 결제·메일0.
- Account OFF/실제403, authLimit2 복원, Function disabled/execute=[], B6 `6ad41e576cb7a8f346af` active, customer·Renewal writes·preorders 명시적 false, 전체 변수30/기존7 ID 유지.
- signing key 무효화 PUT은 watchdog 실패 단계 없이 완료됐다. secret GET readback은 마스킹되어 원문 비교로 증명한 것은 아니다. B6/공개 실행 OFF도 직접 확인했다.
- test DB2 / collection12 / attribute182 / index38, available·ACL·owner schema·Admin M 검증 PASS. Google/B4 SMTP 및 보호 정책 지문 동일.
- 운영4개 현시점 의미적 설정 지문 일치, 기존 Function6개의 deployment/runtime/enabled가 보존된 B6 기준과 동일. **과거 AU raw 설정 차이는 UNVERIFIED 유지.** 앞의 운영 화면 관찰을 이 설정 불변 검사로 없던 일로 취급하지 않는다.
- RAM 가용 약8.69→8.41GiB, disk 가용 약83.08→82.99GiB, load1 약0.13→0.18, OOM0/API 정상. CPU 사용률 측정값은 아니다. 서비스 재시작·컨테이너 재생성0.

## PASS / FAIL / NOT RUN

| 항목 | 결과 |
| --- | --- |
| 기존 자원·승인 SHA·누적 budget 보존, 새 secret | PASS |
| 실제 닫힌 probe5주기, 독립 worker32주기·5초 lease | PASS |
| 개별 HTTP/window/lease 계측·bounded GET 후 활성화 | PASS |
| 기존 guarded runtime / Owner 서명 health3·header/path/flags | PASS |
| 보호 파일 가져오기 | **FAIL — Chrome 파일 접근 권한 부족** |
| 테스트 브라우저 범위 보호 | **FAIL — native 앱 호출이 기존 운영 예약 화면을 도구에 표시** |
| G/H Google·고객 JWT·owner 저장 | **NOT RUN** |
| 회원 주문·MY ORDERS·타인404·Guest 분리/lookup | **NOT RUN** |
| 실제 쿠폰·멱등성·legacy409·OAuth 복원·모바일/WebKit | **NOT RUN** |
| 자동 OFF 및 직접 GET 복원 검증 | PASS |
| 전체 `npm test` | **2,013 PASS / 0 FAIL / 기존 SKIP1**, 총2,014 |
| Node22.23.3 V3/Pages/watchdog 집중 검증 | 71 PASS / 0 FAIL / 0 SKIP |
| root ESLint / TypeScript / 변경 MJS 검사 | PASS |
| Git 대상1,896파일·보호값9종 credential 검사 | 검출0; 운영 화면 내용은 문서·파일에 재수록하지 않음 |
| 원본 journal SHA / V1·V2·V3 SHA / V3 false | 보존 확인 |

기존 skip은 AU dist에서의 `KR production dist does not publish AU Chocolate pages`다. AU build는 전체 suite에서 PASS, KR와 compiled Chromium/WebKit은 관련 product/overlay/dependency 변경이 없어 이전 증거를 재사용했다. 이번 사용자의 Chrome 파일 권한과 Google provider 검증은 그 증거로 대체하지 않는다. 기존 테스트 삭제·완화는 없다.

코드 커밋 `5cfe88f`: continuation state의 이전 SHA/자원 인계, 누적 실행 cap3+117, CLOSED7 전용 cap, 닫힌 probe와 OPEN 전 중단 시 불필요한 Pages 배포 방지. RED→GREEN 증거를 보존했다. 새 approval/continuation journal·private scripts·키·metadata는 Git 제외 `continuation-20261018/`에 남겼다. 제품 구현 source와 main/다른 worktree는 변경하지 않았다. 문서는 별도 커밋으로 구분한다.

## 중단·출시 제한

이번 단일 창은 조기 종료됐고 Pages7/7 예산도 소진했다. 남은 Function 수량114회는 새 창을 자동 허용하지 않는다. 다음 시험에는 브라우저 준비·범위 보호 검토와 **새 단일 창 및 필요한 OPEN/CLOSED 배포 예산의 별도 승인**이 필요하다. 합성 자원·기존 journal을 삭제하거나 다시 만들지 않는다.

**B5 — DEFERRED — RELEASE BLOCKER**. 공통 SMTP·OTP 수신자/남용 방지·Gallery 예외·system credential·운영 백업/재생성/복구·실제 OTP와 Google↔OTP 동일 UID는 모두 미완료다. native OTP OFF, Google+OTP 출시 미완료. B5/B8·운영 배포·main 병합 없이 여기서 중단한다.
