# B7 D1 health timeout — 읽기 전용 조사

2026-10-18 KST, 조사 시작 HEAD `53e1954`. **500을 만든 계층은 확인했다. 실제 Node runtime의 soft timeout이 원래 handler의 완료보다 먼저 끝났다. 그러나 settings1회와 metadata7회 중 어느 DB 호출이 기다렸는지는 UNVERIFIED다.** 새 Function execution/deployment·인증 창·Pages·원격 설정 변경은0이다. 이번 결과로 Google 주문 시험 준비 완료를 선언하지 않는다.

## 기존 execution과 실제 runtime

공식 Owner GET으로 D1 execution `6ad477ee72988db3dfb8`를 다시 읽었다. deployment `6ad477e22a983cbda34c`, status failed, HTTP500, duration **19.739536초**, body0bytes, 오류21bytes다. 고정 timeout 오류와 일치하고 guard PASS/accepted=true 및 플랫폼 계약 성공 로그2건만 있다. 원래 handler의 completed/failed 로그와 DB 단계 로그는 없다. raw 오류·요청 path/body/header·credential은 재수록하지 않았다.

정확한 D1 컨테이너를 `docker inspect`하고 기존 server source 및 resolv.conf만 읽었다. `docker exec`·runtime process 시작·내부 execution endpoint 호출은 하지 않았다. 실제 server source SHA `d026c95e9a1070d4c32243c635b353915dc1a2c73f44809a9b994101c8c24fd5`가 다운로드한 [공식 Node server](https://github.com/open-runtimes/open-runtimes/blob/main/runtimes/node/versions/latest/src/server.js)와 같았다.

해당 server는 사용자 함수와 timer를 `Promise.race()`로 기다리고 timer가 먼저 끝나면 고정 timeout 오류를 기록한 뒤 빈500을 반환한다. [Executor0.7.22](https://github.com/open-runtimes/executor/blob/0.7.22/src/Executor/Runner/Docker.php)는 Function timeout에서 준비/cold-start 시간을 차감하고 정수 timeout header를 runtime에 전달한다. 그러므로 관리 설정20초와19.74초 결과는 모순되지 않는다. 정확한 당시 timeout header 값은 저장되지 않아 추정하지 않는다.

이 race는 SDK HTTP 요청에 AbortSignal을 전달하지 않는다. **500 응답을 함수 내부의 모든 비동기 작업 취소·컨테이너 종료와 동일시하면 안 된다.** D1 health는 읽기만 수행하며 추가 호출로 이 현상을 재현하지 않았다.

## settings1 + metadata7의 대기 경계

원래 `appwrite-functions/reservation-api/src/reservation-health.js`를 그대로 분석·로컬 실행했다.

| 순서/고정 진단 단계 | 원래 SDK 호출 | 대기 의미 |
| --- | --- | --- |
| `RES_SETTINGS` | settings `listDocuments`, limit1/totalfalse | 먼저 await. 끝나기 전 아래7개는 시작하지 않음 |
| `RES_REVIEW_COLLECTION` | review_coupons `getCollection` | 아래7개는 하나의 Promise.all에서 시작 |
| `RES_REVIEW_ATTRIBUTES` | review_coupons `listAttributes`, limit100 | 하나라도 pending이면 join이 끝나지 않음 |
| `RES_REVIEW_INDEXES` | review_coupons `listIndexes`, limit100 | 동일 |
| `RES_MANUAL_COLLECTION` | manual_coupons `getCollection` | 동일 |
| `RES_MANUAL_ATTRIBUTES` | manual_coupons `listAttributes`, limit100 | 동일 |
| `RES_MANUAL_INDEXES` | manual_coupons `listIndexes`, limit100 | 동일 |
| `RES_RESERVATION_ATTRIBUTES` | reservations `listAttributes`, limit100 | 동일 |

경로는 `settings 완료 시간 + 병렬7개의 최장 완료 시간 + 로컬 schema 검증`이다. 전체8개를 순차 합산하는 모델은 틀리다. 빠른 SDK 오류는 reject→기존 health의 generic503/error 로그로 이어지지만, D1은 runtime timeout만 남아 **첫 settings 대기와 병렬 join 대기를 구분할 수 없다.** ACL/schema 불일치로 확정하거나 일곱 metadata 조회 중 특정 하나를 지목할 근거는 없다.

## endpoint·DNS·TLS·SDK 계약

- `resolveReservationAppwriteEndpoint()`는 유효한 `APPWRITE_INTERNAL_API_ENDPOINT`가 있으면 한 번 선택하고, 없으면 `APPWRITE_FUNCTION_API_ENDPOINT`를 사용한다. 네트워크 실패 후 자동 endpoint 전환/쓰기 재시도는 없다.
- [Appwrite1.8.1 실행 source](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Executions/Create.php)는 force-HTTPS/domain으로 기본 endpoint를 주입한다. 실제 D1 컨테이너는 **내부 override 없음 / 공개 `https://api.verygood-chocolate.com/v1` 선택 / runtimes bridge만 연결**이었다. raw env 대신 일치 boolean/분류만 기록했다.
- 현재 Function 변수30개와 [공식 GET `/project/variables`](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/project.php)의 project 변수0개에도 endpoint override는 없다. 최초 잘못된 `/variables` 조회404 기록을 보존한 뒤 공식 경로로 확인했으며 쓰기/권한 우회는 없었다.
- 기존 내부 프록시는 appwrite/runtimes 두 bridge에서 running이다. 이 존재만으로 테스트 Function이 프록시를 사용한다고 판단하지 않는다. 기존 proxy/운영 Function 설정은 변경하지 않았다. endpoint 선택을 오류로 단정하지도 않는다. B6도 기본 경로로 성공한 기록이 있다.
- D1 resolv.conf는 Docker embedded DNS를 사용했다. 서버 host에서는 공개 hostname의 A2/AAAA2가 조회됐고, 별도 host-only TLS 인증서 검증/TLS1.3 연결이426ms에 성공했다. **이는 host의 현재 연결 근거이며 당시 D1 container의 DNS/TCP/TLS/API 응답 시간을 증명하지 않는다.** runtime 내부 DNS·연결·TLS·HTTP headers/body 중 정확한 대기 구간은 UNVERIFIED다.
- 설치된 [node-appwrite22.1.3 Client](https://github.com/appwrite/sdk-for-node/blob/22.1.3/src/client.ts)는 `prepareRequest()` 후 fetch와 response body를 await하며 명시적 전체 deadline/AbortSignal/`setTimeout()` API가 없다. TLS는 기본 검증한다. 설치된 fetch-agent1.7.2도 Client가 설정한20초 전체 deadline을 만들지 않는다. SDK `prepareRequest()`가 매번 agent를 만들지만 이것이 D1 원인이라는 증거는 없다.
- 관리 runner의30초 AbortSignal·Function20초·UI10초는 서로 다른 경계다. Owner 요청의 timeout 설정을 Function 내부 SDK timeout으로 해석하지 않는다. TLS 검증 해제·CA/endpoint 변경·timeout 상향은 실행하지 않았다.

## B6 / D1 대조

| 항목 | B6 | D1 |
| --- | --- | --- |
| deployment | `6ad41e576cb7a8f346af` | `6ad477e22a983cbda34c` |
| 일반 health | 보존된 smoke 응답200/ready, execution `6ad41e653a0004196b87` duration2.671643초 | guard 통과 후 timeout500/19.739536초 |
| runtime/실제 build Node | node-22 /22.23.2 | node-22 /22.23.2 |
| scope·사양·timeout | 기존7 scopes /s-1vcpu-1gb/20초 | 동일 |
| 원래 main/endpoint/일반 health/회원 readiness source | archive 기준 | **4개 모두 byte-identical** |
| package.json / lockfile | node-appwrite22.1.3, sharp0.35.5 | **모두 byte-identical** |
| 차이 | 원래 entrypoint·customer OFF | test-only guard entrypoint, 새 고정 window/key·Customer/writes true·preorders false |

B6 과거 컨테이너의 env snapshot은 없어 당시 전체 env 동등성은 미확인이다. B6 생성 입력/변수 계약과 source에는 internal override가 없으며 D1에서는 실제 env 선택을 관찰했다. 일반 health action에는 Customer flag에 따라 추가 readiness를 호출하는 분기가 없다. **코드/SDK/scope/runtime 변경으로 인한 회귀나 확정된 endpoint 오설정이라고 보고하지 않는다.** 공개 경로의 일시 지연 또는 metadata/backend 대기는 후보지만 정확한 원인은 UNVERIFIED다.

## 회원 readiness / MY ORDERS의 시간 예산

현재 test DB2·Collection12, Custom 미활성 구성을 원본 코드로 세었다. 과거 Google/Owner 실행이 실제 모든 회원 경로의20초 성능을 증명한 것은 아니다.

| 경로 | 서버 API 왕복 수·순서 |
| --- | --- |
| customer-account-health ON | DB 목록1 + Collection 목록2 + private ACL9 + public read-only ACL3 + owner attribute1 + index1 = **17회 순차** |
| MY ORDERS 첫 목록/상세, 원래 handler | readiness17 → JWT Account.get1 → 소유권 제한 데이터 조회1 = **19회** |
| 목록 cursor 있음 | 위19 + cursor 소유권 getDocument1 = **20회** |
| B7 guard 안의 실제 회원 목록/상세 | guard의 별도 JWT Account.get1 추가: **20회**, cursor는 **21회** |
| customer-account-health OFF | DB 호출0, enabled=false/ready=false |

기존 B7 customer-health execution `6ad4636347f1791a450a`의 보존된 실제 응답은 enabled=true/ready=true,200, **17.459621초**였다.20초까지 산술 여유2.54초지만 추가 JWT/조회와 cold start·네트워크 변동을 포함한 성능 보장은 아니다. 로컬의17×1,200ms=20,400ms 계산은 **가상 latency 모델**이며 서버 측정치가 아니다.

더 좁은 제품 경계도 있다. `src/CustomerAccountProvider.tsx`는 `health()`를 **10,000ms**만 기다리고 늦으면 unavailable로 처리한다. 그 뒤 `auth.restore()`도 별도로 제한한다. 따라서17.46초의 backend ready조차 실제 제품 로그인 진입의 성공 근거가 될 수 없다. refresh/focus/pageshow마다 readiness를 다시 수행하고 각 주문 API도 원래 readiness를 반복한다. 이번에는 제한시간·캐싱·ACL/JWT/소유권/readiness를 바꾸지 않았다. **실제 제품 로그인 준비는 여전히 미완료다.**

## 로컬 진단 준비·다음 최소 승인안

Git 제외 조사 폴더의 원본 호출 구조 probe **10 PASS**, 기존 reservation coupon/readiness/customer-orders/internal-endpoint/guard 회귀 **88 PASS**, fail/skip0. settings 선행·7개 동시 시작·각 pending의 join 차단·settings 오류 전파·회원17개 순차·회원조회19/20개·ACL 실패 시 JWT/조회 차단·SDK deadline 부재를 확인했다. 실제 provider 성능으로 표시하지 않는다. 제품/guard/runner source 변경0이며 전체 suite/build/browser 자동화는 반복하지 않았다. Git 후보와 조사 자료1,929파일·보호값5개 검사에서 검출0, V1/V2/V3 manifest·이전 journal·D1 archive 불변을 확인했다.

[단계별 계측·최소 재검증 제안](superpowers/plans/2026-10-18-customer-account-b7-health-timing-diagnostic.md)을 작성했다. **아직 구현/배포/실행 승인이 아니다.** test-only archive에서 각 원래 SDK 호출의 고정 단계명과 start/end/error·경과 시간만 기록하면 settings 대기와 병렬 pending을 구분할 수 있다. 새로운 env 변수·scope·endpoint 변경은 필요하지 않다.

최소 추가 자원은 **진단 deployment1개 + Owner health1회**다. 회원 readiness도 같은 archive에서 실제 측정하려면 첫 health 성공 시에만 별도 승인된 추가1회, 총 최대2회다. Google·MY ORDERS 실인수는 포함하지 않는다. 기존 누적8/120·Pages7/9와 V3 SHA/이전 journal을 보존하며 새 승인 증거·새 key/최대300초 고정 window를 **배포 전에 동결**해야 한다. 실패 즉시 종료·OFF/B6/CLOSED 복구, 자동 재시도/연장 없음이다.

공식 Owner 읽기로 Account OFF403/Function disabled·execute=[]/flagsfalse/B6 active/CLOSED 및 운영4개 현재 Auth/SMTP/OAuth/service 지문·Function6개 상태 불변을 재확인했다. 누적 실행8/120·Pages7/9 그대로. 새 배포/Function execution/인증 창/사용자/주문/쿠폰/권한/SMTP 변경0. 보호 자료와 이전 evidence를 보존하고 여기서 중단한다.

**B5 — DEFERRED — RELEASE BLOCKER**, native OTP OFF, 실제 OTP/Google↔OTP UID NOT RUN, 과거 AU raw 차이 UNVERIFIED. 운영 환경·main은 변경하지 않았다.
