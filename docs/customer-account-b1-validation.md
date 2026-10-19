# Customer Account B안 B1 실행 결과

2026-10-17 KST. 사용자 승인 범위는 **빈 테스트 프로젝트 1개 생성 및 Account 서비스 초기 차단**뿐이다. [B안 계획](superpowers/plans/2026-10-17-customer-account-very-server-test.md)의 B1을 완료했으며 B2–B8은 실행하지 않았다. 시작 Git HEAD는 `df0f1d427ecaac721bc43f1f028fb5bd438bc96b`, branch `feat/customer-account`, 승인 worktree는 `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`다. 시작 상태는 clean이었다.

## 생성 결과와 승인된 관리 경로

| 항목 | 결과 |
| --- | --- |
| Name | `VERYGOOD AU Customer Account TEST` |
| Project ID | **`verygood-au-account-test`** |
| Instance | 기존 `https://api.verygood-chocolate.com/v1`, Appwrite 1.8.1 |
| Console | [테스트 프로젝트 Settings](https://api.verygood-chocolate.com/console/project-default-verygood-au-account-test/settings) |
| 관리 권한 | 현재 로그인된 Console 계정과 기존 Personal projects 조직의 유일한 Owner 멤버가 일치함을 UI에서 확인. 계정·조직·멤버 role 변경 없음 |
| 실제 변경 경로 | 정식 Console의 Create project → 지정 name/ID → 해당 프로젝트 Settings → Services → Account OFF |
| Account 상태 | **`services.account=false`**. 저장 완료 toast 및 새로고침 후 OFF 확인 |
| Client API 차단 | API key/cookie 없는 **테스트 project** `GET /v1/account` → **HTTP 403 / `general_service_disabled`** |

프로젝트 생성 직후 다른 설정/리소스를 추가하지 않고 Account부터 차단했다. DB의 프로젝트 생성/갱신 시각은 같은 기준으로 `12:05:05.516` → `12:05:18.901`이며 약 **13.4초** 간격이다(실행 시각 KST 21:05). 생성 전 후보 ID 부재와 기존 project 4개를 확인했고, 완료 후 5개 중 신규 ID는 정확히 하나였다.

SQL은 **읽기 전용 metadata SELECT**에만 사용했다. 생성/차단을 SQL 쓰기, 운영 API key 권한 확대, 임시 API key 발급 또는 별도 관리자 인증 우회로 수행하지 않았다. Console의 기존 owner session만 사용했다.

Account 서비스 OFF는 client Account API 차단이다. Console 관리 접근은 유지된다. 다른 서비스와 개별 Auth method의 Appwrite 기본값은 이번 승인 범위에서 변경하지 않았다. Google/OTP 실제 인증 시험이나 Auth 활성화는 수행하지 않았다.

## 신규 프로젝트 자원

| 사용자 생성 자원 | 수량 / 상태 |
| --- | --- |
| DB / Collection | **0 / 0** |
| Bucket / Function | **0 / 0** |
| API key / Web platform | **0 / 0** |
| 프로젝트 전역 변수 | **0** |
| Auth users | Console에서 `Create your first user` 빈 상태 확인. 사용자 생성 없음 |
| OAuth providers | 신규 project Console에서 Google 포함 모든 provider **disabled** 확인. 설정/secret 추가 없음 |
| 프로젝트 SMTP | 신규 project Console에서 Custom SMTP server **OFF**, Update disabled 확인. 저장/발송 없음 |

Appwrite가 프로젝트 생성에 따라 내부 namespace `_5`와 관리용 테이블 60개를 자동 초기화했다. 이것은 Appwrite 자체 Auth/audit/metadata 구조이며 사용자 DB/Collection 60개를 만든 것이 아니다. 운영 데이터 export/import·복사, schema setup/migration, Function 배포는 수행하지 않았다.

## 기존 프로젝트 4개 비교

21:04:53(변경 전), 21:05:53(직후), 21:09:18(최종 확인) snapshot을 보존했다. 기존 각 project의 설정, DB 정의, collection schema/ACL, Function 설정, active deployment, bucket 설정, 변수, API key metadata, platform의 **9개 범주 지문**을 비교해 **4 × 9 모두 동일**함을 확인했다. accessedAt·조회/실행 통계 등 가변 운영 지표는 비교 대상에서 제외했다. 운영 고객 users/sessions·주문 document·업로드·메일/queue 본문·execution log는 읽지 않았다.

| 기존 project | DB / Collection | Bucket / Function | Key / Platform | 구성·ACL·배포 비교 |
| --- | --- | --- | --- | --- |
| `verygood-main` | 5 / 10 | 2 / 2 | 2 / 8 | 동일 |
| 기타 project 2 | 1 / 4 | 1 / 0 | 0 / 2 | 동일 |
| 기타 project 3 | 1 / 2 | 1 / 0 | 1 / 5 | 동일 |
| `verygood-au` | 2 / 22 | 2 / 4 | 3 / 7 | 동일 |

프로젝트 설정의 before/after SHA-256은 각각 아래와 같고 두 시점에 동일하다. 세부 범주별 digest·배포 ID·변수 값의 digest는 ignored evidence에 보존하며 비밀값 원문을 외부 출력하지 않았다.

| 기존 project | 동일한 project configuration SHA-256 |
| --- | --- |
| `verygood-main` | `0050960b491b4840bc9394db62b9d20f56c05311ed62b655b240bd18d97d2430` |
| 기타 project 2 | `ec7dec4ca8f4bf12b1dce322df97fdb9934d31451724f378834bb29dad95bde3` |
| 기타 project 3 | `65a1bb9ad8a230233217b7538a5b8514665f59370c4484aabec55eafdf384a58` |
| `verygood-au` | `b0884256753dc0fb024bc729f9299d1ebbd220dc9ecc2dbd13eb750cb7ac927d` |

## 암호화된 설정에 관한 기존 조사 정정

SMTP와 OAuth 설정은 DB에 `data/method/iv/tag/version` 암호화 envelope로 저장되어 있다. 직접 SQL JSON 조회의 `enabled=null`, `googleEnabled=null`이나 envelope 존재 여부로 **활성/미설정 상태를 판정할 수 없다**. 이전 조사 문서와 B안 계획에서 그 결과를 “기존 프로젝트 SMTP override/Google 미설정”으로 해석한 부분을 정정했다. 이 조사에서는 기존 설정을 복호화하거나 수정하지 않았다.

초기 비교 스크립트도 envelope 존재를 provider 설정 존재로 해석해 한 assertion이 실패했다. 저장 형식을 확인한 뒤 그 추론을 제거하고, **신규 project의 실제 상태는 정식 Console에서 읽기 전용으로 확인**했다. 이후 metadata/차단 비교 6개 그룹은 모두 통과했다. 이 실패는 Account 차단 실패나 운영 변경이 아니다.

공통 `_APP_SMTP_HOST`가 비어 있다는 container 관측과 1.8.1 OTP의 공통 host gate 분석은 그대로 유효하다. 기존 프로젝트의 실제 SMTP override/provider 활성 상태는 이후 승인된 Console/API metadata 조회로 확인해야 한다. 기존 네 프로젝트의 encrypted configuration 지문은 이번 전후에 동일했다.

## 서버 자원과 서비스 상태

| 항목 | 21:04:53 변경 전 | 21:09:18 최종 확인 |
| --- | --- | --- |
| CPU | 4 CPU | 동일 |
| load 1/5/15분 | 0.10 / 0.25 / 0.25 | 0.33 / 0.32 / 0.28 |
| available RAM | 8215.78MiB | 8142.84MiB |
| available disk | 83.2234GiB | 83.1512GiB |

이 기간 host 전체 available RAM은 약 72.94MiB, disk는 약 73.93MiB 감소했다. 공유 서버의 cache·로그·다른 서비스 활동이 포함되므로 신규 프로젝트만의 사용량으로 귀속하지 않는다. swap 사용은 약 1.73GiB로 유지됐다. 자원 중단 기준에 도달하지 않았다.

API, mail worker, MariaDB, Redis, executor **5개 core container의 ID·image ID·startedAt·환경변수 지문이 모두 동일**했다. 서비스 재시작·재생성·SMTP 변경·runtime 변경을 하지 않았다. 새 상시 container도 만들지 않았다.

## 검증 증거·Git·중단 지점

로컬 ignored evidence: `.superpowers/sdd/2026-10-17-customer-account-very-server-test/`.

- `b1-before.json`, `b1-after.json`, `b1-after-final.json`: 비민감 구성 지문·자원 snapshot. 암호화 상태의 해석은 위 정정사항을 따른다.
- `b1-comparison.json`, `b1-verify.py`: 4개 기존 project 불변·신규 1개·resource 0·core container 불변·403 차단의 **6개 검증 그룹 PASS**.
- `b1-account-disabled.json`: 테스트 project만 대상으로 한 Account GET의 403 응답.
- `b1-console-account-off.jpg`: 프로젝트 이름과 Account OFF를 함께 보여 주는 Console 화면.

Git 변경은 이 결과 문서와 관련 계획·조사·rollout 문서 보완뿐이다. 제품 코드·dependency·배포 script·환경파일은 바꾸지 않았으므로 전체 제품 테스트/빌드는 재실행하지 않았다. main/origin main은 `34ba1072f475ba8458b25a8ffd7a9e5467293dbe`로 유지한다. 결과 문서 커밋 SHA와 clean 상태는 최종 보고에서 확인한다.

**B1 완료 후 중단한다.** 테스트 프로젝트를 삭제하지 않았고, B2 helper·key 발급·DB/schema/fixture·migration은 실행하지 않았다. B2에는 로컬 target/seed helper 작성, test 전용 key의 scope/만료, 생성할 DB/collection/ACL/합성 fixture 목록 및 migration dry-run/apply 범위를 명시한 별도 승인이 필요하다. Account ON·Google/SMTP·Function·운영 재시작 승인은 B2에 자동 포함되지 않는다.
