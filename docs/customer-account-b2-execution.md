# Customer Account B2 최초 생성 시도 — 역사적 중단 기록

> **후속 실행에서 B2 완료:** 사용자가 공식 Owner API/CLI 경로를 승인한 뒤 [최종 B2 결과](customer-account-b2-owner-execution.md)대로 실행·검증했다. 아래 생성 0/미완료 표시는 최초 Console UI 시도 당시 기록이다.

2026-10-17 KST. 사용자에게 test M/Key 3개/DB 2개/Collection 12개/baseline181 attributes·37 indexes/settings1건 및 조건부 owner migration1+1 생성 승인을 받았다. **B2는 완료하지 못했다. 실제 자원 생성 전에 Console의 승인 scope 선택 불가를 확인하여 중단했다.** B3 진행 승인은 요청할 단계가 아니다.

작업은 Mac Codex 단독, `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`, `feat/customer-account`에서 수행했다. 시작 HEAD는 `36985b4238cabfde714016af56f49f6576eca7e5`이며 clean이었다. main/origin main은 `34ba107`을 유지한다.

## 실행 직전 확인

- [승인 manifest](customer-account-b2-resource-manifest.json)의 SHA-256은 실행 전·후 모두 **`75e18834d1020a0279946169ddc3e9c9d1e58684c76104a6738d92c559f8ef94`**로 일치했다. manifest/승인 scope/ACL/자원 수를 변경하지 않았다.
- 공식 Console Settings에서 endpoint `https://api.verygood-chocolate.com/v1`, project ID `verygood-au-account-test`, Account OFF를 확인했다.
- 기존 조직 Members의 유일한 Owner와 현재 세션의 Console 계정이 일치함을 UI에서 비교했다. 계정/role/권한 변경 또는 새 관리자 세션 생성은 하지 않았다.
- 시작 metadata에서 test DB/Collection/Key/Function/Bucket/platform/변수는 모두 0개였다. 기존 운영 4개 프로젝트의 구성 metadata 지문과 자원 수를 읽기 전용으로 기록했다. 고객 users/orders/documents는 읽지 않았다.
- 기존 guard/seed 12개를 다시 통과시켰다. 운영 project·혼합 DB/Function·unknown key·잘못된 header를 network 전에 거부한다.

## 생성 adapter: 로컬 RED → GREEN

추가 파일:

- `scripts/provision-customer-account-test-project.mjs`
- `tests/customer-account-test-provision.test.mjs`

adapter는 승인 raw manifest의 고정 SHA-256, exact target/resources 및 Key 3개의 provenance·scope·expiry를 검사한 뒤에만 실행할 수 있다. `.env` 자동 로딩이나 운영 key 참조는 없다. 승인 manifest로부터 만든 POST path+payload allowlist만 허용하고 update/delete/overwrite/실패한 POST retry는 없다. 실제 명령행 apply는 제공하지 않으며 기존 seed CLI는 offline-only를 유지한다.

DB/Collection → 각 Attribute 생성·정의 확인·available 대기 → 각 Index 생성·available 대기 → 합성 settings → 전체 schema/정확 ACL/inventory 확인 → 기존 migration의 GET-only dry-run 순서다. 독립 작업의 대량 병렬 생성도 하지 않는다. 각 생성 전 기존 자원 존재 여부를 확인하며, 예상 밖 자원·409·실패·30회 polling timeout은 정지한다.

owner apply는 dry-run의 누락 항목이 정확히 승인된 두 항목일 때만 가능하다. dry-run 이후 schema가 바뀌는 경합도 테스트했다. apply에서 owner Attribute를 이 실행이 직접 생성하지 않았다면 Index를 생성할 수 없고, 첫 owner 쓰기 전에 baseline 전체와 두 owner 자원 부재를 재검사한다. 기존 generic migration 모듈은 수정하지 않았다.

RAM <3GiB, disk <30GiB, API health 실패, baseline 이후 OOM 증가, load1≥4가 5분 지속되면 다음 쓰기를 차단하는 budget gate가 있다. 실제 실행은 readonly 서버/API probe 연결을 필수로 요구한다. 이번에는 Key 발급 전 멈췄으므로 실제 생성 runner·생성 중 monitor는 실행하지 않았다. GET-only migration도 로컬 emulator에서만 검증했다.

서버 integer schema의 int64 기본 경계는 Node22/24 JSON reviver source로 정밀하게 파싱한다. 실제 데이터 값을 안전하지 않은 Number로 반올림해서 schema drift를 허용하지 않는다. 기존 schema·ACL validator를 재사용하고 실제 서버 schema가 다르면 중단한다.

