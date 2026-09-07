# 예약 quantity 스키마 원인 감사 및 제한적 마이그레이션

## 결론 — 운영 변경 없음

운영으로 구성된 AU Appwrite의 예약 `quantity` 단일 attribute를 GET하여 **max=5**를 확인했다. 최초 성공 조회, 로컬 CLI 기본 dry-run, 작업 종료 후 GET 모두 같은 상태다. 따라서 실제 첫 주문 행 수량이 5를 초과하는 주문은 이 저장 스키마와 충돌한다. 이 감사에서 예약 생성/Function execution/스키마 PATCH 등 운영 쓰기는 전혀 실행하지 않았다. 실제 주문 실패를 재현하기 위한 쓰기도 하지 않았다.

| 필드 | 최초 성공 GET | 종료 후 GET | 승인 후 목표 (아직 미적용) |
|---|---|---|---|
| key | quantity | quantity | quantity |
| type | integer | integer | integer |
| required | false | false | false |
| array | false | false | false |
| min | 1 | 1 | 1 |
| max | 5 | 5 | 2147483647 |
| default | null | null | null |
| status | available | available | available |
| error | 빈 문자열 | 빈 문자열 | 빈 문자열 |

`2147483647`은 보수적인 signed-32-bit 기술적 저장 상한이다. 무한대나 상품 정책이 아니다. 일반 케이크 비즈니스 최대 5개는 별도의 기존 상품/서버 검증에서 유지해야 한다. 스모어의 실제 첫 행 수량을 최상위 `quantity`에 저장하는 백엔드 변경은 담당 부모 작업 범위다. 가짜 `quantity=1`이나 다른 필드에만 실제 수량을 숨기는 우회는 이 마이그레이션에 없다.

## 자격증명/대상 확인 방법과 한계

- README의 Appwrite 설정은 `.env.local`을 명시한다. worktree에 해당 파일이 없고 현재 프로세스에 APPWRITE 환경변수도 없었다.
- worktree `.git` 메타데이터가 연결하는 원본 checkout `/home/john/workspace/au-cake`의 기존 `.env.local`만 메모리에서 읽었다. 셸 source, 환경변수 변경, env 복사, 키/원시 resource ID 출력은 하지 않았다.
- `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_CAKE_DATABASE_ID`, `APPWRITE_CAKE_RESERVATIONS_TABLE_ID`와 각각의 `VITE_*` 값이 모두 동일함을 비공개 값 비교로 확인했고 `VITE_MARKET=AU`, HTTPS도 확인했다.
- `src/lib/appwrite.ts`의 frontend 대상 선택과 `scripts/setup-appwrite.mjs`의 server 설정 선택이 위 변수에 대응한다. 정확히 해당 database/collection 아래 `/attributes/quantity`만 조회해 200을 받았다. 다른 attributes, collections, documents, Function runtime configuration은 조회하지 않았다. 따라서 이 증거는 기존 운영 설정 파일과 실제 대상 attribute의 일치이며, 별도로 현재 배포된 Function 환경 전체를 대조한 증거는 아니다.
- Python 기본 User-Agent 첫 조회는 403이었다. `Mozilla/5.0` User-Agent의 GET 재시도는 quantity 200이었다. 인증 키를 붙인 `/health/version`은 `general_unauthorized_scope` 401이었으나 **키와 project header 없이 같은 endpoint의 `/health/version` GET은 200, version=1.8.1**이었다. `/version` GET은 404였다. CLI는 검증된 public health/version 방식만 사용한다.

## max=null은 제거가 아니다: 실제 버전의 공식 구현

설치된 `node-appwrite`는 **22.1.3**이다. `node_modules/node-appwrite/dist/services/databases.mjs`의 `updateIntegerAttribute`는 `max !== undefined`이면 payload에 값을 넣으므로 JavaScript에서 `null`을 전달하면 wire payload에는 들어간다. 필수 default의 SDK 매개변수 이름은 `xdefault`이고 wire 이름은 `default`다. 그러나 SDK 직렬화 가능성과 서버 의미는 다르다.

공식 Appwrite **1.8.1** 소스:

