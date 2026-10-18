# B7 health403 — 환경변수와 기존 runtime 재사용 조사

2026-10-18 KST. **기존 절차의 결함은 확인했다: 변수 API 갱신·기존 deployment 재활성화를 runtime 설정 갱신으로 취급했다. Appwrite의 재배포 계약과 맞지 않는다.** 실패 원인으로는 **이전 window/key를 가진 warm runtime 재사용**이 가장 유력하다. 다만 당시 runtime 환경은 이미 제거돼 직접 대조할 수 없고 guard의 세부 로그도 없어 **실제 최초 거부 predicate는 UNVERIFIED**다. 저장 metadata의 HMAC 성공을 runtime 내부 환경 일치로 보지 않는다.

이번에는 공식 문서/버전 고정 소스·기존 evidence·Owner GET·서버 metadata/비민감 로그만 조사했다. Appwrite execution/재배포/새 창/Pages/주문/설정 쓰기0, 전체 suite 재실행0이다. 원본 guard에 대한 로컬7개 시나리오만 실행했다. CUA·자동 브라우저·운영 고객정보 접근도0이다.

## 1. 확인한 1.8.1 / Executor 동작

[공식 환경변수 문서](https://appwrite.io/docs/products/functions/environment-variables)는 변수 변경 후 재배포를 요구한다. 최신 문서만 적용한 결론을 피하기 위해 **Appwrite1.8.1 / Executor0.7.22 태그**의 소스도 확인했다. very-server의 설치된 다음4개 파일 SHA-256이 다운로드한 공식 소스와 모두 같았다. Appwrite tree SHA `bd288ce6507643eef4891bfdad27a60fcb8a09e2`, Executor tree SHA `8c19c56d4d1e0244f58cc6c574fd1e21694785ac`를 보호 evidence에 기록했다.

| 경계 | 소스에서 확인한 동작 |
| --- | --- |
| [Variables Update](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Variables/Update.php#L78-L105) | 변수 document 갱신과 Function live=false. 기존 execution runtime을 재생성/삭제하지 않음 |
| [Executions Create](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Executions/Create.php#L347-L428) | 최신 Function vars를 읽어 executor에 전달. 이 API 단계만으로 이미 실행 중인 process.env 갱신은 보장하지 않음 |
| [Executor Docker](https://github.com/open-runtimes/executor/blob/0.7.22/src/Executor/Runner/Docker.php#L731-L1015) | project+deployment로 runtime 식별. 없을 때만 변수로 컨테이너 생성. warm v5 호출은 path/method/headers/body를 전달하며 새 variables를 실행 중 process에 주입하지 않음 |
| [Deployment activation](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Functions/Deployment/Update.php#L78-L98) | active deployment 포인터 변경. rebuild나 기존 runtime 환경 재설정이 아님 |
| [Functions Update](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Functions/Update.php#L225-L257) | name/entrypoint/commands/root/runtime이 같으면 live=true를 다시 기록할 수 있음. spec이 바뀔 때만 별도 cold-start 삭제 경로. 변수 변경 후 일반 PUT이 live 경고를 덮을 수 있음 |

**live=false는 장식적인 배너가 아니며, live=true도 runtime 환경 일치 증거가 아니다.** 조사 시 현재 Function은 B6 active/live=true였다. 복구의 동일 설정 Function PUT으로 설명 가능한 값이며 재배포 성공으로 재분류하지 않는다. 실패 직전 live를 따로 기록하지 않아 그 순간의 정확한 값은 UNVERIFIED다.

기존 runner의 `configureGuard()`는 관리 API readback과 secret metadata만 확인했다. 그 뒤 동일 guarded deployment에서 실제 health가 성공할 때만 runtime 검증을 했고, 그 전에 환경 적용을 보장하는 재배포가 없었다. 이 검증 공백을 놓쳤다. 다음 시험에서는 `기존 deployment 재활성화 → 변수 PUT → health` 순서를 그대로 재사용하지 않는다.

## 2. 실제 시간 순서

아래는 **UTC**다. KST는9시간을 더한다. key 원문/지문·서명 경로·JWT·Cookie는 재수록하지 않는다.

| UTC | 확인된 사실 |
| --- | --- |
| 05:15:41~42 | 기존7 guard/renewal 변수 생성 |
| 05:16:19.642~05:16:29.612 | guarded `6ad456239aeb781a4f4d` 생성·ready. 이때 이후 시험 window들은 아직 설정되지 않음 |
| 05:24:59.634 | 첫 window 시작·관리 변수 설정, 같은 deployment 사용 |
| 05:25:11.398 | 첫 health200. 서명→metadata 생성3,648ms |
| **06:01:14.714** | 실제 Executor 로그에서 정확한 **테스트 execution runtime** 제거 확인(build runtime과 구분) |
| **06:12:39.673** | 마지막 성공 창 시작. 이전과 다른 key, end06:27:39.673, flags true/true/false 설정 |
| **06:12:50.900** | 같은 guarded deployment health200. 서명→생성4,031ms. 이후 renewal/customer health200 |
| 06:14:36.344까지 | 이전 창 조기 종료, 관리 flags OFF/key revoke/B6 복원. 이 조작은 warm process 환경의 즉시 교체를 보장하지 않음 |
| **06:55:51.130** | 실패한 수동 창 시작. 새 key, end07:10:51.130, 같은 deployment/변수 ID 사용 |
| 06:55:52.320 /52.763 | 관리 API의 startsAt/endsAt 마지막 변경 시각 확인. key/flags ON은 이후 worker 시작 전 완료되나 개별 PUT 원시 응답 시각은 보존되지 않음 |
| **06:55:58.591** | health403. 서명→생성202ms, execution duration4.894ms, guard 성공 로그0 |
| 06:56:03.345 | watchdog 복구 verified=true, failedSteps=[] |
| **07:01:14.759** | Executor 로그에 같은 테스트 execution runtime 제거 기록 |
| 조사 시 | 해당 execution 컨테이너 없음. Docker event ring은256건만 남아 해당 과거 create/destroy event가 보존되지 않음 |

실서버 executor는 inactive threshold60초 / maintenance interval3,600초다. 유휴60초가 지나도 삭제 작업 자체는 시간당 실행된다. 실제 maintenance 로그가05:01/06:01/07:01에 있다. **06:12 성공 runtime이06:55에 재사용되고07:01에 제거된 설명과 일치한다.** 두 성공의 수초 지연과 실패의202ms 차이도 이 가설을 지지하지만, 지연만으로 cold/warm을 확정하지 않는다. 계측을 위해 maintenance 주기를 변경하거나 컨테이너를 재생성하지 않았다.

## 3. guard 단계별 판단

원본 archive의 `b7-guard.mjs`를 그대로 사용했다. 실패 당시 관리 API에 설정하려던 env+기존 실패 요청을 재구성하면 로컬200, 이전 성공 창의 env면403이다. 이는 조건별 재현이며 실제 provider 환경 관찰의 대체물이 아니다.

| 단계 | 이번 evidence로 가능한 판단 |
| --- | --- |
| CONFIG | 이전 false flag·잘못된 IDs/run/fixture도403 가능. 당시 runtime 값 직접 기록 없음: UNVERIFIED. 관리 API의 의도 값만 일치 확인 |
| TIME | **가장 강한 후보.** 이전 env라면 실패 시각에 window가28분18.918초 만료돼 secret/HMAC 읽기 전에403. 원본 guard 로컬 재현 확인 |
| SIGNATURE | 관리 key로 저장 path HMAC는 맞음. runtime key가 이전 값이면 새 window만 맞아도403을 재현. runtime key 일치는 UNVERIFIED |
| HEADERS | 필수 x-b7 header 누락/시간 형식/nonce/replay도403. Appwrite 저장 metadata는 custom header를 필터링하므로 runtime의 실제 header 존재를 증명하지 못함 |
| BODY | bodyText/bodyJson 불일치도403. 의도한 health의 hash와 저장 path는 일치하고 로컬 원본 재현은 통과. 실제 parser 값은 UNVERIFIED |
| PATH | 저장 requestPath와 HMAC는 일치. runtime 내부 req.path와 동일하다는 별도 성공 로그가 없어 최종 runtime 비교는 UNVERIFIED |
| 기타 | 전체 승인 execution은7건이어서 guard120 제한은 설명이 되지 않음. health는 고객 UID/JWT 검증 분기를 통과하지 않으므로 고객 JWT 실패를 이 Owner health 원인으로 보지 않음 |

403은 Appwrite Console Owner/execute ACL의 플랫폼 거부가 아니다. API가 execution을 만들었고 B7 handler가 고유 코드로 응답했다. native module·빌드 실패500도 아니다. 추가 사용자/상품/쿠폰/가격/주문 소유권 로직을 고칠 근거가 없다.

로컬7개(현재 env 정상200, stale window403, false flag403, old key403, missing header403, body mismatch403, path mismatch403)가 기대대로 동작했다. 실제 기존 env였다는 증거로 이 로컬 결과를 격상하지 않는다.

## 4. 판정과 다음 승인 대상

- **CONFIRMED:** 재배포 없는 환경 변경/동일 runtime 재사용을 안전하게 보장할 수 없는 기존 실행 절차, live 값만으로 판정할 수 없는 점.
- **STRONGLY SUPPORTED / 실제 predicate UNVERIFIED:** 06:12의 warm env가06:55에도 남아 이전 window TIME 검사에서 거부됐다는 가설. 이전 key SIGNATURE 또는 다른 runtime input을 직접 배제할 기록은 없음.
- **NOT RUN:** 새 runtime/env 검증, 재배포, 실제 Google 인증·주문. 확정하려면 runtime 내부의 비민감 단계 진단과 설정 고정 후 새 deployment가 필요하다.

[제안된 최소 검증·복구 계획](superpowers/plans/2026-10-18-customer-account-b7-runtime-env-verification.md)은 **닫힌 진단 deployment1개 + Owner health 최대3회**를 다음 별도 승인 대상으로 제시한다. Google15분 창·Pages·주문은 포함하지 않는다. 이 진단을 별도로 끝낸 뒤 새 key/window로 Google 시험을 하면 새 deployment1개가 추가로 필요하다. 같은 진단 deployment에서 변수만 바꿔 후속 창을 열지 않는다.

현재 Account OFF403 / disabled·execute=[] / 명시적 관리 flagsfalse / B6 active / 사이트 CLOSED를 확인했다. 관리 flags/key의 OFF와 cached runtime 메모리의 갱신은 구분하며 실제 차단은 Account/Function·B6 포인터와 고정 runtime deadline으로 보장한다. 실행 누적7/120·Pages7/9 유지, 이번 새 실행0이다. Git에는 조사/제안 문서만 추가하고 기존 증거는 보호 폴더에 보존한다.

**B5 — DEFERRED — RELEASE BLOCKER**, 과거 AU raw 차이 **UNVERIFIED**. 운영/main/SMTP/OTP/DB/ACL은 변경하지 않았다.