8개 신규 테스트는 잘못된 manifest/target/key에서 probe/network 0, 순차 생성과 available barrier, 기존 자원의 0 writes, owner opt-in, dry-run 누락 차이, schema 경합, unsafe ACL/실패/timeout의 중단, 자원 중단 기준을 검증한다. HTTP 경계만 emulator로 대체하며 실제 guard·migration·정의 검증 코드를 사용한다. 성공 emulator의 POST 235회는 **로컬 가상 호출**이며 실제 서버 생성 수가 아니다.

## 원격 생성 중단 사유

기존 Appwrite API는 1.8.1, Console 이미지는 앞선 조사에서 7.5.7로 확인했다. 실제 test project의 Create API key 폼에서 Database와 Other 그룹을 열고 접근성 트리·DOM snapshot·화면을 확인했다. 다음 차이가 있었다.

| 승인된 scope | Console에서 선택할 수 있는 항목 |
| --- | --- |
| `collections.read/write` | `tables.read/write` |
| `attributes.read/write` | `columns.read/write` |
| `documents.read/write` | `rows.read/write` |
| `databases.read/write`, `indexes.read/write` | 동일 이름으로 표시됨 |

**승인된 legacy scope의 checkbox 또는 custom scope 입력 항목을 확인할 수 없었다.** 이름을 바꿔 발급하거나 scope를 추가하지 않았다. Key 생성 버튼은 누르지 않고 Cancel → Exit로 빈 폼을 종료했다. Key/secret은 발급·추출·저장하지 않았다.

사전 B2 계획에서 서버의 scope 정의는 확인했으나, 실제 Console에서 legacy scope를 선택할 수 있는지까지 확인하지 못했다. 이번 생성 직전 점검에서 이 차이가 드러났다.

또한 실행 중인 Appwrite 컨테이너의 공식 route 구현을 읽기 전용으로 확인했다.

- `.../Http/Databases/Collections/Get.php`: `/v1/databases/:databaseId/collections/:collectionId`, scope `collections.read`.
- `.../Http/Databases/Collections/Documents/Create.php`: `/documents`, scope `documents.write`.
- `.../Http/Databases/Collections/Indexes/Create.php`: `/indexes`, scope `collections.write`.

따라서 UI의 새 scope를 동일 권한·동일 API 동작이라고 단정해서 대체할 근거가 없다. 일부 TablesDB 읽기 route에 두 scope가 함께 선언돼 있어도 모든 legacy 쓰기 route의 대체 가능성을 입증하지 않는다. 최소 scope를 임의 확대하거나 legacy API를 TablesDB로 전환하지 않았다. [공식 1.8.1 Index route](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Databases/Http/Databases/Collections/Indexes/Create.php)도 별도 API 계약임을 확인하는 근거다.

Console session cookie·브라우저 내부 state를 꺼내 비공식 API 요청을 만들거나 SQL 쓰기로 Key를 넣지 않았다. 운영 API key도 사용하지 않았다. 별도 Appwrite Owner connector는 현재 도구 목록에 없다. 현재 승인된 **기존 Console UI 경로**로 정확한 scope를 발급할 수 없는 상태에서 더 진행하지 않았다.

## 실제 자원 수와 미실행 항목

| 대상 | 이번 실제 생성 | 현재 상태 |
| --- | ---: | --- |
| 관리자 M | 0 | test Auth `Create your first user` 확인 |
| metadata/bootstrap/fixtures Key | 0 | `Create your first API key`, scope/expiry 실제 적용 미검증 |
| DB / Collection | 0 / 0 | 빈 프로젝트 유지 |
| 기본 Attribute / Index | 0 / 0 | available 검증 미실행 |
| 합성 settings | 0 | 미생성 |
| owner Attribute / Index | 0 / 0 | dry-run 미실행, apply 미실행 |
| Function/Bucket/platform/변수/provider | 0 | 미생성/미설정 |

전체 ACL의 **실제 생성 후 검증은 미실행**이다. 12개 ACL 정의와 실패 차단 동작만 로컬 emulator에서 검증했다. Google/SMTP/메일/Account ON/Function 배포/재시작/production/main 병합은 실행하지 않았다. M을 먼저 만들어 불필요한 부분 상태를 남기지도 않았다. 자동 삭제·복구·롤백도 수행하지 않았다.