- [Integer/Update.php](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Databases/Http/Databases/Collections/Attributes/Integer/Update.php): PATCH `/v1/databases/:databaseId/collections/:collectionId/attributes/integer/:key`, `collections.write` scope, nullable integer `max` 입력을 `updateAttribute`에 전달한다.
- [Attributes/Action.php L525–553](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Databases/Http/Databases/Collections/Attributes/Action.php#L525-L553): integer range 분기에서 `$max ??= $attribute->getAttribute('formatOptions')['max'];`. **null/생략은 기존 max 유지**다. 그 뒤 min/max를 `formatOptions`에 다시 기록한다.
- TablesDB integer update도 위 integer update를 상속하지만 이번 migration은 원래 Collections API 경로만 사용한다.

따라서 `max:null`로 기존 5를 제거할 수 있다는 계획은 잘못이다. 명시적인 넓은 정수 상한으로 바꿔야 한다. 이번 CLI는 전송 payload를 작게 명시하기 위해 native fetch를 사용한다. SDK 버전만으로 서버 지원을 추정하지 않는다.

## CLI 보장

- 기본은 **네트워크 GET-only dry-run**이다(기존 setup의 offline dry-run과 다름).
- 명시적 `--apply`만 쓰기를 허용한다. 알 수 없는/중복/충돌 flag는 거절한다.
- env 파일은 `--env-file`로 명시해야 읽는다. 파일을 지정하면 그 파일만 사용하며 process.env와 합치지 않는다. 미지정 시 기존 프로세스 환경의 복사본만 사용한다.
- 네 가지 server/frontend mapping 쌍, AU, private key, HTTPS `/v1`, server version 1.8.1을 검사한다. URL credential/query/fragment와 redirects는 거절한다.
- 정확한 기존 quantity schema 또는 이미 같은 목표 schema만 허용한다. missing field, 다른 type/required/array/min/default/status/error/max는 fail-closed.
- 적용 순서: version GET → quantity GET → quantity 재확인 GET → **quantity integer PATCH 한 번** → bounded GET polling → available 상태의 목표 schema 전체 검증. 이미 목표이면 noop이며 쓰기가 없다.
- PATCH body는 `{ required: false, min: 1, max: 2147483647, default: null }`뿐이다. key rename, 다른 attribute/resource 접근, 예약 데이터 업데이트는 없다.
- PATCH 후 최대 30회, 1초 간격으로 확인한다. `processing`은 재조회하고 `available`은 전체 목표 schema가 정확할 때만 성공한다. `failed`/`stuck`, 알 수 없는 status, schema drift, network 오류, timeout은 PATCH가 수락된 뒤의 실패임을 구분해 fail closed 한다. polling 중 PATCH를 재전송하지 않는다.
- Appwrite schema CAS가 없어 마지막 GET과 PATCH 사이 경쟁 상태를 완전히 막을 수 없다. 승인 적용은 다른 schema 작업이 없는 유지보수 창에서 실행해야 한다. 다른 필드에 대한 동시 변경을 허용하지 말 것.
- setup의 fresh-create 선언도 같은 기술 상한으로만 수정했다. 전체 setup 스크립트는 운영 migration 수단으로 실행하지 말 것.

## 정확한 명령

실행 완료한 GET-only 명령:

```bash
cd /home/john/workspace/au-cake-hermes
node scripts/migrate-reservation-quantity.mjs --env-file /home/john/workspace/au-cake/.env.local
node scripts/migrate-reservation-quantity.mjs --env-file /home/john/workspace/au-cake/.env.local --dry-run
```

**승인을 받은 운영자가 나중에 실행할 명령 — 이번 감사에서 실행하지 않음:**

```bash
cd /home/john/workspace/au-cake-hermes
node scripts/migrate-reservation-quantity.mjs --env-file /home/john/workspace/au-cake/.env.local --apply
```

적용은 해당 프로젝트의 `collections.write` 권한을 필요로 한다. 현재 키의 쓰기 권한은 GET-only 범위에서 확인하지 않았다. server version이 달라지거나 스키마가 이미 다른 값이면 의도적으로 중단한다. 실제 생산 PATCH 성공을 이번 결과로 주장하지 않는다.

## TDD/검증과 정확한 증거 경로

새 테스트를 먼저 작성하고 planner 부재와 setup max5로 RED를 관측한 후 구현했다. production 대신 테스트 transport에서만 PATCH 분기를 검증했다.

```bash
node --test tests/migrate-reservation-quantity.test.mjs
# GREEN: 12/12 통과
node --test tests/review-schema.test.mjs tests/individual-packaging-schema.test.mjs tests/au-email-schema-migration.test.mjs tests/migrate-reservation-quantity.test.mjs
# 회귀: 아래 최종 검증 결과를 기준으로 확인
```

부모 작업에서 병렬 수정 중인 백엔드/runner의 전체 테스트는 이 하위 작업에서 소유하지 않는다.

마스킹된 실제 실행 로그:

- `/tmp/au-cake-quantity-audit-before.json` — 최초 403 시도 및 mapping 비교 boolean
- `/tmp/au-cake-quantity-audit-before-browser-ua.json` — quantity 실제 200 및 최초 실제 schema
- `/tmp/au-cake-quantity-version.json` — public health/version 실제 1.8.1
- `/tmp/au-cake-quantity-migration-red.log` — 구현 전 RED
- `/tmp/au-cake-quantity-migration-green.log` — 7개 GREEN
- `/tmp/au-cake-quantity-migration-regression.log` — 67개 회귀 통과
- `/tmp/au-cake-quantity-migration-production-dry-run.json` — 실제 CLI GET-only 계획
- `/tmp/au-cake-quantity-audit-after.json` — 종료 후 GET-only 재확인, 여전히 max5

공식 소스 다운로드 원본:

- `/tmp/au-cake-appwrite-1.8.1-integer-update.php`
- `/tmp/au-cake-appwrite-1.8.1-column-integer-update.php`
- `/tmp/au-cake-appwrite-1.8.1-attribute-action.php`

운영 리소스 생성/수정, Function execution, package install, git 명령, env 파일 생성/변경은 수행하지 않았다. 운영 목표 스키마의 사후 값은 아직 없으며 위 표의 목표 열은 오직 계획이다.

## 저장 경계와 rollback — 부모 통합 검증

공식 [Integer/Create.php](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Databases/Http/Databases/Collections/Attributes/Integer/Create.php#L94)는 `max > 2147483647`일 때만 size 8, 그 외에는 size 4로 만든다. Integer/Update.php에는 size 매개변수가 없고 Action.php는 integer 범위 변경에서 size를 확장하지 않는다. 원래 source declaration의 max5로 생성한 컬럼은 따라서 32비트 경로다. 운영 물리 테이블을 직접 조회하거나 ALTER한 것은 아니므로, 실제 물리 폭까지 확인했다고 주장하지 않는다. 기존 컬럼을 보존하는 이번 계획은 안전한 32비트 범위 안에서만 넓힌다.

- 상품 수량 검증 및 cents 계산은 계속 positive safe integer를 사용한다. S'more에 business max를 만들지 않는다.
- `createCake()`의 DB 쓰기 경계에서 **최상위 quantity가 2147483647보다 크면 `QUANTITY_STORAGE_OVERFLOW`**로 거절한다. 예약 쓰기·쿠폰 transaction 시작 전에 거절하며, 저장 가능한 것처럼 응답하거나 1로 바꾸지 않는다. 첫 line 수량을 투영하는 DB 컬럼의 기술적 한계이지 line 가격 정책이 아니다.
- 이 한계를 넘는 수량까지 실제 저장하려면 물리 저장 폭 확장에 대한 별도 승인/설계가 필요하다. max 메타데이터만 safe-integer 최댓값으로 올리는 방식은 승인 대상으로 제안하지 않는다.
- 새 S'more 주문이 존재하면 이전 S'more 미지원 parser로 무조건 rollback하면 안 된다. 신규 접수를 중지하고 S'more 읽기 호환 코드를 보존한 rollback을 사용한다.
- DB max는 확대 상태로 남기는 것이 안전하다. 6개 이상 저장된 레코드가 있는데 max5로 축소하거나 quantity를 1로 덮어쓰지 않는다. 축소/데이터 수정은 별도 승인과 전체 영향 검증이 필요하다.
