# Customer Account Production Preflight Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` inline. Mac Codex 단독. 기존 승인에 따라 중간 승인 없이 로컬 준비를 완료하고 실제 운영 변경 직전에 중단한다.

**Goal:** 운영 metadata/계약 차이를 확인하고 단 한 번의 운영 승인으로 실행할 수 있는 정확한 변경·복구 범위를 준비한다.
**Architecture:** 기존 Owner GET/migration/schema/byte-preserving SMTP operator를 재사용한다. SMTP 상시 유지 확정은 기존 단발 도구를 호출하는 작은 고정-target adapter로 분리해 과거 승인 hash/동작을 보존한다.
**Tech Stack:** Appwrite1.8.1, Node22, Python3, 기존 node:test.
**Spec:** 사용자의 Production Release Final Preflight 요청과 `docs/customer-account-always-on-smtp.md`.

## Constraints

운영 쓰기/Function 실행/배포/메일/Key 발급/main 병합0. 운영 고객·주문 문서는 조회하지 않는다. 기존 PASS 및 Function19/120·Pages31을 재시험/초기화하지 않는다. 역사적 raw 지문 불확실성은 유지한다. 새 프레임워크/새 관리 권한을 만들지 않는다.

## Tasks

- [x] Owner GET으로 `verygood-au` DB/Collection/ACL/Function/플랫폼/Google/변수 metadata를 수집하고 기존 semantic baseline과 비교한다. 보호 원본은 비추적0600, 공개 보고는 설정/집계만 포함한다.
- [x] 기존 `runCustomerAccountMigration`을 GET-only client로 주입해 dry-run한다. 실제 ACL의 기존 관리자 UID를 명시적으로 audit allowlist 후보로 사용하되, 누락된 runtime APPWRITE_ADMIN_USER_IDS 및 숨겨진 REVIEW_ADMIN_USER_IDS 확인 한계를 따로 기록한다. 필드1+인덱스1 외 변경은 승인 범위에 넣지 않는다.
- [x] 실제 AU Renewal routing과 old health 소비자를 소스로 대조하고 배포 도구의 Node16 default/판매 플래그 rewrite를 식별한다. 현재 runtime/options/scopes/flags를 보존하는 운영 계약을 문서로 동결한다.
- [x] `tests/customer-account-system-smtp-production.test.mjs` RED: 승인/manifest 불일치, 불완전 gate, 만료, 확인↔타이머 경합, 미확정 자동 복구, 유지 확정 후 rollback, 잘못된 target/secret 출력 방지를 검증한다.
- [x] `scripts/customer-account-system-smtp-production.py` 구현: 기존 operator의 preflight/prepare/apply/restore 재사용, 480초 독립 timer, root lock 안의 최신 post-apply gate와 유지 확정, 미확정이면 rollback. 독립 root 복구는 Mac heartbeat에 의존하지 않는다. 기존 단발 코드/manifest는 수정하지 않는다.
- [x] 집중 SMTP/부정/byte 복구 테스트 GREEN, Python 문법/secret scan/diff 검증. 기존 전체 제품 인수는 반복하지 않는다.
- [x] 운영 변경 manifest와 정확한 frontend→호환 readers→member writes→auth UI 순서, quota/담당자/즉시 복구/승인 범위를 보고한다. 의미적 지문을 GET으로 재비교하고 문서·로컬 도구만 커밋한다.

## Review focus

동일 DB에 Custom Cake 컬렉션10개가 있는 실제22개 inventory 분류, 누락 admin audit 변수, 배포 시 기존 secret 덮어쓰기 금지, stale Function 변수/배포 순서, 유지 확정과 자동 복구의 lock 경합을 검토한다. Auth UI 활성화에는 독립 운영 승인이 필요하며 현재 enabled OAuth metadata만으로 Google Cloud redirect의 실제 설정을 PASS 처리하지 않는다.