테스트 project를 지정한 비인증 GET `/health/version`은 **HTTP200 / 1.8.1**, GET `/account`는 **HTTP403 / general_service_disabled**였다. Account 서비스는 계속 OFF다. 이 검증은 실제 고객 로그인 또는 full DB health 검증이 아니다.

## 기존 프로젝트 불변 및 서버 자원

읽기 전용 snapshot 시간은 22:21:26 → 22:30:34 KST다. 기존 4개 project별 **9범주**(projectConfig/databases/schemaAcl/functions/activeDeployments/buckets/variables/keysMetadata/platforms)의 지문·자원 수·배포 metadata가 모두 동일했다. test project도 전 범주 동일, 사용자 자원 수 0, Account OFF였다. 주요 5개 컨테이너의 ID/image/start time/env 지문도 동일했다.

| 측정 | 전 | 후 |
| --- | ---: | ---: |
| 가용 RAM | 7.949GiB | 7.979GiB |
| 가용 disk | 83.184GiB | 83.184GiB |
| load 1/5/15분 | 0.58 / 0.40 / 0.31 | 0.38 / 0.32 / 0.29 |

공유 서버의 일반 변동이며, 이번에는 test 자원을 생성하지 않아 증분 자원 사용량이나 실제 생성 중 peak를 측정한 결과가 아니다. 중단 기준에 이른 관측은 없었다.

## 로컬 검증

| 검증 | pass | fail | skip |
| --- | ---: | ---: | ---: |
| 신규 provision adapter | 8 | 0 | 0 |
| guard/seed/provision 합계 | 20 | 0 | 0 |
| 계정 suite | 79 | 0 | 0 |
| 전체 `npm test` | 1,855 | 0 | 기존 market skip 1 |
| Node22.23.3 helper tests | 20 | 0 | 0 |

Node24.12.0 전체 테스트 총 1,856개/69 summary. 기존 skip은 `KR production dist does not publish AU Chocolate pages`다. TypeScript·root ESLint·신규 JS no-unused-vars·Node syntax 검증을 통과했다. 추가 JS lint에서 발견한 test-local unused binding 1건은 `void type`으로 정리한 후 재검증했다. 테스트 삭제·완화는 없다. AU/KR 독립 build와 고객 브라우저 flow는 이 helper 작업에서 별도로 재실행하지 않았다.

최초 provision RED 7개 → GREEN, 이후 dry-run/apply 경합 RED 1개 → GREEN을 기록했다. 로그·metadata 비교·scope 화면은 `.superpowers/sdd/2026-10-17-customer-account-very-server-test/`에 Git 제외로 보존한다. 단독 작업 조건에 따라 코드 최종 검토는 작성자가 수행했으며 별도 reviewer에게 위임하지 않았다.

## Git

- `96e56c4`: create-only provision adapter와 RED→GREEN 테스트.
- 결과 문서·B안 상태 갱신은 별도 후속 문서 커밋으로 구분한다.
- 승인 worktree/branch만 수정했고 manifest/package/lock/제품 코드/Function 코드는 변경하지 않았다. 최종 tracked status를 clean으로 확인한다.

## 재개 조건

승인된 manifest/legacy scope/만료 정책은 그대로 유지한다. 기존 Owner 권한으로 정확한 legacy scope를 발급할 수 있는 **공식 관리 경로를 확보하는 것**이 우선이다. 새로운 CLI Owner 인증/세션 등 현재 Console 세션 이외의 관리 접근을 사용하려면 먼저 사용자에게 그 경로를 설명하고 승인을 받는다. Console 교체/업그레이드·운영 서비스 재시작·다른 scope 발급은 이 실행에서 수행하지 않는다.

새 scope로 바꾸는 대안을 원하면 legacy API와의 호환성·권한 범위부터 별도 검토하고 scope/adapter 변경 승인을 받아야 한다. 현재 scope alias 동등성을 입증한 것으로 보고하거나 guard를 느슨하게 만들어 진행하지 않는다.

경로 문제가 해결되면 기존 B2 승인 범위 안에서 manifest/빈 inventory/Owner/Account OFF/서버 자원을 다시 확인하고, read-only probe를 연결한 실행 runner 검증 → M/Key 발급 → 순차 baseline 생성 → exact GET dry-run → 조건부 owner apply → 실제 ACL/available/운영 불변 검증 순서로 재개한다. **현재는 B2 미완료 상태에서 중단하며 B3는 시작하지 않는다.**
